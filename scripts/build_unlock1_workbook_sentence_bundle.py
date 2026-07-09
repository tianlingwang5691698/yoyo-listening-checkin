#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from xml.etree import ElementTree as ET


DEFAULT_AUDIO_DIR = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L1/Unlock 2e LS/Unlock 2e LS1 v2 Test_Audio"
DEFAULT_DOCX = "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/2.练习/L1/Unlock 2e LS/Unlock 2e LS1 v2 Test_Word files/UL2v2_L1_TST_LS_AK_audio scripts.docx"


TRACKS = [
    ("u01", "UNIT 1 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U01_Audio_1.1.mp3"),
    ("u02", "UNIT 2 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U02_Audio_2.1.mp3"),
    ("u03", "UNIT 3 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U03_Audio_3.1.mp3"),
    ("u04", "UNIT 4 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U04_Audio_4.1.mp3"),
    ("mid1", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L1_TST_LS_MID_Audio_MID_1.mp3"),
    ("mid2", "MID-LEVEL AUDIO SCRIPT", "UL2v2_L1_TST_LS_MID_Audio_MID_2.mp3"),
    ("u05", "UNIT 5 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U05_Audio_5.1.mp3"),
    ("u06", "UNIT 6 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U06_Audio_6.1.mp3"),
    ("u07", "UNIT 7 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U07_Audio_7.1.mp3"),
    ("u08", "UNIT 8 AUDIO SCRIPT", "UL2v2_L1_TST_LS_U08_Audio_8.1.mp3"),
    ("end1", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L1_TST_LS_END_Audio_END_1.mp3"),
    ("end2", "END-OF-LEVEL AUDIO SCRIPT", "UL2v2_L1_TST_LS_END_Audio_END_2.mp3"),
]

SCRIPT_LINE_PATCHES = {
    "u06": [
        {
            "after": "Lucas: OK, I want to get a desk for my room, oh, and a wooden bookcase for all my books.",
            "line": "And lots of other things as well come to think of it.",
            "source": "asr_audio_gap_patch",
        },
    ],
}


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def sha1_file(path):
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ffprobe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        text=True,
        capture_output=True,
    )
    return float(result.stdout.strip())


def read_docx_paragraphs(path):
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as docx:
        root = ET.fromstring(docx.read("word/document.xml"))
    paragraphs = []
    for para in root.findall(".//w:p", ns):
        texts = [node.text or "" for node in para.findall(".//w:t", ns)]
        paragraphs.append(re.sub(r"\s+", " ", "".join(texts)).strip())
    return paragraphs


def find_heading(paragraphs, heading, start=0):
    target = heading.upper()
    for index in range(start, len(paragraphs)):
        if paragraphs[index].upper() == target:
            return index
    raise ValueError(f"missing heading: {heading}")


def next_boundary(paragraphs, start):
    patterns = [
        r"^UNIT \d+ LISTENING TEST$",
        r"^MID-LEVEL LISTENING TEST$",
        r"^END-OF-LEVEL LISTENING TEST$",
        r"^TEST ANSWERS AND AUDIO SCRIPTS$",
    ]
    for index in range(start + 1, len(paragraphs)):
        text = paragraphs[index].strip()
        if any(re.match(pattern, text, re.I) for pattern in patterns):
            return index
    return len(paragraphs)


def clean_script_lines(lines):
    cleaned = []
    for line in lines:
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        compact = re.sub(r"\s+", "", line)
        if re.fullmatch(r"[0-9.]+", compact) and "." in compact:
            continue
        if re.fullmatch(r"(?i)(?:MID[12]|END[12])+", compact):
            continue
        if re.fullmatch(r"\d+(?:\.\d+)?", line):
            continue
        if "© Cambridge University Press" in line:
            continue
        if line in {"p b", "TEST ANSWERS AND AUDIO SCRIPTS"}:
            continue
        cleaned.append(line)
    return cleaned


def section_lines(paragraphs, heading):
    start = find_heading(paragraphs, heading)
    end = next_boundary(paragraphs, start)
    return clean_script_lines(paragraphs[start + 1 : end])


def split_dual_section(lines, second_prefix):
    first = []
    second = []
    target = first
    for line in lines:
        if line.startswith(second_prefix):
            target = second
        target.append(line)
    return first, second


def split_sentences(lines):
    output = []
    for line in lines:
        speaker = ""
        body = line
        match = re.match(r"^([^:]{1,32}:)\s+(.*)$", line)
        if match:
            speaker, body = match.group(1), match.group(2)
        parts = re.findall(r".+?(?:[.!?](?=\s|$)|$)", body)
        for index, part in enumerate(parts):
            text = re.sub(r"\s+", " ", part).strip()
            if not text:
                continue
            if index == 0 and speaker:
                text = f"{speaker} {text}"
            output.append(text)
    return output


def apply_script_line_patches(key, lines):
    patches = SCRIPT_LINE_PATCHES.get(key) or []
    if not patches:
        return lines
    output = list(lines)
    for patch in patches:
        try:
            index = output.index(patch["after"])
        except ValueError:
            output.append(patch["line"])
        else:
            output.insert(index + 1, patch["line"])
    return output


def clean_alignment_word(value):
    value = value.lower().replace("’", "'")
    value = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", value)
    if value.endswith("'s"):
        value = value[:-2]
    return value


def alignment_tokens(text):
    text = re.sub(r"^[A-Z][A-Za-z]+(?:\s+\d+)?:\s+", "", text)
    tokens = []
    for raw in re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", text):
        token = clean_alignment_word(raw)
        if token:
            tokens.append(token)
    return tokens


def asr_words(asr_data):
    words = []
    for segment in asr_data.get("segments") or []:
        for item in segment.get("words") or []:
            token = clean_alignment_word(str(item.get("word") or ""))
            if not token:
                continue
            start = item.get("start")
            end = item.get("end")
            if start is None or end is None:
                continue
            words.append({
                "token": token,
                "startMs": int(round(float(start) * 1000)),
                "endMs": int(round(float(end) * 1000)),
            })
    return words


def allocate_unmatched(lines, missing_indexes, left_ms, right_ms):
    if not missing_indexes:
        return {}
    left_ms = max(0, int(left_ms))
    right_ms = max(left_ms + len(missing_indexes), int(right_ms))
    weights = [max(len(re.sub(r"\s+", "", lines[index])), 8) for index in missing_indexes]
    total = sum(weights) or 1
    cursor = left_ms
    allocated = {}
    for offset, index in enumerate(missing_indexes):
        end_ms = right_ms if offset == len(missing_indexes) - 1 else cursor + max(1, round((right_ms - left_ms) * weights[offset] / total))
        allocated[index] = (cursor, min(right_ms, max(end_ms, cursor + 1)))
        cursor = allocated[index][1]
    return allocated


def allocate_lines_word_aligned(track_id, sentences, duration_sec, asr_data):
    duration_ms = int(round(duration_sec * 1000))
    official_tokens = []
    for line_index, text in enumerate(sentences):
        for token in alignment_tokens(text):
            official_tokens.append({"token": token, "lineIndex": line_index})

    words = asr_words(asr_data or {})
    if not official_tokens or not words:
        return allocate_lines(track_id, sentences, duration_sec)
    first_content_start_ms = next((word["startMs"] for word in words if word["startMs"] > 2500), words[0]["startMs"])

    matcher = SequenceMatcher(
        None,
        [item["token"] for item in official_tokens],
        [item["token"] for item in words],
        autojunk=False,
    )
    matched = defaultdict(list)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            continue
        for official_index, word_index in zip(range(i1, i2), range(j1, j2)):
            matched[official_tokens[official_index]["lineIndex"]].append(word_index)

    ranges = {}
    for line_index, indexes in matched.items():
        if not indexes:
            continue
        ranges[line_index] = (
            max(0, words[min(indexes)]["startMs"]),
            min(duration_ms, words[max(indexes)]["endMs"]),
        )

    cursor = 0
    while cursor < len(sentences):
        if cursor in ranges:
            cursor += 1
            continue
        start = cursor
        while cursor < len(sentences) and cursor not in ranges:
            cursor += 1
        previous_end = ranges[start - 1][1] if start > 0 and start - 1 in ranges else first_content_start_ms
        next_start = ranges[cursor][0] if cursor < len(sentences) and cursor in ranges else duration_ms
        ranges.update(allocate_unmatched(sentences, list(range(start, cursor)), previous_end, next_start))

    output = []
    previous_end = 0
    for index, text in enumerate(sentences):
        start_ms, end_ms = ranges.get(index, (previous_end, previous_end + 1))
        start_ms = min(duration_ms, max(0, start_ms))
        end_ms = min(duration_ms, max(start_ms + 1, end_ms))
        if start_ms < previous_end:
            start_ms = previous_end
            end_ms = max(end_ms, start_ms + 1)
        output.append({
            "lineId": f"{track_id}-line-{index + 1}",
            "text": text,
            "startMs": start_ms,
            "endMs": min(duration_ms, end_ms),
        })
        previous_end = output[-1]["endMs"]
    if output:
        output[-1]["endMs"] = duration_ms
    return output


def allocate_lines(track_id, sentences, duration_sec):
    duration_ms = int(round(duration_sec * 1000))
    weights = [max(len(re.sub(r"\s+", "", text)), 8) for text in sentences]
    total_weight = sum(weights) or 1
    cursor = 0
    lines = []
    for index, text in enumerate(sentences):
        end_ms = duration_ms if index == len(sentences) - 1 else cursor + max(900, round(duration_ms * weights[index] / total_weight))
        end_ms = min(duration_ms, max(end_ms, cursor + 1))
        lines.append({
            "lineId": f"{track_id}-line-{index + 1}",
            "text": text,
            "startMs": cursor,
            "endMs": end_ms,
        })
        cursor = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines


def transcribe_medium(model, audio_path):
    result = model.transcribe(str(audio_path), language="en", fp16=False, verbose=False, word_timestamps=True)
    segments = []
    for index, item in enumerate(result.get("segments") or [], 1):
        text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()
        if not text:
            continue
        words = []
        for word in item.get("words") or []:
            word_text = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
            if not word_text:
                continue
            words.append({
                "word": word_text,
                "start": float(word.get("start") or 0),
                "end": float(word.get("end") or 0),
            })
        segment = {
            "index": index,
            "startMs": int(round(float(item.get("start") or 0) * 1000)),
            "endMs": int(round(float(item.get("end") or 0) * 1000)),
            "text": text,
        }
        if words:
            segment["words"] = words
        segments.append(segment)
    return {
        "model": "medium",
        "language": result.get("language") or "en",
        "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
        "segments": segments,
    }


def main():
    parser = argparse.ArgumentParser(description="Build local Unlock1 workbook sentence-level transcript bundle.")
    parser.add_argument("--audio-dir", default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--docx", default=DEFAULT_DOCX)
    parser.add_argument("--out-root", default="data/transcript-build/unlock1-workbook/A1/unlock1")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    out_root = Path(args.out_root)
    asr_dir = out_root / "asr-medium"
    out_root.mkdir(parents=True, exist_ok=True)
    asr_dir.mkdir(parents=True, exist_ok=True)

    paragraphs = read_docx_paragraphs(args.docx)
    by_heading = {}
    for _, heading, _ in TRACKS:
        if heading not in by_heading:
            by_heading[heading] = section_lines(paragraphs, heading)

    mid1, mid2 = split_dual_section(by_heading["MID-LEVEL AUDIO SCRIPT"], "Nour:")
    end1, end2 = split_dual_section(by_heading["END-OF-LEVEL AUDIO SCRIPT"], "Fahd:")

    scripts = {}
    for key, heading, _ in TRACKS:
        if key == "mid1":
            scripts[key] = mid1
        elif key == "mid2":
            scripts[key] = mid2
        elif key == "end1":
            scripts[key] = end1
        elif key == "end2":
            scripts[key] = end2
        else:
            scripts[key] = by_heading[heading]

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
        track_id = f"track-unlock1-workbook-{slug(key)}"
        content_id = f"unlock1-workbook-{slug(key)}"
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
            "audioCloudPath": f"A1/unlock1 练习册/Audio/{file_sha1[:10]}_{file_name}",
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

    manifest = {
        "meta": {
            "level": "A1",
            "series": "unlock1",
            "book": "Unlock 1",
            "module": "workbook",
            "audioDir": str(audio_dir),
            "scriptDocx": str(Path(args.docx)),
            "cloudAudioRoot": "A1/unlock1 练习册/Audio",
            "transcriptCloudPath": "_transcripts/A1/unlock1/workbook-bundle-wordaligned-v2.json",
            "audioCount": len(manifest_tracks),
            "eligibleCount": len(manifest_tracks),
            "asrModel": "medium",
        },
        "tracks": manifest_tracks,
    }
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

    (out_root / "bundle-draft.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_root / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
