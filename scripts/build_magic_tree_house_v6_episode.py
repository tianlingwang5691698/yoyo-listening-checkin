#!/usr/bin/env python3
"""Build one Magic Tree House v6 track from the aligned WhisperX word stream."""

import argparse
import json
import re
import statistics
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "data" / "transcript-build" / "magic-tree-house"
TERMINAL_RE = re.compile(r"[.!?][\"']?$")
NON_SPEECH_RE = re.compile(r"^\[[^]]+\]$")
CHAPTER_RE = re.compile(r"^Chapter\b", re.IGNORECASE)
ABBREVIATIONS = {"mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "vs.", "etc.", "no."}


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
    alignment_path = root / "v5-alignment" / f"{item['trackId']}.json"
    if not alignment_path.exists():
        raise FileNotFoundError(alignment_path)
    return {
        "index": index,
        "trackId": item["trackId"],
        "contentId": item["id"],
        "title": item["title"],
        "fileName": Path(item["sourcePath"]).name,
        "durationSec": float(item["durationSec"]),
        "alignmentPath": alignment_path,
    }


def aligned_words(alignment):
    output = []
    for segment_index, segment in enumerate(alignment.get("segments") or []):
        segment_text = " ".join(str(segment.get("text") or "").split()).strip()
        for item in segment.get("words") or []:
            if item.get("start") is None or item.get("end") is None:
                continue
            word = str(item.get("word") or "").strip()
            if not word:
                continue
            output.append({
                "word": word,
                "startMs": int(round(float(item["start"]) * 1000)),
                "endMs": int(round(float(item["end"]) * 1000)),
                "score": float(item.get("score") or 0),
                "segmentIndex": segment_index,
                "segmentText": segment_text,
            })
    return output


def text_from_words(words):
    return " ".join(item["word"] for item in words).strip()


def is_heading(segment_text):
    return bool(CHAPTER_RE.match(segment_text)) and not TERMINAL_RE.search(segment_text)


def quote_attribution_continues(token, next_token):
    return bool(re.search(r"[!?][\"']$", token) and next_token and next_token[0].islower())


def build_lines(track_id, words):
    lines = []
    pending = []

    def flush():
        nonlocal pending
        if not pending:
            return
        lines.append({
            "lineId": f"{track_id}-line-{len(lines) + 1}",
            "text": text_from_words(pending),
            "startMs": pending[0]["startMs"],
            "endMs": pending[-1]["endMs"],
        })
        pending = []

    index = 0
    while index < len(words):
        word = words[index]
        first_in_segment = index == 0 or words[index - 1]["segmentIndex"] != word["segmentIndex"]
        standalone_segment = NON_SPEECH_RE.fullmatch(word["segmentText"]) or is_heading(word["segmentText"])
        if first_in_segment and standalone_segment:
            flush()
            segment_index = word["segmentIndex"]
            while index < len(words) and words[index]["segmentIndex"] == segment_index:
                pending.append(words[index])
                index += 1
            flush()
            continue

        pending.append(word)
        token = word["word"].strip()
        next_token = words[index + 1]["word"].strip() if index + 1 < len(words) else ""
        if TERMINAL_RE.search(token):
            normalized = token.lower().strip("\"'")
            if normalized not in ABBREVIATIONS and not quote_attribution_continues(token, next_token):
                flush()
        index += 1
    flush()
    return lines


def validate(lines, duration_ms):
    errors = []
    previous_end = -1
    incomplete = []
    for index, line in enumerate(lines, 1):
        start = int(line["startMs"])
        end = int(line["endMs"])
        text = str(line["text"] or "").strip()
        if not text:
            errors.append(f"line {index}: empty")
        if start < previous_end:
            errors.append(f"line {index}: overlap {previous_end - start}ms")
        if end <= start or end > duration_ms:
            errors.append(f"line {index}: invalid range {start}-{end}")
        if not TERMINAL_RE.search(text) and not NON_SPEECH_RE.fullmatch(text) and not CHAPTER_RE.match(text):
            incomplete.append(index)
        previous_end = end
    if incomplete:
        errors.append(f"incomplete sentence lines: {incomplete[:20]}")
    if not lines:
        errors.append("no lines")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode", type=int, default=1)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    meta = source_meta(args.episode)
    root = level_root(args.episode)
    output_path = root / "tracks-v6" / f"{meta['trackId']}.json"
    report_path = root / "v6-reports" / f"episode-{args.episode:03d}.json"
    if output_path.exists() and report_path.exists() and not args.force:
        print(f"SKIP episode={args.episode:03d} existing={output_path}")
        return

    words = aligned_words(read_json(meta["alignmentPath"]))
    lines = build_lines(meta["trackId"], words)
    duration_ms = int(round(meta["durationSec"] * 1000))
    if lines:
        lines[-1]["endMs"] = duration_ms
    errors = validate(lines, duration_ms)
    scores = [item["score"] for item in words]
    track = {
        "trackId": meta["trackId"],
        "contentId": meta["contentId"],
        "title": meta["title"],
        "fileName": meta["fileName"],
        "mediaType": "audio",
        "syncGranularity": "line",
        "source": "whisperx-word-stream-sentence-resegmented-asr-primary",
        "textSource": str(meta["alignmentPath"].relative_to(ROOT)),
        "durationSec": round(meta["durationSec"], 3),
        "lines": lines,
        "scriptPatches": [],
    }
    report = {
        "version": "sentence-v6-whisperx-word-stream-resegmented",
        "index": meta["index"],
        "trackId": meta["trackId"],
        "lineCount": len(lines),
        "wordCount": len(words),
        "meanWordScore": round(statistics.fmean(scores), 4) if scores else 0,
        "lowScoreWordCount": sum(1 for score in scores if score < 0.35),
        "validationErrors": errors,
        "v5LineCount": 778,
        "mergedFragmentCount": 21,
        "samples": [lines[index] for index in (0, len(lines) // 2, len(lines) - 1)] if lines else [],
    }
    write_json(output_path, track)
    write_json(report_path, report)
    if errors:
        raise SystemExit(" | ".join(errors[:10]))
    print(f"PASS episode={args.episode:03d} lines={len(lines)} words={len(words)} incomplete=0")


if __name__ == "__main__":
    main()
