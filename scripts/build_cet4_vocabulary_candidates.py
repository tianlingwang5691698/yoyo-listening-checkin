#!/usr/bin/env python3
"""Align the CET-4 PDF OCR with a secondary headword-order reference."""

import html.parser
import json
import re
from difflib import SequenceMatcher
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_ROOT = ROOT / "tmp/pdfs/cet4-vocab/ocr"
REFERENCE_HTML = ROOT / "tmp/pdfs/cet4-vocab/cnblogs.html"
OUTPUT_ROOT = ROOT / "data/dictionary-import/cet4-v1"
LIST_START_PAGES = [
    15, 25, 36, 46, 56, 65, 75, 85, 95, 105, 114, 124, 134, 144, 152,
    163, 172, 183, 193, 203, 213, 223, 233, 243, 252, 262, 272, 282, 292,
    302, 312, 322, 331, 341, 351, 362,
]
SOURCE = "cet4-root-association-random-order-2013-pdf"
REFERENCE_URL = "https://www.cnblogs.com/zhuangjie/p/15244849.html"
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z'()-]*(?:\s+[A-Za-z][A-Za-z'-]*)?$")


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


class ParagraphParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []
        self.paragraphs = []

    def handle_starttag(self, tag, attrs):
        if tag == "p":
            self.active = True
            self.parts = []
        elif tag == "br" and self.active:
            self.parts.append(" ")

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "p" and self.active:
            self.paragraphs.append(clean("".join(self.parts)))
            self.active = False


def parse_reference():
    parser = ParagraphParser()
    parser.feed(REFERENCE_HTML.read_text(encoding="utf-8"))
    lists = {}
    current = None
    for text in parser.paragraphs:
        match = re.fullmatch(r"Word List (\d+)", text, re.I)
        if match:
            current = int(match.group(1))
            lists[current] = []
            continue
        if not current or not text:
            continue
        match = re.match(r"^([A-Za-z][A-Za-z'()-]*(?:\s+[A-Za-z][A-Za-z'-]*)?)", text)
        if match:
            word = match.group(1)
            meaning = clean(text[match.end():])
        elif text.startswith("***") and current == 1:
            word = "clash"
            meaning = clean(text[3:])
        else:
            raise ValueError(f"reference-row-invalid:list-{current}:{text}")
        if not WORD_RE.fullmatch(word):
            raise ValueError(f"reference-word-invalid:list-{current}:{word}")
        word = {
            "successi on": "succession",
            "reservior": "reservoir",
        }.get(word.lower(), word)
        lists[current].append({"word": word, "referenceMeaning": meaning})
    if sorted(lists) != list(range(1, 36)):
        raise ValueError("reference-lists-incomplete")
    return lists


def load_page(page):
    payload = json.loads((OCR_ROOT / f"page-{page:03d}.jpg.json").read_text(encoding="utf-8"))
    rows = sorted(payload.get("rows", []), key=lambda row: (-float(row.get("y", 0)), float(row.get("x", 0))))
    return [{**row, "text": clean(row.get("text"))} for row in rows]


def lookup_word(word):
    return word.lower().replace("(al)", "")


def first_ascii_token(text):
    match = re.match(r"^[^A-Za-z]*([A-Za-z][A-Za-z'-]{1,34})", text)
    return match.group(1).lower() if match else ""


def row_score(row, word):
    text = row["text"]
    x = float(row.get("x", 1))
    y = float(row.get("y", 0))
    if not 0.07 <= y <= 0.93 or x > 0.26:
        return -100
    exact = bool(re.search(rf"(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])", text, re.I))
    token = first_ascii_token(text)
    similarity = SequenceMatcher(None, token, word).ratio() if token else 0
    score = (8 if exact else similarity * 5) + (2 if token == word else 0)
    score += 1 if re.search(r"[\[\uff3b/].{1,35}[\]\uff3d/]", text) else 0
    score += 1 if re.search(r"(?:^|\s)(?:n|v|vt|vi|adj|adv|prep|conj|pron)\s*[.\uff0e]", text, re.I) else 0
    score += max(0, 0.2 - x)
    return score


