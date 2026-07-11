#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path


DEFAULT_AUDIO_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/ULK3-高清/LS 3/5. 配套音频"
DEFAULT_OUT_ROOT = "data/transcript-build/unlock3-3e-textbook/B1/unlock3"
AUDIO_RE = re.compile(r"_U(\d+).*_t(\d+)$", re.I)
SENTENCE_END_RE = re.compile(r"[.!?][\"'’”)]*$")
ABBREVIATIONS = {"dr.", "mr.", "mrs.", "ms.", "prof.", "st.", "vs.", "e.g.", "i.e."}
TRACK_LABEL_RE = re.compile(
    r"^(?:(?:unit|track)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine)"
    r"(?:\s*[,.:;-]?\s*)?){1,3}$",
    re.I,
)


def run(command):
    return subprocess.run(command, check=True, text=True, capture_output=True).stdout.strip()


def duration_sec(path):
    return float(
        run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1", str(path),
        ])
    )


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def audio_key(path):
    match = AUDIO_RE.search(path.stem)
    if not match:
        raise ValueError(f"cannot parse unit/track: {path}")
    return int(match.group(1)), int(match.group(2)), path.name.lower()


def transcribe(model, audio_path, model_name):
    result = model.transcribe(
        str(audio_path), language="en", fp16=False, verbose=None, word_timestamps=True
    )
    segments = []
    for index, item in enumerate(result.get("segments") or [], 1):
        words = []
        for word in item.get("words") or []:
            value = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
            if not value or word.get("start") is None or word.get("end") is None:
                continue
            words.append({
                "word": value,
                "start": float(word["start"]),
                "end": float(word["end"]),
            })
        text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()
        if text:
            segments.append({
                "index": index,
                "startMs": int(round(float(item.get("start") or 0) * 1000)),
                "endMs": int(round(float(item.get("end") or 0) * 1000)),
                "text": text,
                "words": words,
            })
    return {
        "model": model_name,
        "language": result.get("language") or "en",
        "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
        "segments": segments,
    }


def flatten_words(asr):
    words = []
    for segment in asr.get("segments") or []:
        for item in segment.get("words") or []:
            if item.get("start") is None or item.get("end") is None:
                continue
            words.append({
                "word": str(item.get("word") or "").strip(),
                "startMs": int(round(float(item["start"]) * 1000)),
                "endMs": int(round(float(item["end"]) * 1000)),
            })
    return [item for item in words if item["word"]]


def strip_track_label_words(words):
    words = list(words)
    remove_count = 0
    if len(words) >= 2 and words[0]["word"].lower().rstrip(".,:") == "unit":
        remove_count = 2
    if len(words) >= remove_count + 2:
        first = re.sub(r"[^0-9]", "", words[remove_count]["word"])
        second = words[remove_count + 1]["word"].strip()
        if first and re.fullmatch(r"\.\d+[.]?", second):
            remove_count += 2
    return words[remove_count:], words[:remove_count]


def is_sentence_end(current):
    word = current[-1]["word"].strip()
    if not SENTENCE_END_RE.search(word):
        return False
    if word.lower() in ABBREVIATIONS:
        return False
    text = " ".join(item["word"] for item in current).strip()
    if re.fullmatch(r"\d+[.]", text):
        return False
    return True


def word_sentences(asr):
    words, stripped = strip_track_label_words(flatten_words(asr))
    groups = []
    current = []
    for item in words:
        current.append(item)
        if is_sentence_end(current):
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    output = []
    for group in groups:
        text = " ".join(item["word"] for item in group)
        text = re.sub(r"\s+([,.;:!?])", r"\1", text)
        text = re.sub(r"\s+", " ", text).strip()
        output.append({
            "text": text,
            "startMs": group[0]["startMs"],
            "endMs": group[-1]["endMs"],
        })

    return output, stripped


def segment_sentences(asr):
    output = []
    for segment in asr.get("segments") or []:
        text = re.sub(r"\s+", " ", str(segment.get("text") or "")).strip()
        if not text or TRACK_LABEL_RE.fullmatch(text):
            continue
        output.append({
            "text": text,
            "startMs": int(segment["startMs"]),
            "endMs": int(segment["endMs"]),
        })
    return output


