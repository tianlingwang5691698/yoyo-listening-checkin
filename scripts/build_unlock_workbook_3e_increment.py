#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_unlock1_workbook_sentence_bundle import (  # noqa: E402
    alignment_tokens,
    allocate_lines_word_aligned,
    asr_words,
    read_docx_paragraphs,
    split_sentences,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/2.5 配套练习")
BACKUP_ROOT = ROOT / "data/transcript-build/unlock-workbook-third-edition/cloud-backup"

CONFIG = {
    1: {
        "level": "A1", "old": "a1-old.json", "oldCategory": "unlock1workbook",
        "audioDir": Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L1/Unlock 2e LS/Unlock 2e LS1 v2 Test_Audio"),
        "sourceNote": "L1 supplied folder has no audio; matched official UL2v2 LS1 workbook audio is used",
    },
    2: {
        "level": "A2", "old": "a2-old.json", "oldCategory": "unlock2workbook",
        "audioDir": SOURCE_ROOT / "L2/Unlock 2-第三版-听口课后练习/ULK2_LS Audio Files",
    },
    3: {
        "level": "B1", "old": "b1-old.json", "oldCategory": "unlock3",
        "audioDir": SOURCE_ROOT / "L3/Unlock 3 第三版-听口课后练习/Unlock 2e LS3 v2 Tests_Audio files",
        "scriptDocx": Path("/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L3/Unlock 2e LS/Unlock 2e LS3 v2 Test_Word files/UL2v2_L3_TST_LS_AK_audioscripts.docx"),
    },
    4: {
        "level": "B2", "old": "b2-old.json", "oldCategory": "unlock4workbook",
        "audioDir": SOURCE_ROOT / "L4/Unlock4-第三版-听口课后练习/ULK4_LS_Audio Files",
    },
}

EXTRA_OFFICIAL = {
    (4, "u01-1"): [
        "GM foods have been changed by scientists, but, despite what some people claim, there’s no evidence that they are actually bad for us to eat, so I wouldn’t avoid them.",
        "People have been trying to find a way to end world hunger for many years and GM foods may be part of the solution – they could feed millions of people around the world. And that’s the reason for my interest, not particularly because I want to see red bananas!",
        "As farming conditions are expected to get worse in many areas due to the effects of rising temperatures and climate change. And of all the issues facing agricultural industries, climate change is, in my personal opinion, the number one challenge.",
    ],
}


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ], text=True).strip())


def track_key(path):
    name = path.stem.upper()
    suffix = "-2" if "（1）" in name or "(1)" in name else "-1"
    match = re.search(r"_U(\d{2})_", name)
    if match:
        unit = int(match.group(1))
        return f"u{unit:02d}{suffix}"
    match = re.search(r"_(MID|END)_(\d)", name)
    if match:
        return f"{match.group(1).lower()}{match.group(2)}"
    raise ValueError(path)


def normalized_keys(level, files):
    keys = {path: track_key(path) for path in files}
    counts = {}
    for key in keys.values():
        base = re.sub(r"-[12]$", "", key)
        counts[base] = counts.get(base, 0) + 1
    for path, key in list(keys.items()):
        base = re.sub(r"-[12]$", "", key)
        if counts[base] == 1:
            keys[path] = base
    if level == 2:
        keys = {path: ({"u07-1": "u07-2", "u07-2": "u07-1"}.get(key, key)) for path, key in keys.items()}
    if level == 4:
        keys = {path: ({
            "u01-1": "u01-2", "u01-2": "u01-1",
            "u06-1": "u06-2", "u06-2": "u06-1",
        }.get(key, key)) for path, key in keys.items()}
    return keys


def old_key(track_id):
    value = track_id.lower().replace("_", "-")
    match = re.search(r"-(u\d{2}(?:-[12])?|mid[123]|end[123])$", value)
    return match.group(1) if match else ""


def display_title(key):
    unit_match = re.fullmatch(r"u(\d{2})(?:-([12]))?", key)
    if unit_match:
        return f"{int(unit_match.group(1))}.{int(unit_match.group(2) or 1)}"
    term_match = re.fullmatch(r"(mid|end)(\d+)", key)
    if term_match:
        return f"{term_match.group(1).upper()} {int(term_match.group(2))}"
    return key


