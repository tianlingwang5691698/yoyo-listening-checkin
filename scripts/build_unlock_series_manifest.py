#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


SERIES = [
    {
        "level": "A2",
        "series": "unlock2",
        "book": "Unlock 2",
        "audio_dir": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/Unlock2/LS/Class Audio",
        "script_pdf": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/Unlock2/LS/Unlock 2e LS2 Scripts.pdf",
        "cloud_audio_root": "A2/Unlock2/Class Audio",
        "transcript_cloud_path": "_transcripts/A2/unlock2/bundle.json",
    },
    {
        "level": "B1",
        "series": "unlock3",
        "book": "Unlock 3",
        "audio_dir": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L3/Unlock 3 LS/听力单元测配套音频",
        "script_pdf": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L3/Unlock 3 LS/Unlock 2e LS3 Scripts.pdf",
        "cloud_audio_root": "B1/Unlock3/Class Audio",
        "transcript_cloud_path": "_transcripts/B1/unlock3/bundle.json",
    },
    {
        "level": "B2",
        "series": "unlock4",
        "book": "Unlock 4",
        "audio_dir": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L4/Unlock 4 LS/Class Audio",
        "script_pdf": "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/L4/Unlock 4 LS/Unlock 2e LS4 Scripts.pdf",
        "cloud_audio_root": "B2/Unlock4/Class Audio",
        "transcript_cloud_path": "_transcripts/B2/unlock4/bundle.json",
    },
]

AUDIO_EXTS = {".mp3", ".m4a", ".wav"}


def run_text(command):
    result = subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.stdout.strip()


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


def normalize_stem(stem):
    return re.sub(r"[_\-\s]*(副本|copy|\(\d+\))$", "", stem, flags=re.I).strip()


def parse_audio_code(stem):
    normalized = normalize_stem(stem)
    unit_match = re.search(r"(?:_|U)(\d{1,2})[._-](?:Audio_)?(\d{1,2})(?:\.(\d{1,2}))?$", normalized, re.I)
    simple_match = re.search(r"_(\d{1,2})\.(\d{1,2})$", normalized)
    test_match = re.search(r"_TST_LS_(MID|END)_(MID|END)_(\d+)$", normalized, re.I)

    if simple_match:
        return {
            "unit": int(simple_match.group(1)),
            "track": simple_match.group(2),
            "kind": "class_audio",
        }
    if unit_match:
        return {
            "unit": int(unit_match.group(1)),
            "track": unit_match.group(3) or unit_match.group(2),
            "kind": "unit_test_audio" if "_TST_" in normalized.upper() else "class_audio",
        }
    if test_match:
        return {
            "unit": None,
            "track": test_match.group(3),
            "kind": f"{test_match.group(1).lower()}_test_audio",
        }
    return {
        "unit": None,
        "track": "",
        "kind": "unknown_audio",
    }


def extract_pdf_text(pdf_path, output_txt):
    output_txt.parent.mkdir(parents=True, exist_ok=True)
    run_text(["pdftotext", "-layout", str(pdf_path), str(output_txt)])
    text = output_txt.read_text(encoding="utf-8", errors="replace")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text).strip()
    output_txt.write_text(text + "\n", encoding="utf-8")
    return text


def build_series(config, output_root, min_duration):
    audio_dir = Path(config["audio_dir"])
    script_pdf = Path(config["script_pdf"])
    series_dir = output_root / config["level"] / config["series"]
    transcript_txt = series_dir / "script-text.txt"

    if not audio_dir.exists():
        raise FileNotFoundError(audio_dir)
    if not script_pdf.exists():
        raise FileNotFoundError(script_pdf)

    source_text = extract_pdf_text(script_pdf, transcript_txt)
    audio_paths = sorted(
        path for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in AUDIO_EXTS
    )

    records = []
    seen_hashes = {}
    for path in audio_paths:
        duration_sec = read_duration_sec(path)
        digest = sha1_file(path)
        duplicate_of = seen_hashes.get(digest, "")
        if not duplicate_of:
            seen_hashes[digest] = path.name
        code = parse_audio_code(path.stem)
        eligible = duration_sec >= min_duration and not duplicate_of
        status = "eligible" if eligible else ("duplicate" if duplicate_of else "excluded_short_audio")
        normalized_name = normalize_stem(path.stem) + path.suffix.lower()
        record = {
            "id": f"{config['series']}-{normalize_stem(path.stem).lower()}",
            "level": config["level"],
            "series": config["series"],
            "book": config["book"],
            "title": normalize_stem(path.stem),
            "fileName": path.name,
            "normalizedFileName": normalized_name,
            "sourcePath": str(path),
            "cloudPath": f"{config['cloud_audio_root']}/{normalized_name}",
            "durationSec": duration_sec,
            "size": path.stat().st_size,
            "sha1": digest,
            "status": status,
            "duplicateOf": duplicate_of,
            "unit": code["unit"],
            "track": code["track"],
            "kind": code["kind"],
        }
        records.append(record)

    eligible = [item for item in records if item["status"] == "eligible"]
    report = {
        "level": config["level"],
        "series": config["series"],
        "book": config["book"],
        "audioDir": str(audio_dir),
        "scriptPdf": str(script_pdf),
        "cloudAudioRoot": config["cloud_audio_root"],
        "transcriptCloudPath": config["transcript_cloud_path"],
        "minDurationSec": min_duration,
        "audioCount": len(records),
        "eligibleCount": len(eligible),
        "excludedShortCount": len([item for item in records if item["status"] == "excluded_short_audio"]),
        "duplicateCount": len([item for item in records if item["status"] == "duplicate"]),
        "unknownCodeCount": len([item for item in records if item["kind"] == "unknown_audio"]),
        "scriptTextChars": len(source_text),
        "scriptTextLines": len([line for line in source_text.splitlines() if line.strip()]),
    }

    manifest = {
        "meta": report,
        "tracks": records,
    }
    series_dir.mkdir(parents=True, exist_ok=True)
    (series_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (series_dir / "upload-audio-list.txt").write_text(
        "\n".join(item["sourcePath"] for item in eligible) + ("\n" if eligible else ""),
        encoding="utf-8",
    )
    (series_dir / "cloud-audio-paths.txt").write_text(
        "\n".join(item["cloudPath"] for item in eligible) + ("\n" if eligible else ""),
        encoding="utf-8",
    )
    (series_dir / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Build local clean manifests for Unlock 2/3/4 audio assets.")
    parser.add_argument("--output-root", default="data/transcript-build/unlock-series")
    parser.add_argument("--min-duration-sec", type=float, default=60)
    args = parser.parse_args()

    output_root = Path(args.output_root).resolve()
    reports = [build_series(config, output_root, args.min_duration_sec) for config in SERIES]
    summary = {
        "minDurationSec": args.min_duration_sec,
        "seriesCount": len(reports),
        "audioCount": sum(item["audioCount"] for item in reports),
        "eligibleCount": sum(item["eligibleCount"] for item in reports),
        "excludedShortCount": sum(item["excludedShortCount"] for item in reports),
        "duplicateCount": sum(item["duplicateCount"] for item in reports),
        "unknownCodeCount": sum(item["unknownCodeCount"] for item in reports),
        "reports": reports,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "clean-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
