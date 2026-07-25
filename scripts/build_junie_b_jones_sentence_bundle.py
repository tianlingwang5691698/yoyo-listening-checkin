#!/usr/bin/env python3
import argparse
import hashlib
import html
import json
import math
import re
import subprocess
import time
import unicodedata
import zipfile
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path


SOURCE_ROOT = Path("/Users/wangtianlong/资料1/雅思/网课/jonie b joins/R1002《330L-560L》Junie B. Jones系列 28册（6-9岁）音频")
AUDIO_DIR = SOURCE_ROOT / "音频"
PDF_DIR = SOURCE_ROOT / "PDF 格式"
EPUB_DIR = SOURCE_ROOT / "EPUB 格式"
OUT_ROOT = Path("data/transcript-build/junie-b-jones/A1/junie-b-jones")
STATIC_MANIFEST_PATH = Path("cloudfunctions/yoyo/data/static-catalog-manifests.json")
CATEGORY = "juniebjones"
LEVEL = "A1"
SERIES = "Junie B. Jones"
TRANSCRIPT_CLOUD_PATH = "_transcripts/A1/junie-b-jones/bundle-sentence-v1.json"
TRANSCRIPT_TRACK_ROOT = "_transcripts/A1/junie-b-jones/tracks-v1"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slug(value):
    normalized = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def clean_title(name):
    return re.sub(r"\s+", " ", re.sub(r"^\s*\d+\s+", "", Path(name).stem)).strip()


def ffprobe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def list_audio_files():
    items = []
    for path in AUDIO_DIR.glob("*.mp3"):
        match = re.match(r"^(\d{2})\s+(.+)\.mp3$", path.name, flags=re.I)
        if not match:
            raise ValueError(f"bad audio file name: {path.name}")
        items.append({
            "index": int(match.group(1)),
            "title": clean_title(path.name),
            "audioPath": path,
        })
    return sorted(items, key=lambda item: item["index"])


def find_pdf(index):
    matches = sorted(PDF_DIR.glob(f"[[]%02d[]]*.pdf" % index))
    return matches[0] if len(matches) == 1 else None


def find_epub(index):
    matches = sorted(EPUB_DIR.glob(f"[[]%02d[]]*.epub" % index))
    return matches[0] if len(matches) == 1 else None