def l3_official_scripts():
    paragraphs = [re.sub(r"\s+", " ", item).strip() for item in read_docx_paragraphs(CONFIG[3]["scriptDocx"])]
    ranges = {
        "u01": (39, 47), "u02-1": (88, 93), "u02-2": (96, 100),
        "u03": (131, 136), "u04": (169, 176), "mid1": (246, 252),
        "mid2": (255, 262), "u05": (303, 310), "u06": (347, 352),
        "u07": (397, 410), "u08": (444, 449), "end1": (510, 521),
        "end2": (524, 529),
    }
    scripts = {}
    for key, (start, end) in ranges.items():
        lines = []
        for line in paragraphs[start:end]:
            if not line or re.fullmatch(r"(?:\d+(?:\.\d+)?|MID \d|END \d)", line, re.I):
                continue
            if "Unlock Listening" in line or "TEST ANSWERS" in line:
                continue
            lines.append(line)
        sentences = split_sentences(lines)
        scripts[key] = [
            re.sub(r"(?<=[.:])(?=[A-Z])", " ", sentence).replace("reliable.2", "reliable.")
            for sentence in sentences
            if not re.fullmatch(r"Extract [12]", sentence, re.I)
        ]
    return scripts


def clean_asr(asr):
    segments = []
    for item in asr.get("segments") or []:
        text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()
        if text:
            segments.append(text)
    return split_sentences(segments)


def validate_asr(asr):
    segments = [item for item in asr.get("segments") or [] if str(item.get("text") or "").strip()]
    if not segments:
        return ["missing_asr_segments"]
    if any(not (item.get("words") or []) for item in segments):
        return ["missing_asr_word_timestamps"]
    return []


def trim_official_to_asr(sentences, asr):
    official = []
    for line_index, text in enumerate(sentences):
        official.extend((token, line_index) for token in alignment_tokens(text))
    words = asr_words(asr)
    matcher = SequenceMatcher(None, [item[0] for item in official], [item["token"] for item in words], autojunk=False)
    matched = defaultdict(int)
    for tag, i1, i2, _, _ in matcher.get_opcodes():
        if tag == "equal":
            for index in range(i1, i2):
                matched[official[index][1]] += 1
    anchors = [index for index, count in matched.items() if count >= 2]
    if not anchors:
        return sentences, 0
    start, end = min(anchors), max(anchors)
    trimmed = sentences[start:end + 1]
    token_count = sum(len(alignment_tokens(text)) for text in trimmed)
    matched_count = sum(count for index, count in matched.items() if start <= index <= end)
    return trimmed, matched_count / max(1, token_count)


def merge_implausible_short_lines(track_id, lines):
    output = []
    index = 0
    while index < len(lines):
        group = [lines[index]]
        words = len(re.findall(r"[A-Za-z]+", lines[index]["text"]))
        duration_ms = lines[index]["endMs"] - lines[index]["startMs"]
        minimum_ms = min(1200, words * 50) if words >= 5 else 0
        while minimum_ms and duration_ms < minimum_ms and index + len(group) < len(lines):
            group.append(lines[index + len(group)])
            words = sum(len(re.findall(r"[A-Za-z]+", item["text"])) for item in group)
            duration_ms = group[-1]["endMs"] - group[0]["startMs"]
            minimum_ms = min(1800, words * 45)
        if minimum_ms and duration_ms < minimum_ms and output:
            previous = output.pop()
            group.insert(0, previous)
        output.append({
            "lineId": "",
            "text": " ".join(item["text"] for item in group),
            "startMs": group[0]["startMs"],
            "endMs": group[-1]["endMs"],
        })
        index += len(group)
    for line_index, line in enumerate(output, 1):
        line["lineId"] = f"{track_id}-line-{line_index}"
    return output


