#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_unlock1_workbook_sentence_bundle import (  # noqa: E402
    allocate_lines_word_aligned,
    ffprobe_duration,
    read_docx_paragraphs,
    sha1_file,
    slug,
    split_sentences,
    transcribe_medium,
)


DEFAULT_AUDIO_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L4/Unlock 2e LS/Unlock 2e LS4 v2 Tests_Audio files"
DEFAULT_DOCX = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L4/Unlock 2e LS/Unlock 2e LS4 v2 Test_Word files/UL2v2_L4_TST_LS_AK_audioscripts.docx"


TRACKS = [
    ("u01", "UNIT 1 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U01_Audio_1.1.mp3"),
    ("u02-1", "UNIT 2 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U02_Audio_2.1.mp3"),
    ("u02-2", "UNIT 2 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U02_Audio_2.2.mp3"),
    ("u03", "UNIT 3 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U03_Audio_3.1.mp3"),
    ("u04", "UNIT 4 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U04_Audio_4.1.mp3"),
    ("mid1", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L4_TST_LS_MID_Audio_MID_1.mp3"),
    ("mid2", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L4_TST_LS_MID_Audio_MID_2.mp3"),
    ("u05-1", "UNIT 5 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U05_Audio_5.1.mp3"),
    ("u05-2", "UNIT 5 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U05_Audio_5.2.mp3"),
    ("u06-1", "UNIT 6 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U06_Audio_6.1.mp3"),
    ("u06-2", "UNIT 6 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U06_Audio_6.2.mp3"),
    ("u07", "UNIT 7 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U07_Audio_7.1.mp3"),
    ("u08", "UNIT 8 AUDIO SCRIPT", "UL2v2_L4_TST_LS_U08_Audio_8.1.mp3"),
    ("end1", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L4_TST_LS_END_Audio_END_1.mp3"),
    ("end2", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L4_TST_LS_END_Audio_END_2.mp3"),
]


SCRIPT_RANGES = {
    "u01": (48, 66),
    "u02-1": (114, 120),
    "u02-2": (122, 140),
    "u03": (190, 212),
    "u04": (256, 262),
    "mid1": (296, 307),
    "mid2": (309, 322),
    "u05-1": (368, 372),
    "u05-2": (374, 389),
    "u06-1": (424, 437),
    "u06-2": (439, 443),
    "u07": (482, 500),
    "u08": (541, 551),
    "end1": (598, 604),
    "end2": (606, 622),
}

SCRIPT_LINE_PATCHES = {
    "u01": [
        {
            "type": "replace",
            "from": "I’m afraid that’s all we have time for, and now …",
            "line": "I’m afraid that’s all we have time for. And now, for something a little different.",
            "source": "asr_audio_gap_patch",
        },
    ],
    "u05-2": [
        {
            "type": "replace",
            "from": "Let’s discuss it …",
            "line": "Let’s discuss it a bit further.",
            "source": "asr_audio_gap_patch",
        },
    ],
    "u06-1": [
        {
            "type": "replace",
            "from": "Join me next week for …",
            "line": "Join me next week for a discussion on a further interesting source.",
            "source": "asr_audio_gap_patch",
        },
    ],
    "end2": [
        {
            "type": "replace",
            "from": "Dr Andrews: Good morning, Charlie. I wouldn’t say taking over exactly, but they are starting to use smartphones and",
            "line": "Dr Andrews: Good morning, Charlie. I wouldn’t say taking over exactly, but they are starting to use smartphones and tablets in record numbers.",
            "source": "docx_wrapped_line_join",
        },
        {
            "type": "remove",
            "line": "tablets in record numbers.",
            "source": "docx_wrapped_line_join",
        },
        {
            "type": "replace",
            "from": "For now, that’s all we have time for …",
            "line": "For now, that’s all we have time for. Thank you.",
            "source": "asr_audio_gap_patch",
        },
    ],
}


def clean_l4_script_line(line):
    line = re.sub(r"\s+", " ", line).strip()
    if not line:
        return ""
    compact = re.sub(r"\s+", "", line)
    if re.fullmatch(r"(?:\d+(?:\.\d+)*|MID\d+|END\d+)+", compact, re.I):
        return ""
    line = re.sub(r"^(?:\d+(?:\.\d+)+)+(?=[A-Z])", "", line).strip()
    line = re.sub(r"^(?:MID|END)\s*\d+(?:(?:MID|END)\s*\d+)*(?=[A-Z])", "", line, flags=re.I).strip()
    line = re.sub(r"^(?:\d+\.\d+)+", "", line).strip()
    line = re.sub(r"^(?:MID|END)\s*\d+(?:MID|END)?\s*\d*", "", line, flags=re.I).strip()
    line = re.sub(r"^\d+\s*", "", line).strip()
    if not line:
        return ""
    if re.match(r"^[A-Za-z]", line):
        return line
    return ""


def build_scripts(paragraphs):
    scripts = {}
    for key, (start, end) in SCRIPT_RANGES.items():
        lines = []
        for raw in paragraphs[start:end]:
            line = clean_l4_script_line(raw)
            if line:
                lines.append(line)
        scripts[key] = lines
    return scripts


def apply_script_line_patches(key, lines):
    output = list(lines)
    for patch in SCRIPT_LINE_PATCHES.get(key) or []:
        if patch["type"] == "replace":
            output = [line.replace(patch["from"], patch["line"]) for line in output]
            continue
        if patch["type"] == "remove":
            output = [line for line in output if line != patch["line"]]
            continue
        if patch["type"] == "append":
            try:
                index = output.index(patch["after"])
            except ValueError:
                output.append(patch["line"])
            else:
                output.insert(index + 1, patch["line"])
    return output


def validate_track(track):
    issues = []
    lines = track.get("lines") or []
    if not lines:
        issues.append("empty_lines")
        return issues
    previous_end = 0
    duration_ms = int(round(float(track.get("durationSec") or 0) * 1000))
    for line in lines:
        if not str(line.get("text") or "").strip():
            issues.append("empty_text")
        start_ms = int(line.get("startMs") or 0)
        end_ms = int(line.get("endMs") or 0)
        if start_ms < previous_end:
            issues.append("overlap")
        if end_ms <= start_ms:
            issues.append("bad_range")
        previous_end = end_ms
    if lines[-1].get("endMs") != duration_ms:
        issues.append("last_end_not_duration")
    return sorted(set(issues))


def main():
    parser = argparse.ArgumentParser(description="Build local Unlock4 workbook sentence-level transcript bundle.")
    parser.add_argument("--audio-dir", default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--docx", default=DEFAULT_DOCX)
    parser.add_argument("--out-root", default="data/transcript-build/unlock4-workbook/B2/unlock4")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    out_root = Path(args.out_root)
    asr_dir = out_root / "asr-medium"
    out_root.mkdir(parents=True, exist_ok=True)
    asr_dir.mkdir(parents=True, exist_ok=True)

    paragraphs = [item for item in read_docx_paragraphs(args.docx) if item]
    scripts = build_scripts(paragraphs)

    model = None
    if not args.skip_asr:
        import whisper
        model = whisper.load_model("medium")

    manifest_tracks = []
    bundle = {}
    for key, heading, file_name in TRACKS:
        audio_path = audio_dir / file_name
        if not audio_path.exists():
            raise FileNotFoundError(audio_path)
        duration_sec = ffprobe_duration(audio_path)
        file_sha1 = sha1_file(audio_path)
        title = file_name[:-4]
        track_id = f"track-unlock4-workbook-{slug(key)}"
        content_id = f"unlock4-workbook-{slug(key)}"
        asr_path = asr_dir / f"{title}.json"
        if model and (args.force_asr or not asr_path.exists()):
            asr_path.write_text(json.dumps(transcribe_medium(model, audio_path), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        sentences = split_sentences(apply_script_line_patches(key, scripts[key]))
        asr_data = {}
        if asr_path.exists():
            asr_data = json.loads(asr_path.read_text(encoding="utf-8"))
        track = {
            "trackId": track_id,
            "contentId": content_id,
            "title": title,
            "fileName": file_name,
            "sourcePath": str(audio_path),
            "audioCloudPath": f"B2/unlock4 练习册/Audio/{file_sha1[:10]}_{file_name}",
            "durationSec": duration_sec,
            "syncGranularity": "line",
            "transcriptStatus": "official_text_sentence_draft",
            "sourceType": "workbook_answer_key_audio_scripts_docx",
            "asrModel": "medium",
            "timingSource": "whisper_medium_word_alignment",
            "scriptPatches": SCRIPT_LINE_PATCHES.get(key) or [],
            "lines": allocate_lines_word_aligned(track_id, sentences, duration_sec, asr_data),
        }
        bundle[track_id] = track
        manifest_tracks.append({
            "id": content_id,
            "trackId": track_id,
            "title": title,
            "fileName": file_name,
            "sourcePath": str(audio_path),
            "audioCloudPath": track["audioCloudPath"],
            "durationSec": duration_sec,
            "sha1": file_sha1,
            "lineCount": len(track["lines"]),
            "status": "eligible",
            "sourceHeading": heading,
            "asrPath": str(asr_path) if asr_path.exists() else "",
        })

    validation = {track_id: validate_track(track) for track_id, track in bundle.items()}
    validation = {track_id: issues for track_id, issues in validation.items() if issues}
    report = {
        "trackCount": len(bundle),
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "asrDoneCount": sum(1 for item in manifest_tracks if item["asrPath"]),
        "missingTextCount": sum(1 for track in bundle.values() if not track["lines"]),
        "validationIssues": validation,
        "outputs": {
            "bundle": str(out_root / "bundle-draft.json"),
            "manifest": str(out_root / "manifest.json"),
            "report": str(out_root / "clean-report.json"),
        },
    }
    manifest = {
        "meta": {
            "level": "B2",
            "series": "unlock4",
            "book": "Unlock 4",
            "module": "workbook",
            "audioDir": str(audio_dir),
            "scriptDocx": str(Path(args.docx)),
            "cloudAudioRoot": "B2/unlock4 练习册/Audio",
            "transcriptCloudPath": "_transcripts/B2/unlock4/workbook-bundle-wordaligned-v1.json",
            "audioCount": len(manifest_tracks),
            "eligibleCount": len(manifest_tracks),
            "asrModel": "medium",
        },
        "tracks": manifest_tracks,
    }

    (out_root / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