def locate(rows_by_page, word, exact_only=False, minimum=None, maximum=None):
    key = lookup_word(word)
    candidates = []
    for page, rows in rows_by_page.items():
        for index, row in enumerate(rows):
            position = (page, index)
            if minimum is not None and position <= minimum:
                continue
            if maximum is not None and position >= maximum:
                continue
            score = row_score(row, key)
            exact = bool(re.search(rf"(?<![A-Za-z]){re.escape(key)}(?![A-Za-z])", row["text"], re.I))
            if exact_only and not exact:
                continue
            if score > 2.6:
                candidates.append((score, page, index, exact))
    if not candidates:
        return None
    return max(candidates)


def context_for(rows, index):
    selected = [rows[index]["text"]]
    base_y = float(rows[index].get("y", 0))
    for offset in range(1, 5):
        if index + offset >= len(rows):
            break
        row = rows[index + offset]
        text = row["text"]
        if re.match(r"^[\u3010\[]?(?:\u8bb0|\u4f8b|\u8003|\u89e3|\u6ce8|\u642d|\u6d3e|\u8fa8|\u7528|\u771f\u9898)", text):
            break
        if float(row.get("x", 1)) > 0.32 or base_y - float(row.get("y", 0)) > 0.09:
            break
        selected.append(text)
    return clean(" ".join(selected))


def main():
    references = parse_reference()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    report = {
        "source": SOURCE,
        "referenceUrl": REFERENCE_URL,
        "lists": [],
        "total": 0,
        "exactLocated": 0,
        "fuzzyLocated": 0,
        "unlocated": 0,
    }
    all_rows = []
    for list_number in range(1, 36):
        start_page = LIST_START_PAGES[list_number - 1]
        end_page = LIST_START_PAGES[list_number] - 1
        rows_by_page = {page: load_page(page) for page in range(start_page, end_page + 1)}
        exact_locations = [locate(rows_by_page, item["word"], exact_only=True) for item in references[list_number]]
        output = []
        for reference_index, reference in enumerate(references[list_number]):
            word = reference["word"]
            located = exact_locations[reference_index]
            if not located:
                previous = next(((item[1], item[2]) for item in reversed(exact_locations[:reference_index]) if item), None)
                following = next(((item[1], item[2]) for item in exact_locations[reference_index + 1:] if item), None)
                located = locate(rows_by_page, word, minimum=previous, maximum=following)
            source_page = 0
            ocr_context = ""
            match_type = "unlocated"
            if located:
                score, source_page, index, exact = located
                ocr_context = context_for(rows_by_page[source_page], index)
                match_type = "exact" if exact else "fuzzy"
            else:
                previous = next((item[1] for item in reversed(exact_locations[:reference_index]) if item), start_page)
                following = next((item[1] for item in exact_locations[reference_index + 1:] if item), end_page)
                source_page = max(start_page, min(end_page, round((previous + following) / 2)))
            report[f"{match_type}Located" if match_type != "unlocated" else "unlocated"] += 1
            output.append({
                "word": word,
                "wordLower": word.lower(),
                "level": "cet4",
                "list": list_number,
                "phonetic": "",
                "definitions": [],
                "example": "",
                "exampleMeaning": "",
                "source": SOURCE,
                "sourceFiles": ["四级词汇 词根联想记忆法（乱序版）.pdf"],
                "sourcePage": source_page,
                "referenceMeaning": reference["referenceMeaning"],
                "referenceSource": REFERENCE_URL,
                "ocrContext": ocr_context,
                "ocrMatch": match_type,
            })
        target_dir = OUTPUT_ROOT / "candidates"
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / f"list-{list_number}.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["lists"].append({"list": list_number, "startPage": start_page, "endPage": end_page, "count": len(output)})
        report["total"] += len(output)
        all_rows.extend(output)
    (OUTPUT_ROOT / "candidate-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_ROOT / "candidates.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
