#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import time
import unicodedata
from pathlib import Path


DEFAULT_SOURCE_DIR = "/Users/wangtianlong/工作/未命名文件夹/07. 40册 mp3"
DEFAULT_OUT_ROOT = "data/transcript-build/pete-the-cat/A2/pete-the-cat"
TRANSCRIPT_CLOUD_PATH = "_transcripts/A2/pete-the-cat/bundle-sentence-v1.json"
AUDIO_CLOUD_ROOT = "A2/Pete the Cat/Audio"
COVER_CLOUD_ROOT = "A2/Pete the Cat/Covers"


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ffprobe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def slug(value):
    normalized = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def match_key(value):
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii").lower())


def parse_official_titles(metadata_path):
    titles = {}
    for raw_line in metadata_path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = re.match(r"^(\d+)\.\s+(.+?)\s*$", raw_line.strip())
        if not match:
            continue
        index = int(match.group(1))
        if 1 <= index <= 40 and index not in titles:
            titles[index] = match.group(2).strip()
    if sorted(titles) != list(range(1, 41)):
        raise ValueError(f"metadata title indexes are incomplete: {sorted(titles)}")
    return titles


def find_asset(assets, title, extension):
    expected = match_key(title)
    candidates = [item for item in assets if match_key(item.stem) == expected and item.suffix.lower() == extension]
    if len(candidates) != 1:
        raise ValueError(f"expected one {extension} for {title!r}, found {[item.name for item in candidates]}")
    return candidates[0]


