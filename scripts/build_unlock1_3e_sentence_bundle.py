#!/usr/bin/env python3
import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

from build_unlock1_workbook_sentence_bundle import (
    alignment_tokens,
    allocate_lines_word_aligned,
    asr_words,
    clean_alignment_word,
    ffprobe_duration,
    read_docx_paragraphs,
    sha1_file,
    split_sentences,
    transcribe_medium,
)


DEFAULT_SOURCE_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/ULK1-高清/LS 1/4. 配套音频"
DEFAULT_DOCX = f"{DEFAULT_SOURCE_DIR}/1. LS1 听力文本.docx"
DEFAULT_OUT_ROOT = "data/transcript-build/unlock1-3e-textbook/A1/unlock1"
HEADING_RE = re.compile(
    r"^Student's Book; Unit (\d+); Page\s*(\d+);.*?Track\s+(\d+)\.(\d+)$"
)
INTRO_RE = re.compile(r"^Narrator:\s*(?:Unit\s+\d+\s*,\s*)?\d+\.\d+$", re.I)
FOOTER_RE = re.compile(r"(?:Cambridge University Press|www\.cambridge\.org)", re.I)


def parse_heading(text):
    match = HEADING_RE.match(text)
    if not match:
        return None
    unit = int(match.group(1))
    heading_unit = int(match.group(3))
    track = int(match.group(4))
    if unit != heading_unit or not 1 <= unit <= 8 or not 1 <= track <= 9:
        return None
    return unit, track


def extract_sections(docx_path):
    paragraphs = [text for text in read_docx_paragraphs(docx_path) if text]
    first_content = next(
        index
        for index, text in enumerate(paragraphs)
        if parse_heading(text) == (1, 1)
    )
    headings = []
    for index, text in enumerate(paragraphs[first_content:], first_content):
        key = parse_heading(text)
        if key:
            headings.append((index, key, text))

    sections = {}
    for position, (start, key, heading) in enumerate(headings):
        end = headings[position + 1][0] if position + 1 < len(headings) else len(paragraphs)
        lines = []
        for raw in paragraphs[start + 1 : end]:
            line = re.sub(r"\s+", " ", raw).strip()
            if not line or INTRO_RE.fullmatch(line) or FOOTER_RE.search(line):
                continue
            if line in {"Unlock Third Edition", "Student's Book Audio scripts"}:
                continue
            lines.append(line)
        if key in sections:
            raise ValueError(f"duplicate official script heading: {key}")
        sections[key] = {"heading": heading, "lines": lines}
    return sections


def audio_key(path):
    unit_match = re.fullmatch(r"unit\s+(\d+)", path.parent.name, re.I)
    track_match = re.search(r"_t(\d+)$", path.stem, re.I)
    if not unit_match or not track_match:
        raise ValueError(f"cannot parse audio track: {path}")
    return int(unit_match.group(1)), int(track_match.group(1))


def collect_audio(source_dir):
    audio_paths = list(Path(source_dir).glob("unit */*.mp3"))
    return sorted(audio_paths, key=audio_key)


def asr_word_items(asr_data):
    return [
        word
        for segment in asr_data.get("segments") or []
        for word in segment.get("words") or []
    ]


def sanitize_asr_word_timings(asr_data):
    output = dict(asr_data)
    segments = []
    removed_count = 0
    for segment in asr_data.get("segments") or []:
        item = dict(segment)
        valid_words = []
        for word in segment.get("words") or []:
            try:
                start = float(word.get("start"))
                end = float(word.get("end"))
            except (TypeError, ValueError):
                removed_count += 1
                continue
            if start < 0 or end <= start:
                removed_count += 1
                continue
            valid_words.append(word)
        if valid_words:
            item["words"] = valid_words
        else:
            item.pop("words", None)
        segments.append(item)
    output["segments"] = segments
    return output, removed_count


def leading_track_intro_word_count(asr_data, unit, track):
    words = asr_word_items(asr_data)
    if not words:
        return 0
    first = re.sub(r"[^a-z]", "", str(words[0].get("word") or "").lower())
    expected = [unit, unit, track] if first == "unit" else [unit, track]
    start = 1 if first in {"unit", "track"} else 0
    numbers = []
    for index in range(start, min(len(words), start + 6)):
        numbers.extend(int(value) for value in re.findall(r"\d+", str(words[index].get("word") or "")))
        if numbers == expected:
            return index + 1
        if numbers != expected[: len(numbers)]:
            return 0
    return 0


