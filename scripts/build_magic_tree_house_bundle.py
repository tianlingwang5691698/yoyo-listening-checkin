#!/usr/bin/env python3
"""Build local Magic Tree House A2/B1 sentence bundles with real Whisper timestamps."""

import argparse
import hashlib
import json
import math
import re
import subprocess
import time
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path


AUDIO_DIR = Path("/Users/wangtianlong/工作/未命名文件夹/KL90/3、神奇树屋 Magic Tree House 1-52 （音频）")
PDF_DIR = Path("/Users/wangtianlong/工作/未命名文件夹/KL90/2、神奇树屋Magic Tree House 1-52 （PDF）")
OUT_ROOT = Path("data/transcript-build/magic-tree-house")
DEFAULT_MODEL = Path.home() / ".cache/whisper.cpp/ggml-small.en.bin"
SERIES = "Magic Tree House"
CATEGORY_BY_LEVEL = {
    "A2": "magictreehouse",
    "B1": "magictreehouseb1",
}

TITLES = [
    "Dinosaurs Before Dark",
    "The Knight at Dawn",
    "Mummies in the Morning",
    "Pirates Past Noon",
    "Night of the Ninjas",
    "Afternoon on the Amazon",
    "Sunset of the Sabertooth",
    "Midnight on the Moon",
    "Dolphins at Daybreak",
    "Ghost Town at Sundown",
    "Lions at Lunchtime",
    "Polar Bears Past Bedtime",
    "Vacation Under the Volcano",
    "Day of the Dragon King",
    "Viking Ships at Sunrise",
    "Hour of the Olympics",
    "Tonight on the Titanic",
    "Buffalo Before Breakfast",
    "Tigers at Twilight",
    "Dingoes at Dinnertime",
    "Civil War on Sunday",
    "Revolutionary War on Wednesday",
    "Twister on Tuesday",
    "Earthquake in the Early Morning",
    "Stage Fright on a Summer Night",
    "Good Morning, Gorillas",
    "Thanksgiving on Thursday",
    "High Tide in Hawaii",
    "Christmas in Camelot",
    "Haunted Castle on Hallows Eve",
    "Summer of the Sea Serpent",
    "Winter of the Ice Wizard",
    "Carnival at Candlelight",
    "Season of the Sandstorms",
    "Night of the New Magicians",
    "Blizzard of the Blue Moon",
    "Dragon of the Red Dawn",
    "Monday with a Mad Genius",
    "Dark Day in the Deep Sea",
    "Eve of the Emperor Penguin",
    "Moonlight on the Magic Flute",
    "A Good Night for Ghosts",
    "Leprechaun in Late Winter",
    "A Ghost Tale for Christmas Time",
    "A Crazy Day with Cobras",
    "Dogs in the Dead of Night",
    "Abe Lincoln at Last!",
    "A Perfect Time for Pandas",
    "Stallion by Starlight",
    "Hurry Up, Houdini!",
    "High Time for Heroes",
    "Soccer on Sunday",
]

# Source package defects: #17 is a Sea Monsters fact tracker, while #35/#36
# contain the correct novels under swapped numeric filename prefixes.
PDF_PREFIX_BY_EPISODE = {17: None, 35: 36, 36: 35}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slug(value):
    normalized = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def level_for(index):
    return "A2" if index <= 28 else "B1"


def build_root_for(index):
    return OUT_ROOT / level_for(index) / "magic-tree-house"


def category_for(level):
    return CATEGORY_BY_LEVEL[level]


def find_numbered_file(directory, index, suffix):
    matches = sorted(directory.glob(f"{index:02d}*{suffix}"))
    if len(matches) != 1:
        raise ValueError(f"expected one {suffix} for #{index:02d}, found {[item.name for item in matches]}")
    return matches[0]


def source_files(index):
    audio_matches = sorted(AUDIO_DIR.glob(f"Magic Tree House {index:02d}_*.mp3"))
    if len(audio_matches) != 1:
        raise ValueError(f"expected one MP3 for #{index:02d}, found {[item.name for item in audio_matches]}")
    pdf_prefix = PDF_PREFIX_BY_EPISODE.get(index, index)
    pdf_path = find_numbered_file(PDF_DIR, pdf_prefix, ".pdf") if pdf_prefix else None
    return audio_matches[0], pdf_path


