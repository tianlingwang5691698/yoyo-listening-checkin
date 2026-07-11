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


DEFAULT_SOURCE_ROOT = Path(
    "/Users/wangtianlong/工作/01_教学与备考/unlock 第三版/ULK2-高清/LS 2/4. 配套音频"
)
DEFAULT_OUTPUT_ROOT = Path("data/transcript-build/unlock2-third-edition/A2/unlock2")
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".aac"}
OFFICIAL_MAIN_TRACK = {
    1: "t02",
    2: "t01",
    3: "t03",
    4: "t02",
    5: "t02",
    6: "t03",
    7: "t01",
    8: "t04",
}


def run_text(command):
    return subprocess.run(command, check=True, text=True, capture_output=True).stdout.strip()


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ffprobe_duration(path):
    return float(
        run_text(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ]
        )
    )


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")


def read_docx_paragraphs(path):
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as docx:
        root = ET.fromstring(docx.read("word/document.xml"))
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
        paragraphs.append(re.sub(r"\s+", " ", "".join(texts)).strip())
    return paragraphs


def parse_official_sections(docx_path):
    paragraphs = read_docx_paragraphs(docx_path)
    start_index = next(
        index
        for index, text in enumerate(paragraphs)
        if index > 90 and re.match(r"^Unit 1, Lesson 2, Exercise 1,", text, re.I)
    )
    sections = []
    current_heading = ""
    current_lines = []
    for text in paragraphs[start_index:]:
        if re.match(r"^Unit \d+, Lesson \d+, Exercise \d+,", text, re.I):
            if current_heading:
                sections.append({"heading": current_heading, "lines": current_lines})
            current_heading = text
            current_lines = []
        elif current_heading and text:
            current_lines.append(text)
    if current_heading:
        sections.append({"heading": current_heading, "lines": current_lines})

    first_main_by_unit = {}
    for section in sections:
        match = re.match(r"^Unit (\d+),", section["heading"], re.I)
        if not match:
            continue
        unit = int(match.group(1))
        first_main_by_unit.setdefault(unit, section)
    return sections, first_main_by_unit


def parse_audio_identity(path):
    match = re.search(r"_U(\d{2})_p(\d+)(?:_X(\d+))?_(t\d{2})$", path.stem, re.I)
    if not match:
        raise ValueError(f"unrecognized audio filename: {path.name}")
    return {
        "unit": int(match.group(1)),
        "page": int(match.group(2)),
        "exercise": int(match.group(3)) if match.group(3) else None,
        "trackCode": match.group(4).lower(),
    }


def clean_token(value):
    value = str(value or "").lower().replace("’", "'")
    value = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", value)
    return value


