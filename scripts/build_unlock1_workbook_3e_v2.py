#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_unlock1_workbook_sentence_bundle import allocate_lines_word_aligned, split_sentences  # noqa: E402
from build_unlock_workbook_3e_increment import (  # noqa: E402
    display_title,
    duration,
    merge_implausible_short_lines,
    normalized_keys,
    sha1_file,
    trim_official_to_asr,
    validate,
    validate_asr,
)

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/ULK 第三版 课后练习音频/ULK1 Tests_Audio files")
ANSWER_PDF = Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/2.5 配套练习/新版课后练习答案/新版 Unlock 1 L&S 练习册答案.pdf")
OUT = ROOT / "data/transcript-build/unlock1-workbook-third-edition-v2/A1/unlock1"
ASR_DIR = OUT / "asr-word-timestamps"
CATEGORY = "unlock1workbookthirdedition"


def extract_raw_lines():
    raw_path = OUT / "answer-raw.txt"
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftotext", "-raw", str(ANSWER_PDF), str(raw_path)], check=True)
    return raw_path.read_text(encoding="utf-8").splitlines()


def find_line(lines, pattern, start=0):
    regex = re.compile(pattern, re.I)
    for index in range(start, len(lines)):
        if regex.fullmatch(re.sub(r"\s+", " ", lines[index]).strip()):
            return index
    raise ValueError(pattern)


def clean_section(lines):
    cleaned = []
    for raw in lines:
        line = re.sub(r"\s+", " ", raw.replace("\f", " ")).strip()
        if not line:
            continue
        if "Unlock Listening, Speaking & Critical Thinking" in line or "TESTS ANSWERS AND AUDIO SCRIPTS" in line:
            continue
        if re.fullmatch(r"(?:\d+\.\d+|MID ?\d+|END ?\d+)", line, re.I):
            continue
        cleaned.append(line)
    text = " ".join(cleaned)
    text = text.replace("Sophia My mother’s", "Sophia: My mother’s")
    text = re.sub(r"\s+", " ", text).strip()
    return split_sentences([text])


def extract_scripts(lines):
    scripts = {}
    for unit in range(1, 9):
        start = find_line(lines, rf"UNIT {unit} AUDIO SCRIPT") + 1
        if unit == 4:
            end = find_line(lines, r"MID-LEVEL LISTENING TEST", start)
        elif unit == 8:
            end = find_line(lines, r"END-OF-LEVEL ?LISTENING TEST", start)
        else:
            end = find_line(lines, rf"UNIT {unit + 1} LISTENING TEST", start)
        scripts[f"u{unit:02d}"] = clean_section(lines[start:end])

    mid_start = find_line(lines, r"MID-LEVEL AUDIO SCRIPT") + 1
    mid_end = find_line(lines, r"UNIT 5 LISTENING TEST", mid_start)
    mid_text = clean_section(lines[mid_start:mid_end])
    mid_split = next(index for index, text in enumerate(mid_text) if text.startswith("Nour:"))
    scripts["mid1"], scripts["mid2"] = mid_text[:mid_split], mid_text[mid_split:]

    end_start = find_line(lines, r"END-OF-LEVEL ?AUDIO SCRIPT") + 1
    end_text = clean_section(lines[end_start:])
    end_split = next(index for index, text in enumerate(end_text) if text.startswith("Fahd:"))
    scripts["end1"], scripts["end2"] = end_text[:end_split], end_text[end_split:]
    return scripts


def main():
    current = json.loads((ROOT / "cloudfunctions/yoyo/data/unlock-series-manifests.json").read_text(encoding="utf-8"))[CATEGORY]
    current_by_sha1 = {item["sha1"]: item for item in current["tracks"]}
    files = sorted(AUDIO_DIR.glob("*.mp3"), key=lambda item: item.name.lower())
    keys = normalized_keys(1, files)
    scripts = extract_scripts(extract_raw_lines())
    bundle = {}
    tracks = []
    rejected = []
    for audio_path in files:
        key = keys[audio_path]
        asr_path = ASR_DIR / f"{audio_path.stem}.json"
        if not asr_path.exists():
            rejected.append({"key": key, "reason": "missing_asr_word_timestamps"})
            continue
        asr = json.loads(asr_path.read_text(encoding="utf-8"))
        asr_issues = validate_asr(asr)
        if asr_issues:
            rejected.append({"key": key, "reason": asr_issues})
            continue
        sentences, coverage = trim_official_to_asr(scripts[key], asr)
        if coverage < 0.55:
            rejected.append({"key": key, "reason": "official_audio_mismatch", "coverage": round(coverage, 4)})
            continue
        file_sha1 = sha1_file(audio_path)
        current_track = current_by_sha1.get(file_sha1)
        if not current_track:
            rejected.append({"key": key, "reason": "audio_not_in_current_immutable_release"})
            continue
        track_id = f"track-{CATEGORY}-{key}"
        duration_sec = duration(audio_path)
        aligned = allocate_lines_word_aligned(track_id, sentences, duration_sec, asr)
        aligned = merge_implausible_short_lines(track_id, aligned)
        track = {
            "trackId": track_id,
            "contentId": f"{CATEGORY}-{key}",
            "title": display_title(key),
            "fileName": audio_path.name,
            "sourcePath": str(audio_path),
            "audioCloudPath": current_track["cloudPath"],
            "durationSec": duration_sec,
            "syncGranularity": "line",
            "transcriptStatus": "official_text_word_aligned",
            "sourceType": "official_unlock1_third_edition_2025_answer_pdf",
            "sourcePathPdf": str(ANSWER_PDF),
            "asrModel": asr.get("model") or "base",
            "timingSource": "whisper_word_alignment",
            "officialAsrTokenCoverage": round(coverage, 4),
            "lines": aligned,
        }
        issues = validate(track)
        if issues:
            rejected.append({"key": key, "reason": issues})
            continue
        bundle[track_id] = track
        tracks.append({**current_track, "title": display_title(key), "transcriptTrackId": track_id})

    report = {
        "sourceAudioCount": len(files),
        "eligibleCount": len(tracks),
        "rejectedCount": len(rejected),
        "rejected": rejected,
        "validationErrorCount": 0,
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "sampleChecks": {
            track_id: {
                "first": track["lines"][0],
                "middle": track["lines"][len(track["lines"]) // 2],
                "last": track["lines"][-1],
            }
            for track_id, track in bundle.items()
        },
    }
    section = {
        CATEGORY: {
            "meta": {
                **current["meta"],
                "transcriptCloudPath": "_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v2.json",
                "asrModel": sorted({track["asrModel"] for track in bundle.values()}),
                "sourceAnswerPdf": str(ANSWER_PDF),
            },
            "tracks": tracks,
        }
    }
    (OUT / "bundle-wordaligned-v2.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "manifest-section-v2.json").write_text(json.dumps(section, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "clean-report-v2.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["sourceAudioCount", "eligibleCount", "rejectedCount", "lineCount"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
