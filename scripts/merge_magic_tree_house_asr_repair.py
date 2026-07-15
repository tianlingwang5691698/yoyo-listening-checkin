#!/usr/bin/env python3
"""Merge a robust Whisper repair window into one Magic Tree House ASR file."""

import argparse
import json
from pathlib import Path

from nltk.tokenize import sent_tokenize


ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "data" / "transcript-build" / "magic-tree-house"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8", errors="replace"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def level_for(index):
    return "A2" if index <= 28 else "B1"


def split_repair_segments(transcription):
    output = []
    for segment in transcription:
        text = " ".join(str(segment.get("text") or "").split()).strip()
        offsets = segment.get("offsets") or {}
        start = int(offsets.get("from") or 0)
        end = int(offsets.get("to") or 0)
        sentences = [item.strip() for item in sent_tokenize(text) if item.strip()]
        if not sentences or end <= start:
            continue
        weights = [max(1, len(item.split())) for item in sentences]
        total = sum(weights)
        consumed = 0
        for sentence, weight in zip(sentences, weights):
            sentence_start = start + round((end - start) * consumed / total)
            consumed += weight
            sentence_end = start + round((end - start) * consumed / total)
            output.append({
                "offsets": {"from": sentence_start, "to": max(sentence_start + 1, sentence_end)},
                "text": f" {sentence}",
            })
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode", type=int, required=True)
    parser.add_argument("--repair-json", type=Path, required=True)
    args = parser.parse_args()

    level = level_for(args.episode)
    series_root = BUILD_ROOT / level / "magic-tree-house"
    original_path = next((series_root / "asr-small.en").glob(f"{args.episode:03d}-*.json"))
    output_path = series_root / "asr-repaired" / original_path.name
    base_path = output_path if output_path.exists() else original_path
    original = read_json(base_path)
    repair = read_json(args.repair_json)
    repaired_segments = split_repair_segments(repair.get("transcription") or [])
    if not repaired_segments:
        raise ValueError("repair transcript is empty")
    replace_start = repaired_segments[0]["offsets"]["from"]
    replace_end = repaired_segments[-1]["offsets"]["to"]
    before = [
        item for item in original.get("transcription") or []
        if int((item.get("offsets") or {}).get("to") or 0) <= replace_start
    ]
    after = [
        item for item in original.get("transcription") or []
        if int((item.get("offsets") or {}).get("from") or 0) >= replace_end
    ]
    merged = dict(original)
    merged["transcription"] = before + repaired_segments + after
    merged["repairWindows"] = list(original.get("repairWindows") or []) + [{
        "source": "whisper.cpp-small.en-beam5-fallback",
        "fromMs": replace_start,
        "toMs": replace_end,
        "sentenceCount": len(repaired_segments),
    }]
    write_json(output_path, merged)
    print(json.dumps({
        "episode": args.episode,
        "output": str(output_path),
        "beforeCount": len(before),
        "repairSentenceCount": len(repaired_segments),
        "afterCount": len(after),
        "totalCount": len(merged["transcription"]),
        "replaceStartMs": replace_start,
        "replaceEndMs": replace_end,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
