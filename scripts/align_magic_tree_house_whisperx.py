#!/usr/bin/env python3
"""Locally force-align Magic Tree House ASR text with WhisperX."""

import argparse
import difflib
import gc
import json
import re
import statistics
import time
import unicodedata
from pathlib import Path

import torch
import whisperx


ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "data" / "transcript-build" / "magic-tree-house"
AUDIO_DIR = Path("/Users/wangtianlong/工作/未命名文件夹/KL90/3、神奇树屋 Magic Tree House 1-52 （音频）")
PROGRESS_PATH = BUILD_ROOT / "whisperx-v4-progress.json"
GROUP_SECONDS = 60.0
LEADING_PAD_SECONDS = 1.0
TRAILING_PAD_SECONDS = 1.25
LINE_HOLD_MS = 180


def level_for(index):
    return "A2" if index <= 28 else "B1"


def level_root(index):
    return BUILD_ROOT / level_for(index) / "magic-tree-house"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8", errors="replace"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_meta(index):
    manifest = read_json(level_root(index) / "manifest.json")
    item = next((row for row in manifest.get("tracks") or [] if int(row.get("index") or 0) == index), None)
    if not item:
        raise ValueError(f"missing manifest item: {index}")
    audio_matches = sorted(AUDIO_DIR.glob(f"Magic Tree House {index:02d}_*.mp3"))
    if len(audio_matches) != 1:
        raise ValueError(f"expected one audio for {index}, found {len(audio_matches)}")
    repaired_matches = sorted((level_root(index) / "asr-repaired").glob(f"{index:03d}-*.json"))
    asr_matches = repaired_matches or sorted((level_root(index) / "asr-small.en").glob(f"{index:03d}-*.json"))
    if len(asr_matches) != 1:
        raise ValueError(f"expected one ASR JSON for {index}, found {len(asr_matches)}")
    return {
        "index": index,
        "level": level_for(index),
        "trackId": item["trackId"],
        "contentId": item["id"],
        "title": item["title"],
        "durationSec": float(item["durationSec"]),
        "audioPath": audio_matches[0],
        "asrPath": asr_matches[0],
    }


def whisper_cpp_segments(asr):
    output = []
    for item in asr.get("transcription") or []:
        text = " ".join(str(item.get("text") or "").split()).strip()
        offsets = item.get("offsets") or {}
        start = float(offsets.get("from") or 0) / 1000
        end = float(offsets.get("to") or 0) / 1000
        if text and end > start:
            output.append({"start": start, "end": end, "text": text})
    return output


def grouped_alignment_specs(segments, duration_sec):
    ranges = []
    start_index = 0
    for index, segment in enumerate(segments):
        if index > start_index and segment["end"] - segments[start_index]["start"] > GROUP_SECONDS:
            ranges.append((start_index, index - 1))
            start_index = index
    if segments:
        ranges.append((start_index, len(segments) - 1))
    specs = []
    for core_start, core_end in ranges:
        context_start = max(0, core_start - 1)
        context_end = min(len(segments) - 1, core_end + 1)
        context = segments[context_start:context_end + 1]
        specs.append({
            "coreStart": core_start,
            "coreEnd": core_end,
            "contextStart": context_start,
            "contextEnd": context_end,
            "transcript": {
                "start": max(0.0, context[0]["start"] - LEADING_PAD_SECONDS),
                "end": min(duration_sec, context[-1]["end"] + TRAILING_PAD_SECONDS),
                "text": " ".join(item["text"] for item in context),
            },
        })
    return specs


def normalized_token(value):
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9']+", "", value)


def text_tokens(value):
    return [item for item in str(value or "").split() if item]


def map_aligned_words(input_tokens, aligned_words):
    input_norm = [normalized_token(item) for item in input_tokens]
    aligned_norm = [normalized_token(item.get("word")) for item in aligned_words]
    matcher = difflib.SequenceMatcher(a=input_norm, b=aligned_norm, autojunk=False)
    mapped = {}
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                mapped[i1 + offset] = aligned_words[j1 + offset]
        elif tag == "replace" and i2 - i1 == j2 - j1:
            for offset in range(i2 - i1):
                mapped[i1 + offset] = aligned_words[j1 + offset]
    return mapped