def make_lines(track_id, asr, duration_ms):
    if flatten_words(asr):
        raw, stripped = word_sentences(asr)
    else:
        raw, stripped = segment_sentences(asr), []
    lines = []
    previous_end = 0
    for item in raw:
        start_ms = max(previous_end, min(duration_ms - 1, int(item["startMs"])))
        end_ms = max(start_ms + 1, min(duration_ms, int(item["endMs"])))
        lines.append({
            "lineId": f"{track_id}-line-{len(lines) + 1}",
            "text": item["text"],
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines, stripped


def validate(bundle):
    empty = []
    timing = []
    last_end = []
    label_first = []
    for track_id, track in bundle.items():
        lines = track["lines"]
        if not lines:
            empty.append(track_id)
            continue
        previous_end = 0
        for line in lines:
            if line["startMs"] < previous_end or line["endMs"] <= line["startMs"]:
                timing.append(track_id)
                break
            previous_end = line["endMs"]
        if lines[-1]["endMs"] != int(round(track["durationSec"] * 1000)):
            last_end.append(track_id)
        if TRACK_LABEL_RE.fullmatch(lines[0]["text"].strip()):
            label_first.append(track_id)
    return {
        "emptyTrackIds": empty,
        "timingErrorTrackIds": timing,
        "lastEndMismatchTrackIds": last_end,
        "trackLabelFirstLineIds": label_first,
    }


def main():
    parser = argparse.ArgumentParser(description="Build Unlock 3 Third Edition local sentence bundle.")
    parser.add_argument("--audio-dir", default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--out-root", default=DEFAULT_OUT_ROOT)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--min-duration-sec", type=float, default=0.0)
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--units", default="", help="Comma-separated units to transcribe; bundle remains full.")
    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    out_root = Path(args.out_root)
    asr_dir = out_root / f"asr-{args.model}"
    out_root.mkdir(parents=True, exist_ok=True)
    asr_dir.mkdir(parents=True, exist_ok=True)

    audio_paths = sorted(audio_dir.glob("unit */*.mp3"), key=audio_key)
    seen_hashes = {}
    records = []
    for path in audio_paths:
        source_unit, track_number, _ = audio_key(path)
        unit = source_unit
        metadata_patches = []
        if re.search(r"_U08_p158_.*_t07$", path.stem, re.I):
            unit = 7
            metadata_patches.append({
                "field": "unit",
                "oldValue": 8,
                "newValue": 7,
                "source": "audio_spoken_label_7.7_and_page_158",
            })
        seconds = duration_sec(path)
        digest = sha1_file(path)
        duplicate_of = seen_hashes.get(digest, "")
        if not duplicate_of:
            seen_hashes[digest] = path.name
        status = "eligible"
        records.append({
            "sourcePath": str(path), "fileName": path.name, "title": path.stem,
            "durationSec": seconds, "sha1": digest, "unit": unit, "sourceUnit": source_unit,
            "track": track_number, "metadataPatches": metadata_patches,
            "status": status, "duplicateOf": duplicate_of,
        })

    eligible = records
    selected_units = {
        int(value) for value in args.units.split(",") if value.strip()
    }
    transcribe_items = [
        item for item in eligible if not selected_units or item["unit"] in selected_units
    ]
    model = None
    if not args.skip_asr:
        import whisper
        model = whisper.load_model(args.model)

    processed = 0
    asr_by_sha1 = {}
    for index, item in enumerate(transcribe_items, 1):
        asr_path = asr_dir / f"{item['title']}.json"
        item["asrPath"] = str(asr_path) if asr_path.exists() else ""
        reused_path = asr_by_sha1.get(item["sha1"])
        if not asr_path.exists() and reused_path and reused_path.exists():
            asr_path.write_text(reused_path.read_text(encoding="utf-8"), encoding="utf-8")
            item["asrPath"] = str(asr_path)
            item["asrReusedFrom"] = reused_path.name
        if model and (args.force_asr or not asr_path.exists()):
            if args.limit and processed >= args.limit:
                continue
            data = transcribe(model, Path(item["sourcePath"]), args.model)
            asr_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            item["asrPath"] = str(asr_path)
            processed += 1
            print(f"asr {index}/{len(transcribe_items)}: {item['fileName']}", flush=True)
        if asr_path.exists():
            asr_by_sha1[item["sha1"]] = asr_path

    bundle = {}
    missing_asr = []
    for item in eligible:
        asr_path = asr_dir / f"{item['title']}.json"
        if not asr_path.exists():
            missing_asr.append(item["fileName"])
            continue
        asr = json.loads(asr_path.read_text(encoding="utf-8"))
        unit = item["unit"]
        track_number = item["track"]
        digest = item["sha1"]
        file_key = hashlib.sha1(item["fileName"].encode("utf-8")).hexdigest()[:8]
        track_id = f"track-unlock3-3e-u{unit:02d}-t{track_number:02d}-{file_key}"
        content_id = f"unlock3-3e-u{unit:02d}-t{track_number:02d}-{file_key}"
        cloud_path = f"B1/unlock3 第三版/Audio/{digest[:10]}_{item['fileName']}"
        duration_ms = int(round(item["durationSec"] * 1000))
        lines, stripped_label_words = make_lines(track_id, asr, duration_ms)
        bundle[track_id] = {
            "trackId": track_id,
            "contentId": content_id,
            "title": item["title"],
            "fileName": item["fileName"],
            "sourcePath": item["sourcePath"],
            "audioCloudPath": cloud_path,
            "durationSec": item["durationSec"],
            "unit": unit,
            "track": track_number,
            "syncGranularity": "line",
            "transcriptStatus": (
                "asr_sentence_draft_official_text_pending"
                if lines else "label_only_no_transcript_content"
            ),
            "sourceType": "unlock_third_edition_ls3_audio_asr",
            "asrModel": args.model,
            "timingSource": f"whisper_{args.model}_word_timestamps",
            "scriptPatches": item["metadataPatches"],
            "strippedTrackLabel": " ".join(word["word"] for word in stripped_label_words),
            "lines": lines,
        }
        item["lineCount"] = len(lines)
        item["hasWordTimestamps"] = bool(flatten_words(asr))
        item["strippedTrackLabel"] = bundle[track_id]["strippedTrackLabel"]
        item.update({
            "id": content_id,
            "level": "B1",
            "series": "unlock3thirdedition",
            "book": "Unlock 3 Third Edition",
            "normalizedFileName": item["fileName"],
            "cloudPath": cloud_path,
            "kind": "class_audio",
            "transcriptTrackId": track_id,
        })

    checks = validate(bundle)
    label_only_track_ids = [
        track_id for track_id, track in bundle.items()
        if not track["lines"] and track.get("strippedTrackLabel")
    ]
    non_label_empty_ids = [
        track_id for track_id in checks["emptyTrackIds"] if track_id not in label_only_track_ids
    ]
    sample_checks = []
    for track_id, track in bundle.items():
        lines = track["lines"]
        sample_checks.append({
            "trackId": track_id,
            "fileName": track["fileName"],
            "strippedTrackLabel": track["strippedTrackLabel"],
            "first": lines[0] if lines else None,
            "middle": lines[len(lines) // 2] if lines else None,
            "last": lines[-1] if lines else None,
            "status": track["transcriptStatus"],
        })
    report = {
        "trackCount": len(bundle),
        "sourceAudioCount": len(records),
        "durationFilterApplied": False,
        "eligibleTrackCount": len(eligible),
        "excludedShortCount": 0,
        "duplicateFileCountIncluded": sum(bool(item["duplicateOf"]) for item in records),
        "metadataPatchCount": sum(len(item["metadataPatches"]) for item in records),
        "metadataPatches": [
            {"fileName": item["fileName"], "patches": item["metadataPatches"]}
            for item in records if item["metadataPatches"]
        ],
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "asrDoneCount": len(bundle),
        "missingAsrCount": len(missing_asr),
        "missingAsrFiles": missing_asr,
        "officialTextStatus": "missing_official_audio_scripts_asr_candidate_only",
        "labelOnlyTrackCount": len(label_only_track_ids),
        "labelOnlyTrackIds": label_only_track_ids,
        "nonLabelEmptyTrackIds": non_label_empty_ids,
        **checks,
        "readyForLocalReview": (
            len(bundle) == len(eligible)
            and not non_label_empty_ids
            and not checks["timingErrorTrackIds"]
            and not checks["lastEndMismatchTrackIds"]
            and not checks["trackLabelFirstLineIds"]
        ),
        "readyForUpload": (
            len(bundle) == len(eligible)
            and not non_label_empty_ids
            and not checks["timingErrorTrackIds"]
            and not checks["lastEndMismatchTrackIds"]
            and not checks["trackLabelFirstLineIds"]
        ),
        "uploadPolicy": "new_third_edition_paths_asr_candidate_user_approved",
        "processedThisRun": processed,
        "outputs": {
            "bundle": str(out_root / "bundle-draft.json"),
            "manifest": str(out_root / "manifest.json"),
            "sampleCheck": str(out_root / "sample-check.json"),
            "rejectedTracks": str(out_root / "rejected-tracks.json"),
        },
    }
    manifest = {
        "meta": {
            "level": "B1", "series": "unlock3thirdedition", "edition": "third",
            "book": "Unlock Listening, Speaking & Critical Thinking 3", "module": "textbook",
            "displayTitle": "Unlock3 听口 第三版",
            "cloudAudioRoot": "B1/unlock3 第三版/Audio",
            "transcriptCloudPath": "_transcripts/B1/unlock3-third-edition/bundle-wordaligned-v1.json",
            "audioDir": str(audio_dir), "audioCount": len(records),
            "eligibleCount": len(records), "fullImportNoDurationFilter": True,
            "duplicateCount": sum(bool(item["duplicateOf"]) for item in records),
            "minDurationSec": args.min_duration_sec, "asrModel": args.model,
            "cloudBackup": str(out_root / "cloud-backup/bundle-before-clean.json"),
        },
        "tracks": records,
    }
    (out_root / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "sample-check.json").write_text(
        json.dumps(sample_checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (out_root / "rejected-tracks.json").write_text(
        json.dumps([
            {
                "trackId": track_id,
                "fileName": bundle[track_id]["fileName"],
                "reason": "audio_contains_track_label_only_no_transcript_content",
                "keptInFullLocalBundle": True,
            }
            for track_id in label_only_track_ids
        ], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_root / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
