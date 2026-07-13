#!/usr/bin/env python3
"""Build the standalone Unlock 2 Third Edition 16-book formal dataset."""

import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/unlock-vocabulary/unlock2-third-edition"
FINAL = ROOT / "data/unlock-vocabulary/unlock-third-edition-final/level-2"
FIELDS = (
    "word",
    "wordLower",
    "level",
    "unlockLevel",
    "section",
    "units",
    "phonetic",
    "definitions",
    "example",
    "exampleMeaning",
    "source",
    "sourceFiles",
    "sourcePage",
)
REQUIRED_TEXT = ("word", "wordLower", "level", "section", "phonetic", "example", "exampleMeaning", "source")
PURE_POS = {"n", "v", "adj", "adv", "phr", "prep", "pron", "det", "conj", "num"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def stable_body(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def normalized_word(value):
    value = str(value or "").lower().replace("’", "'").replace("‘", "'")
    value = re.sub(r"[‐‑‒–—]", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def validate_row(row, unit, section, index):
    label = f"u{unit}-{section}-{index}"
    if tuple(row.keys()) != FIELDS:
        raise ValueError(f"field-order-or-schema:{label}:{tuple(row.keys())}")
    for field in REQUIRED_TEXT:
        if not isinstance(row[field], str) or not row[field].strip():
            raise ValueError(f"missing-{field}:{label}")
    if row["wordLower"] != row["word"].lower():
        raise ValueError(f"wordLower-mismatch:{label}:{row['word']}")
    if row["unlockLevel"] != 2 or row["level"] != f"unlock2-{section}":
        raise ValueError(f"level-mismatch:{label}")
    if row["section"] != section.upper() or row["units"] != [unit]:
        raise ValueError(f"unit-section-mismatch:{label}")
    if row["source"] != "unlock-third-edition" or not row["sourceFiles"] or not row["sourcePage"]:
        raise ValueError(f"source-mismatch:{label}")
    if not isinstance(row["definitions"], list) or not row["definitions"]:
        raise ValueError(f"definitions-missing:{label}")
    if any(not isinstance(value, str) or not value.strip() or not re.search(r"[\u3400-\u9fff]", value) for value in row["definitions"]):
        raise ValueError(f"definition-invalid:{label}")
    compact_phonetic = re.sub(r"[\s/.'_-]", "", row["phonetic"].lower())
    if not compact_phonetic or compact_phonetic in PURE_POS:
        raise ValueError(f"phonetic-invalid:{label}:{row['phonetic']}")
    if not re.search(r"[A-Za-z]", row["example"]) or not re.search(r"[.!?]$", row["example"]):
        raise ValueError(f"example-invalid:{label}")
    if not re.search(r"[\u3400-\u9fff]", row["exampleMeaning"]):
        raise ValueError(f"exampleMeaning-invalid:{label}")


def main():
    FINAL.mkdir(parents=True, exist_ok=True)
    stripped = Counter()
    books = []
    total = 0
    for unit in range(1, 9):
        for section in ("ls", "rw"):
            source_path = SOURCE / f"unit-{unit}-{section}.json"
            source_rows = load(source_path)
            final_rows = []
            keys = set()
            for index, source_row in enumerate(source_rows, 1):
                stripped.update(set(source_row) - set(FIELDS))
                row = {field: source_row[field] for field in FIELDS}
                validate_row(row, unit, section, index)
                key = normalized_word(row["word"])
                if key in keys:
                    raise ValueError(f"duplicate-word:u{unit}-{section}:{key}")
                keys.add(key)
                final_rows.append(row)
            if len(final_rows) != len(source_rows):
                raise ValueError(f"row-loss:u{unit}-{section}")
            body = stable_body(final_rows)
            if len(body) >= 1024 * 1024:
                raise ValueError(f"book-over-1mb:u{unit}-{section}:{len(body)}")
            target = FINAL / f"unit-{unit}" / f"{section}.json"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(body)
            books.append({
                "unit": unit,
                "section": section.upper(),
                "rows": len(final_rows),
                "bytes": len(body),
                "sha256": sha256(body),
                "source": str(source_path.relative_to(ROOT)),
                "file": str(target.relative_to(ROOT)),
            })
            total += len(final_rows)
    if len(books) != 16 or total != 1155:
        raise ValueError(f"final-count-mismatch:{len(books)}:{total}")
    report = {
        "edition": "third",
        "unlockLevel": 2,
        "books": books,
        "bookCount": len(books),
        "rows": total,
        "fields": list(FIELDS),
        "strippedInternalFields": dict(sorted(stripped.items())),
        "maxBookBytes": max(book["bytes"] for book in books),
        "underOneMegabyte": all(book["bytes"] < 1024 * 1024 for book in books),
    }
    (FINAL / "build-report.json").write_bytes(stable_body(report))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