def strip_asr_track_intro(asr_data, unit, track):
    words = asr_word_items(asr_data)
    count = leading_track_intro_word_count(asr_data, unit, track)
    if not count:
        return asr_data
    return {"segments": [{"words": words[count:]}]}


def normalize_alignment_asr(asr_data, unit, track):
    if (unit, track) != (8, 2):
        return asr_data
    source_words = asr_word_items(asr_data)
    words = []
    index = 0
    while index < len(source_words):
        item = dict(source_words[index])
        if float(item.get("end") or 0) - float(item.get("start") or 0) < 0.08:
            index += 1
            continue
        value = re.sub(r"\s+", "", str(item.get("word") or ""))
        if index + 1 < len(source_words) and re.fullmatch(r"\d{2}", value):
            next_item = source_words[index + 1]
            next_value = re.sub(r"\s+", "", str(next_item.get("word") or ""))
            if re.fullmatch(r"[.]\d{2}", next_value):
                item["word"] = value + next_value[1:]
                item["end"] = next_item.get("end")
                index += 1
        words.append(item)
        index += 1
    return {"segments": [{"words": words}]}


def track_intro_end_ms(asr_data, unit, track):
    words = asr_word_items(asr_data)
    count = leading_track_intro_word_count(asr_data, unit, track)
    if not count:
        return 0
    return int(round(float(words[count - 1].get("end") or 0) * 1000))


def transcribe_medium_chunked(model, audio_path, duration_sec):
    import whisper

    audio = whisper.load_audio(str(audio_path))
    sample_rate = whisper.audio.SAMPLE_RATE
    window_sec = 30.0
    step_sec = 28.0
    start_sec = 2.0
    chunks = []
    while start_sec < duration_sec:
        end_sec = min(duration_sec, start_sec + window_sec)
        chunks.append((start_sec, end_sec))
        start_sec += step_sec

    segments = []
    all_words = []
    for index, (start_sec, end_sec) in enumerate(chunks):
        first_sample = int(round(start_sec * sample_rate))
        last_sample = int(round(end_sec * sample_rate))
        result = model.transcribe(
            audio[first_sample:last_sample],
            language="en",
            fp16=False,
            verbose=False,
            word_timestamps=True,
            condition_on_previous_text=False,
        )
        keep_start = start_sec if index == 0 else start_sec + 1.0
        keep_end = end_sec if index == len(chunks) - 1 else end_sec - 1.0
        words = []
        for segment in result.get("segments") or []:
            for word in segment.get("words") or []:
                absolute_start = start_sec + float(word.get("start") or 0)
                absolute_end = start_sec + float(word.get("end") or 0)
                center = (absolute_start + absolute_end) / 2
                if center < keep_start or center >= keep_end:
                    continue
                value = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
                if not value:
                    continue
                words.append({"word": value, "start": absolute_start, "end": absolute_end})
        if not words:
            continue
        all_words.extend(words)
        segments.append({
            "index": len(segments) + 1,
            "startMs": int(round(words[0]["start"] * 1000)),
            "endMs": int(round(words[-1]["end"] * 1000)),
            "text": " ".join(word["word"] for word in words),
            "words": words,
        })
    return {
        "model": "medium",
        "language": "en",
        "text": " ".join(word["word"] for word in all_words),
        "segments": segments,
        "strategy": "overlapping_30s_chunks_condition_off",
        "chunkStartsSec": [start for start, _ in chunks],
    }


