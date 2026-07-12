#!/usr/bin/env python3
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tmp/pdfs/unlock4-third-vocab/columns"
OUT = ROOT / "data/unlock-vocabulary/unlock4-third-edition"
SOURCE_PDF = "unlock4词汇册_4.27已转曲.pdf"

SECTIONS = [
    (1, "ls", 4), (1, "rw", 6),
    (2, "ls", 9), (2, "rw", 11),
    (3, "ls", 14), (3, "rw", 16),
    (4, "ls", 19), (4, "rw", 21),
    (5, "ls", 24), (5, "rw", 26),
    (6, "ls", 29), (6, "rw", 31),
    (7, "ls", 33), (7, "rw", 36),
    (8, "ls", 39), (8, "rw", 42),
]

BAD_WORDS = {"word", "wordlist", "ordlist", "dlist", "unlock", "third version", "book"}
MANUAL_WORDS = {
    28: [(0.6795, "leaky"), (0.6519, "icon"), (0.6235, "blending")],
    34: [(0.2347, "legal")],
}
MANUAL_MEANINGS = {
    (36, "capture"): "捕捉",
    (42, "sold out"): "售罄的",
}
WORD_CORRECTIONS = {"diabete": "diabetes"}
MANUAL_POS = {
    "relatively": "adv.", "specialty": "n.", "degree": "n.", "graduate": "n.",
    "practical": "adj.", "principle": "n.", "potential": "adj.", "thriving": "adj.",
    "industrial": "adj.", "abandoned": "adj.",
}


def read_tsv(path):
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            y = float(parts[0])
            if "full-en" not in path.name:
                y = y * 0.94 + 0.04
            rows.append({"y": y, "x": float(parts[1]), "text": parts[2].strip()})
    return rows


def clean_word(text):
    text = text.replace("（", "(").replace("）", ")").replace("’", "'").replace("‘", "'")
    text = re.sub(r"\s+", " ", text).strip(" .,:;|-_")
    return WORD_CORRECTIONS.get(text.lower(), text)


def valid_word(text):
    low = text.lower()
    if low in BAD_WORDS or "unlock" in low or re.fullmatch(r"[ju]?\d+\s*(?:ls|rw)", low):
        return False
    if re.search(r"[\u3400-\u9fff]", text) or not re.search(r"[A-Za-z]", text):
        return False
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9'() /+&.-]{0,70}", text))


def cluster_words(page):
    candidates = []
    for suffix in ("word", "word-tight"):
        for item in read_tsv(OCR / f"page-{page:02d}-{suffix}.tsv"):
            text = clean_word(item["text"])
            if valid_word(text):
                candidates.append({**item, "text": text, "source": suffix})
    for item in read_tsv(OCR / f"page-{page:02d}-full-en.tsv"):
        text = clean_word(item["text"])
        if 0.13 <= item["x"] <= 0.35 and valid_word(text):
            candidates.append({**item, "text": text, "source": "full-en"})
    for y, text in MANUAL_WORDS.get(page, []):
        candidates.append({"y": y, "x": 0.2, "text": text, "source": "manual"})
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
        # Prefer the complete phrase; for equal length use the tighter English-only crop.
        best = max(cluster, key=lambda item: (len(re.sub(r"[^A-Za-z]", "", item["text"])), item["source"] == "full-en", item["source"] == "word-tight"))
        result.append(best)
    return result


def nearest(items, y, predicate=lambda _: True, tolerance=0.009):
    matches = [item for item in items if predicate(item["text"]) and abs(item["y"] - y) <= tolerance]
    return min(matches, key=lambda item: abs(item["y"] - y))["text"] if matches else ""