def regroup_aligned_segments(specs, aligned_segments):
    grouped = []
    cursor = 0
    for spec in specs:
        target_count = len(text_tokens(spec["transcript"]["text"]))
        group = []
        actual_count = 0
        while cursor < len(aligned_segments) and actual_count < target_count:
            aligned_segment = aligned_segments[cursor]
            group.append(aligned_segment)
            actual_count += len(text_tokens(aligned_segment.get("text")))
            cursor += 1
        if actual_count != target_count:
            raise ValueError(
                f"alignment token mismatch: expected {target_count}, got {actual_count}"
            )
        grouped.append(group)
    if cursor != len(aligned_segments):
        raise ValueError(f"unused aligned segments: {len(aligned_segments) - cursor}")
    return grouped


def align_asr_segments(segments, duration_sec, model, metadata, audio, device):
    rows = [None] * len(segments)
    scores = []
    specs = grouped_alignment_specs(segments, duration_sec)
    result = whisperx.align(
        [spec["transcript"] for spec in specs],
        model,
        metadata,
        audio,
        device,
        return_char_alignments=False,
    )
    aligned_segments = result.get("segments") or []
    aligned_groups = regroup_aligned_segments(specs, aligned_segments)
    for spec, aligned_group in zip(specs, aligned_groups):
        aligned_words = [
            item
            for aligned_segment in aligned_group
            for item in aligned_segment.get("words") or []
            if item.get("start") is not None and item.get("end") is not None
        ]
        context_segments = segments[spec["contextStart"]:spec["contextEnd"] + 1]
        input_tokens = []
        spans = []
        for segment in context_segments:
            start = len(input_tokens)
            input_tokens.extend(text_tokens(segment["text"]))
            spans.append((start, len(input_tokens)))
        mapped = map_aligned_words(input_tokens, aligned_words)
        for global_index in range(spec["coreStart"], spec["coreEnd"] + 1):
            local_index = global_index - spec["contextStart"]
            token_start, token_end = spans[local_index]
            matched = [mapped[index] for index in range(token_start, token_end) if index in mapped]
            segment = segments[global_index]
            if matched:
                start_ms = ms(matched[0].get("start"))
                end_ms = ms(matched[-1].get("end"), start_ms + 1)
                scores.extend(float(item.get("score") or 0) for item in matched)
            else:
                start_ms = ms(segment["start"])
                end_ms = ms(segment["end"], start_ms + 1)
            rows[global_index] = {
                "text": segment["text"],
                "startMs": start_ms,
                "endMs": max(start_ms + 1, end_ms),
            }
    return [row for row in rows if row], scores


def ms(value, fallback=0):
    try:
        return int(round(float(value) * 1000))
    except (TypeError, ValueError):
        return int(fallback)