def text_tokens(text):
    return [
        token
        for token in (clean_token(item) for item in re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", text))
        if token
    ]


def asr_words(asr):
    output = []
    for segment in asr.get("segments") or []:
        for word in segment.get("words") or []:
            start = word.get("start")
            end = word.get("end")
            token = clean_token(word.get("word"))
            if start is None or end is None or not token:
                continue
            output.append(
                {
                    "raw": re.sub(r"\s+", " ", str(word.get("word") or "")).strip(),
                    "token": token,
                    "startMs": int(round(float(start) * 1000)),
                    "endMs": int(round(float(end) * 1000)),
                }
            )
    return output


def split_official_sentences(lines):
    output = []
    for line in lines:
        speaker = ""
        body = line
        match = re.match(r"^([^:]{1,32}:)\s*(.*)$", line)
        if match:
            speaker = match.group(1)
            body = match.group(2)
        parts = re.findall(r".+?(?:[.!?](?=\s|$)|$)", body)
        for index, part in enumerate(parts):
            text = re.sub(r"\s+", " ", part).strip()
            if not text:
                continue
            if speaker and index == 0:
                text = f"{speaker} {text}"
            output.append(text)
    return output


def align_official_sentences(sentences, words, duration_ms):
    official = []
    token_count_by_line = defaultdict(int)
    for line_index, sentence in enumerate(sentences):
        body = re.sub(r"^[^:]{1,32}:\s*", "", sentence)
        for token in text_tokens(body):
            official.append({"token": token, "lineIndex": line_index})
            token_count_by_line[line_index] += 1
    if not official or not words:
        return [], {"matchedTokenRatio": 0, "matchedLineRatio": 0}

    matcher = SequenceMatcher(
        None,
        [item["token"] for item in official],
        [item["token"] for item in words],
        autojunk=False,
    )
    matched = defaultdict(list)
    matched_token_count = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            continue
        for official_index, word_index in zip(range(i1, i2), range(j1, j2)):
            matched[official[official_index]["lineIndex"]].append(word_index)
            matched_token_count += 1

    if len(matched) != len(sentences):
        return [], {
            "matchedTokenRatio": round(matched_token_count / max(1, len(official)), 4),
            "matchedLineRatio": round(len(matched) / max(1, len(sentences)), 4),
        }

    lines = []
    previous_end = 0
    for line_index, text in enumerate(sentences):
        indexes = matched[line_index]
        start_ms = max(previous_end, words[min(indexes)]["startMs"])
        end_ms = max(start_ms + 1, words[max(indexes)]["endMs"])
        lines.append({"text": text, "startMs": start_ms, "endMs": min(duration_ms, end_ms)})
        previous_end = lines[-1]["endMs"]
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines, {
        "matchedTokenRatio": round(matched_token_count / max(1, len(official)), 4),
        "matchedLineRatio": 1,
    }


def is_announcement(text):
    compact = re.sub(r"\s+", " ", text).strip().lower()
    patterns = [
        r"^(?:unit \d+[,.:]?\s*)?track \d+(?:\.\d+)?[.!]?$",
        r"^track \d+(?:\.\d+)?[.!]?$",
        r"^unit \d+[.!]?$",
    ]
    return any(re.match(pattern, compact) for pattern in patterns)


def strip_leading_track_label(words):
    if len(words) >= 4 and words[0]["token"] == "unit":
        if re.fullmatch(r"\d+", words[1]["token"]) and re.fullmatch(r"\d+", words[2]["token"]):
            return words[4:] if re.match(r"^\.\d+\.?$", words[3]["raw"]) else words[3:]
    if len(words) >= 2 and re.fullmatch(r"\d+", words[0]["token"]) and re.match(r"^\.\d+\.?$", words[1]["raw"]):
        return words[2:]
    return words


def asr_sentence_lines(words, asr, duration_ms):
    words = strip_leading_track_label(words)
    lines = []
    current = []

    def flush():
        nonlocal current
        if not current:
            return
        text = "".join(
            ("" if index == 0 or re.match(r"^[,.;:!?'’]", word["raw"]) else " ") + word["raw"]
            for index, word in enumerate(current)
        ).strip()
        if text:
            lines.append(
                {
                    "text": text,
                    "startMs": current[0]["startMs"],
                    "endMs": max(current[0]["startMs"] + 1, current[-1]["endMs"]),
                }
            )
        current = []

    for word in words:
        if current and word["startMs"] - current[-1]["endMs"] >= 1400:
            flush()
        current.append(word)
        if re.search(r"[.!?][\"'’)]*$", word["raw"]) or len(current) >= 36:
            flush()
    flush()

    while len(lines) > 1 and is_announcement(lines[0]["text"]):
        lines.pop(0)
    if not lines:
        for segment in asr.get("segments") or []:
            text = re.sub(r"\s+", " ", str(segment.get("text") or "")).strip()
            if not text or is_announcement(text):
                continue
            lines.append(
                {
                    "text": text,
                    "startMs": int(segment.get("startMs") or 0),
                    "endMs": int(segment.get("endMs") or 0),
                }
            )
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines


def normalize_asr(result, model_name):
    segments = []
    for index, item in enumerate(result.get("segments") or [], 1):
        text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()
        words = []
        for word in item.get("words") or []:
            raw = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
            if not raw or word.get("start") is None or word.get("end") is None:
                continue
            words.append({"word": raw, "start": float(word["start"]), "end": float(word["end"])})
        if text:
            segment = {
                "index": index,
                "startMs": int(round(float(item.get("start") or 0) * 1000)),
                "endMs": int(round(float(item.get("end") or 0) * 1000)),
                "text": text,
                "words": words,
            }
            segments.append(segment)
    return {
        "model": model_name,
        "language": result.get("language") or "en",
        "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
        "segments": segments,
    }


def validate_track(track):
    duration_ms = int(round(float(track["durationSec"]) * 1000))
    lines = track.get("lines") or []
    errors = []
    previous_end = 0
    for index, line in enumerate(lines):
        if not line.get("text"):
            errors.append(f"empty_text:{index + 1}")
        if line["startMs"] < previous_end:
            errors.append(f"overlap:{index + 1}")
        if line["endMs"] <= line["startMs"]:
            errors.append(f"invalid_range:{index + 1}")
        previous_end = line["endMs"]
    if not lines:
        errors.append("empty_lines")
    elif lines[-1]["endMs"] != duration_ms:
        errors.append("last_end_not_duration")
    if lines and is_announcement(lines[0]["text"]):
        errors.append("first_line_announcement")
    return errors


def main():
    parser = argparse.ArgumentParser(description="Build Unlock 2 third-edition full sentence bundle.")
    parser.add_argument("--source-root", default=str(DEFAULT_SOURCE_ROOT))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", choices=["auto", "cpu", "mps"], default="auto")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    args = parser.parse_args()

    source_root = Path(args.source_root)
    output_root = Path(args.output_root)
    asr_dir = output_root / "asr-word-timestamps"
    output_root.mkdir(parents=True, exist_ok=True)
    asr_dir.mkdir(parents=True, exist_ok=True)

    docx_path = source_root / "LS2 PE 音频文本.docx"
    sections, official_main_by_unit = parse_official_sections(docx_path)
    (output_root / "script-text.txt").write_text(
        "\n\n".join(
            f"{section['heading']}\n" + "\n".join(section["lines"])
            for section in sections
        )
        + "\n",
        encoding="utf-8",
    )

    audio_paths = sorted(
        path
        for path in source_root.glob("unit */*")
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
    )
    records = []
    first_by_hash = {}
    for audio_path in audio_paths:
        identity = parse_audio_identity(audio_path)
        file_hash = sha1_file(audio_path)
        duplicate_of = first_by_hash.get(file_hash, "")
        first_by_hash.setdefault(file_hash, audio_path.name)
        duration_sec = ffprobe_duration(audio_path)
        records.append(
            {
                **identity,
                "id": f"unlock2-third-{slug(audio_path.stem)}-{file_hash[:10]}",
                "trackId": f"track-unlock2-third-{slug(audio_path.stem)}-{file_hash[:10]}",
                "title": audio_path.stem,
                "fileName": audio_path.name,
                "sourcePath": str(audio_path),
                "audioCloudPath": f"A2/unlock2 第三版/Audio/{file_hash[:10]}_{audio_path.name}",
                "durationSec": duration_sec,
                "durationMs": int(round(duration_sec * 1000)),
                "size": audio_path.stat().st_size,
                "sha1": file_hash,
                "isShortUnder60Sec": duration_sec < 60,
                "duplicateOf": duplicate_of,
                "status": "eligible_full_import",
            }
        )

    model = None
    device = args.device
    if device == "auto":
        try:
            import torch

            device = "mps" if torch.backends.mps.is_available() else "cpu"
        except ImportError:
            device = "cpu"
    if not args.skip_asr:
        import whisper
        import torch

        if device == "mps":
            import whisper.timing as whisper_timing

            # OpenAI Whisper's DTW helper casts on-device tensors to float64 before
            # moving them to CPU. MPS has no float64, so move/cast in the safe order.
            whisper_timing.dtw = lambda value: whisper_timing.dtw_cpu(value.float().cpu().numpy())
            model = whisper.load_model(args.model, device="cpu")
            alignment_heads = model._buffers.pop("alignment_heads")
            model.to("mps")
            model.register_buffer("alignment_heads", alignment_heads, persistent=False)
        else:
            model = whisper.load_model(args.model, device=device)

    asr_by_hash = {}
    for index, record in enumerate(records, 1):
        asr_path = asr_dir / f"{Path(record['fileName']).stem}.json"
        canonical_path = asr_by_hash.get(record["sha1"])
        if asr_path.exists() and not args.force_asr:
            canonical_path = asr_path
        elif canonical_path and canonical_path.exists() and not args.force_asr:
            asr_path.write_text(canonical_path.read_text(encoding="utf-8"), encoding="utf-8")
        elif model:
            result = model.transcribe(
                record["sourcePath"],
                language="en",
                fp16=device != "cpu",
                verbose=False,
                word_timestamps=True,
            )
            asr_path.write_text(
                json.dumps(normalize_asr(result, args.model), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            canonical_path = asr_path
            print(f"asr {index}/{len(records)} {record['fileName']}", flush=True)
        if asr_path.exists():
            asr_by_hash[record["sha1"]] = asr_path
            record["asrPath"] = str(asr_path)
        else:
            record["asrPath"] = ""

    bundle = {}
    transcript_draft = []
    validation = []
    for record in records:
        if not record["asrPath"]:
            continue
        asr = json.loads(Path(record["asrPath"]).read_text(encoding="utf-8"))
        words = asr_words(asr)
        lines = []
        alignment = {"matchedTokenRatio": 0, "matchedLineRatio": 0}
        source_type = "whisper_asr"
        transcript_status = "asr_word_timestamps_sentence_draft"
        official_section = None
        if record["trackCode"] == OFFICIAL_MAIN_TRACK.get(record["unit"]):
            official_section = official_main_by_unit.get(record["unit"])
        if official_section:
            official_sentences = split_official_sentences(official_section["lines"])
            lines, alignment = align_official_sentences(official_sentences, words, record["durationMs"])
            if lines:
                source_type = "official_practice_extra_docx"
                transcript_status = "official_text_whisper_word_aligned_draft"
        if not lines:
            lines = asr_sentence_lines(words, asr, record["durationMs"])

        finalized_lines = []
        for line_index, line in enumerate(lines, 1):
            finalized_lines.append(
                {
                    "lineId": f"{record['trackId']}-line-{line_index}",
                    "text": line["text"],
                    "startMs": int(line["startMs"]),
                    "endMs": int(line["endMs"]),
                }
            )
        track = {
            "trackId": record["trackId"],
            "contentId": record["id"],
            "title": record["title"],
            "fileName": record["fileName"],
            "audioCloudPath": record["audioCloudPath"],
            "durationSec": record["durationSec"],
            "syncGranularity": "line",
            "transcriptStatus": transcript_status,
            "sourceType": source_type,
            "asrModel": asr.get("model") or args.model,
            "asrDevice": device,
            "timingSource": f"whisper_{asr.get('model') or args.model}_word_timestamps",
            "officialHeading": official_section["heading"] if official_section and source_type.startswith("official") else "",
            "alignment": alignment,
            "lines": finalized_lines,
        }
        bundle[track["trackId"]] = track
        errors = validate_track(track)
        validation.append({"trackId": track["trackId"], "errors": errors})
        transcript_draft.append(
            {
                "audioTitle": record["title"],
                "status": transcript_status,
                "sourceType": source_type,
                "asrPath": record["asrPath"],
                "track": track,
            }
        )

    manifest = {
        "meta": {
            "level": "A2",
            "series": "unlock2",
            "edition": "third",
            "book": "Unlock 2 Listening, Speaking & Critical Thinking",
            "module": "textbook",
            "fullImportNoDurationFilter": True,
            "audioDir": str(source_root),
            "officialScriptDocx": str(docx_path),
            "cloudAudioRoot": "A2/unlock2 第三版/Audio",
            "transcriptCloudPath": "_transcripts/A2/unlock2-third-edition/bundle-wordaligned-v1.json",
            "asrModel": args.model,
        },
        "tracks": records,
    }
    error_items = [item for item in validation if item["errors"]]
    manual_review_items = []
    for track in bundle.values():
        for line in track["lines"]:
            if re.search(r"\b(?:thank(?:s| you) for watching|subscribe|amara\.org)\b", line["text"], re.I):
                manual_review_items.append(
                    {
                        "trackId": track["trackId"],
                        "lineId": line["lineId"],
                        "text": line["text"],
                        "reason": "possible_asr_outro_hallucination",
                    }
                )
    report = {
        "trackCount": len(records),
        "bundleTrackCount": len(bundle),
        "uniqueAudioHashCount": len(set(item["sha1"] for item in records)),
        "shortUnder60SecCount": sum(1 for item in records if item["isShortUnder60Sec"]),
        "duplicateFileCount": sum(1 for item in records if item["duplicateOf"]),
        "officialTextTrackCount": sum(1 for track in bundle.values() if track["sourceType"].startswith("official")),
        "officialScriptSectionCount": len(sections),
        "officialTranscriptMissingCount": sum(1 for track in bundle.values() if not track["sourceType"].startswith("official")),
        "officialScriptCompatibility": "practice_extra_docx_does_not_match_textbook_audio",
        "asrTextTrackCount": sum(1 for track in bundle.values() if track["sourceType"] == "whisper_asr"),
        "lineCount": sum(len(track["lines"]) for track in bundle.values()),
        "asrDoneCount": sum(1 for item in records if item["asrPath"]),
        "missingTextCount": sum(1 for track in bundle.values() if not track["lines"]),
        "validationErrorCount": len(error_items),
        "validationErrors": error_items,
        "manualReviewCount": len(manual_review_items),
        "manualReviewItems": manual_review_items,
        "policy": {
            "durationFilter": "disabled_by_user_full_import",
            "duplicateFilter": "disabled_by_user_full_import",
            "timing": "real_whisper_word_timestamps_only_no_equal_duration_allocation",
        },
        "outputs": {
            "bundle": str(output_root / "bundle-draft.json"),
            "manifest": str(output_root / "manifest.json"),
            "transcriptDraft": str(output_root / "transcript-draft.json"),
            "report": str(output_root / "clean-report.json"),
            "validation": str(output_root / "validation-report.json"),
        },
    }

    (output_root / "bundle-draft.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_root / "transcript-draft.json").write_text(
        json.dumps(transcript_draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_root / "validation-report.json").write_text(
        json.dumps({"tracks": validation}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_root / "clean-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