def clean_pos(text):
    text = text.lower().replace("adi", "adj").replace("ad]", "adj").replace("门", "n").replace("几", "n")
    text = text.replace("n.n", "n./v").replace("n.v", "n./v").replace("1./v", "n./v")
    match = re.search(r"(?:n|v|adj|adv|phr|prep|conj|det|pron)(?:\s*[./]+\s*(?:n|v|adj|adv))*", text)
    return (match.group(0).replace(" ", "") + ("" if match.group(0).strip().endswith(".") else ".")) if match else ""


def clean_phonetic(text):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    text = text.replace("（", "(").replace("）", ")").replace("I", "/")
    text = text.strip(" |")
    if text.startswith(("l", "1")):
        text = "/" + text[1:]
    if not text.startswith("/"):
        text = "/" + text.lstrip("1.,")
    if not text.endswith("/"):
        text = text.rstrip("1.,") + "/"
    return text


def title_y(page, unit, section):
    pattern = re.compile(rf"[A-Za-z]?{unit}\s*{section}", re.I)
    for item in read_tsv(OCR / f"page-{page:02d}-word.tsv"):
        if pattern.fullmatch(item["text"].strip()):
            return item["y"]
    raise ValueError(f"section-title-not-found:page-{page}:{unit}-{section}")


def parse_page(page, unit, section, min_y=None, max_y=None):
    meanings = read_tsv(OCR / f"page-{page:02d}-mean.tsv")
    phonetics = read_tsv(OCR / f"page-{page:02d}-phon.tsv")
    poses = read_tsv(OCR / f"page-{page:02d}-pos.tsv")
    full_en = read_tsv(OCR / f"page-{page:02d}-full-en.tsv")
    full_phonetics = [item for item in full_en if 0.37 <= item["x"] <= 0.58]
    full_poses = [item for item in full_en if 0.57 <= item["x"] <= 0.69]
    rows = []
    for word_item in cluster_words(page):
        if min_y is not None and word_item["y"] <= min_y:
            continue
        if max_y is not None and word_item["y"] >= max_y:
            continue
        meaning = nearest(meanings, word_item["y"], lambda text: bool(re.search(r"[\u3400-\u9fff]", text)) and "释义" not in text)
        meaning = meaning or MANUAL_MEANINGS.get((page, word_item["text"].lower()), "")
        if not meaning:
            continue
        phonetic = nearest(full_phonetics, word_item["y"], lambda text: "/" in text or len(text) > 2, tolerance=0.009)
        if not phonetic:
            phonetic = nearest(phonetics, word_item["y"], lambda text: "/" in text or len(text) > 2)
        pos_text = nearest(full_poses, word_item["y"], lambda text: bool(re.fullmatch(r"(?i)(?:n|v|adj|adv|phr|prep|conj|det|pron)(?:\s*[./]+\s*(?:n|v|adj|adv))*\.?", text)), tolerance=0.009)
        pos = clean_pos(pos_text or nearest(poses, word_item["y"], tolerance=0.011))
        pos = pos or MANUAL_POS.get(word_item["text"].lower(), "")
        rows.append({
            "word": word_item["text"],
            "wordLower": word_item["text"].lower(),
            "level": f"unlock4-{section}",
            "unlockLevel": 4,
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
    report = {"source": SOURCE_PDF, "sections": [], "total": 0, "rejected": []}
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
        merged = {}
        for row in rows:
            key = row["wordLower"]
            if key not in merged:
                merged[key] = row
                continue
            current = merged[key]
            for definition in row["definitions"]:
                if definition not in current["definitions"]:
                    current["definitions"].append(definition)
            report["rejected"].append({"reason": "duplicate-merged", "unit": unit, "section": section, "word": row["word"]})
        deduped = list(merged.values())
        target = OUT / f"unit-{unit}-{section}.json"
        target.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["sections"].append({"unit": unit, "section": section.upper(), "pages": list(pages), "count": len(deduped), "rawCount": len(rows), "file": str(target.relative_to(ROOT))})
        report["total"] += len(deduped)
        all_rows.extend(deduped)
    (OUT / "ocr-draft.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
