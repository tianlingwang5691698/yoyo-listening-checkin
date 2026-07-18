#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tmp/pdfs/ielts-vocab/pages"
OUTPUT = ROOT / "data/dictionary-import/ielts-vocabulary-v1"
FINAL_OUTPUT = ROOT / "data/dictionary-import/ielts-examples-v1/ielts"
FALLBACKS = json.loads((ROOT / "data/dictionary-import/ielts-example-fallbacks.json").read_text(encoding="utf-8"))
START_PRINTED = [
    1, 11, 21, 31, 41, 51, 61, 72, 82, 92, 103, 113, 122, 131, 140, 150,
    160, 170, 179, 189, 199, 209, 218, 228, 237, 246, 255, 265, 275, 285, 294,
    305, 315, 325, 336, 346, 357, 367, 377, 388, 399, 410, 419, 429, 439, 448,
    460, 471,
]
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z' -]{0,38}[*'\"`.,，、]*$")
POS_RE = re.compile(r"^(?:n|v|vt|vi|a|ad|adv|prep|conj|pron|num|excl)\s*[./，,:：]|^\([^)]+\)\s*(?:n|v|a)", re.I)
BLOCKED = {"word list", "mp", "example", "index"}
DICTIONARY = {line.lower() for line in Path('/usr/share/dict/words').read_text(errors='ignore').splitlines()}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_word(value):
    value = clean(value).lower().strip(" *'\"`.,，、口oO•")
    value = re.sub(r"\s+", " ", value)
    value = {"rientation": "orientation", "ak": "oak", "bamb": "bamboo"}.get(value, value)
    if value not in DICTIONARY and f"o{value}" in DICTIONARY:
        value = f"o{value}"
    if value not in DICTIONARY and value[:1] in {"i", "h"} and f"l{value[1:]}" in DICTIONARY:
        value = f"l{value[1:]}"
    return value


def page_rows(page):
    path = OCR / f"page-{page:03d}.jpg.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [row for row in payload.get("rows", []) if float(row.get("y", 0)) >= 0.065]


def same_line(a, b):
    return abs(float(a.get("y", 0)) - float(b.get("y", 0))) <= 0.011


def heading_candidates(rows, first_page=False):
    candidates = []
    for index, row in enumerate(rows):
        text = clean(row.get("text"))
        x = float(row.get("x", 0))
        if first_page and float(row.get("y", 0)) > 0.60:
            continue
        if x > 0.20 or not WORD_RE.fullmatch(text) or text.lower().startswith(("word list", "mp3")):
            continue
        word = clean_word(text)
        if not word or word in BLOCKED or len(word) < 2:
            continue
        if "'" in word:
            continue
        paired = sorted((other for other in rows if float(other.get("x", 0)) >= 0.24 and same_line(row, other)), key=lambda item: float(item.get("x", 0)))
        definition = clean(" ".join(clean(item.get("text")) for item in paired))
        if definition.startswith("例"):
            continue
        if definition.startswith(("口", "运", "脚", "腳", "腦", "搭", "记", "派")) or definition.count("口") >= 3:
            continue
        if re.match(r"^[A-Za-z][A-Za-z' -]+\s+(?:n|v|vt|vi|a|ad|adv)\s*[.]", definition, re.I):
            continue
        if not definition or not (POS_RE.search(definition) or re.search(r"[\u3400-\u9fff]", definition)):
            continue
        candidates.append((index, row, word, definition))
    return candidates


def extract_example(block):
    start = next((index for index, item in enumerate(block) if re.match(r"^例\s*", clean(item.get("text")))), None)
    if start is None:
        start = next((index for index, item in enumerate(block) if re.match(r"^[A-Z][A-Za-z]", clean(item.get("text"))) and len(clean(item.get("text")).split()) >= 4), None)
    if start is None:
        start = next((index for index, item in enumerate(block) if re.match(r"^(?:搭|脚|腳|腦)\s*[A-Za-z]", clean(item.get("text")))), None)
    if start is None:
        return "", ""
    parts = []
    for item in block[start:]:
        text = clean(item.get("text"))
        if parts and re.match(r"^(?:记|搭|派|考|注|辨|用)\s*", text):
            break
        parts.append(text)
    combined = clean(" ".join(parts))
    combined = re.sub(r"^(?:例|搭|脚|腳|腦)\s*", "", combined)
    match = re.search(r"[\u3400-\u9fff]", combined)
    if not match:
        return combined, ""
    return clean(combined[:match.start()]), clean(combined[match.start():])


def parse_page(page, list_number, first_page=False):
    rows = page_rows(page)
    candidates = heading_candidates(rows, first_page)
    entries = []
    for candidate_index, (row_index, row, word, definition) in enumerate(candidates):
        next_row_index = candidates[candidate_index + 1][0] if candidate_index + 1 < len(candidates) else len(rows)
        block = rows[row_index:next_row_index]
        phonetic = ""
        for item in block[1:5]:
            text = clean(item.get("text"))
            if float(item.get("x", 0)) < 0.22 and re.search(r"[\[\]［］]", text):
                phonetic = text
                break
        example, example_meaning = extract_example(block)
        if not example or not example_meaning:
            example, example_meaning = FALLBACKS.get(word, [example, example_meaning])
        entries.append({
            "word": word,
            "wordLower": word,
            "level": "ielts",
            "list": list_number,
            "phonetic": phonetic,
            "definitions": [definition],
            "example": example,
            "exampleMeaning": example_meaning,
            "exampleSource": "ielts-root-association-random-order-pdf",
            "source": "ielts-root-association-random-order-pdf-vision-ocr",
            "sourcePage": page,
        })
    return entries


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    FINAL_OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {"lists": [], "total": 0, "duplicatesWithinList": 0, "emptyDefinitions": 0}
    for index, printed_start in enumerate(START_PRINTED):
        list_number = index + 1
        physical_start = printed_start + 7
        physical_end = (START_PRINTED[index + 1] + 7 - 1) if index + 1 < len(START_PRINTED) else 489
        rows = []
        seen = set()
        for page in range(physical_start, physical_end + 1):
            for row in parse_page(page, list_number, page == physical_start):
                key = row["wordLower"]
                if key in seen:
                    report["duplicatesWithinList"] += 1
                    continue
                seen.add(key)
                rows.append(row)
        target = OUTPUT / f"list-{list_number}.json"
        target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (FINAL_OUTPUT / f"list-{list_number}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["lists"].append({"list": list_number, "startPage": physical_start, "endPage": physical_end, "count": len(rows)})
        report["total"] += len(rows)
        report["emptyDefinitions"] += sum(not row["definitions"][0] for row in rows)
    (OUTPUT / "ocr-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
