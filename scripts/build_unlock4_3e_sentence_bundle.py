#!/usr/bin/env python3
import argparse
import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from build_unlock1_3e_sentence_bundle import (
    alignment_tokens,
    asr_word_items,
    asr_words,
    audio_key,
    build_alignment_audit,
    collect_audio,
    extract_sections,
    ffprobe_duration,
    sanitize_asr_word_timings,
    sha1_file,
    split_sentences,
    strip_asr_track_intro,
    track_intro_end_ms,
    transcribe_medium,
)


DEFAULT_SOURCE_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/ULK4-高清/LS 4/4. 配套音频"
DEFAULT_DOCX = f"{DEFAULT_SOURCE_DIR}/Unlock Listening and Speaking 4 audio script.docx"
DEFAULT_OUT_ROOT = "data/transcript-build/unlock4-3e-textbook/B2/unlock4"
PURE_ITEM_NUMBER_RE = re.compile(r"^Narrator:\s*\d+[.:]?$", re.I)


def clean_official_lines(lines):
    output = []
    for raw in lines:
        line = re.sub(r"\[[^]]*]", "", raw)
        line = re.sub(r"\s+", " ", line).strip()
        if not line or PURE_ITEM_NUMBER_RE.fullmatch(line):
            continue
        output.append(line)
    return output