def validate_bundle(bundle, asr_by_track):
    empty_tracks = []
    empty_lines = []
    timing_errors = []
    last_end_mismatches = []
    track_label_overlaps = []
    asr_word_track_count = 0
    for track_id, track in bundle.items():
        lines = track["lines"]
        if not lines:
            empty_tracks.append(track_id)
            continue
        if any(not str(line.get("text") or "").strip() for line in lines):
            empty_lines.append(track_id)
        previous_end = 0
        for line in lines:
            start_ms = int(line["startMs"])
            end_ms = int(line["endMs"])
            if start_ms < previous_end or end_ms <= start_ms:
                timing_errors.append(track_id)
                break
            previous_end = end_ms
        duration_ms = int(round(float(track["durationSec"]) * 1000))
        if int(lines[-1]["endMs"]) != duration_ms:
            last_end_mismatches.append(track_id)
        asr_data = asr_by_track.get(track_id) or {}
        intro_end_ms = track_intro_end_ms(asr_data, track["unit"], track["track"])
        if intro_end_ms and int(lines[0]["startMs"]) < intro_end_ms:
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


def build_alignment_audit(bundle, alignment_asr_by_track):
    tracks = []
    review_track_ids = []
    for track_id, track in bundle.items():
        official_tokens = [
            token
            for line in track["lines"]
            for token in alignment_tokens(line["text"])
        ]
        asr_tokens = []
        for word in asr_word_items(alignment_asr_by_track.get(track_id) or {}):
            token = clean_alignment_word(str(word.get("word") or ""))
            if token:
                asr_tokens.append(token)
        matcher = SequenceMatcher(None, official_tokens, asr_tokens, autojunk=False)
        equal_count = sum(block.size for block in matcher.get_matching_blocks())
        official_coverage = equal_count / max(1, len(official_tokens))
        asr_coverage = equal_count / max(1, len(asr_tokens))
        needs_review = not asr_tokens or (official_coverage < 0.60 and asr_coverage < 0.60)
        if needs_review:
            review_track_ids.append(track_id)
        lines = track["lines"]
        middle = lines[len(lines) // 2]
        tracks.append({
            "trackId": track_id,
            "officialTokenCoverage": round(official_coverage, 4),
            "asrTokenCoverage": round(asr_coverage, 4),
            "officialTokenCount": len(official_tokens),
            "asrTokenCount": len(asr_tokens),
            "status": "review" if needs_review else "pass",
            "first": {
                "text": lines[0]["text"],
                "startMs": lines[0]["startMs"],
                "endMs": lines[0]["endMs"],
            },
            "middle": {
                "text": middle["text"],
                "startMs": middle["startMs"],
                "endMs": middle["endMs"],
            },
            "last": {
                "text": lines[-1]["text"],
                "startMs": lines[-1]["startMs"],
                "endMs": lines[-1]["endMs"],
            },
            "asrHeadTokens": asr_tokens[:12],
            "asrTailTokens": asr_tokens[-12:],
        })
    return {"reviewTrackIds": review_track_ids, "tracks": tracks}


def main():
    parser = argparse.ArgumentParser(
        description="Build local Unlock 1 Third Edition Student's Book sentence-level bundle."
    )
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--docx", default=DEFAULT_DOCX)
    parser.add_argument("--out-root", default=DEFAULT_OUT_ROOT)
    parser.add_argument("--min-duration-sec", type=float, default=0.0)
    parser.add_argument("--device", choices=("cpu", "mps"), default="cpu")
    parser.add_argument("--only-track", help="Optional target such as u03-t05 for a focused ASR rerun.")
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
    previous_removed_counts = {}
    previous_manifest_path = out_root / "manifest.json"
    if previous_manifest_path.exists():
        try:
            previous_manifest = json.loads(previous_manifest_path.read_text(encoding="utf-8"))
            previous_removed_counts = {
                item["trackId"]: int(item.get("removedInvalidAsrWordCount") or 0)
                for item in previous_manifest.get("tracks") or []
            }
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            previous_removed_counts = {}

    sections = extract_sections(args.docx)
    audio_paths = collect_audio(source_dir)
    if len(audio_paths) != 66 or len(sections) != 66:
        raise ValueError(f"expected 66 tracks, got audio={len(audio_paths)}, script={len(sections)}")
    audio_keys = [audio_key(path) for path in audio_paths]
    if set(audio_keys) != set(sections):
        raise ValueError(
            f"audio/script mismatch: audioOnly={sorted(set(audio_keys) - set(sections))}, "
            f"scriptOnly={sorted(set(sections) - set(audio_keys))}"
        )

    source_records = []
    for audio_path in audio_paths:
        source_records.append({
            "path": audio_path,
            "key": audio_key(audio_path),
            "durationSec": ffprobe_duration(audio_path),
            "sha1": sha1_file(audio_path),
        })
    eligible_count = sum(
        1 for item in source_records if item["durationSec"] >= args.min_duration_sec
    )

    model = None
    device_in_use = args.device
    if not args.skip_asr:
        import whisper

        try:
            model = whisper.load_model("medium", device=device_in_use)
        except (NotImplementedError, RuntimeError) as error:
            if device_in_use != "mps":
                raise
            print(f"mps load fallback to cpu: {error}", flush=True)
            device_in_use = "cpu"
            model = whisper.load_model("medium", device=device_in_use)

    bundle = {}
    manifest_tracks = []
    asr_by_track = {}
    alignment_asr_by_track = {}
    asr_index = 0
    for item in source_records:
        audio_path = item["path"]
        unit, track_number = item["key"]
        key = (unit, track_number)
        title = audio_path.stem
        track_id = f"track-unlock1-3e-u{unit:02d}-t{track_number:02d}"
        content_id = f"unlock1-3e-u{unit:02d}-t{track_number:02d}"
        duration_sec = item["durationSec"]
        digest = item["sha1"]
        asr_path = asr_dir / f"{title}.json"
        cloud_path = f"A1/unlock1 第三版/Audio/{digest[:10]}_{audio_path.name}"
        if duration_sec < args.min_duration_sec:
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
                "lineCount": 0,
                "status": "excluded_short_audio",
                "sourceHeading": sections[key]["heading"],
                "asrPath": "",
                "hasWordTimestamps": False,
                "removedInvalidAsrWordCount": 0,
            })
            continue
        asr_index += 1
        should_transcribe = not only_key or key == only_key
        asr_was_transcribed = False
        if model and should_transcribe and (args.force_asr or not asr_path.exists()):
            try:
                if key == (3, 5):
                    asr_result = transcribe_medium_chunked(model, audio_path, duration_sec)
                else:
                    asr_result = transcribe_medium(model, audio_path)
            except (NotImplementedError, RuntimeError) as error:
                if device_in_use != "mps":
                    raise
                print(f"mps fallback to cpu: {error}", flush=True)
                del model
                import torch
                import whisper

                torch.mps.empty_cache()
                device_in_use = "cpu"
                model = whisper.load_model("medium", device=device_in_use)
                asr_result = transcribe_medium(model, audio_path)
            asr_path.write_text(
                json.dumps(asr_result, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            asr_was_transcribed = True
            print(f"asr {asr_index}/{eligible_count}: {audio_path.name}", flush=True)

        asr_data = {}
        removed_invalid_asr_words = 0
        if asr_path.exists():
            asr_data = json.loads(asr_path.read_text(encoding="utf-8"))
            existing_sanitized_count = int(
                (asr_data.get("sanitization") or {}).get("removedInvalidWordCount") or 0
            )
            asr_data, removed_now = sanitize_asr_word_timings(asr_data)
            previous_count = 0 if asr_was_transcribed else max(
                existing_sanitized_count,
                previous_removed_counts.get(track_id, 0),
            )
            removed_invalid_asr_words = previous_count + removed_now
            if removed_invalid_asr_words:
                asr_data["sanitization"] = {
                    "removedInvalidWordCount": removed_invalid_asr_words,
                    "rule": "drop_word_when_end_lte_start_or_start_negative",
                }
            if removed_now or removed_invalid_asr_words > existing_sanitized_count:
                asr_path.write_text(
                    json.dumps(asr_data, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
        asr_by_track[track_id] = asr_data
        has_word_timing = bool(asr_words(asr_data))
        sentences = split_sentences(sections[key]["lines"])
        alignment_asr = strip_asr_track_intro(asr_data, unit, track_number)
        alignment_asr = normalize_alignment_asr(alignment_asr, unit, track_number)
        alignment_asr_by_track[track_id] = alignment_asr
        lines = allocate_lines_word_aligned(track_id, sentences, duration_sec, alignment_asr)
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
            "transcriptStatus": (
                "official_text_word_aligned" if has_word_timing else "official_text_timing_pending_asr"
            ),
            "sourceType": "unlock_third_edition_ls1_student_book_audio_scripts_docx",
            "asrModel": "medium",
            "asrStrategy": (
                "overlapping_30s_chunks_condition_off" if key == (3, 5) else "full_track"
            ),
            "timingSource": (
                "whisper_medium_word_alignment" if has_word_timing else "pending_asr_not_for_upload"
            ),
            "scriptPatches": [],
            "lines": lines,
        }
        manifest_tracks.append({
            "id": content_id,
            "trackId": track_id,
            "title": title,
            "fileName": audio_path.name,
            "sourcePath": str(audio_path),
            "audioCloudPath": bundle[track_id]["audioCloudPath"],
            "durationSec": duration_sec,
            "sha1": digest,
            "unit": unit,
            "track": track_number,
            "lineCount": len(lines),
            "status": "eligible" if sentences else "rejected_missing_official_text",
            "sourceHeading": sections[key]["heading"],
            "asrPath": str(asr_path) if asr_path.exists() else "",
            "hasWordTimestamps": has_word_timing,
            "removedInvalidAsrWordCount": removed_invalid_asr_words,
        })

    validation = validate_bundle(bundle, asr_by_track)
    alignment_audit = build_alignment_audit(bundle, alignment_asr_by_track)
    report = {
        "trackCount": len(bundle),
        "sourceAudioCount": len(source_records),
        "expectedTrackCount": eligible_count,
        "excludedShortAudioCount": len(source_records) - eligible_count,
        "minDurationSec": args.min_duration_sec,
        "asrDevice": device_in_use,
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "officialScriptTrackCount": len(sections),
        "asrDoneCount": sum(
            1 for item in manifest_tracks if item["status"] == "eligible" and item["asrPath"]
        ),
        "removedInvalidAsrWordCount": sum(
            item["removedInvalidAsrWordCount"] for item in manifest_tracks
        ),
        "missingTextCount": sum(1 for track in bundle.values() if not track["lines"]),
        "alignmentReviewTrackIds": alignment_audit["reviewTrackIds"],
        "chunkedAsrTrackIds": ["track-unlock1-3e-u03-t05"],
        **validation,
        "readyForUpload": (
            len(bundle) == eligible_count
            and validation["asrWordTrackCount"] == eligible_count
            and not validation["emptyTrackIds"]
            and not validation["emptyLineTrackIds"]
            and not validation["timingErrorTrackIds"]
            and not validation["lastEndMismatchTrackIds"]
            and not validation["trackLabelOverlapIds"]
            and not alignment_audit["reviewTrackIds"]
        ),
        "outputs": {
            "bundle": str(out_root / "bundle-draft.json"),
            "manifest": str(out_root / "manifest.json"),
            "report": str(out_root / "clean-report.json"),
            "alignmentAudit": str(out_root / "alignment-audit.json"),
        },
    }
    manifest = {
        "meta": {
            "level": "A1",
            "series": "unlock1",
            "edition": "third",
            "book": "Unlock Listening, Speaking & Critical Thinking 1",
            "module": "textbook",
            "fullImportNoDurationFilter": True,
            "audioDir": str(source_dir),
            "scriptDocx": str(Path(args.docx)),
            "cloudAudioRoot": "A1/unlock1 第三版/Audio",
            "transcriptCloudPath": "_transcripts/A1/unlock1-third-edition/bundle-wordaligned-v1.json",
            "cloudBackup": "data/transcript-build/unlock1-3e-textbook/A1/unlock1/cloud-backup/unlock1-bundle-before-3e-upload-20260710.json",
            "audioCount": len(manifest_tracks),
            "eligibleCount": sum(1 for item in manifest_tracks if item["status"] == "eligible"),
            "excludedShortAudioCount": sum(
                1 for item in manifest_tracks if item["status"] == "excluded_short_audio"
            ),
            "minDurationSec": args.min_duration_sec,
            "asrModel": "medium",
            "asrDevice": device_in_use,
        },
        "tracks": manifest_tracks,
    }

    (out_root / "bundle-draft.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (out_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (out_root / "clean-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (out_root / "alignment-audit.json").write_text(
        json.dumps(alignment_audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