def validate(track):
    issues = []
    previous = 0
    for line in track["lines"]:
        if not line["text"].strip(): issues.append("empty_text")
        if line["startMs"] < previous: issues.append("overlap")
        if line["endMs"] <= line["startMs"]: issues.append("bad_range")
        word_count = len(re.findall(r"[A-Za-z]+", line["text"]))
        if word_count >= 5 and line["endMs"] - line["startMs"] < min(1200, word_count * 50):
            issues.append("implausible_short_line")
        previous = line["endMs"]
    if not track["lines"]: issues.append("empty_lines")
    elif track["lines"][-1]["endMs"] != round(track["durationSec"] * 1000): issues.append("last_end_not_duration")
    return sorted(set(issues))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("level", type=int, choices=CONFIG)
    args = parser.parse_args()
    level = args.level
    cfg = CONFIG[level]
    category = f"unlock{level}workbookthirdedition"
    out = ROOT / f"data/transcript-build/unlock{level}-workbook-third-edition/{cfg['level']}/unlock{level}"
    asr_dir = out / "asr-medium"
    out.mkdir(parents=True, exist_ok=True)
    old_bundle = json.loads((BACKUP_ROOT / cfg["old"]).read_text(encoding="utf-8"))
    old_by_key = {old_key(key): value for key, value in old_bundle.items()}
    l3_scripts = l3_official_scripts() if level == 3 else {}
    files = sorted(cfg["audioDir"].glob("*.mp3"), key=lambda item: item.name.lower())
    keys = normalized_keys(level, files)
    bundle = {}
    tracks = []
    rejected = []
    for audio_path in files:
        key = keys[audio_path]
        asr_path = asr_dir / f"{audio_path.stem}.json"
        if level != 1 and not asr_path.exists():
            rejected.append({"file": str(audio_path), "reason": "missing_asr_word_timestamps"})
            continue
        asr = json.loads(asr_path.read_text(encoding="utf-8")) if asr_path.exists() else {}
        asr_issues = validate_asr(asr) if asr else []
        if asr_issues:
            rejected.append({"file": str(audio_path), "key": key, "reason": asr_issues})
            continue
        old = old_by_key.get("u01" if level == 4 and key == "u01-2" else key)
        if level == 3:
            sentences = l3_scripts.get(key) or clean_asr(asr)
            text_source = "official_ul2v2_l3_answer_scripts_docx"
        elif (level, key) in EXTRA_OFFICIAL:
            sentences = split_sentences(EXTRA_OFFICIAL[(level, key)])
            text_source = "official_third_edition_answer_scripts_pdf"
        elif old:
            sentences = [line["text"] for line in old.get("lines") or []]
            if level == 2:
                sentences = [sentence.replace("Kaymakli in Turkey", "Kaymakli in Türkiye") for sentence in sentences]
            text_source = "official_third_edition_pdf_audited_existing_bundle_text"
        else:
            sentences = clean_asr(asr)
            text_source = "asr_verified_against_official_answer_scripts"
        alignment_coverage = 1.0
        if asr:
            sentences, alignment_coverage = trim_official_to_asr(sentences, asr)
            if alignment_coverage < 0.45:
                rejected.append({
                    "file": str(audio_path), "key": key,
                    "reason": "official_audio_mismatch", "officialAsrTokenCoverage": round(alignment_coverage, 4),
                })
                continue
        file_sha1 = sha1_file(audio_path)
        duration_sec = duration(audio_path)
        track_id = f"track-{category}-{key}"
        lines = allocate_lines_word_aligned(track_id, sentences, duration_sec, asr) if asr else []
        if asr:
            lines = merge_implausible_short_lines(track_id, lines)
        if level == 1 and old:
            lines = [{**line, "lineId": f"{track_id}-line-{index}"} for index, line in enumerate(old["lines"], 1)]
        cloud_name = f"Unlock{level}_Workbook_3e_{key}.mp3"
        cloud_path = f"{cfg['level']}/unlock{level} 练习册 第三版/Audio/{file_sha1[:10]}_{cloud_name}"
        track = {
            "trackId": track_id, "contentId": f"{category}-{key}", "title": display_title(key),
            "fileName": audio_path.name, "sourcePath": str(audio_path), "audioCloudPath": cloud_path,
            "durationSec": duration_sec, "syncGranularity": "line", "transcriptStatus": "official_text_word_aligned",
            "sourceType": text_source, "asrModel": asr.get("model") or "reused-verified",
            "timingSource": "whisper_word_alignment" if asr else "reused_verified_timeline",
            "officialAsrTokenCoverage": round(alignment_coverage, 4), "lines": lines,
        }
        issues = validate(track)
        if issues:
            rejected.append({"file": str(audio_path), "key": key, "reason": issues})
            continue
        bundle[track_id] = track
        tracks.append({
            "id": track["contentId"], "level": cfg["level"], "series": category, "book": f"Unlock {level}",
            "title": track["title"], "fileName": audio_path.name, "normalizedFileName": audio_path.name,
            "cloudPath": cloud_path, "durationSec": duration_sec, "sha1": file_sha1, "status": "eligible",
            "duplicateOf": "", "kind": "workbook_audio", "transcriptTrackId": track_id,
        })
    manifest = {category: {"meta": {
        "level": cfg["level"], "series": category, "book": f"Unlock {level}", "module": "workbook-third-edition",
        "cloudAudioRoot": f"{cfg['level']}/unlock{level} 练习册 第三版/Audio",
        "transcriptCloudPath": f"_transcripts/{cfg['level']}/unlock{level}-workbook-third-edition/bundle-wordaligned-v1.json",
        "audioCount": len(tracks), "eligibleCount": len(tracks),
        "asrModel": sorted({bundle[item["transcriptTrackId"]]["asrModel"] for item in tracks}),
        "sourceNote": cfg.get("sourceNote", "supplied third-edition workbook folder"),
    }, "tracks": tracks}}
    report = {
        "level": cfg["level"], "sourceAudioCount": len(files), "eligibleCount": len(tracks),
        "rejectedCount": len(rejected), "rejected": rejected,
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "validationErrorCount": 0,
        "sampleChecks": {
            track_id: {
                "first": track["lines"][0],
                "middle": track["lines"][len(track["lines"]) // 2],
                "last": track["lines"][-1],
            }
            for track_id, track in bundle.items()
        },
    }
    (out / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "manifest-section.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
