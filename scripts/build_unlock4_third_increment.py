#!/usr/bin/env python3
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/unlock-vocabulary/unlock4-third-edition"
BACKUP = ROOT / "data/unlock-vocabulary/backups/2026-07-13-before-unlock4-third-edition/level-4"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def norm(value):
    value = str(value or "").lower().replace("’", "'").replace("‘", "'")
    value = re.sub(r"[‐‑–—]", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def main():
    candidates = []
    report = {"books": [], "oldTotal": 0, "thirdEditionUnique": 0, "newTotal": 0}
    for unit in range(1, 9):
        for section in ("ls", "rw"):
            old = load(BACKUP / f"unit-{unit}/{section}.json")
            third = load(SOURCE / f"unit-{unit}-{section}.json")
            old_words = {norm(row.get("word")) for row in old}
            added = [row for row in third if norm(row.get("word")) not in old_words]
            for row in added:
                row["candidateKey"] = f"u{unit}-{section}-{norm(row['word'])}"
            candidates.extend(added)
            report["books"].append({"unit": unit, "section": section.upper(), "old": len(old), "thirdEditionUnique": len(third), "new": len(added)})
            report["oldTotal"] += len(old)
            report["thirdEditionUnique"] += len(third)
            report["newTotal"] += len(added)
    (SOURCE / "new-candidate.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (SOURCE / "increment-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