def normalize_display_title(title):
    value = str(title).replace("’", "'").strip()
    value = re.sub(r"^Pete the Cat:\s*", "Pete the Cat ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def transcribe(model, audio_path, model_name, device):
    started = time.time()
    result = model.transcribe(
        str(audio_path),
        language="en",
        fp16=device == "cuda",
        verbose=False,
        word_timestamps=True,
        temperature=0,
    )
    segments = []
    for segment_index, segment in enumerate(result.get("segments") or [], 1):
        words = []
        for word_index, word in enumerate(segment.get("words") or [], 1):
            text = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
            if not text:
                continue
            words.append({
                "index": word_index,
                "text": text,
                "startMs": int(round(float(word.get("start") or 0) * 1000)),
                "endMs": int(round(float(word.get("end") or 0) * 1000)),
                "probability": round(float(word.get("probability") or 0), 6),
            })
        segments.append({
            "index": segment_index,
            "text": re.sub(r"\s+", " ", str(segment.get("text") or "")).strip(),
            "startMs": int(round(float(segment.get("start") or 0) * 1000)),
            "endMs": int(round(float(segment.get("end") or 0) * 1000)),
            "avgLogprob": round(float(segment.get("avg_logprob") or 0), 6),
            "noSpeechProb": round(float(segment.get("no_speech_prob") or 0), 6),
            "compressionRatio": round(float(segment.get("compression_ratio") or 0), 6),
            "words": words,
        })
    return {
        "model": model_name,
        "device": device,
        "language": result.get("language") or "en",
        "elapsedSec": round(time.time() - started, 3),
        "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
        "segments": segments,
    }


def flatten_words(asr):
    words = []
    for segment in asr.get("segments") or []:
        for word in segment.get("words") or []:
            if word.get("text") and int(word.get("endMs") or 0) > int(word.get("startMs") or 0):
                words.append(dict(word))
    return sorted(words, key=lambda item: (int(item["startMs"]), int(item["endMs"])))


def join_words(words):
    text = " ".join(str(item["text"]).strip() for item in words).strip()
    text = re.sub(r"\s+([,.;:!?%])", r"\1", text)
    text = re.sub(r"([(“])\s+", r"\1", text)
    text = re.sub(r"\s+(['’])\s+", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def sentence_lines(track_id, asr, duration_ms):
    segments = asr.get("segments") or []
    if not segments:
        return []
    groups = []
    current = []
    for segment in segments:
        segment_words = sorted(segment.get("words") or [], key=lambda item: (int(item["startMs"]), int(item["endMs"])))
        for word in segment_words:
            if current and int(word["startMs"]) - int(current[-1]["endMs"]) >= 1400:
                groups.append(current)
                current = []
            current.append(word)
            terminal = bool(re.search(r"[.!?][\"'’”)]*$", str(word["text"])))
            if terminal or len(current) >= 32:
                groups.append(current)
                current = []
        if current:
            groups.append(current)
            current = []

    lines = []
    previous_end = 0
    for group in groups:
        text = join_words(group)
        if not text:
            continue
        start_ms = max(previous_end, max(0, int(group[0]["startMs"])))
        end_ms = min(duration_ms, max(start_ms + 1, int(group[-1]["endMs"])))
        line_index = len(lines) + 1
        lines.append({
            "lineId": f"{track_id}-line-{line_index}",
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines


def validate_track(track):
    errors = []
    duration_ms = int(round(float(track["durationSec"]) * 1000))
    lines = track.get("lines") or []
    if not lines:
        return ["no sentence lines"]
    previous_end = -1
    for index, line in enumerate(lines):
        start_ms = int(line.get("startMs") or 0)
        end_ms = int(line.get("endMs") or 0)
        if not str(line.get("text") or "").strip():
            errors.append(f"line {index + 1}: empty text")
        if start_ms < 0 or end_ms <= start_ms or end_ms > duration_ms:
            errors.append(f"line {index + 1}: invalid range {start_ms}-{end_ms}/{duration_ms}")
        if start_ms < previous_end:
            errors.append(f"line {index + 1}: overlaps previous line")
        previous_end = end_ms
    if int(lines[-1]["endMs"]) != duration_ms:
        errors.append("last line does not end at audio duration")
    return errors


def main():
    parser = argparse.ArgumentParser(description="Build Pete the Cat sentence-level ASR bundle with real Whisper word timestamps.")
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--out-root", default=DEFAULT_OUT_ROOT)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--end-index", type=int, default=40)
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser().resolve()
    out_root = Path(args.out_root)
    out_root.mkdir(parents=True, exist_ok=True)
    asr_dir = out_root / f"asr-{args.model}"
    asr_dir.mkdir(parents=True, exist_ok=True)
    metadata_files = sorted(source_dir.glob("*.txt"))
    if len(metadata_files) != 1:
        raise ValueError(f"expected one metadata txt, found {len(metadata_files)}")
    titles = parse_official_titles(metadata_files[0])
    assets = [item for item in source_dir.iterdir() if item.is_file()]

    model = None
    if not args.skip_asr:
        import whisper
        model = whisper.load_model(args.model, device=args.device)

    bundle = {}
    manifest_tracks = []
    validation_errors = []
    start_index = max(1, args.start_index)
    end_index = min(40, args.end_index)
    target_indexes = list(range(start_index, end_index + 1))[: args.limit or None]
    for position, index in enumerate(target_indexes, 1):
        source_title = titles[index]
        display_title = normalize_display_title(source_title)
        audio_path = find_asset(assets, source_title, ".mp3")
        cover_path = find_asset(assets, source_title, ".jpg")
        audio_sha1 = sha1_file(audio_path)
        cover_sha1 = sha1_file(cover_path)
        duration_sec = ffprobe_duration(audio_path)
        duration_ms = int(round(duration_sec * 1000))
        id_suffix = f"{index:03d}"
        track_id = f"track-pete-the-cat-{id_suffix}"
        content_id = f"pete-the-cat-{id_suffix}"
        file_slug = slug(display_title)
        audio_cloud_path = f"{AUDIO_CLOUD_ROOT}/{id_suffix}-{file_slug}-{audio_sha1[:10]}.mp3"
        cover_cloud_path = f"{COVER_CLOUD_ROOT}/{id_suffix}-{file_slug}-{cover_sha1[:10]}.jpg"
        asr_path = asr_dir / f"{id_suffix}-{file_slug}.json"
        if model and (args.force_asr or not asr_path.exists()):
            asr = transcribe(model, audio_path, args.model, args.device)
            asr_path.write_text(json.dumps(asr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        asr = json.loads(asr_path.read_text(encoding="utf-8")) if asr_path.exists() else {}
        lines = sentence_lines(track_id, asr, duration_ms)
        track = {
            "trackId": track_id,
            "contentId": content_id,
            "title": display_title,
            "fileName": audio_path.name,
            "mediaType": "audio",
            "syncGranularity": "line",
            "source": f"whisper-{args.model}-word-timestamps",
            "textSource": "asr-no-official-transcript-in-source-package",
            "durationSec": round(duration_sec, 3),
            "lines": lines,
        }
        errors = validate_track(track)
        validation_errors.extend(f"{track_id}: {error}" for error in errors)
        bundle[track_id] = track
        manifest_tracks.append({
            "index": index,
            "id": content_id,
            "trackId": track_id,
            "title": display_title,
            "sourceTitle": source_title,
            "sourcePath": str(audio_path),
            "coverSourcePath": str(cover_path),
            "audioCloudPath": audio_cloud_path,
            "coverCloudPath": cover_cloud_path,
            "durationSec": round(duration_sec, 3),
            "size": audio_path.stat().st_size,
            "coverSize": cover_path.stat().st_size,
            "sha1": audio_sha1,
            "coverSha1": cover_sha1,
            "lineCount": len(lines),
            "asrPath": str(asr_path) if asr_path.exists() else "",
        })
        print(f"{position}/{len(target_indexes)} {audio_path.name} lines={len(lines)}")

    catalog_items = [{
        "taskId": item["id"],
        "category": "petethecat",
        "title": item["title"],
        "subtitle": f"Pete the Cat · {item['index']}/40",
        "audioCloudPath": item["audioCloudPath"],
        "coverCloudPath": item["coverCloudPath"],
        "size": item["size"],
        "repeatTarget": 3,
        "durationSec": item["durationSec"],
        "coverTone": "mint" if item["index"] % 2 else "peach",
        "transcriptTrackId": item["trackId"],
        "transcriptStatus": "ready",
        "syncGranularity": "line",
        "textSource": {
            "sourceType": "transcript-bundle",
            "title": "Pete the Cat sentence transcript",
            "filePath": TRANSCRIPT_CLOUD_PATH,
        },
    } for item in manifest_tracks]
    manifest = {
        "meta": {
            "level": "A2",
            "category": "petethecat",
            "series": "Pete the Cat",
            "sourceDir": str(source_dir),
            "metadataSource": str(metadata_files[0]),
            "audioCloudRoot": AUDIO_CLOUD_ROOT,
            "coverCloudRoot": COVER_CLOUD_ROOT,
            "transcriptCloudPath": TRANSCRIPT_CLOUD_PATH,
            "audioCount": len(manifest_tracks),
            "coverCount": len(manifest_tracks),
            "asrModel": args.model,
            "timing": "real-whisper-word-timestamps-no-equal-duration-allocation",
            "textSource": "ASR draft; source package contains metadata only and no official story transcript",
        },
        "tracks": manifest_tracks,
    }
    report = {
        "audioCount": len(manifest_tracks),
        "coverCount": len(manifest_tracks),
        "trackCount": len(bundle),
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "asrDoneCount": sum(1 for item in manifest_tracks if item["asrPath"]),
        "validationErrorCount": len(validation_errors),
        "validationErrors": validation_errors,
        "durationSec": round(sum(item["durationSec"] for item in manifest_tracks), 3),
        "audioBytes": sum(item["size"] for item in manifest_tracks),
        "coverBytes": sum(item["coverSize"] for item in manifest_tracks),
        "audioCoverPairMismatchCount": 0,
        "sampleTrackIds": [manifest_tracks[index]["trackId"] for index in (0, len(manifest_tracks) // 2, len(manifest_tracks) - 1)] if manifest_tracks else [],
    }
    sample_audit = []
    if len(manifest_tracks) == 40:
        for sample_index in (0, 19, 39):
            item = manifest_tracks[sample_index]
            track = bundle[item["trackId"]]
            lines = track["lines"]
            sample_audit.append({
                "trackId": item["trackId"],
                "title": item["title"],
                "durationSec": item["durationSec"],
                "lineCount": len(lines),
                "firstLine": lines[0],
                "middleLine": lines[len(lines) // 2],
                "lastLine": lines[-1],
                "lastLineEndsAtDuration": lines[-1]["endMs"] == round(item["durationSec"] * 1000),
                "audioSha1": item["sha1"],
                "coverSha1": item["coverSha1"],
            })
    (out_root / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "catalog-items.json").write_text(json.dumps(catalog_items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "sample-audit.json").write_text(json.dumps(sample_audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if validation_errors:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