def extract_pdf_text(pdf_path, out_path):
    if not pdf_path:
        return ""
    if out_path.exists():
        return out_path.read_text(encoding="utf-8", errors="replace")
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True)
    text = result.stdout if result.returncode == 0 else ""
    text = text.replace("\u00a0", " ").replace("\u00ad", "")
    pages = text.split("\f")
    start_index = 0
    for page_index, page in enumerate(pages[:12]):
        normalized = re.sub(r"\s+", " ", page).strip()
        if re.search(r"\b1\s*/\s*[A-Za-z]", normalized) or re.search(r"^\s*1\s*/", page, flags=re.M):
            start_index = page_index
            break
    text = "\f".join(pages[start_index:])
    text = re.sub(r"([A-Za-z])-\s*\n\s*([A-Za-z])", r"\1\2", text)
    text = re.sub(r"(?m)^\s*(\d{1,2})\s*/\s*([^\n]+?)\s*$", r"Chapter \1. \2.", text)
    text = text.replace("\f", "\n\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    return text


def extract_epub_text(epub_path, out_path):
    if not epub_path:
        return ""
    if out_path.exists():
        return out_path.read_text(encoding="utf-8", errors="replace")
    chunks = []
    with zipfile.ZipFile(epub_path) as archive:
        names = sorted(name for name in archive.namelist() if re.search(r"\.(xhtml|html|htm)$", name, flags=re.I))
        for name in names:
            raw = archive.read(name).decode("utf-8", errors="replace")
            raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
            raw = re.sub(r"(?is)<br\s*/?>", "\n", raw)
            raw = re.sub(r"(?is)</(p|div|h[1-6]|li)>", "\n", raw)
            raw = re.sub(r"(?is)<[^>]+>", " ", raw)
            chunks.append(html.unescape(raw))
    text = "\n".join(chunks).replace("\u00a0", " ").replace("\u00ad", "")
    text = re.sub(r"([A-Za-z])-\s*\n\s*([A-Za-z])", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    return text


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


def protect_sentence_abbreviations(text):
    replacements = {}

    def put(value):
        key = f"__ABBR_{len(replacements)}__"
        replacements[key] = value.group(0)
        return key

    text = re.sub(r"\b(Junie\s+B)\.(?=\s+[A-Z][a-z])", put, text)
    text = re.sub(r"\bB\.(?=\s+Jones\b)", put, text)
    text = re.sub(r"\b(Mr|Mrs|Ms|Dr)\.(?=\s+[A-Z][a-z])", put, text)
    text = re.sub(r"\b(Mr|Mrs|Ms|Dr)\.(?=\s+[a-z])", put, text)
    return text, replacements


def official_sentences(official_text):
    flat = re.sub(r"\s+", " ", official_text).strip()
    flat = re.sub(r"\bContents\b.*?(?=Chapter\s+1\.)", "", flat, flags=re.I)
    protected, replacements = protect_sentence_abbreviations(flat)
    parts = re.findall(r".+?(?:[.!?](?:[\"”’']+)?(?=\s|$)|$)", protected)
    sentences = []
    for part in parts:
        text = re.sub(r"\s+", " ", part).strip()
        for key, value in replacements.items():
            text = text.replace(key, value)
        text = re.sub(r"^\s*[•*]\s*", "", text).strip()
        if not text:
            continue
        for candidate in split_long_sentence(text):
            if len(re.findall(r"[A-Za-z0-9]", candidate)) >= 2:
                sentences.append(candidate)
    return sentences


def transcribe(model, audio_path, model_name, device):
    started = time.time()
    result = model.transcribe(
        str(audio_path),
        language="en",
        fp16=device == "cuda",
        verbose=False,
        word_timestamps=True,
        temperature=0,
        condition_on_previous_text=False,
    )
    segments = []
    for segment_index, segment in enumerate(result.get("segments") or [], 1):
        words = []
        for word_index, word in enumerate(segment.get("words") or [], 1):
            text = re.sub(r"\s+", " ", str(word.get("word") or "")).strip()
            if not text:
                continue
            words.append({
                "index": word_index,
                "text": text,
                "startMs": int(round(float(word.get("start") or 0) * 1000)),
                "endMs": int(round(float(word.get("end") or 0) * 1000)),
                "probability": round(float(word.get("probability") or 0), 6),
            })
        segments.append({
            "index": segment_index,
            "text": re.sub(r"\s+", " ", str(segment.get("text") or "")).strip(),
            "startMs": int(round(float(segment.get("start") or 0) * 1000)),
            "endMs": int(round(float(segment.get("end") or 0) * 1000)),
            "words": words,
        })
    return {
        "model": model_name,
        "device": device,
        "language": result.get("language") or "en",
        "elapsedSec": round(time.time() - started, 3),
        "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
        "segments": segments,
    }


def join_words(words):
    text = " ".join(str(item["text"]).strip() for item in words).strip()
    text = re.sub(r"\s+([,.;:!?%])", r"\1", text)
    text = re.sub(r"([(“])\s+", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_token(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii").lower()
    value = value.replace("'s", "s")
    return re.sub(r"[^a-z0-9]+", "", value)


def text_tokens(text):
    return [token for raw in re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", str(text)) if (token := clean_token(raw))]


def whisper_words(asr):
    words = []
    for segment_index, segment in enumerate(asr.get("segments") or []):
        for word in sorted(segment.get("words") or [], key=lambda item: (int(item.get("startMs") or 0), int(item.get("endMs") or 0))):
            token = clean_token(word.get("text") or "")
            start_ms = int(word.get("startMs") or 0)
            end_ms = int(word.get("endMs") or start_ms)
            if token and end_ms > start_ms:
                words.append({
                    "token": token,
                    "segmentIndex": segment_index,
                    "text": str(word.get("text") or "").strip(),
                    "startMs": start_ms,
                    "endMs": end_ms,
                })
    return words


def asr_segment_lines(track_id, asr, duration_ms):
    lines = []
    previous_end = 0
    for segment_index, segment in enumerate(asr.get("segments") or []):
        text = re.sub(r"\s+", " ", str(segment.get("text") or "")).strip()
        start_ms = max(previous_end, int(segment.get("startMs") or 0))
        end_ms = min(duration_ms, max(start_ms + 1, int(segment.get("endMs") or start_ms + 1)))
        if not text_tokens(text) or start_ms >= duration_ms:
            continue
        lines.append({
            "lineId": f"{track_id}-asr-{segment_index + 1}",
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
            "source": "asr-gap-patch",
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
            if word_gap > 14 or time_gap > 9000:
                clusters.append(current)
                current = []
        current.append(word_index)
    if current:
        clusters.append(current)
    return max(clusters, key=lambda item: (len(item), -item[0]), default=[])


def clean_official_sentence(value):
    text = re.sub(r"\s+", " ", str(value)).strip()
    text = re.sub(r"^(?:Page\s+\d+|\d+)\s*$", "", text, flags=re.I)
    text = re.sub(r"\.\.+$", ".", text)
    return text.strip()


def is_non_transcript_asr_patch(text, start_ms):
    normalized = re.sub(r"[^a-z0-9]+", " ", str(text).lower()).strip()
    if start_ms < 30000 and re.search(r"\b(listening library|presents|collection books|read for you|read by|barbara park)\b", normalized):
        return True
    if start_ms < 30000 and re.search(r"\bjunie b jones\b", normalized):
        return True
    if re.fullmatch(r"chapter (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten).{0,80}", normalized):
        return True
    return False


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
            "source": "official-text",
            "sourceLineIndex": source_index + 1,
        })
        matched_word_indexes.update(indexes)
        previous_end = end_ms

    fallback_lines = []
    excluded_patches = []
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
        excluded_reason = ""
        if end_ms - start_ms < 1200:
            excluded_reason = "short residual ASR overlap with official sentence"
        elif is_non_transcript_asr_patch(segment["text"], start_ms):
            excluded_reason = "audio intro/title/chapter label excluded from transcript body"
        if excluded_reason:
            excluded_patches.append({
                **segment,
                "startMs": start_ms,
                "endMs": end_ms,
                "reason": excluded_reason,
            })
            continue
        fallback_lines.append({**segment, "startMs": start_ms, "endMs": end_ms})

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
        "officialLineCount": sum(1 for line in lines if line.get("source") == "official-text"),
        "asrPatchLineCount": sum(1 for line in lines if line.get("source") == "asr-gap-patch"),
        "excludedAsrPatchCount": len(excluded_patches),
        "excludedAsrPatches": excluded_patches,
    }


def asr_sentence_lines(track_id, asr, duration_ms):
    groups = []
    current = []
    for segment in asr.get("segments") or []:
        for word in sorted(segment.get("words") or [], key=lambda item: (item["startMs"], item["endMs"])):
            if current and int(word["startMs"]) - int(current[-1]["endMs"]) >= 1400:
                groups.append(current)
                current = []
            current.append(word)
            if re.search(r"[.!?][\"'’”)]*$", str(word["text"])) or len(current) >= 34:
                groups.append(current)
                current = []
        if current:
            groups.append(current)
            current = []
    lines = []
    previous_end = 0
    for group in groups:
        text = join_words(group)
        if not text:
            continue
        start_ms = max(previous_end, max(0, int(group[0]["startMs"])))
        end_ms = min(duration_ms, max(start_ms + 1, int(group[-1]["endMs"])))
        lines.append({
            "lineId": f"{track_id}-line-{len(lines) + 1}",
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
        })
        previous_end = end_ms
    if lines:
        lines[-1]["endMs"] = duration_ms
    return lines


def validate_lines(lines, duration_ms):
    errors = []
    previous_end = -1
    if not lines:
        return ["no transcript lines"]
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
            errors.append(f"line {index}: duration exceeds 45s")
        if re.search(r"\btrack\s+\d+(?:\.\d+)?\b", str(line.get("text") or ""), flags=re.I):
            errors.append(f"line {index}: track label appears in transcript")
        previous_end = end_ms
    if int(lines[-1]["endMs"]) != duration_ms:
        errors.append("last line does not end at audio duration")
    return errors


def update_static_manifest(manifest_tracks):
    static_manifest = read_json(STATIC_MANIFEST_PATH)
    rows = static_manifest.setdefault("categories", {}).setdefault(CATEGORY, [])
    row_by_id = {item.get("taskId"): item for item in rows}
    for item in manifest_tracks:
        row = row_by_id.get(item["id"])
        if not row:
            continue
        row["transcriptTrackId"] = item["trackId"]
        row["transcriptStatus"] = "ready" if not item["validationErrors"] else "candidate-unverified"
        row["syncGranularity"] = "line"
        row["validationStatus"] = item["validationStatus"]
        row["textSource"] = {
            "sourceType": "transcript-track",
            "title": "Junie B. Jones sentence transcript",
            "filePath": item["transcriptTrackCloudPath"],
        }
    static_manifest["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    write_json(STATIC_MANIFEST_PATH, static_manifest)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--force-asr", action="store_true")
    parser.add_argument("--update-static", action="store_true")
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--end-index", type=int, default=28)
    args = parser.parse_args()

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    asr_dir = OUT_ROOT / f"asr-{args.model}"
    official_dir = OUT_ROOT / "official-text"
    asr_dir.mkdir(parents=True, exist_ok=True)

    model = None
    if not args.skip_asr:
        import whisper
        model = whisper.load_model(args.model, device=args.device)

    existing_manifest = read_json(OUT_ROOT / "manifest.json", {"tracks": []})
    existing_by_index = {int(item["index"]): item for item in existing_manifest.get("tracks") or []}
    bundle = read_json(OUT_ROOT / "bundle-sentence-v1.json", {})
    tracks = []
    validation_errors = []
    for item in list_audio_files():
        if item["index"] < args.start_index or item["index"] > args.end_index:
            if item["index"] in existing_by_index:
                tracks.append(existing_by_index[item["index"]])
            continue
        index = item["index"]
        title = item["title"]
        track_id = f"track-junie-b-jones-{index:03d}"
        content_id = f"junie-b-jones-{index:03d}"
        duration_sec = ffprobe_duration(item["audioPath"])
        duration_ms = int(round(duration_sec * 1000))
        file_slug = slug(title)
        asr_path = asr_dir / f"{index:03d}-{file_slug}.json"
        pdf_path = find_pdf(index)
        epub_path = find_epub(index)
        official_text_path = official_dir / f"{index:03d}-{file_slug}.txt"
        official_source = "pdf" if pdf_path else "epub"
        official_text = extract_pdf_text(pdf_path, official_text_path) if pdf_path else extract_epub_text(epub_path, official_text_path)
        sentences = official_sentences(official_text)
        if model and (args.force_asr or not asr_path.exists()):
            asr = transcribe(model, item["audioPath"], args.model, args.device)
            write_json(asr_path, asr)
        asr = read_json(asr_path, {})
        aligned = align_official_sentences(track_id, sentences, asr, duration_ms)
        lines = aligned["lines"] if sentences else asr_sentence_lines(track_id, asr, duration_ms)
        errors = validate_lines(lines, duration_ms)
        validation_errors.extend(f"{track_id}: {error}" for error in errors)
        script_patches = [{
            "type": "official-source",
            "sourceType": official_source,
            "sourcePath": str(pdf_path or epub_path or ""),
            "officialTextPath": str(official_text_path) if official_text else "",
            "officialSentenceCount": len(sentences),
            "note": "Transcript body uses official text when aligned; Whisper supplies real word-level timing and ASR gap checks.",
        }]
        excluded_patches = aligned.get("excludedAsrPatches") or []
        if excluded_patches:
            script_patches.append({
                "type": "excluded-asr-gap-audit",
                "count": len(excluded_patches),
                "sample": [{
                    "startMs": patch["startMs"],
                    "endMs": patch["endMs"],
                    "text": patch["text"],
                    "reason": patch["reason"],
                } for patch in excluded_patches[:20]],
            })
        for patch_index, line in enumerate((item for item in lines if item.get("source") == "asr-gap-patch"), 1):
            script_patches.append({
                "type": "asr-gap-patch",
                "index": patch_index,
                "lineId": line["lineId"],
                "startMs": line["startMs"],
                "endMs": line["endMs"],
                "text": line["text"],
                "reason": "Audio range was not confidently aligned to an official-text sentence.",
            })
        track = {
            "trackId": track_id,
            "contentId": content_id,
            "title": title,
            "fileName": item["audioPath"].name,
            "mediaType": "audio",
            "syncGranularity": "line",
            "source": f"whisper-{args.model}-word-timestamps",
            "textSource": "official-text-primary-whisper-word-timing",
            "durationSec": round(duration_sec, 3),
            "lines": lines,
            "scriptPatches": script_patches,
            "alignmentStats": {key: aligned[key] for key in (
                "officialTokenCount",
                "asrWordCount",
                "matchedAsrWordCount",
                "asrWordCoverage",
                "officialTokenCoverage",
                "officialLineCount",
                "asrPatchLineCount",
                "excludedAsrPatchCount",
            )} if sentences else {},
        }
        bundle[track_id] = track
        base_manifest = existing_by_index.get(index, {})
        manifest_item = {
            **base_manifest,
            "index": index,
            "level": LEVEL,
            "id": content_id,
            "trackId": track_id,
            "title": title,
            "sourcePath": str(item["audioPath"]),
            "durationSec": round(duration_sec, 3),
            "lineCount": len(lines),
            "asrPath": str(asr_path),
            "officialPdfPath": str(pdf_path) if pdf_path else "",
            "officialEpubPath": str(epub_path) if epub_path else "",
            "officialTextPath": str(official_text_path) if official_text else "",
            "officialTextCharCount": len(official_text),
            "officialSentenceCount": len(sentences),
            "officialLineCount": int(aligned.get("officialLineCount") or 0),
            "asrPatchLineCount": int(aligned.get("asrPatchLineCount") or 0),
            "excludedAsrPatchCount": int(aligned.get("excludedAsrPatchCount") or 0),
            "officialTokenCoverage": aligned.get("officialTokenCoverage"),
            "asrWordCoverage": aligned.get("asrWordCoverage"),
            "validationStatus": "official-text-primary-whisper-word-timestamps",
            "validationErrors": errors,
            "transcriptTrackCloudPath": f"{TRANSCRIPT_TRACK_ROOT}/{track_id}.json",
        }
        tracks.append(manifest_item)
        write_json(OUT_ROOT / "tracks-v1" / f"{track_id}.json", track)
        print(f"{index}/28 {title} lines={len(lines)} official={manifest_item['officialLineCount']} asrPatch={manifest_item['asrPatchLineCount']} errors={len(errors)}")

    tracks = sorted({int(item["index"]): item for item in tracks}.values(), key=lambda item: item["index"])
    manifest = {
        **existing_manifest,
        "meta": {
            **(existing_manifest.get("meta") or {}),
            "level": LEVEL,
            "category": CATEGORY,
            "series": SERIES,
            "audioSourceDir": str(AUDIO_DIR),
            "pdfSourceDir": str(PDF_DIR),
            "epubSourceDir": str(EPUB_DIR),
            "transcriptCloudPath": TRANSCRIPT_CLOUD_PATH,
            "transcriptTrackRoot": TRANSCRIPT_TRACK_ROOT,
            "expectedTrackCount": 28,
            "asrModel": args.model,
            "timing": "real-whisper-word-timestamps-no-equal-duration-allocation",
            "textSource": "official-text-primary-whisper-word-timing",
        },
        "tracks": tracks,
    }
    sample_audit = []
    for track in tracks:
        built_track = bundle.get(track["trackId"]) or {}
        built_lines = built_track.get("lines") or []
        if not built_lines:
            continue
        middle_index = len(built_lines) // 2
        sample_audit.append({
            "trackId": track["trackId"],
            "title": track["title"],
            "first": built_lines[0],
            "middle": built_lines[middle_index],
            "last": built_lines[-1],
        })
    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "level": LEVEL,
        "category": CATEGORY,
        "trackCount": len(tracks),
        "bundleTrackCount": len(bundle),
        "asrDoneCount": sum(1 for item in tracks if item.get("asrPath") and Path(item["asrPath"]).exists()),
        "officialPdfCount": sum(1 for item in tracks if item.get("officialPdfPath")),
        "officialEpubCount": sum(1 for item in tracks if item.get("officialEpubPath")),
        "lineCount": sum(int(item.get("lineCount") or 0) for item in tracks),
        "officialLineCount": sum(int(item.get("officialLineCount") or 0) for item in tracks),
        "asrPatchLineCount": sum(int(item.get("asrPatchLineCount") or 0) for item in tracks),
        "excludedAsrPatchCount": sum(int(item.get("excludedAsrPatchCount") or 0) for item in tracks),
        "durationSec": round(sum(float(item.get("durationSec") or 0) for item in tracks), 3),
        "validationErrorCount": len(validation_errors),
        "validationErrors": validation_errors,
        "timing": "real-whisper-word-timestamps-no-equal-duration-allocation",
        "textSource": "official-text-primary-whisper-word-timing",
    }
    write_json(OUT_ROOT / "bundle-sentence-v1.json", bundle)
    write_json(OUT_ROOT / "manifest.json", manifest)
    write_json(OUT_ROOT / "clean-report.json", report)
    write_json(OUT_ROOT / "sample-audit.json", sample_audit)
    if args.update_static:
        update_static_manifest(tracks)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if validation_errors:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