def allocate_official_lines(track_id, sentences, duration_sec, asr_data):
    duration_ms = int(round(duration_sec * 1000))
    words = asr_words(asr_data)
    official = []
    line_token_counts = defaultdict(int)
    def canonical(token):
        return {"okay": "ok"}.get(token, token)

    sentence_tokens = []
    for line_index, text in enumerate(sentences):
        tokens = [canonical(token) for token in alignment_tokens(text)]
        sentence_tokens.append(tokens)
        for token in tokens:
            official.append({"token": token, "lineIndex": line_index})
            line_token_counts[line_index] += 1
    canonical_words = [{**word, "token": canonical(word["token"])} for word in words]
    if not official or not words:
        return [], {
            "matchedTokenRatio": 0,
            "matchedLineRatio": 0,
            "unmatchedLineIndexes": list(range(len(sentences))),
            "lowCoverageLineIndexes": [],
        }

    matcher = SequenceMatcher(
        None,
        [item["token"] for item in official],
        [item["token"] for item in canonical_words],
        autojunk=False,
    )
    matched = defaultdict(list)
    matched_token_count = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            continue
        for official_index, word_index in zip(range(i1, i2), range(j1, j2)):
            matched[official[official_index]["lineIndex"]].append(word_index)
            matched_token_count += 1

    unmatched = [index for index in range(len(sentences)) if not matched.get(index)]
    for line_index in unmatched:
        previous_indexes = [index for key, indexes in matched.items() if key < line_index for index in indexes]
        next_indexes = [index for key, indexes in matched.items() if key > line_index for index in indexes]
        left = max(previous_indexes) + 1 if previous_indexes else 0
        right = min(next_indexes) if next_indexes else len(canonical_words)
        local_tokens = [item["token"] for item in canonical_words[left:right]]
        local_matcher = SequenceMatcher(None, sentence_tokens[line_index], local_tokens, autojunk=False)
        local_indexes = []
        for tag, i1, i2, j1, j2 in local_matcher.get_opcodes():
            if tag == "equal":
                local_indexes.extend(left + index for index in range(j1, j2))
        if local_indexes:
            matched[line_index].extend(local_indexes)

    unmatched = [index for index in range(len(sentences)) if not matched.get(index)]
    low_coverage = [
        index
        for index in range(len(sentences))
        if line_token_counts[index] >= 4
        and len(matched.get(index) or []) / line_token_counts[index] < 0.25
    ]
    anchors = sorted(matched)
    grouped = {index: [(index, sentences[index])] for index in anchors}
    merged_into = {}
    for line_index in unmatched:
        previous = next((index for index in reversed(anchors) if index < line_index), None)
        following = next((index for index in anchors if index > line_index), None)
        anchor = previous if previous is not None else following
        if anchor is None:
            continue
        grouped[anchor].append((line_index, sentences[line_index]))
        merged_into[line_index] = anchor

    lines = []
    previous_end = 0
    for output_index, line_index in enumerate(anchors, 1):
        indexes = matched[line_index]
        members = sorted(grouped[line_index])
        text = " ".join(item[1] for item in members)
        start_ms = canonical_words[min(indexes)]["startMs"]
        end_ms = canonical_words[max(indexes)]["endMs"]
        if members[0][0] < line_index:
            start_ms = canonical_words[0]["startMs"] if not lines else previous_end
        if members[-1][0] > line_index:
            next_anchor = next((index for index in anchors if index > members[-1][0]), None)
            if next_anchor is not None:
                end_ms = max(end_ms, canonical_words[min(matched[next_anchor])]["startMs"])
        start_ms = max(previous_end, start_ms)
        end_ms = min(duration_ms, max(start_ms + 1, end_ms))
        lines.append({
            "lineId": f"{track_id}-line-{output_index}",
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines, {
        "matchedTokenRatio": round(matched_token_count / max(1, len(official)), 4),
        "matchedLineRatio": round(len(matched) / max(1, len(sentences)), 4),
        "unmatchedLineIndexes": [],
        "mergedUnmatchedLineIndexes": unmatched,
        "mergedIntoLineIndexes": merged_into,
        "unmatchedTimingPolicy": "merge_with_adjacent_official_sentence_using_real_asr_word_boundaries",
        "lowCoverageLineIndexes": low_coverage,
    }


def validate_bundle(bundle, asr_by_track):
    empty_tracks = []
    empty_lines = []
    timing_errors = []
    last_end_mismatches = []
    track_label_overlaps = []
    asr_word_track_count = 0
    for track_id, track in bundle.items():
        lines = track.get("lines") or []
        if not lines:
            empty_tracks.append(track_id)
            continue
        if any(not str(line.get("text") or "").strip() for line in lines):
            empty_lines.append(track_id)
        previous_end = 0
        for line in lines:
            if line["startMs"] < previous_end or line["endMs"] <= line["startMs"]:
                timing_errors.append(track_id)
                break
            previous_end = line["endMs"]
        duration_ms = int(round(float(track["durationSec"]) * 1000))
        if lines[-1]["endMs"] != duration_ms:
            last_end_mismatches.append(track_id)
        asr_data = asr_by_track.get(track_id) or {}
        intro_end = track_intro_end_ms(asr_data, track["unit"], track["track"])
        if intro_end and lines[0]["startMs"] < intro_end:
            track_label_overlaps.append(track_id)
        if asr_words(asr_data):
            asr_word_track_count += 1
    return {
        "emptyTrackIds": empty_tracks,
        "emptyLineTrackIds": empty_lines,
        "timingErrorTrackIds": timing_errors,
        "lastEndMismatchTrackIds": last_end_mismatches,
        "trackLabelOverlapIds": track_label_overlaps,
        "asrWordTrackCount": asr_word_track_count,
    }


def main():
    parser = argparse.ArgumentParser(description="Build Unlock 4 Third Edition sentence bundle.")
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--docx", default=DEFAULT_DOCX)
    parser.add_argument("--out-root", default=DEFAULT_OUT_ROOT)
    parser.add_argument("--device", choices=("cpu", "mps"), default="cpu")
    parser.add_argument("--only-track", help="Optional target such as u03-t05.")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    args = parser.parse_args()

    only_key = None
    if args.only_track:
        match = re.fullmatch(r"u(\d{1,2})-t(\d{1,2})", args.only_track, re.I)
        if not match:
            raise ValueError("--only-track must use the form u03-t05")
        only_key = int(match.group(1)), int(match.group(2))

    source_dir = Path(args.source_dir)
    out_root = Path(args.out_root)
    asr_dir = out_root / "asr-medium"
    out_root.mkdir(parents=True, exist_ok=True)
    asr_dir.mkdir(parents=True, exist_ok=True)

    sections = extract_sections(args.docx)
    audio_paths = collect_audio(source_dir)
    if len(audio_paths) != 49 or len(sections) != 49:
        raise ValueError(f"expected 49 tracks, got audio={len(audio_paths)}, script={len(sections)}")
    audio_keys = [audio_key(path) for path in audio_paths]
    if set(audio_keys) != set(sections):
        raise ValueError(
            f"audio/script mismatch: audioOnly={sorted(set(audio_keys) - set(sections))}, "
            f"scriptOnly={sorted(set(sections) - set(audio_keys))}"
        )

    model = None
    device_in_use = args.device
    if not args.skip_asr:
        import whisper
        if device_in_use == "mps":
            import whisper.timing as whisper_timing

            whisper_timing.dtw = lambda value: whisper_timing.dtw_cpu(value.float().cpu().numpy())
            model = whisper.load_model("medium", device="cpu")
            alignment_heads = model._buffers.pop("alignment_heads")
            model.to("mps")
            model.register_buffer("alignment_heads", alignment_heads, persistent=False)
        else:
            model = whisper.load_model("medium", device=device_in_use)

    bundle = {}
    manifest_tracks = []
    asr_by_track = {}
    alignment_asr_by_track = {}
    alignment_details = []
    duplicate_hashes = {}
    for index, audio_path in enumerate(audio_paths, 1):
        unit, track_number = audio_key(audio_path)
        key = unit, track_number
        title = audio_path.stem
        track_id = f"track-unlock4-3e-u{unit:02d}-t{track_number:02d}"
        content_id = f"unlock4-3e-u{unit:02d}-t{track_number:02d}"
        duration_sec = ffprobe_duration(audio_path)
        digest = sha1_file(audio_path)
        duplicate_of = duplicate_hashes.get(digest, "")
        duplicate_hashes.setdefault(digest, audio_path.name)
        cloud_path = f"B2/unlock4 第三版/Audio/{digest[:10]}_{audio_path.name}"
        asr_path = asr_dir / f"{title}.json"
        should_transcribe = not only_key or key == only_key
        if model and should_transcribe and (args.force_asr or not asr_path.exists()):
            result = transcribe_medium(model, audio_path)
            asr_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"asr {index}/{len(audio_paths)}: {audio_path.name}", flush=True)

        asr_data = {}
        removed_invalid_words = 0
        if asr_path.exists():
            asr_data = json.loads(asr_path.read_text(encoding="utf-8"))
            asr_data, removed_invalid_words = sanitize_asr_word_timings(asr_data)
            if removed_invalid_words:
                asr_data["sanitization"] = {
                    "removedInvalidWordCount": removed_invalid_words,
                    "rule": "drop_word_when_end_lte_start_or_start_negative",
                }
                asr_path.write_text(json.dumps(asr_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        asr_by_track[track_id] = asr_data
        alignment_asr = strip_asr_track_intro(asr_data, unit, track_number)
        alignment_asr_by_track[track_id] = alignment_asr
        official_lines = clean_official_lines(sections[key]["lines"])
        sentences = split_sentences(official_lines)
        lines, alignment = allocate_official_lines(track_id, sentences, duration_sec, alignment_asr)
        alignment_details.append({"trackId": track_id, **alignment})

        bundle[track_id] = {
            "trackId": track_id,
            "contentId": content_id,
            "title": title,
            "fileName": audio_path.name,
            "sourcePath": str(audio_path),
            "audioCloudPath": cloud_path,
            "durationSec": duration_sec,
            "unit": unit,
            "track": track_number,
            "syncGranularity": "line",
            "transcriptStatus": "official_text_word_aligned" if lines else "alignment_review_required",
            "sourceType": "unlock_third_edition_ls4_student_book_audio_scripts_docx",
            "asrModel": "medium",
            "timingSource": "whisper_medium_word_timestamps",
            "scriptPatches": [],
            "alignment": alignment,
            "lines": lines,
        }
        manifest_tracks.append({
            "id": content_id,
            "trackId": track_id,
            "title": title,
            "fileName": audio_path.name,
            "sourcePath": str(audio_path),
            "audioCloudPath": cloud_path,
            "durationSec": duration_sec,
            "sha1": digest,
            "unit": unit,
            "track": track_number,
            "lineCount": len(lines),
            "status": "eligible" if lines else "alignment_review_required",
            "sourceHeading": sections[key]["heading"],
            "asrPath": str(asr_path) if asr_path.exists() else "",
            "hasWordTimestamps": bool(asr_words(asr_data)),
            "removedInvalidAsrWordCount": removed_invalid_words,
            "isShortUnder60Sec": duration_sec < 60,
            "duplicateOf": duplicate_of,
        })

    validation = validate_bundle(bundle, asr_by_track)
    if all(track["lines"] for track in bundle.values()):
        alignment_audit = build_alignment_audit(bundle, alignment_asr_by_track)
    else:
        alignment_audit = {
            "reviewTrackIds": [track_id for track_id, track in bundle.items() if not track["lines"]],
            "tracks": [],
        }
    unmatched_tracks = [
        item["trackId"] for item in alignment_details if item["unmatchedLineIndexes"]
    ]
    low_coverage_tracks = [
        item["trackId"] for item in alignment_details if item["lowCoverageLineIndexes"]
    ]
    report = {
        "trackCount": len(bundle),
        "sourceAudioCount": len(audio_paths),
        "expectedTrackCount": 49,
        "durationFilterApplied": False,
        "excludedShortAudioCount": 0,
        "shortUnder60SecCount": sum(item["isShortUnder60Sec"] for item in manifest_tracks),
        "duplicateFileCountIncluded": sum(bool(item["duplicateOf"]) for item in manifest_tracks),
        "asrDevice": device_in_use,
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "officialScriptTrackCount": len(sections),
        "asrDoneCount": sum(bool(item["asrPath"]) for item in manifest_tracks),
        "missingTextCount": sum(not track["lines"] for track in bundle.values()),
        "unmatchedOfficialTrackIds": unmatched_tracks,
        "lowCoverageLineTrackIds": low_coverage_tracks,
        "alignmentReviewTrackIds": alignment_audit["reviewTrackIds"],
        **validation,
    }
    report["readyForUpload"] = (
        len(bundle) == 49
        and validation["asrWordTrackCount"] == 49
        and not validation["emptyTrackIds"]
        and not validation["emptyLineTrackIds"]
        and not validation["timingErrorTrackIds"]
        and not validation["lastEndMismatchTrackIds"]
        and not validation["trackLabelOverlapIds"]
        and not unmatched_tracks
        and not low_coverage_tracks
        and not alignment_audit["reviewTrackIds"]
    )
    report["outputs"] = {
        "bundle": str(out_root / "bundle-draft.json"),
        "manifest": str(out_root / "manifest.json"),
        "report": str(out_root / "clean-report.json"),
        "alignmentAudit": str(out_root / "alignment-audit.json"),
        "alignmentDetails": str(out_root / "alignment-details.json"),
        "sampleCheck": str(out_root / "sample-check.json"),
    }
    manifest = {
        "meta": {
            "level": "B2",
            "series": "unlock4thirdedition",
            "edition": "third",
            "book": "Unlock Listening, Speaking & Critical Thinking 4",
            "module": "textbook",
            "displayTitle": "Unlock 4 听口 第三版",
            "fullImportNoDurationFilter": True,
            "audioDir": str(source_dir),
            "scriptDocx": str(Path(args.docx)),
            "cloudAudioRoot": "B2/unlock4 第三版/Audio",
            "transcriptCloudPath": "_transcripts/B2/unlock4-third-edition/bundle-wordaligned-v1.json",
            "audioCount": len(manifest_tracks),
            "eligibleCount": sum(item["status"] == "eligible" for item in manifest_tracks),
            "excludedShortAudioCount": 0,
            "asrModel": "medium",
            "asrDevice": device_in_use,
        },
        "tracks": manifest_tracks,
    }
    sample_checks = []
    for track_id, track in bundle.items():
        lines = track["lines"]
        sample_checks.append({
            "trackId": track_id,
            "fileName": track["fileName"],
            "first": lines[0] if lines else None,
            "middle": lines[len(lines) // 2] if lines else None,
            "last": lines[-1] if lines else None,
            "alignment": track["alignment"],
        })

    for name, data in (
        ("bundle-draft.json", bundle),
        ("manifest.json", manifest),
        ("clean-report.json", report),
        ("alignment-audit.json", alignment_audit),
        ("alignment-details.json", alignment_details),
        ("sample-check.json", sample_checks),
    ):
        (out_root / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
