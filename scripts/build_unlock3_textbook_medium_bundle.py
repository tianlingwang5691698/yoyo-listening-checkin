#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


AUDIO_DIR = Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L3/Unlock 3 LS/Unlock3-听说教材配套音频")
SCRIPT_PDF = Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L3/Unlock 3 LS/Unlock 2e LS3 Scripts.pdf")
CLOUD_AUDIO_ROOT = "B1/Unlock3/Class Audio"
LEVEL = "B1"
SERIES = "unlock3"
BOOK = "Unlock 3"
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".aac"}


def run_text(command):
    result = subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.stdout.strip()


def slugify(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"\.(mp3|m4a|wav|aac)$", "", text)
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def content_slug(value):
    text = str(value or "").strip()
    text = re.sub(r"\.(mp3|m4a|wav|aac)$", "", text, flags=re.I)
    return text.lower().replace("-", "_")


def read_duration_sec(path):
    value = run_text([
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ])
    return round(float(value), 3)


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_audio_code(stem):
    match = re.search(r"_(\d{1,2})\.(\d{1,2})$", stem)
    if not match:
        return None, ""
    return int(match.group(1)), match.group(2)


def extract_pdf_text(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not SCRIPT_PDF.exists():
        return ""
    run_text(["pdftotext", "-layout", str(SCRIPT_PDF), str(output_path)])
    text = output_path.read_text(encoding="utf-8", errors="replace")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text).strip()
    output_path.write_text(text + "\n", encoding="utf-8")
    return text


