#!/usr/bin/env python3
"""Parse the outlined Unlock 2 Third Edition vocabulary PDF OCR into 16 candidates."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tmp/pdfs/unlock2-third-vocab/columns"
OUT = ROOT / "data/unlock-vocabulary/unlock2-third-edition"
SOURCE_PDF = "unlock2词汇册_4.23已转曲.pdf"

SECTIONS = [
    (1, "ls", 4), (1, "rw", 8),
    (2, "ls", 11), (2, "rw", 13),
    (3, "ls", 16), (3, "rw", 19),
    (4, "ls", 22), (4, "rw", 26),
    (5, "ls", 28), (5, "rw", 31),
    (6, "ls", 33), (6, "rw", 37),
    (7, "ls", 40), (7, "rw", 45),
    (8, "ls", 47), (8, "rw", 50),
]

BAD_WORDS = {"word", "wordlist", "ordlist", "dlist", "unlock", "third version", "book", "st", "ia", "mia", "izic", "i i c"}
WORD_CORRECTIONS = {
    "eletricity": "electricity",
    "enviroment": "environment",
    "auiet": "quiet",
    "anartment": "apartment",
    "sking": "skiing",
    "synerience": "experience",
    "nantain": "captain",
    "meting": "meeting",
    "jewllery": "jewellery",
    "nis": "mix",
    "lousework": "housework",
    "conl": "cool",
    "searct": "search",
    "specifice": "specific",
    "photograpy": "photography",
    "suqare kilometres": "square kilometres",
    "the lastest news": "the latest news",
}
MANUAL_POS = {
    "problem": "n.", "technology": "n.", "develop": "v.", "invent": "v.",
    "damage": "v.", "disappear": "v.", "explain": "v.", "interesting": "adj.",
    "present": "v.", "hope": "v.", "save": "v.", "course": "n.", "break": "v.",
    "trophy": "n.", "language": "n.", "computer": "n.", "part": "n.", "grow": "v.",
    "double": "v.", "career": "n.", "importance": "n.", "deliver": "v.", "universe": "n.",
}
MANUAL_PHONETIC = {
    "sport": "/spɔ:t/", "pollution": "/pə'lu:ʃn/", "almost": "/'ɔ:lməʊst/",
    "official": "/ə'fɪʃl/", "northern": "/'nɔ:ðən/", "personal": "/'pɜ:sənl/",
    "organize": "/'ɔ:ɡənaɪz/", "social": "/'əʊʃl/", "ornament": "/'ɔ:nəmənt/",
    "cup": "/kʌp/", "ocean": "/'əʊʃn/", "alternative": "/ɔ:l'tɜ:nətɪv/",
    "soil": "/sɔɪl/", "rise": "/raɪz/",
    "square kilometres": "/skweə 'kɪlə,mi:təz/", "the latest news": "/ðə 'leɪtɪst nju:z/",
}
MANUAL_MEANING = {
    "giant": "巨大的", "landslide": "山体滑坡", "livestreaming": "直播（行为）",
    "between...and": "在……和……之间", "export": "出口", "pure": "纯的；纯净的",
    "dream job": "梦想的工作", "litre": "升（容量单位）", "craftsman": "工匠",
    "fall down": "跌倒", "fashion": "时尚", "model": "模特；模型", "imagine": "想象",
    "brick": "砖块", "give up": "放弃", "surf": "冲浪", "tourist": "游客",
    "idea": "想法", "interesting": "有趣的",
}

SECTION_RANGES = {
    (1, "ls"): [(4, 1, 23), (5, 24, 50), (6, 51, 77), (7, 78, 104), (8, 105, 112)],
    (1, "rw"): [(8, 1, 10), (9, 11, 37), (10, 38, 56)],
    (2, "ls"): [(11, 1, 23), (12, 24, 50), (13, 51, 60)],
    (2, "rw"): [(13, 1, 9), (14, 10, 36), (15, 37, 63)],
    (3, "ls"): [(16, 1, 23), (17, 24, 50), (18, 51, 77), (19, 78, 90)],
    (3, "rw"): [(19, 1, 5), (20, 6, 32), (21, 33, 59), (22, 60, 64)],
    (4, "ls"): [(22, 1, 13), (23, 14, 40), (24, 41, 67), (25, 68, 94)],
    (4, "rw"): [(26, 1, 23), (27, 24, 50), (28, 51, 59)],
    (5, "ls"): [(28, 1, 10), (29, 11, 38), (30, 39, 63)],
    (5, "rw"): [(31, 1, 23), (32, 24, 50), (33, 51, 57)],
    (6, "ls"): [(33, 1, 10), (34, 11, 37), (35, 38, 64), (36, 65, 90)],
    (6, "rw"): [(37, 1, 23), (38, 24, 50), (39, 51, 74)],
    # The source PDF duplicates U7 LS rows 36-63 across pages 42-43.
    (7, "ls"): [(40, 1, 23), (41, 24, 51), (42, 52, 63), (42, 36, 51), (43, 52, 79), (44, 80, 104)],
    (7, "rw"): [(45, 1, 23), (46, 24, 51), (47, 52, 57)],
    (8, "ls"): [(47, 1, 12), (48, 13, 39), (49, 40, 66)],
    (8, "rw"): [(50, 1, 23), (51, 24, 50), (52, 51, 77)],
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
        if "full-en" not in path.name and "tiles" not in path.name:
            y = y * 0.94 + 0.04
        rows.append({"y": y, "x": float(parts[1]), "text": parts[2].strip()})
    return rows


def clean_word(text):
    text = text.replace("（", "(").replace("）", ")").replace("’", "'").replace("‘", "'")
    text = re.sub(r"\s*\.\s*\.\s*\.\s*", "...", text)
    text = re.sub(r"\s+", " ", text).strip(" *.,:;|-_")
    return WORD_CORRECTIONS.get(text.lower(), text)


def valid_word(text):
    low = text.lower()
    compact = re.sub(r"\s+", "", low)
    if low in BAD_WORDS or "unlock" in low or re.fullmatch(r"[a-z]?\d?(?:ls|rw)", compact):
        return False
    if re.search(r"[\u3400-\u9fff]", text) or not re.search(r"[A-Za-z]", text):
        return False
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9'() /+&.,-]{0,80}", text))


def cluster_words(page):
    candidates = []
    for suffix in ("word", "word-tight", "word-tiles"):
        for item in read_tsv(OCR / f"page-{page:02d}-{suffix}.tsv"):
            text = clean_word(item["text"])
            if valid_word(text):
                candidates.append({**item, "text": text, "source": suffix})
    for item in read_tsv(OCR / f"page-{page:02d}-full-en.tsv"):
        text = clean_word(item["text"])
        if 0.13 <= item["x"] <= 0.37 and valid_word(text):
            candidates.append({**item, "text": text, "source": "full-en"})
    candidates.sort(key=lambda item: -item["y"])
    clusters = []
    for item in candidates:
        match = next((cluster for cluster in clusters if abs(cluster[0]["y"] - item["y"]) <= 0.009), None)
        (match if match is not None else clusters.append([item]))
        if match is not None:
            match.append(item)
    result = []
    for cluster in clusters:
        best = max(
            cluster,
            key=lambda item: (
                len(re.sub(r"[^A-Za-z]", "", item["text"])),
                item["source"] == "full-en",
                item["source"] == "word-tight",
            ),
        )
        result.append(best)
    return result


def nearest(items, y, predicate=lambda _: True, tolerance=0.009):
    matches = [item for item in items if predicate(item["text"]) and abs(item["y"] - y) <= tolerance]
    return min(matches, key=lambda item: abs(item["y"] - y))["text"] if matches else ""


def clean_pos(text):
    text = text.lower().strip().replace("adi", "adj").replace("ad]", "adj").replace("门", "n").replace("几", "n")
    text = re.sub(r"^d[ij]\.?$", "adj.", text)
    text = re.sub(r"^[amdu]v\.?$", "adv.", text)
    text = re.sub(r"^u?j\.?$", "adj.", text)
    text = re.sub(r"^/?\.?v\.?$", "v.", text)
    text = re.sub(r"^hr\.?$", "phr.", text)
    text = re.sub(r"^ep\.?$", "prep.", text)
    text = re.sub(r"^um\.?$", "num.", text)
    text = text.replace("Л.", "n.")
    text = text.replace("n.n", "n./v").replace("n.v", "n./v").replace("1./v", "n./v")
    match = re.search(r"(?:num|pron|prep|conj|det|phr|adv|adj|n|v)(?:\s*[./]+\s*(?:n|v|adj|adv))*", text)
    return (match.group(0).replace(" ", "") + ("" if match.group(0).strip().endswith(".") else ".")) if match else ""


def clean_phonetic(text):
    text = re.sub(r"\s+", " ", text).strip().replace("（", "(").replace("）", ")")
    if not text:
        return ""
    text = text.strip(" |")
    if text.startswith(("l", "1", "I")):
        text = "/" + text[1:]
    if not text.startswith("/"):
        text = "/" + text.lstrip("1.,")
    if not text.endswith("/"):
        text = text.rstrip("1.,") + "/"
    return text


def valid_phonetic(text):
    compact = re.sub(r"[\s/.'_-]", "", str(text or "").lower())
    if not compact or compact in {"n", "v", "adj", "adv", "phr", "prep", "pron", "det", "conj", "num"}:
        return False
    return len(compact) >= 2 and bool(re.search(r"[a-zɐ-ʯ]", compact))


def title_y(page, unit, section):
    pattern = re.compile(rf"[A-Za-z]?{unit}\s*{section}", re.I)
    for item in read_tsv(OCR / f"page-{page:02d}-word.tsv"):
        if pattern.fullmatch(item["text"].strip()):
            return item["y"]
    raise ValueError(f"section-title-not-found:page-{page}:{unit}-{section}")


def parse_page(page, unit, section, min_y=None, max_y=None):
    meanings = read_tsv(OCR / f"page-{page:02d}-mean-tiles.tsv")
    phonetics = read_tsv(OCR / f"page-{page:02d}-phon-tiles.tsv")
    poses = read_tsv(OCR / f"page-{page:02d}-pos-tiles.tsv")
    full_en = read_tsv(OCR / f"page-{page:02d}-full-en.tsv")
    full_phonetics = [item for item in full_en if 0.37 <= item["x"] <= 0.59]
    full_poses = [item for item in full_en if 0.57 <= item["x"] <= 0.70]
    rows, rejected = [], []
    for word_item in cluster_words(page):
        if min_y is not None and word_item["y"] <= min_y:
            continue
        if max_y is not None and word_item["y"] >= max_y:
            continue
        meaning = nearest(
            meanings,
            word_item["y"],
            lambda text: bool(re.search(r"[\u3400-\u9fff]", text)) and "释义" not in text,
            tolerance=0.010,
        )
        if not meaning:
            rejected.append({"reason": "missing-meaning", "sourcePage": page, "word": word_item["text"]})
            continue
        meaning = MANUAL_MEANING.get(word_item["text"].lower(), meaning)
        phonetic = nearest(phonetics, word_item["y"], valid_phonetic, tolerance=0.010)
        phonetic = phonetic or nearest(full_phonetics, word_item["y"], valid_phonetic, tolerance=0.010)
        pos_text = nearest(
            full_poses,
            word_item["y"],
            lambda text: bool(re.fullmatch(r"(?i)(?:n|v|adj|adv|phr|prep|conj|det|pron)(?:\s*[./]+\s*(?:n|v|adj|adv))*\.?", text)),
            tolerance=0.010,
        )
        pos = clean_pos(pos_text or nearest(poses, word_item["y"], tolerance=0.011))
        pos = pos or MANUAL_POS.get(word_item["text"].lower(), "")
        if not pos:
            rejected.append({"reason": "missing-pos", "sourcePage": page, "word": word_item["text"]})
            continue
        rows.append({
            "word": word_item["text"],
            "wordLower": word_item["text"].lower(),
            "level": f"unlock2-{section}",
            "unlockLevel": 2,
            "section": section.upper(),
            "units": [unit],
            "phonetic": clean_phonetic(phonetic) if valid_phonetic(phonetic) else MANUAL_PHONETIC.get(word_item["text"].lower(), ""),
            "definitions": [f"{pos} {meaning}"],
            "example": "",
            "exampleMeaning": "",
            "source": "unlock-third-edition",
            "sourceFiles": [SOURCE_PDF],
            "sourcePage": page,
        })
    return rows, rejected


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"source": SOURCE_PDF, "sections": [], "total": 0, "rejected": []}
    all_rows = []
    for index, (unit, section, start_page) in enumerate(SECTIONS):
        own_title_y = title_y(start_page, unit, section)
        next_item = SECTIONS[index + 1] if index + 1 < len(SECTIONS) else None
        end_page = next_item[2] if next_item else 52
        pages = range(start_page, end_page + 1)
        rows = []
        rows_by_page = {}
        for page in pages:
            min_y = title_y(end_page, next_item[0], next_item[1]) if next_item and page == end_page else None
            max_y = own_title_y if page == start_page else None
            parsed, rejected = parse_page(page, unit, section, min_y=min_y, max_y=max_y)
            rows.extend(parsed)
            rows_by_page[page] = parsed
            report["rejected"].extend({**item, "unit": unit, "section": section.upper()} for item in rejected)
        expected_sequence = []
        expected_by_page = {}
        for range_page, first, last in SECTION_RANGES[(unit, section)]:
            expected_by_page.setdefault(range_page, []).extend(range(first, last + 1))
            expected_sequence.extend(range(first, last + 1))
        sequence_mismatches = []
        source_rows = []
        for page in pages:
            page_rows = rows_by_page.get(page, [])
            sequence = expected_by_page.get(page, [])
            if len(page_rows) != len(sequence):
                sequence_mismatches.append({"page": page, "expected": len(sequence), "actual": len(page_rows)})
            for position, row in enumerate(page_rows):
                row["sourceSequence"] = sequence[position] if position < len(sequence) else None
                source_rows.append(row)
        merged = {}
        for row in rows:
            key = row["wordLower"]
            if key not in merged:
                merged[key] = row
            else:
                for definition in row["definitions"]:
                    if definition not in merged[key]["definitions"]:
                        merged[key]["definitions"].append(definition)
                report["rejected"].append({"reason": "duplicate-merged", "unit": unit, "section": section.upper(), "word": row["word"], "sourcePage": row["sourcePage"]})
        deduped = list(merged.values())
        target = OUT / f"unit-{unit}-{section}.json"
        target.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["sections"].append({
            "unit": unit,
            "section": section.upper(),
            "pages": list(pages),
            "expectedNumberedRows": len(expected_sequence),
            "rawCount": len(source_rows),
            "dedupedCount": len(deduped),
            "missingNumbers": [],
            "sequenceMismatches": sequence_mismatches,
            "expectedSourceRanges": [
                {"page": range_page, "first": first, "last": last}
                for range_page, first, last in SECTION_RANGES[(unit, section)]
            ],
            "file": str(target.relative_to(ROOT)),
        })
        report["total"] += len(deduped)
        all_rows.extend(source_rows)
    report["expectedNumberedTotal"] = sum(item["expectedNumberedRows"] for item in report["sections"])
    report["rawTotal"] = sum(item["rawCount"] for item in report["sections"])
    report["dedupedTotal"] = sum(item["dedupedCount"] for item in report["sections"])
    (OUT / "ocr-draft.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "rejected.json").write_text(json.dumps(report["rejected"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": report["total"], "sections": report["sections"], "rejected": len(report["rejected"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
