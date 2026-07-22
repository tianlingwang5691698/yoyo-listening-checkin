#!/usr/bin/env python3
"""Build reviewable CET-4 vocabulary candidates from the scanned source PDF OCR."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_ROOT = ROOT / "tmp/pdfs/cet4-vocab/ocr"
OUTPUT_ROOT = ROOT / "data/dictionary-import/cet4-v1"
LIST_START_PAGES = [
    15, 25, 36, 46, 56, 65, 75, 85, 95, 105, 114, 124, 134, 144, 152,
    163, 172, 183, 193, 203, 213, 223, 233, 243, 252, 262, 272, 282, 292,
    302, 312, 322, 331, 341, 351,
]
SOURCE = "cet4-root-association-random-order-2013-pdf"
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z'-]{1,34}$")
HEADING_RE = re.compile(r"^[^A-Za-z]*([A-Za-z][A-Za-z'-]{1,34})(?:\s+|(?=[\[\uff3b]))")
POS_RE = re.compile(r"(?:^|\s)(?:n|v|vt|vi|adj|adv|prep|conj|pron|num)\s*[.\uff0e]", re.I)
BLOCK_PREFIX_RE = re.compile(r"^[\u3010\[]?(?:\u4f8b|\u8bb0|\u8003|\u89e3|\u6ce8|\u642d|\u6d3e|\u8fa8|\u7528|\u8bcd|\u771f\u9898)")
BLOCKED = {
    "word", "list", "page", "four", "cet", "the", "a", "an", "to", "of", "in",
    "on", "for", "with", "from", "and", "or", "as", "at", "by", "this", "that",
}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_rows(page):
    path = OCR_ROOT / f"page-{page:03d}.jpg.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    return sorted(payload.get("rows", []), key=lambda row: (-float(row.get("y", 0)), float(row.get("x", 0))))


def grouped_lines(rows):
    lines = []
    for row in rows:
        if not lines or abs(float(lines[-1][0].get("y", 0)) - float(row.get("y", 0))) > 0.009:
            lines.append([row])
        else:
            lines[-1].append(row)
    return [sorted(line, key=lambda row: float(row.get("x", 0))) for line in lines]


def line_text(line):
    return clean(" ".join(clean(row.get("text")) for row in line))


def heading_candidate(line):
    text = line_text(line)
    if not text or BLOCK_PREFIX_RE.match(text) or re.search(r"Word\s+List|\u56db\u7ea7\u8bcd\u6c47", text, re.I):
        return None
    match = HEADING_RE.match(text)
    if not match:
        return None
    word = match.group(1).lower()
    if word in BLOCKED or not WORD_RE.fullmatch(word):
        return None
    x = min(float(row.get("x", 0)) for row in line)
    if x > 0.19:
        return None
    tail = text[match.end():]
    has_phonetic = bool(re.search(r"[\[\uff3b/].{1,30}[\]\uff3d/]", tail))
    has_pos = bool(POS_RE.search(tail))
    isolated = len(line) >= 2 and clean(line[0].get("text")).lower().strip(" \u2022o0") == word
    if not (has_phonetic or has_pos or isolated):
        return None
    return word


def definition_from_line(text, word):
    value = re.sub(rf"^[^A-Za-z]*{re.escape(word)}\s*", "", text, flags=re.I)
    value = re.sub(r"^[\[\uff3b/][^\]\uff3d/]{1,40}[\]\uff3d/]\s*", "", value)
    value = clean(value)
    return value if re.search(r"[\u3400-\u9fff]", value) else ""


def list_for_page(page):
    for index in range(len(LIST_START_PAGES) - 1, -1, -1):
        if page >= LIST_START_PAGES[index]:
            return index + 1
    return 0


def parse_page(page):
    lines = grouped_lines(load_rows(page))
    entries = []
    for line in lines:
        word = heading_candidate(line)
        if not word:
            continue
        text = line_text(line)
        entries.append({
            "word": word,
            "wordLower": word,
            "level": "cet4",
            "list": list_for_page(page),
            "phonetic": "",
            "definitions": [definition_from_line(text, word)],
            "example": "",
            "exampleMeaning": "",
            "source": SOURCE,
            "sourcePage": page,
            "ocrHeading": text,
        })
    return entries


def main():
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    all_rows = []
    report = {"source": SOURCE, "lists": [], "total": 0, "emptyDefinitions": 0}
    for list_number, start_page in enumerate(LIST_START_PAGES, 1):
        end_page = LIST_START_PAGES[list_number] - 1 if list_number < len(LIST_START_PAGES) else 361
        rows = []
        for page in range(start_page, end_page + 1):
            rows.extend(parse_page(page))
        target = OUTPUT_ROOT / f"candidate-list-{list_number}.json"
        target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["lists"].append({"list": list_number, "startPage": start_page, "endPage": end_page, "count": len(rows)})
        report["total"] += len(rows)
        report["emptyDefinitions"] += sum(not row["definitions"][0] for row in rows)
        all_rows.extend(rows)
    (OUTPUT_ROOT / "ocr-candidate-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_ROOT / "ocr-candidates.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