def build_manifest(series_dir, min_duration_sec):
    if not AUDIO_DIR.exists():
        raise FileNotFoundError(AUDIO_DIR)

    script_text = extract_pdf_text(series_dir / "script-text.txt")
    audio_paths = sorted(path for path in AUDIO_DIR.iterdir() if path.is_file() and path.suffix.lower() in AUDIO_EXTS)
    records = []
    seen_hashes = {}
    for path in audio_paths:
        duration_sec = read_duration_sec(path)
        digest = sha1_file(path)
        duplicate_of = seen_hashes.get(digest, "")
        if not duplicate_of:
            seen_hashes[digest] = path.name
        eligible = duration_sec >= min_duration_sec and not duplicate_of
        unit, track = parse_audio_code(path.stem)
        records.append({
            "id": f"{SERIES}-{content_slug(path.stem)}",
            "level": LEVEL,
            "series": SERIES,
            "book": BOOK,
            "title": path.stem,
            "fileName": path.name,
            "normalizedFileName": path.name,
            "sourcePath": str(path),
            "cloudPath": f"{CLOUD_AUDIO_ROOT}/{path.name}",
            "durationSec": duration_sec,
            "size": path.stat().st_size,
            "sha1": digest,
            "status": "eligible" if eligible else ("duplicate" if duplicate_of else "excluded_short_audio"),
            "duplicateOf": duplicate_of,
            "unit": unit,
            "track": track,
            "kind": "class_audio" if unit and track else "unknown_audio",
        })

    eligible = [item for item in records if item["status"] == "eligible"]
    report = {
        "level": LEVEL,
        "series": SERIES,
        "book": BOOK,
        "audioDir": str(AUDIO_DIR),
        "scriptPdf": str(SCRIPT_PDF),
        "cloudAudioRoot": CLOUD_AUDIO_ROOT,
        "transcriptCloudPath": "_transcripts/B1/unlock3/bundle.json",
        "minDurationSec": min_duration_sec,
        "audioCount": len(records),
        "eligibleCount": len(eligible),
        "excludedShortCount": len([item for item in records if item["status"] == "excluded_short_audio"]),
        "duplicateCount": len([item for item in records if item["status"] == "duplicate"]),
        "unknownCodeCount": len([item for item in records if item["kind"] == "unknown_audio"]),
        "scriptTextChars": len(script_text),
        "scriptTextLines": len([line for line in script_text.splitlines() if line.strip()]),
    }
    series_dir.mkdir(parents=True, exist_ok=True)
    (series_dir / "manifest.json").write_text(json.dumps({"meta": report, "tracks": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "upload-audio-list.txt").write_text("\n".join(item["sourcePath"] for item in eligible) + ("\n" if eligible else ""), encoding="utf-8")
    (series_dir / "cloud-audio-paths.txt").write_text("\n".join(item["cloudPath"] for item in eligible) + ("\n" if eligible else ""), encoding="utf-8")
    return records, report


def transcribe_missing(series_dir, records, model_name, limit, force):
    import whisper

    eligible = [item for item in records if item["status"] == "eligible"]
    model = whisper.load_model(model_name)
    processed = 0
    asr_dir = series_dir / "asr"
    asr_dir.mkdir(parents=True, exist_ok=True)
    for item in eligible:
        if limit and processed >= limit:
            break
        audio_path = Path(item["sourcePath"])
        asr_path = asr_dir / f"{audio_path.stem}.json"
        if asr_path.exists() and not force:
            continue
        result = model.transcribe(str(audio_path), language="en", fp16=False, verbose=False)
        segments = []
        for index, segment in enumerate(result.get("segments") or [], 1):
            text = " ".join(str(segment.get("text") or "").split())
            if not text:
                continue
            segments.append({
                "index": index,
                "startMs": int(round(float(segment.get("start") or 0) * 1000)),
                "endMs": int(round(float(segment.get("end") or 0) * 1000)),
                "text": text,
            })
        asr_path.write_text(json.dumps({
            "text": " ".join(str(result.get("text") or "").split()),
            "segments": segments,
            "language": result.get("language") or "en",
            "model": model_name,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        processed += 1
        print(f"asr {processed}: {audio_path.name}")
    return processed


def build_bundle(series_dir, records, model_name):
    bundle = {}
    drafts = []
    missing = []
    for item in [record for record in records if record["status"] == "eligible"]:
        track_id = f"track-{SERIES}-{slugify(item['title'])}"
        asr_path = series_dir / "asr" / f"{Path(item['fileName']).stem}.json"
        if not asr_path.exists():
            missing.append(item["title"])
            continue
        asr = json.loads(asr_path.read_text(encoding="utf-8"))
        lines = []
        for index, segment in enumerate(asr.get("segments") or [], 1):
            start_ms = int(segment["startMs"])
            end_ms = max(int(segment["endMs"]), start_ms + 1)
            lines.append({
                "lineId": f"{track_id}-line-{index}",
                "text": segment["text"],
                "startMs": start_ms,
                "endMs": end_ms,
            })
        track = {
            "trackId": track_id,
            "contentId": f"{SERIES}-{content_slug(item['title'])}",
            "title": item["title"],
            "fileName": item["normalizedFileName"],
            "audioCloudPath": item["cloudPath"],
            "durationSec": item["durationSec"],
            "syncGranularity": "line",
            "transcriptStatus": "asr_medium_aligned" if model_name == "medium" else "asr_draft",
            "lines": lines,
            "asrModel": asr.get("model") or model_name,
        }
        bundle[track_id] = track
        drafts.append({
            "audioTitle": item["title"],
            "audioCode": f"{item['unit']}.{item['track']}" if item.get("unit") and item.get("track") else "",
            "status": track["transcriptStatus"],
            "text": asr.get("text") or "",
            "track": track,
            "asrPath": str(asr_path),
        })
    report = {
        "level": LEVEL,
        "series": SERIES,
        "book": BOOK,
        "eligibleCount": len([record for record in records if record["status"] == "eligible"]),
        "bundleTrackCount": len(bundle),
        "missingAsrCount": len(missing),
        "missingAudioTitles": missing,
        "transcriptStatus": "asr_medium_aligned" if model_name == "medium" else "asr_draft",
        "asrModel": model_name,
    }
    (series_dir / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "transcript-draft.json").write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "transcript-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Build Unlock3 textbook sentence-level medium Whisper bundle.")
    parser.add_argument("--output-root", default="data/transcript-build/unlock3-textbook")
    parser.add_argument("--model", default="medium")
    parser.add_argument("--min-duration-sec", type=float, default=60)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args()

    series_dir = Path(args.output_root) / LEVEL / SERIES
    records, clean_report = build_manifest(series_dir, args.min_duration_sec)
    processed = 0
    if not args.manifest_only:
        processed = transcribe_missing(series_dir, records, args.model, args.limit, args.force)
    transcript_report = build_bundle(series_dir, records, args.model)
    summary = {
        "cleanReport": clean_report,
        "transcriptReport": transcript_report,
        "processedThisRun": processed,
        "outputDir": str(series_dir),
    }
    (Path(args.output_root) / "transcript-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
