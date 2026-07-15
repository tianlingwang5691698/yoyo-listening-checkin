#!/usr/bin/env python3
"""Build one Magic Tree House v5 track with direct WhisperX segment alignment."""

import argparse
import json
import statistics
import time
from pathlib import Path

import whisperx


ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "data" / "transcript-build" / "magic-tree-house"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8", errors="replace"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def level_for(index):
    return "A2" if index <= 28 else "B1"


def level_root(index):
    return BUILD_ROOT / level_for(index) / "magic-tree-house"


def source_meta(index):
    root = level_root(index)
    manifest = read_json(root / "manifest.json")
    item = next((row for row in manifest.get("tracks") or [] if int(row.get("index") or 0) == index), None)
    if not item:
        raise ValueError(f"missing manifest item: {index}")
    repaired = sorted((root / "asr-repaired").glob(f"{index:03d}-*.json"))
    original = sorted((root / "asr-small.en").glob(f"{index:03d}-*.json"))
    matches = repaired or original
    if len(matches) != 1:
        raise ValueError(f"expected one ASR JSON for {index}, found {len(matches)}")
    return {
        "index": index,
        "level": level_for(index),
        "trackId": item["trackId"],
        "contentId": item["id"],
        "title": item["title"],
        "fileName": Path(item["sourcePath"]).name,
        "durationSec": float(item["durationSec"]),
        "asrPath": matches[0],
    }


def source_segments(asr):
    output = []
    for index, item in enumerate(asr.get("transcription") or [], 1):
        text = " ".join(str(item.get("text") or "").split()).strip()
        offsets = item.get("offsets") or {}
        start = float(offsets.get("from") or 0) / 1000
        end = float(offsets.get("to") or 0) / 1000
        if not text or end <= start:
            raise ValueError(f"invalid ASR segment {index}")
        output.append({"start": start, "end": end, "text": text})
    return output


def aligned_words(segment):
    return [
        item
        for item in segment.get("words") or []
        if item.get("start") is not None and item.get("end") is not None
    ]


def is_non_speech_label(text):
    value = str(text or "").strip()
    return value.startswith("[") and value.endswith("]")


def normalized_text(value):
    return " ".join(str(value or "").split()).strip()


def build_track(meta, inputs, aligned):
    aligned_segments = aligned.get("segments") or []
    lines = []
    scores = []
    fallback_segments = []
    cursor = 0
    for segment_index, source in enumerate(inputs, 1):
        source_text = normalized_text(source["text"])
        grouped = []
        combined = ""
        while cursor < len(aligned_segments):
            grouped.append(aligned_segments[cursor])
            cursor += 1
            combined = normalized_text(" ".join(item.get("text") or "" for item in grouped))
            if combined == source_text:
                break
            if not source_text.startswith(combined):
                raise ValueError(
                    f"alignment regroup mismatch at segment {segment_index}: "
                    f"source={source_text!r} aligned={combined!r}"
                )
        if combined != source_text:
            raise ValueError(f"alignment output ended at segment {segment_index}: {source_text}")
        words = [word for segment in grouped for word in aligned_words(segment)]
        if words:
            start_ms = int(round(float(words[0]["start"]) * 1000))
            end_ms = int(round(float(words[-1]["end"]) * 1000))
            scores.extend(float(item.get("score") or 0) for item in words)
        elif is_non_speech_label(source["text"]):
            start_ms = int(round(source["start"] * 1000))
            end_ms = int(round(source["end"] * 1000))
            fallback_segments.append(segment_index)
        else:
            raise ValueError(f"spoken segment {segment_index} has no aligned words: {source['text']}")
        lines.append({
            "lineId": f"{meta['trackId']}-line-{len(lines) + 1}",
            "text": source["text"],
            "startMs": start_ms,
            "endMs": end_ms,
        })
    if cursor != len(aligned_segments):
        raise ValueError(f"unused aligned segments: {len(aligned_segments) - cursor}")

    duration_ms = int(round(meta["durationSec"] * 1000))
    if lines:
        lines[-1]["endMs"] = duration_ms
    track = {
        "trackId": meta["trackId"],
        "contentId": meta["contentId"],
        "title": meta["title"],
        "fileName": meta["fileName"],
        "mediaType": "audio",
        "syncGranularity": "line",
        "source": "whisperx-direct-segment-word-alignment-asr-primary",
        "textSource": str(meta["asrPath"].relative_to(ROOT)),
        "durationSec": round(meta["durationSec"], 3),
        "lines": lines,
        "scriptPatches": [],
    }
    return track, scores, fallback_segments


def validate(track):
    errors = []
    duration_ms = int(round(track["durationSec"] * 1000))
    previous_end = -1
    for index, line in enumerate(track.get("lines") or [], 1):
        start = int(line["startMs"])
        end = int(line["endMs"])
        if not line["text"]:
            errors.append(f"line {index}: empty")
        if start < previous_end:
            errors.append(f"line {index}: overlap {previous_end - start}ms")
        if end <= start or end > duration_ms:
            errors.append(f"line {index}: invalid range {start}-{end}")
        previous_end = end
    if not track.get("lines"):
        errors.append("no lines")
    elif int(track["lines"][-1]["endMs"]) != duration_ms:
        errors.append("last line does not end at duration")
    return errors


