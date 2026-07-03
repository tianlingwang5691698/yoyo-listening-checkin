#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


SERIES_PATHS = [
    ("A2", "unlock2"),
    ("B1", "unlock3"),
    ("B2", "unlock4"),
]


def slugify(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"\.(mp3|m4a|wav|aac)$", "", text)
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def normalize_line(line):
    line = line.replace("\f", "")
    line = re.sub(r"\s+", " ", line).strip()
    if not line:
        return ""
    if re.fullmatch(r"(VIDEO AND AUDIO SCRIPTS|\d{2,3})", line, re.I):
        return ""
    if re.fullmatch(r"VIDEO AND AUDIO SCRIPTS \d{2,3}", line, re.I):
        return ""
    return line


def marker_at_line_start(line):
    match = re.match(r"^\s*(\d{1,2}\.\d{1,2})(?:\s+|$)(.*)$", line)
    if not match:
        return None
    return match.group(1), match.group(2).strip()


def parse_sections(text):
    sections = {}
    current_key = ""
    current_lines = []
    current_unit = 0

    def flush():
        if current_key and current_lines:
            cleaned = [line for line in (normalize_line(item) for item in current_lines) if line]
            sections[current_key] = "\n".join(cleaned).strip()

    for raw_line in text.splitlines():
        unit_match = re.match(r"^\s*UNIT\s+(\d{1,2})\b", raw_line, re.I)
        if unit_match:
            current_unit = int(unit_match.group(1))
        marker = marker_at_line_start(raw_line)
        if marker:
            flush()
            current_key = marker[0]
            current_lines = []
            if marker[1]:
                current_lines.append(marker[1])
            continue
        if current_key:
            current_lines.append(raw_line)
    flush()
    return sections


def split_transcript_lines(text):
    lines = []
    for raw in text.splitlines():
        line = normalize_line(raw)
        if not line:
            continue
        if re.match(r"^UNIT\s+\d+\b", line, re.I):
            continue
        lines.append(line)
    return lines


def get_audio_code(track):
    unit = track.get("unit")
    number = str(track.get("track") or "").strip()
    if unit and number:
        return f"{int(unit)}.{number}"
    title = track.get("title") or ""
    match = re.search(r"_U(\d{1,2})_Audio_(\d{1,2}(?:\.\d{1,2})?)$", title, re.I)
    if match:
        return f"{int(match.group(1))}.{match.group(2).split('.')[-1]}"
    match = re.search(r"_(\d{1,2})\.(\d{1,2})$", title)
    if match:
        return f"{int(match.group(1))}.{match.group(2)}"
    return ""


def build_track(category, item, transcript_text, status):
    duration_ms = max(1000, int(round(float(item.get("durationSec") or 0) * 1000)))
    text_lines = split_transcript_lines(transcript_text)
    line_count = max(1, len(text_lines))
    step = max(1000, duration_ms // line_count)
    track_id = f"track-{category}-{slugify(item.get('title') or item.get('normalizedFileName'))}"
    lines = []
    for index, text in enumerate(text_lines):
        start_ms = min(duration_ms - 1, index * step)
        end_ms = duration_ms if index == line_count - 1 else min(duration_ms, (index + 1) * step)
        lines.append({
            "lineId": f"{track_id}-line-{index + 1}",
            "text": text,
            "startMs": start_ms,
            "endMs": max(end_ms, start_ms + 1),
        })
    return {
        "trackId": track_id,
        "contentId": item.get("id") or track_id.replace("track-", ""),
        "title": item.get("title") or "",
        "fileName": item.get("normalizedFileName") or item.get("fileName") or "",
        "audioCloudPath": item.get("cloudPath") or "",
        "durationSec": item.get("durationSec") or 0,
        "syncGranularity": "line",
        "transcriptStatus": status,
        "lines": lines,
    }


def build_series(root, level, category):
    series_dir = root / level / category
    manifest = json.loads((series_dir / "manifest.json").read_text(encoding="utf-8"))
    script_text = (series_dir / "script-text.txt").read_text(encoding="utf-8")
    sections = parse_sections(script_text)
    eligible = [item for item in manifest["tracks"] if item.get("status") == "eligible"]
    drafts = []
    bundle = {}
    missing = []
    for item in eligible:
        code = get_audio_code(item)
        text = sections.get(code, "")
        status = "draft_matched" if text else "needs_manual_review"
        if not text:
            missing.append(item.get("title") or item.get("normalizedFileName") or "")
        track = build_track(category, item, text, status)
        drafts.append({
            "audioTitle": item.get("title") or "",
            "audioCode": code,
            "status": status,
            "text": text,
            "track": track,
        })
        bundle[track["trackId"]] = track
    report = {
        "level": level,
        "series": category,
        "eligibleCount": len(eligible),
        "matchedCount": len([item for item in drafts if item["status"] == "draft_matched"]),
        "needsManualReviewCount": len(missing),
        "availableSectionCount": len(sections),
        "missingAudioTitles": missing,
    }
    (series_dir / "transcript-draft.json").write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "transcript-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Split Unlock PDF script text into per-audio transcript drafts.")
    parser.add_argument("--root", default="data/transcript-build/unlock-series")
    args = parser.parse_args()
    root = Path(args.root)
    reports = [build_series(root, level, category) for level, category in SERIES_PATHS]
    summary = {
        "seriesCount": len(reports),
        "eligibleCount": sum(item["eligibleCount"] for item in reports),
        "matchedCount": sum(item["matchedCount"] for item in reports),
        "needsManualReviewCount": sum(item["needsManualReviewCount"] for item in reports),
        "reports": reports,
    }
    (root / "transcript-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
