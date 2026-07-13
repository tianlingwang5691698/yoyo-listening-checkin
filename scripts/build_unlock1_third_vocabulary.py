#!/usr/bin/env python3
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tmp/pdfs/unlock1-third-vocab/columns"
OUT = ROOT / "data/unlock-vocabulary/unlock1-third-edition"
SOURCE_PDF = "unlock1词汇册_4.21已转曲.pdf"

SECTIONS = [
    (1, "ls", 4), (1, "rw", 6),
    (2, "ls", 8), (2, "rw", 10),
    (3, "ls", 13), (3, "rw", 15),
    (4, "ls", 18), (4, "rw", 21),
    (5, "ls", 24), (5, "rw", 27),
    (6, "ls", 30), (6, "rw", 32),
    (7, "ls", 34), (7, "rw", 36),
    (8, "ls", 39), (8, "rw", 42),
]
EXPECTED_NUMBERED_ROWS = {
    (1, "ls"): (50, 5, 2), (1, "rw"): (56, 8, 5),
    (2, "ls"): (50, 10, 7), (2, "rw"): (57, 12, 9),
    (3, "ls"): (61, 15, 12), (3, "rw"): (53, 17, 14),
    (4, "ls"): (91, 21, 18), (4, "rw"): (51, 23, 20),
    (5, "ls"): (86, 27, 24), (5, "rw"): (56, 29, 26),
    (6, "ls"): (50, 31, 28), (6, "rw"): (60, 34, 31),
    (7, "ls"): (50, 36, 33), (7, "rw"): (54, 38, 35),
    (8, "ls"): (86, 42, 39), (8, "rw"): (44, 44, 41),
}

BAD_WORDS = {"word", "wordlist", "ordlist", "dlist", "unlock", "third edition", "book", "ia", "st"}
VOICE_CORRECTIONS = {
    "man - men": "man and men",
    "woman - women": "woman and women",
    "person - people": "person and people",
    "café": "cafe",
    "from..to": "from to",
    "between...and": "between and",
    "neither...nor": "neither nor",
    "bicycle-sharing scheme": "bicycle sharing scheme",
}
WORD_CORRECTIONS = {
    "l'landan, andar graund/": "London Underground",
    "bankR": "bank",
}
TESS_FALLBACK_PAGES = {5, 9, 11, 13, 14, 19, 31, 35}
MANUAL_MEANINGS = {
    (5, "study"): "学习",
    (10, "forest"): "森林",
    (14, "friend"): "朋友",
    (14, "visitor"): "游客",
    (14, "watch"): "观看",
    (14, "take photos"): "拍照",
    (8, "california"): "加利福尼亚州（美国）",
    (16, "dream"): "梦想；幻想",
    (19, "climbing wall"): "攀岩墙",
    (40, "london underground"): "伦敦地铁",
}
MANUAL_POS = {
    "alpaca": "n.", "minus": "adj.", "chemical": "n.", "depression": "n.",
    "green": "adj./n.", "live": "v.", "work": "v./n.", "visit": "v./n.",
    "salesperson": "n.", "popular": "adj.", "late": "adj./adv.",
    "thousand": "num./n.", "clean power": "n.", "look after": "phr.",
    "planet": "n.", "cheap": "adj.",
}


def read_tsv(path):
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        y = float(parts[0])
        if "full-en" not in path.name:
            y = y * 0.94 + 0.04
        rows.append({"y": y, "x": float(parts[1]), "text": parts[2].strip()})
    return rows


def clean_word(text):
    text = text.replace("（", "(").replace("）", ")").replace("’", "'").replace("‘", "'")
    text = re.sub(r"^[*#]+", "", text.strip())
    text = re.sub(r"\s+", " ", text).strip(" .,:;|_")
    return WORD_CORRECTIONS.get(text, text)