def compare_v4(root, track):
    path = root / "tracks-v4" / f"{track['trackId']}.json"
    if not path.exists():
        return {"available": False}
    old_lines = read_json(path).get("lines") or []
    new_lines = track.get("lines") or []
    count = min(len(old_lines), len(new_lines))
    deltas = [int(old_lines[index]["startMs"]) - int(new_lines[index]["startMs"]) for index in range(count)]
    largest = sorted(range(count), key=lambda index: abs(deltas[index]), reverse=True)[:10]
    return {
        "available": True,
        "v4LineCount": len(old_lines),
        "v5LineCount": len(new_lines),
        "comparedLineCount": count,
        "medianStartDeltaMs": round(statistics.median(deltas), 1) if deltas else 0,
        "maxAbsStartDeltaMs": max((abs(value) for value in deltas), default=0),
        "over500msCount": sum(1 for value in deltas if abs(value) > 500),
        "over1000msCount": sum(1 for value in deltas if abs(value) > 1000),
        "largestStartDeltas": [
            {
                "line": index + 1,
                "deltaMs": deltas[index],
                "text": new_lines[index]["text"],
            }
            for index in largest
        ],
    }


def build_report(meta, track, scores, fallback_segments, errors, v4_comparison, elapsed_sec):
    lines = track.get("lines") or []
    gaps = [max(0, lines[index]["startMs"] - lines[index - 1]["endMs"]) for index in range(1, len(lines))]
    durations = [line["endMs"] - line["startMs"] for line in lines]
    sample_indexes = sorted(set([0, len(lines) // 2, max(0, len(lines) - 1)])) if lines else []
    return {
        "version": "sentence-v5-whisperx-direct-segment-alignment",
        "index": meta["index"],
        "level": meta["level"],
        "trackId": meta["trackId"],
        "title": meta["title"],
        "durationSec": round(meta["durationSec"], 3),
        "elapsedSec": round(elapsed_sec, 3),
        "speedX": round(meta["durationSec"] / max(elapsed_sec, 0.001), 3),
        "lineCount": len(lines),
        "wordCount": len(scores),
        "meanWordScore": round(statistics.fmean(scores), 4) if scores else 0,
        "lowScoreWordCount": sum(1 for value in scores if value < 0.35),
        "maxGapSec": round(max(gaps, default=0) / 1000, 3),
        "maxLineDurationSec": round(max(durations, default=0) / 1000, 3),
        "nonSpeechFallbackSegmentIndexes": fallback_segments,
        "validationErrors": errors,
        "v4Comparison": v4_comparison,
        "samples": [lines[index] for index in sample_indexes],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode", type=int, default=1)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--realign", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    meta = source_meta(args.episode)
    root = level_root(args.episode)
    output_path = root / "tracks-v5" / f"{meta['trackId']}.json"
    report_path = root / "v5-reports" / f"episode-{args.episode:03d}.json"
    alignment_path = root / "v5-alignment" / f"{meta['trackId']}.json"
    if output_path.exists() and report_path.exists() and not args.force:
        print(f"SKIP episode={args.episode:03d} existing={output_path}")
        return

    inputs = source_segments(read_json(meta["asrPath"]))
    if alignment_path.exists() and not args.realign:
        aligned = read_json(alignment_path)
        elapsed_sec = float((aligned.get("_v5Meta") or {}).get("elapsedSec") or 0)
        print(f"REUSE_ALIGNMENT path={alignment_path}", flush=True)
    else:
        started = time.time()
        print(f"LOAD_ALIGNER device={args.device}", flush=True)
        model, metadata = whisperx.load_align_model(language_code="en", device=args.device)
        manifest = read_json(root / "manifest.json")
        item = next(row for row in manifest.get("tracks") or [] if int(row.get("index") or 0) == args.episode)
        audio = whisperx.load_audio(item["sourcePath"])
        print(f"ALIGN segments={len(inputs)}", flush=True)
        aligned = whisperx.align(
            inputs,
            model,
            metadata,
            audio,
            args.device,
            return_char_alignments=False,
        )
        elapsed_sec = time.time() - started
        aligned["_v5Meta"] = {
            "episode": args.episode,
            "elapsedSec": round(elapsed_sec, 3),
            "method": "whisperx-direct-segment-alignment",
        }
        write_json(alignment_path, aligned)
    track, scores, fallback_segments = build_track(meta, inputs, aligned)
    errors = validate(track)
    comparison = compare_v4(root, track)
    report = build_report(meta, track, scores, fallback_segments, errors, comparison, elapsed_sec)
    write_json(output_path, track)
    write_json(report_path, report)
    if errors:
        raise SystemExit(" | ".join(errors[:10]))
    print(
        f"PASS episode={args.episode:03d} lines={report['lineCount']} words={report['wordCount']} "
        f"score={report['meanWordScore']:.3f} elapsed={report['elapsedSec']:.1f}s "
        f"v4Over1s={comparison.get('over1000msCount', 0)}"
    )


if __name__ == "__main__":
    main()