def build_track(meta, rows, scores):
    duration_ms = int(round(meta["durationSec"] * 1000))
    previous_end = 0
    lines = []
    for row in rows:
        start_ms = max(previous_end, int(row["startMs"]))
        end_ms = min(duration_ms, max(start_ms + 1, int(row["endMs"])))
        lines.append({
            "lineId": f"{meta['trackId']}-line-{len(lines) + 1}",
            "text": row["text"],
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms

    for index in range(len(lines) - 1):
        next_start = lines[index + 1]["startMs"]
        lines[index]["endMs"] = min(next_start, max(lines[index]["endMs"], lines[index]["endMs"] + LINE_HOLD_MS))
    if lines:
        lines[-1]["endMs"] = duration_ms
    return {
        "trackId": meta["trackId"],
        "contentId": meta["contentId"],
        "title": meta["title"],
        "fileName": meta["audioPath"].name,
        "mediaType": "audio",
        "syncGranularity": "line",
        "source": "whisperx-wav2vec2-forced-alignment-asr-primary",
        "textSource": str(meta["asrPath"]),
        "durationSec": round(meta["durationSec"], 3),
        "lines": lines,
        "scriptPatches": [],
    }, scores


def validate_track(track):
    errors = []
    duration_ms = int(round(float(track["durationSec"]) * 1000))
    previous_end = -1
    for index, line in enumerate(track.get("lines") or [], 1):
        start = int(line.get("startMs") or 0)
        end = int(line.get("endMs") or 0)
        if not str(line.get("text") or "").strip():
            errors.append(f"line {index}: empty")
        if start < previous_end:
            errors.append(f"line {index}: overlap")
        if end <= start or end > duration_ms:
            errors.append(f"line {index}: invalid range")
        word_end = start
        for word in line.get("words") or []:
            if int(word["startMs"]) < word_end or int(word["endMs"]) <= int(word["startMs"]):
                errors.append(f"line {index}: invalid word range")
                break
            word_end = int(word["endMs"])
        previous_end = end
    if not track.get("lines"):
        errors.append("no lines")
    elif int(track["lines"][-1]["endMs"]) != duration_ms:
        errors.append("last line does not end at duration")
    return errors


def metrics(meta, track, elapsed_sec, scores):
    gaps = [
        max(0, track["lines"][index]["startMs"] - track["lines"][index - 1]["endMs"])
        for index in range(1, len(track["lines"]))
    ]
    return {
        "index": meta["index"],
        "level": meta["level"],
        "trackId": meta["trackId"],
        "title": meta["title"],
        "durationSec": round(meta["durationSec"], 3),
        "elapsedSec": round(elapsed_sec, 3),
        "speedX": round(meta["durationSec"] / max(elapsed_sec, 0.001), 3),
        "lineCount": len(track["lines"]),
        "wordCount": len(scores),
        "meanWordScore": round(statistics.fmean(scores), 4) if scores else 0,
        "lowScoreWordCount": sum(1 for score in scores if score < 0.35),
        "maxGapSec": round(max(gaps, default=0) / 1000, 3),
        "validationErrors": validate_track(track),
    }


def rebuild_bundles():
    for level, expected in (("A2", range(1, 29)), ("B1", range(29, 53))):
        root = BUILD_ROOT / level / "magic-tree-house"
        bundle = {}
        for index in expected:
            path = root / "tracks-v4" / f"track-magic-tree-house-{index:03d}.json"
            if path.exists():
                track = read_json(path)
                bundle[track["trackId"]] = track
        write_json(root / "bundle-sentence-v4.partial.json", bundle)
        if len(bundle) == len(list(expected)):
            write_json(root / "bundle-sentence-v4.json", bundle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--end-index", type=int, default=52)
    parser.add_argument("--device", default="mps")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    started_at = time.time()
    previous = read_json(PROGRESS_PATH) if PROGRESS_PATH.exists() else {}
    by_index = {int(item["index"]): item for item in previous.get("tracks") or []}
    print(f"Loading WhisperX English aligner on {args.device}...", flush=True)
    model, metadata = whisperx.load_align_model(language_code="en", device=args.device)
    print(f"Aligner ready in {time.time() - started_at:.1f}s", flush=True)

    failures = []
    selected = list(range(max(1, args.start_index), min(52, args.end_index) + 1))
    for position, index in enumerate(selected, 1):
        meta = source_meta(index)
        output_path = level_root(index) / "tracks-v4" / f"{meta['trackId']}.json"
        if output_path.exists() and not args.force:
            track = read_json(output_path)
            errors = validate_track(track)
            if not errors:
                print(f"SKIP {position}/{len(selected)} episode={index:02d} already aligned", flush=True)
                continue
        episode_started = time.time()
        try:
            asr = read_json(meta["asrPath"])
            asr_segments = whisper_cpp_segments(asr)
            audio = whisperx.load_audio(str(meta["audioPath"]))
            rows, scores = align_asr_segments(
                asr_segments,
                meta["durationSec"],
                model,
                metadata,
                audio,
                args.device,
            )
            track, scores = build_track(meta, rows, scores)
            report = metrics(meta, track, time.time() - episode_started, scores)
            if report["validationErrors"]:
                raise ValueError(" | ".join(report["validationErrors"][:10]))
            write_json(output_path, track)
            by_index[index] = report
            print(
                f"PASS {position}/{len(selected)} episode={index:02d} level={meta['level']} "
                f"lines={report['lineCount']} words={report['wordCount']} "
                f"score={report['meanWordScore']:.3f} speed={report['speedX']:.1f}x "
                f"elapsed={report['elapsedSec']:.1f}s",
                flush=True,
            )
        except Exception as error:
            failures.append({"index": index, "error": str(error)})
            print(f"FAIL {position}/{len(selected)} episode={index:02d} error={error}", flush=True)
        finally:
            if "audio" in locals():
                del audio
            gc.collect()
            if args.device == "mps" and torch.backends.mps.is_available():
                torch.mps.empty_cache()
            progress = {
                "version": "sentence-v4-whisperx",
                "device": args.device,
                "completedCount": len(by_index),
                "expectedCount": 52,
                "durationSec": round(sum(item.get("durationSec", 0) for item in by_index.values()), 3),
                "elapsedSec": round(time.time() - started_at, 3),
                "tracks": [by_index[key] for key in sorted(by_index)],
                "failures": failures,
            }
            write_json(PROGRESS_PATH, progress)
            rebuild_bundles()
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