def ffprobe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def pdf_page_count(path):
    result = subprocess.run(["pdfinfo", str(path)], check=True, capture_output=True, text=True)
    match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, flags=re.M)
    if not match:
        raise ValueError(f"missing PDF page count: {path.name}")
    return int(match.group(1))


def extract_pdf_text(path):
    result = subprocess.run(["pdftotext", "-layout", str(path), "-"], check=True, capture_output=True, text=True)
    source = result.stdout.replace("\u00a0", " ").replace("\u00ad", "")
    pages = source.split("\f")
    toc_index = -1
    chapter_one_title = ""
    for page_index, page in enumerate(pages[:25]):
        numbered = re.findall(r"(?m)^\s*\d{1,2}\.\s+([^\n]+?)\s*$", page)
        if re.search(r"\bcontents\b", page, flags=re.I) or len(numbered) >= 5:
            toc_index = page_index
            if numbered and not chapter_one_title:
                chapter_one_title = re.sub(r"\s+", " ", numbered[0]).strip()
    start_index = max(0, toc_index + 1)
    if chapter_one_title:
        for page_index in range(start_index, min(len(pages), start_index + 12)):
            if chapter_one_title.lower() in re.sub(r"\s+", " ", pages[page_index]).lower():
                start_index = page_index
                break
        else:
            for page_index in range(start_index, min(len(pages), start_index + 12)):
                page = pages[page_index]
                if len(re.findall(r"[A-Za-z]", page)) >= 250 and not re.search(r"copyright|library of congress|all rights reserved", page, flags=re.I):
                    start_index = page_index
                    break
    text = "\f".join(pages[start_index:])
    text = re.sub(r"([A-Za-z])-\s*\n\s*([A-Za-z])", r"\1\2", text)
    text = re.sub(r"(?m)^\s*(\d{1,2})\.\s+([^\n]+?)\s*$", r"Chapter \1. \2.", text)
    text = text.replace("\f", "\n\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_long_sentence(text, max_words=45):
    words = text.split()
    if len(words) <= max_words:
        return [text]
    clauses = [item.strip() for item in re.split(r"(?<=[,;:])\s+", text) if item.strip()]
    output = []
    current = []
    for clause in clauses:
        clause_words = clause.split()
        if current and len(current) + len(clause_words) > max_words:
            output.append(" ".join(current))
            current = []
        if len(clause_words) > max_words:
            output.extend(" ".join(clause_words[offset:offset + max_words]) for offset in range(0, len(clause_words), max_words))
        else:
            current.extend(clause_words)
    if current:
        output.append(" ".join(current))
    return output


def official_sentences(pdf_text):
    flat = re.sub(r"\s+", " ", pdf_text).strip()
    parts = re.findall(r".+?(?:[.!?](?:[\"”’']+)?(?=\s|$)|$)", flat)
    sentences = []
    for part in parts:
        text = re.sub(r"\s+", " ", part).strip()
        if not text:
            continue
        for candidate in split_long_sentence(text):
            if len(re.findall(r"[A-Za-z0-9]", candidate)) >= 2:
                sentences.append(candidate)
    return sentences


def clean_token(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii").lower()
    value = value.replace("'s", "s")
    return re.sub(r"[^a-z0-9]+", "", value)


def text_tokens(text):
    return [token for raw in re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", str(text)) if (token := clean_token(raw))]


def run_whisper(audio_path, output_path, model_path, force=False):
    if output_path.exists() and not force:
        return False, 0.0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    prefix = output_path.with_suffix("")
    log_path = output_path.with_suffix(".log")
    started = time.time()
    result = subprocess.run(
        [
            "whisper-cli",
            "-m", str(model_path),
            "-f", str(audio_path),
            "-l", "en",
            "-ojf",
            "-of", str(prefix),
            "-np",
            "-bs", "1",
            "-bo", "1",
            "-nf",
        ],
        capture_output=True,
        text=True,
    )
    log_path.write_text((result.stdout or "") + (result.stderr or ""), encoding="utf-8")
    if result.returncode != 0 or not output_path.exists():
        raise RuntimeError(f"Whisper failed for {audio_path.name}; see {log_path}")
    return True, time.time() - started


def whisper_words(asr):
    words = []
    for segment_index, segment in enumerate(asr.get("transcription") or []):
        current = None
        for item in segment.get("tokens") or []:
            raw = str(item.get("text") or "")
            if not raw or (raw.startswith("[") and raw.endswith("]")):
                continue
            offsets = item.get("offsets") or {}
            start_ms = int(offsets.get("from") or 0)
            end_ms = int(offsets.get("to") or start_ms)
            starts_word = bool(re.match(r"\s", raw))
            has_alnum = bool(re.search(r"[A-Za-z0-9]", raw))
            if starts_word and current:
                token = clean_token(current["text"])
                if token and current["endMs"] > current["startMs"]:
                    words.append({"token": token, "segmentIndex": segment_index, **current})
                current = None
            if current is None and has_alnum:
                current = {"text": raw.strip(), "startMs": start_ms, "endMs": end_ms}
            elif current is not None:
                current["text"] += raw
                current["endMs"] = max(current["endMs"], end_ms)
        if current:
            token = clean_token(current["text"])
            if token and current["endMs"] > current["startMs"]:
                words.append({"token": token, "segmentIndex": segment_index, **current})
    return words


def asr_segment_lines(track_id, asr, duration_ms):
    lines = []
    previous_end = 0
    for segment_index, segment in enumerate(asr.get("transcription") or []):
        text = re.sub(r"\s+", " ", str(segment.get("text") or "")).strip()
        offsets = segment.get("offsets") or {}
        start_ms = max(previous_end, int(offsets.get("from") or 0))
        end_ms = min(duration_ms, max(start_ms + 1, int(offsets.get("to") or start_ms + 1)))
        if not text_tokens(text) or start_ms >= duration_ms:
            continue
        lines.append({
            "lineId": f"{track_id}-asr-{segment_index + 1}",
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms
    return lines


def compact_match_cluster(indexes, words):
    clusters = []
    current = []
    for word_index in sorted(set(indexes)):
        if current:
            previous_index = current[-1]
            word_gap = word_index - previous_index
            time_gap = int(words[word_index]["startMs"]) - int(words[previous_index]["endMs"])
            if word_gap > 12 or time_gap > 8000:
                clusters.append(current)
                current = []
        current.append(word_index)
    if current:
        clusters.append(current)
    return max(clusters, key=lambda item: (len(item), -item[0]), default=[])


def clean_official_sentence(value):
    text = re.sub(r"(?:Demo version limitation\s*)+", "", str(value), flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def align_official_sentences(track_id, sentences, asr, duration_ms):
    official = []
    line_token_counts = defaultdict(int)
    for line_index, sentence in enumerate(sentences):
        for token in text_tokens(clean_official_sentence(sentence)):
            official.append({"token": token, "lineIndex": line_index})
            line_token_counts[line_index] += 1
    words = whisper_words(asr)
    matcher = SequenceMatcher(
        None,
        [item["token"] for item in official],
        [item["token"] for item in words],
        autojunk=False,
    )
    matched = defaultdict(list)
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            matched[official[block.a + offset]["lineIndex"]].append(block.b + offset)
    official_lines = []
    matched_word_indexes = set()
    previous_end = 0
    for source_index, sentence in enumerate(sentences):
        sentence = clean_official_sentence(sentence)
        indexes = compact_match_cluster(matched.get(source_index) or [], words)
        expected = line_token_counts[source_index]
        minimum = 1 if expected <= 2 else max(2, math.ceil(expected * 0.35))
        if len(indexes) < minimum:
            continue
        start_ms = max(previous_end, int(words[indexes[0]]["startMs"]))
        end_ms = min(duration_ms, max(start_ms + 1, int(words[indexes[-1]]["endMs"])))
        if not sentence or start_ms >= duration_ms or end_ms - start_ms > 45000:
            continue
        official_lines.append({
            "lineId": "",
            "text": sentence,
            "startMs": start_ms,
            "endMs": end_ms,
            "sourceLineIndex": source_index + 1,
        })
        matched_word_indexes.update(indexes)
        previous_end = end_ms

    # Official PDFs in this source set contain demo-watermark gaps and some
    # missing pages. Fill those uncovered time ranges with the original
    # Whisper segments instead of stretching a neighbouring PDF sentence.
    fallback_lines = []
    official_cursor = 0
    for segment in asr_segment_lines(track_id, asr, duration_ms):
        midpoint = (segment["startMs"] + segment["endMs"]) // 2
        while official_cursor < len(official_lines) and official_lines[official_cursor]["endMs"] <= midpoint:
            official_cursor += 1
        if official_cursor < len(official_lines):
            active = official_lines[official_cursor]
            if active["startMs"] <= midpoint < active["endMs"]:
                continue
        previous_official_end = official_lines[official_cursor - 1]["endMs"] if official_cursor else 0
        next_official_start = official_lines[official_cursor]["startMs"] if official_cursor < len(official_lines) else duration_ms
        start_ms = max(segment["startMs"], previous_official_end)
        end_ms = min(segment["endMs"], next_official_start)
        if end_ms <= start_ms:
            continue
        fallback_lines.append({
            **segment,
            "startMs": start_ms,
            "endMs": end_ms,
        })

    lines = []
    previous_end = 0
    for line in sorted(official_lines + fallback_lines, key=lambda item: (item["startMs"], item["endMs"])):
        start_ms = max(previous_end, int(line["startMs"]))
        end_ms = min(duration_ms, max(start_ms + 1, int(line["endMs"])))
        if start_ms >= duration_ms or end_ms <= start_ms:
            continue
        normalized = dict(line)
        normalized.update({
            "lineId": f"{track_id}-line-{len(lines) + 1}",
            "startMs": start_ms,
            "endMs": end_ms,
        })
        lines.append(normalized)
        previous_end = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return {
        "lines": lines,
        "asrWords": words,
        "officialTokenCount": len(official),
        "asrWordCount": len(words),
        "matchedAsrWordCount": len(matched_word_indexes),
        "asrWordCoverage": round(len(matched_word_indexes) / max(1, len(words)), 4),
        "officialTokenCoverage": round(len(matched_word_indexes) / max(1, len(official)), 4),
        "officialLineCount": sum(1 for line in lines if line.get("sourceLineIndex")),
        "asrPatchLineCount": sum(1 for line in lines if not line.get("sourceLineIndex")),
    }


def asr_sentence_lines(track_id, asr, duration_ms):
    lines = asr_segment_lines(track_id, asr, duration_ms)
    for index, line in enumerate(lines):
        line["lineId"] = f"{track_id}-line-{index + 1}"
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines


def validate_lines(lines, duration_ms):
    errors = []
    if not lines:
        return ["no transcript lines"]
    previous_end = -1
    for index, line in enumerate(lines, 1):
        start_ms = int(line.get("startMs") or 0)
        end_ms = int(line.get("endMs") or 0)
        if not str(line.get("text") or "").strip():
            errors.append(f"line {index}: empty text")
        if start_ms < previous_end:
            errors.append(f"line {index}: overlaps previous line")
        if previous_end >= 0 and start_ms - previous_end > 30000:
            errors.append(f"line {index}: uncovered gap exceeds 30s ({start_ms - previous_end}ms)")
        if start_ms < 0 or end_ms <= start_ms or end_ms > duration_ms:
            errors.append(f"line {index}: invalid range {start_ms}-{end_ms}/{duration_ms}")
        if end_ms - start_ms > 45000:
            errors.append(f"line {index}: duration exceeds 45s ({end_ms - start_ms}ms)")
        previous_end = end_ms
    if int(lines[-1]["endMs"]) != duration_ms:
        errors.append("last line does not end at audio duration")
    return errors


def metadata_for(index, audio_path, pdf_path):
    title = TITLES[index - 1]
    level = level_for(index)
    duration_sec = ffprobe_duration(audio_path)
    audio_sha1 = sha1_file(audio_path)
    track_id = f"track-magic-tree-house-{index:03d}"
    content_id = f"magic-tree-house-{index:03d}"
    audio_cloud_path = f"{level}/Magic Tree House/Audio/{index:03d}-{slug(title)}-{audio_sha1[:10]}.mp3"
    return {
        "index": index,
        "level": level,
        "title": title,
        "trackId": track_id,
        "id": content_id,
        "audioPath": audio_path,
        "pdfPath": pdf_path,
        "durationSec": duration_sec,
        "durationMs": round(duration_sec * 1000),
        "audioSha1": audio_sha1,
        "audioCloudPath": audio_cloud_path,
    }


def build_one(meta, model_path, force_asr=False):
    index = meta["index"]
    root = build_root_for(index)
    file_slug = slug(meta["title"])
    asr_path = root / "asr-small.en" / f"{index:03d}-{file_slug}.json"
    generated, elapsed = run_whisper(meta["audioPath"], asr_path, model_path, force_asr)
    # whisper.cpp may emit isolated non-UTF-8 bytes for unusual names; keep the
    # timestamped JSON structure and replace only those invalid text bytes.
    asr = json.loads(asr_path.read_text(encoding="utf-8", errors="replace"))
    pdf_text_path = None
    pdf_sha1 = ""
    pdf_pages = 0
    if meta["pdfPath"]:
        pdf_text = extract_pdf_text(meta["pdfPath"])
        pdf_text_path = root / "pdf-text" / f"{index:03d}-{file_slug}.txt"
        pdf_text_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_text_path.write_text(pdf_text + "\n", encoding="utf-8")
        pdf_sha1 = sha1_file(meta["pdfPath"])
        pdf_pages = pdf_page_count(meta["pdfPath"])
        alignment = align_official_sentences(meta["trackId"], official_sentences(pdf_text), asr, meta["durationMs"])
        lines = alignment["lines"]
        source = "official-pdf-plus-whisper-small.en-segment-backbone"
        text_source = str(meta["pdfPath"])
        validation_status = "official-pdf-aligned-candidate"
    else:
        lines = asr_sentence_lines(meta["trackId"], asr, meta["durationMs"])
        alignment = {
            "officialTokenCount": 0,
            "asrWordCount": len(whisper_words(asr)),
            "matchedAsrWordCount": 0,
            "asrWordCoverage": 0,
            "officialTokenCoverage": 0,
            "officialLineCount": 0,
            "asrPatchLineCount": len(lines),
        }
        source = "whisper-small.en-segment-timestamps"
        text_source = "ASR fallback: supplied #17 PDF is Sea Monsters and was rejected"
        validation_status = "asr-only-missing-correct-pdf-candidate"
    errors = validate_lines(lines, meta["durationMs"])
    if meta["pdfPath"] and alignment["asrWordCoverage"] < 0.6:
        errors.append(f"ASR word coverage below threshold: {alignment['asrWordCoverage']:.1%}")
    track = {
        "trackId": meta["trackId"],
        "contentId": meta["id"],
        "title": meta["title"],
        "fileName": meta["audioPath"].name,
        "mediaType": "audio",
        "syncGranularity": "line",
        "source": source,
        "textSource": text_source,
        "durationSec": round(meta["durationSec"], 3),
        "lines": lines,
        "scriptPatches": ([{
            "source": "whisper.cpp-small.en",
            "reason": "official PDF has unmatched or missing audio ranges",
            "lineCount": alignment["asrPatchLineCount"],
        }] if alignment["asrPatchLineCount"] else []),
    }
    durations = [(line["endMs"] - line["startMs"]) / 1000 for line in lines]
    gaps = [(lines[index]["startMs"] - lines[index - 1]["endMs"]) / 1000 for index in range(1, len(lines))]
    manifest_item = {
        "index": index,
        "level": meta["level"],
        "id": meta["id"],
        "trackId": meta["trackId"],
        "title": meta["title"],
        "sourcePath": str(meta["audioPath"]),
        "transcriptSourcePath": str(meta["pdfPath"]) if meta["pdfPath"] else "",
        "audioCloudPath": meta["audioCloudPath"],
        "durationSec": round(meta["durationSec"], 3),
        "size": meta["audioPath"].stat().st_size,
        "sha1": meta["audioSha1"],
        "pdfSha1": pdf_sha1,
        "pdfPageCount": pdf_pages,
        "lineCount": len(lines),
        "officialTokenCount": alignment["officialTokenCount"],
        "asrWordCount": alignment["asrWordCount"],
        "matchedAsrWordCount": alignment["matchedAsrWordCount"],
        "asrWordCoverage": alignment["asrWordCoverage"],
        "officialTokenCoverage": alignment["officialTokenCoverage"],
        "officialLineCount": alignment["officialLineCount"],
        "asrPatchLineCount": alignment["asrPatchLineCount"],
        "maxLineDurationSec": round(max(durations, default=0), 3),
        "maxGapSec": round(max(gaps, default=0), 3),
        "validationStatus": validation_status,
        "validationErrors": errors,
        "asrPath": str(asr_path),
        "pdfTextPath": str(pdf_text_path) if pdf_text_path else "",
        "asrGeneratedNow": generated,
        "asrElapsedSec": round(elapsed, 3),
    }
    return track, manifest_item


def load_existing_level(level):
    root = OUT_ROOT / level / "magic-tree-house"
    bundle_path = root / "bundle-sentence-v2.json"
    manifest_path = root / "manifest.json"
    bundle = json.loads(bundle_path.read_text(encoding="utf-8")) if bundle_path.exists() else {}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"meta": {}, "tracks": []}
    return root, bundle, {item["index"]: item for item in manifest.get("tracks") or []}


def write_level_outputs(level, bundle, items):
    root = OUT_ROOT / level / "magic-tree-house"
    tracks = [items[index] for index in sorted(items)]
    expected = list(range(1, 29)) if level == "A2" else list(range(29, 53))
    transcript_cloud_path = f"_transcripts/{level}/magic-tree-house/bundle-sentence-v2.json"
    transcript_track_root = f"_transcripts/{level}/magic-tree-house/tracks-v2"
    manifest = {
        "meta": {
            "level": level,
            "category": category_for(level),
            "series": SERIES,
            "audioSourceDir": str(AUDIO_DIR),
            "pdfSourceDir": str(PDF_DIR),
            "audioCloudRoot": f"{level}/Magic Tree House/Audio",
            "transcriptCloudPath": transcript_cloud_path,
            "transcriptTrackRoot": transcript_track_root,
            "expectedIndexes": expected,
            "expectedTrackCount": len(expected),
            "asrModel": "whisper.cpp-small.en",
            "transcriptVersion": "sentence-v2",
            "timing": "whisper-segment-backbone-with-official-pdf-text-no-duration-proportional-allocation",
        },
        "tracks": tracks,
    }
    catalog = []
    for item in tracks:
        track_cloud_path = f"{transcript_track_root}/{item['trackId']}.json"
        item["transcriptTrackCloudPath"] = track_cloud_path
        catalog.append({
            "taskId": item["id"],
            "category": category_for(level),
            "title": item["title"],
            "subtitle": f"Magic Tree House · {item['index']}/52",
            "audioCloudPath": item["audioCloudPath"],
            "size": item["size"],
            "repeatTarget": 3,
            "durationSec": item["durationSec"],
            "coverTone": "mint" if item["index"] % 2 else "peach",
            "transcriptTrackId": item["trackId"],
            "transcriptStatus": "ready" if not item["validationErrors"] else "candidate-unverified",
            "syncGranularity": "line",
            "validationStatus": item["validationStatus"],
            "textSource": {
                "sourceType": "transcript-track",
                "title": "Magic Tree House sentence transcript",
                "filePath": track_cloud_path,
            },
        })
    errors = [f"{item['trackId']}: {error}" for item in tracks for error in item["validationErrors"]]
    report = {
        "level": level,
        "expectedTrackCount": len(expected),
        "builtTrackCount": len(tracks),
        "missingIndexes": [index for index in expected if index not in items],
        "officialPdfTrackCount": sum(1 for item in tracks if item["transcriptSourcePath"]),
        "asrFallbackTrackCount": sum(1 for item in tracks if not item["transcriptSourcePath"]),
        "lineCount": sum(item["lineCount"] for item in tracks),
        "durationSec": round(sum(item["durationSec"] for item in tracks), 3),
        "audioBytes": sum(item["size"] for item in tracks),
        "officialLineCount": sum(item.get("officialLineCount", 0) for item in tracks),
        "asrPatchLineCount": sum(item.get("asrPatchLineCount", 0) for item in tracks),
        "maxLineDurationSec": max((item.get("maxLineDurationSec", 0) for item in tracks), default=0),
        "maxGapSec": max((item.get("maxGapSec", 0) for item in tracks), default=0),
        "validationErrorCount": len(errors),
        "validationErrors": errors,
        "timing": "whisper-segment-backbone-with-official-pdf-text-no-duration-proportional-allocation",
    }
    samples = []
    if tracks:
        for offset in sorted({0, len(tracks) // 2, len(tracks) - 1}):
            item = tracks[offset]
            track = bundle[item["trackId"]]
            lines = track["lines"]
            samples.append({
                "trackId": item["trackId"],
                "title": item["title"],
                "firstLine": lines[0] if lines else None,
                "middleLine": lines[len(lines) // 2] if lines else None,
                "lastLine": lines[-1] if lines else None,
                "lastLineEndsAtDuration": bool(lines) and lines[-1]["endMs"] == round(item["durationSec"] * 1000),
            })
    write_json(root / "bundle-sentence-v2.json", bundle)
    for item in tracks:
        write_json(root / "tracks-v2" / f"{item['trackId']}.json", bundle[item["trackId"]])
    write_json(root / "manifest.json", manifest)
    write_json(root / "catalog-items.json", catalog)
    write_json(root / "clean-report.json", report)
    write_json(root / "sample-audit.json", samples)


def build_source_audit(all_meta):
    audit = {
        "audioSourceCount": len(all_meta),
        "pdfSourceCount": len(list(PDF_DIR.glob("*.pdf"))),
        "expectedIndexes": list(range(1, 53)),
        "a2Indexes": list(range(1, 29)),
        "b1Indexes": list(range(29, 53)),
        "sourceDefects": [
            {"episode": 17, "status": "rejected-pdf", "reason": "supplied PDF is Sea Monsters, not Tonight on the Titanic"},
            {"episode": 35, "status": "remapped", "pdfPrefix": 36, "reason": "source PDF numeric prefixes 35/36 are swapped"},
            {"episode": 36, "status": "remapped", "pdfPrefix": 35, "reason": "source PDF numeric prefixes 35/36 are swapped"},
            {"episode": 32, "status": "title-normalized", "reason": "audio says White Wizard; official PDF title is Winter of the Ice Wizard"},
            {"episode": 52, "status": "title-normalized", "reason": "audio filename typo Sunyday; official title is Soccer on Sunday"},
        ],
        "items": [{
            "index": item["index"],
            "level": item["level"],
            "title": item["title"],
            "audioFileName": item["audioPath"].name,
            "pdfFileName": item["pdfPath"].name if item["pdfPath"] else "",
            "durationSec": round(item["durationSec"], 3),
            "audioSize": item["audioPath"].stat().st_size,
            "audioSha1": item["audioSha1"],
        } for item in all_meta],
    }
    write_json(OUT_ROOT / "source-audit.json", audit)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--end-index", type=int, default=52)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    parser.add_argument("--force-asr", action="store_true")
    parser.add_argument("--catalog-only", action="store_true")
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    if not args.catalog_only and not model_path.exists():
        raise FileNotFoundError(f"Whisper model missing: {model_path}")
    if len(TITLES) != 52:
        raise ValueError(f"expected 52 canonical titles, found {len(TITLES)}")
    if len(list(AUDIO_DIR.glob("*.mp3"))) != 52 or len(list(PDF_DIR.glob("*.pdf"))) != 52:
        raise ValueError("source package must contain exactly 52 MP3 and 52 PDF files")

    all_meta = []
    for index in range(1, 53):
        audio_path, pdf_path = source_files(index)
        all_meta.append(metadata_for(index, audio_path, pdf_path))
    build_source_audit(all_meta)
    if args.catalog_only:
        print("CATALOG audio=52 pdf=52 A2=28 B1=24 rejectedPdf=1 remappedPdf=2", flush=True)
        return

    level_state = {}
    for level in ("A2", "B1"):
        _, bundle, items = load_existing_level(level)
        level_state[level] = {"bundle": bundle, "items": items}
    selected = [item for item in all_meta if args.start_index <= item["index"] <= args.end_index]
    selected = selected[:args.limit or None]
    for position, meta in enumerate(selected, 1):
        started = time.time()
        track, manifest_item = build_one(meta, model_path, args.force_asr)
        state = level_state[meta["level"]]
        state["bundle"][meta["trackId"]] = track
        state["items"][meta["index"]] = manifest_item
        if all(item["trackId"] in state["bundle"] for item in state["items"].values()):
            write_level_outputs(meta["level"], state["bundle"], state["items"])
        status = "PASS" if not manifest_item["validationErrors"] else "REVIEW"
        print(
            f"{status} {position}/{len(selected)} episode={meta['index']:02d} level={meta['level']} "
            f"title={meta['title']} duration={meta['durationSec']:.3f}s lines={manifest_item['lineCount']} "
            f"coverage={manifest_item['asrWordCoverage']:.1%} elapsed={time.time() - started:.1f}s",
            flush=True,
        )
    for level in ("A2", "B1"):
        state = level_state[level]
        write_level_outputs(level, state["bundle"], state["items"])


if __name__ == "__main__":
    main()
