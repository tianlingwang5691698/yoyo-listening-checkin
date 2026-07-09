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


DEFAULT_AUDIO_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L2/Unlock 2e LS/Unlock 2e LS2 v2 Test_Audio files"
DEFAULT_DOCX = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L2/Unlock 2e LS/Unlock 2e LS2 v2 Test_Word files/UL2v2_L2_TST_LS_AK_audioscripts.docx"


TRACKS = [
    ("u01-1", "UNIT 1 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U01_Audio_1.1.mp3"),
    ("u01-2", "UNIT 1 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U01_Audio_1.2.mp3"),
    ("u02", "UNIT 2 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U02_Audio_2.1.mp3"),
    ("u03", "UNIT 3 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U03_Audio_3.1.mp3"),
    ("u04", "UNIT 4 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U04_Audio_4.1.mp3"),
    ("mid1", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_MID_Audio_MID_1.mp3"),
    ("mid2", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_MID_Audio_MID_2.mp3"),
    ("mid3", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_MID_Audio_MID_3.mp3"),
    ("u05", "UNIT 5 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U05_Audio_5.1.mp3"),
    ("u06", "UNIT 6 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U06_Audio_6.1.mp3"),
    ("u07-1", "UNIT 7 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U07_Audio_7.1.mp3"),
    ("u07-2", "UNIT 7 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U07_Audio_7.2.mp3"),
    ("u08", "UNIT 8 AUDIO SCRIPT", "UL2v2_L2_TST_LS_U08_Audio_8.1.mp3"),
    ("end1", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_END_Audio_END_1.mp3"),
    ("end2", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_END_Audio_END_2.mp3"),
    ("end3", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L2_TST_LS_END_Audio_END_3.mp3"),
]


SCRIPT_RANGES = {
    "u01-1": (34, 38),
    "u01-2": (40, 44),
    "u02": (80, 84),
    "u03": (123, 126),
    "u04": (166, 171),
    "mid1": (216, 224),
    "mid2": (227, 232),
    "mid3": (234, 240),
    "u05": (283, 291),
    "u06": (331, 342),
    "u07-1": (386, 391),
    "u07-2": (394, 403),
    "u08": (448, 455),
    "end1": (488, 492),
    "end2": (495, 498),
    "end3": (501, 507),
}

SCRIPT_LINE_PATCHES = {
    "u04": [
        {
            "type": "replace",
            "from": "These types of climate are much …",
            "line": "These types of climates are much easier for people to live in.",
            "source": "asr_docx_truncation_patch",
        },
    ],
    "mid1": [
        {
            "type": "append",
            "after": "The problem with this kind of drone is that it uses batteries and obviously you have to charge them after flying, which can take up quite a lot of time.",
            "line": "The drone is very fast.",
            "source": "asr_audio_gap_patch",
        },
    ],
}


def clean_l2_script_line(line):
    line = re.sub(r"\s+", " ", line).strip()
    if not line:
        return ""
    compact = re.sub(r"\s+", "", line)
    if re.fullmatch(r"(?:\d+(?:\.\d+)*|MID\d+|END\d+)+", compact, re.I):
        return ""
    line = re.sub(r"^(?:\d+\.\d+)+\.?\d?(?=[A-Z])", "", line).strip()
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
            line = clean_l2_script_line(raw)
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
        if patch["type"] == "append":
            try:
                index = output.index(patch["after"])
            except ValueError:
                output.append(patch["line"])
            else:
                output.insert(index + 1, patch["line"])
    return output


def main():
    parser = argparse.ArgumentParser(description="Build local Unlock2 workbook sentence-level transcript bundle.")
    parser.add_argument("--audio-dir", default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--docx", default=DEFAULT_DOCX)
    parser.add_argument("--out-root", default="data/transcript-build/unlock2-workbook/A2/unlock2")
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
        track_id = f"track-unlock2-workbook-{slug(key)}"
        content_id = f"unlock2-workbook-{slug(key)}"
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
            "audioCloudPath": f"A2/unlock2 练习册/Audio/{file_sha1[:10]}_{file_name}",
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

    report = {
        "trackCount": len(bundle),
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "asrDoneCount": sum(1 for item in manifest_tracks if item["asrPath"]),
        "missingTextCount": sum(1 for track in bundle.values() if not track["lines"]),
        "outputs": {
            "bundle": str(out_root / "bundle-draft.json"),
            "manifest": str(out_root / "manifest.json"),
            "report": str(out_root / "clean-report.json"),
        },
    }
    manifest = {
        "meta": {
            "level": "A2",
            "series": "unlock2",
            "book": "Unlock 2",
            "module": "workbook",
            "audioDir": str(audio_dir),
            "scriptDocx": str(Path(args.docx)),
            "cloudAudioRoot": "A2/unlock2 练习册/Audio",
            "transcriptCloudPath": "_transcripts/A2/unlock2/workbook-bundle-wordaligned-v1.json",
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