def valid_word(text):
    low = text.lower()
    if low in BAD_WORDS or "unlock" in low or re.fullmatch(r"[ju]?\d+\s*(?:ls|rw)", low):
        return False
    if re.search(r"[\u3400-\u9fff]", text) or not re.search(r"[A-Za-z]", text):
        return False
    return bool(re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'() /+&.,-]{0,90}", text))


def cluster_words(page):
    if page in TESS_FALLBACK_PAGES:
        return [
            {**item, "text": clean_word(item["text"]), "source": "tess-word"}
            for item in read_tsv(OCR / f"page-{page:02d}-tess-word.tsv")
            if valid_word(clean_word(item["text"]))
        ]
    candidates = []
    for suffix in ("word", "word-tight"):
        for item in read_tsv(OCR / f"page-{page:02d}-{suffix}.tsv"):
            text = clean_word(item["text"])
            if valid_word(text):
                candidates.append({**item, "text": text, "source": suffix})
    if len(candidates) <= 2:
        for item in read_tsv(OCR / f"page-{page:02d}-tess-word.tsv"):
            text = clean_word(item["text"])
            if valid_word(text):
                candidates.append({**item, "text": text, "source": "tess-word"})
    for item in read_tsv(OCR / f"page-{page:02d}-full-en.tsv"):
        text = clean_word(item["text"])
        if 0.13 <= item["x"] <= 0.37 and valid_word(text):
            candidates.append({**item, "text": text, "source": "full-en"})
    candidates.sort(key=lambda item: -item["y"])
    clusters = []
    for item in candidates:
        match = next((cluster for cluster in clusters if abs(cluster[0]["y"] - item["y"]) <= 0.009), None)
        if match is None:
            clusters.append([item])
        else:
            match.append(item)
    result = []
    for cluster in clusters:
        best = max(cluster, key=lambda item: (
            len(re.sub(r"[^A-Za-z]", "", item["text"])),
            item["source"] == "full-en",
            item["source"] == "word-tight",
        ))
        result.append(best)
    return result


def nearest(items, y, predicate=lambda _: True, tolerance=0.009):
    matches = [item for item in items if predicate(item["text"]) and abs(item["y"] - y) <= tolerance]
    return min(matches, key=lambda item: abs(item["y"] - y))["text"] if matches else ""


def clean_pos(text):
    text = text.lower().replace("adi", "adj").replace("ad]", "adj").replace("门", "n").replace("几", "n")
    text = text.replace("n.n", "n./v").replace("n.v", "n./v").replace("1./v", "n./v")
    match = re.search(r"(?:n|v|adj|adv|phr|prep|conj|det|pron|num)(?:\s*[./]+\s*(?:n|v|adj|adv|num))*", text)
    return (match.group(0).replace(" ", "") + ("" if match.group(0).strip().endswith(".") else ".")) if match else ""


def clean_phonetic(text):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    text = text.replace("（", "(").replace("）", ")").replace("I", "/").strip(" |")
    if text.startswith(("l", "1")):
        text = "/" + text[1:]
    if not text.startswith("/"):
        text = "/" + text.lstrip("1.,")
    if not text.endswith("/"):
        text = text.rstrip("1.,") + "/"
    if re.fullmatch(r"/(?:adj|adv|n|v|phr|prep|conj|det|pron|num)\.?/", text, re.I):
        return ""
    return text


def title_y(page, unit, section):
    pattern = re.compile(rf"[A-Za-z]?{unit}\s*{section}", re.I)
    for item in read_tsv(OCR / f"page-{page:02d}-word.tsv"):
        if pattern.fullmatch(item["text"].strip()):
            return item["y"]
    for item in read_tsv(OCR / f"page-{page:02d}-full-en.tsv"):
        if pattern.fullmatch(item["text"].strip()):
            return item["y"]
    raise ValueError(f"section-title-not-found:page-{page}:{unit}-{section}")


def parse_page(page, unit, section, min_y=None, max_y=None):
    meanings = read_tsv(OCR / f"page-{page:02d}-mean.tsv")
    phonetics = read_tsv(OCR / f"page-{page:02d}-phon.tsv")
    poses = read_tsv(OCR / f"page-{page:02d}-pos.tsv")
    full_en = read_tsv(OCR / f"page-{page:02d}-full-en.tsv")
    full_phonetics = [item for item in full_en if 0.36 <= item["x"] <= 0.60]
    full_poses = [item for item in full_en if 0.57 <= item["x"] <= 0.70]
    rows = []
    for word_item in cluster_words(page):
        if min_y is not None and word_item["y"] <= min_y:
            continue
        if max_y is not None and word_item["y"] >= max_y:
            continue
        is_tesseract = word_item.get("source") == "tess-word"
        tolerance = 0.012 if is_tesseract else 0.009
        lookup_y = word_item["y"] - 0.0185 if is_tesseract else word_item["y"]
        meaning = nearest(meanings, lookup_y, lambda text: bool(re.search(r"[\u3400-\u9fff]", text)) and "释义" not in text, tolerance=tolerance)
        meaning = MANUAL_MEANINGS.get((page, word_item["text"].lower()), meaning)
        phonetic = nearest(full_phonetics, lookup_y, lambda text: "/" in text or len(text) > 2, tolerance=tolerance)
        if not phonetic:
            phonetic = nearest(phonetics, lookup_y, lambda text: "/" in text or len(text) > 2, tolerance=tolerance)
        pos_text = nearest(full_poses, lookup_y, lambda text: bool(re.fullmatch(r"(?i)(?:n|v|adj|adv|phr|prep|conj|det|pron|num)(?:\s*[./]+\s*(?:n|v|adj|adv|num))*\.?", text)), tolerance=tolerance)
        pos = clean_pos(pos_text or nearest(poses, lookup_y, tolerance=tolerance))
        pos = pos or MANUAL_POS.get(word_item["text"].lower(), "")
        if not meaning and not phonetic and not pos:
            continue
        rows.append({
            "word": word_item["text"],
            "wordLower": word_item["text"].lower(),
            "audioText": VOICE_CORRECTIONS.get(word_item["text"].lower(), word_item["text"]),
            "level": f"unlock1-{section}",
            "unlockLevel": 1,
            "section": section.upper(),
            "units": [unit],
            "phonetic": clean_phonetic(phonetic),
            "definitions": [f"{pos} {meaning}".strip()],
            "example": "",
            "exampleMeaning": "",
            "source": "unlock-third-edition",
            "sourceFiles": [SOURCE_PDF],
            "sourcePage": page,
        })
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"source": SOURCE_PDF, "sections": [], "rawTotal": 0, "total": 0, "numberingGatePassed": True, "rejected": []}
    all_rows = []
    for index, (unit, section, start_page) in enumerate(SECTIONS):
        own_title_y = title_y(start_page, unit, section)
        next_item = SECTIONS[index + 1] if index + 1 < len(SECTIONS) else None
        end_page = next_item[2] if next_item else 44
        pages = range(start_page, end_page + 1)
        rows = []
        for page in pages:
            min_y = title_y(end_page, next_item[0], next_item[1]) if next_item and page == end_page else None
            max_y = own_title_y if page == start_page else None
            rows.extend(parse_page(page, unit, section, min_y=min_y, max_y=max_y))
        for source_index, row in enumerate(rows, 1):
            row["sourceIndex"] = source_index
        merged = {}
        for row in rows:
            key = row["wordLower"]
            if key not in merged:
                merged[key] = row
                continue
            for definition in row["definitions"]:
                if definition not in merged[key]["definitions"]:
                    merged[key]["definitions"].append(definition)
            report["rejected"].append({"reason": "duplicate-merged", "unit": unit, "section": section, "word": row["word"]})
        deduped = list(merged.values())
        target = OUT / f"unit-{unit}-{section}.json"
        target.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        expected, evidence_pdf_page, evidence_printed_page = EXPECTED_NUMBERED_ROWS[(unit, section)]
        missing_numbers = list(range(len(rows) + 1, expected + 1)) if len(rows) < expected else []
        extra_count = max(0, len(rows) - expected)
        gate_passed = len(rows) == expected
        report["sections"].append({
            "unit": unit,
            "section": section.upper(),
            "pages": list(pages),
            "count": len(deduped),
            "rawCount": len(rows),
            "expectedNumberedRows": expected,
            "missingNumbers": missing_numbers,
            "extraCount": extra_count,
            "numberingGatePassed": gate_passed,
            "numberingEvidence": {"pdfPage": evidence_pdf_page, "printedPage": evidence_printed_page, "lastPrintedIndex": expected},
            "file": str(target.relative_to(ROOT)),
        })
        report["rawTotal"] += len(rows)
        report["total"] += len(deduped)
        report["numberingGatePassed"] = report["numberingGatePassed"] and gate_passed
        all_rows.extend(rows)
    (OUT / "ocr-draft.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "rejected.json").write_text(json.dumps(report["rejected"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not report["numberingGatePassed"]:
        raise SystemExit("numbering-gate-failed")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
