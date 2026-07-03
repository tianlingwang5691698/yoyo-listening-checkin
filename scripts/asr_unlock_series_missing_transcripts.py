#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path


SERIES_PATHS = [
    ("A2", "unlock2"),
    ("B1", "unlock3"),
    ("B2", "unlock4"),
]


def run_asr(python_bin, model, audio_path, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    code = f"""
import json
import whisper
model = whisper.load_model({model!r})
result = model.transcribe({str(audio_path)!r}, language='en', fp16=False, verbose=False)
segments = []
for index, item in enumerate(result.get('segments') or [], 1):
    text = ' '.join(str(item.get('text') or '').split())
    if not text:
        continue
    segments.append({{
        'index': index,
        'startMs': int(round(float(item.get('start') or 0) * 1000)),
        'endMs': int(round(float(item.get('end') or 0) * 1000)),
        'text': text
    }})
output = {{
    'text': ' '.join(str(result.get('text') or '').split()),
    'segments': segments,
    'language': result.get('language') or 'en',
    'model': {model!r}
}}
open({str(output_path)!r}, 'w', encoding='utf-8').write(json.dumps(output, ensure_ascii=False, indent=2) + '\\n')
"""
    subprocess.run([python_bin, "-c", code], check=True)


def build_track_from_asr(track, asr):
    lines = []
    for segment in asr.get("segments") or []:
        lines.append({
            "lineId": f"{track['trackId']}-asr-{segment['index']}",
            "text": segment["text"],
            "startMs": segment["startMs"],
            "endMs": max(segment["endMs"], segment["startMs"] + 1),
        })
    next_track = dict(track)
    next_track["transcriptStatus"] = "asr_draft"
    next_track["lines"] = lines
    next_track["asrModel"] = asr.get("model") or ""
    return next_track


def main():
    parser = argparse.ArgumentParser(description="Use local Whisper to fill Unlock transcript drafts missing from PDF scripts.")
    parser.add_argument("--root", default="data/transcript-build/unlock-series")
    parser.add_argument("--python-bin", default=str(Path.home() / "whisper-env" / "bin" / "python"))
    parser.add_argument("--model", default="base")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--series", default="")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    root = Path(args.root)
    selected = [item for item in SERIES_PATHS if not args.series or item[1] in args.series.split(",")]
    processed = 0
    reports = []

    for level, category in selected:
        series_dir = root / level / category
        drafts_path = series_dir / "transcript-draft.json"
        bundle_path = series_dir / "bundle-draft.json"
        drafts = json.loads(drafts_path.read_text(encoding="utf-8"))
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        next_drafts = []
        asr_count = 0
        for draft in drafts:
            track = draft["track"]
            if draft["status"] != "needs_manual_review":
                next_drafts.append(draft)
                continue
            if args.limit and processed >= args.limit:
                next_drafts.append(draft)
                continue
            audio_path = Path(next(item["sourcePath"] for item in json.loads((series_dir / "manifest.json").read_text(encoding="utf-8"))["tracks"] if item["title"] == draft["audioTitle"]))
            asr_path = series_dir / "asr" / f"{audio_path.stem}.json"
            if args.force or not asr_path.exists():
                run_asr(args.python_bin, args.model, audio_path, asr_path)
            asr = json.loads(asr_path.read_text(encoding="utf-8"))
            next_track = build_track_from_asr(track, asr)
            bundle[next_track["trackId"]] = next_track
            next_drafts.append(dict(draft, status="asr_draft", text=asr.get("text") or "", track=next_track, asrPath=str(asr_path)))
            processed += 1
            asr_count += 1
        drafts_path.write_text(json.dumps(next_drafts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        bundle_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report = {
            "level": level,
            "series": category,
            "eligibleCount": len(next_drafts),
            "asrDraftCount": len([item for item in next_drafts if item["status"] == "asr_draft"]),
            "pdfMatchedCount": len([item for item in next_drafts if item["status"] == "draft_matched"]),
            "remainingManualReviewCount": len([item for item in next_drafts if item["status"] == "needs_manual_review"]),
            "processedThisRun": asr_count,
        }
        (series_dir / "transcript-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        reports.append(report)

    summary = {
        "model": args.model,
        "eligibleCount": sum(item["eligibleCount"] for item in reports),
        "pdfMatchedCount": sum(item["pdfMatchedCount"] for item in reports),
        "asrDraftCount": sum(item["asrDraftCount"] for item in reports),
        "remainingManualReviewCount": sum(item["remainingManualReviewCount"] for item in reports),
        "processedThisRun": processed,
        "reports": reports,
    }
    (root / "asr-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (root / "transcript-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
