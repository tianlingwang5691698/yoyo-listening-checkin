#!/usr/bin/env python3
"""Re-OCR Unlock 2 word/meaning columns in short tiles to prevent Vision row loss."""

import concurrent.futures
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "tmp/pdfs/unlock2-third-vocab/render300"
OUT = ROOT / "tmp/pdfs/unlock2-third-vocab/columns"
OCR_BIN = ROOT / "tmp/pdfs/unlock4-third-vocab/vision_ocr"
TILES = [(top, 0.14) for top in (0.01, 0.10, 0.19, 0.28, 0.37, 0.46, 0.55, 0.64, 0.73, 0.82, 0.85)]
COLUMNS = {
    "word-tiles": (0.12, 0.25, True),
    "phon-tiles": (0.36, 0.235, True),
    "pos-tiles": (0.595, 0.09, True),
    "mean-tiles": (0.68, 0.25, False),
}


def one(page, suffix, x, width, english):
    image = IMAGES / f"page-{page:02d}.jpg"
    rows = []
    env = dict(os.environ)
    if english:
        env["OCR_LANG"] = "en"
    for top, height in TILES:
        result = subprocess.run(
            [str(OCR_BIN), str(image), str(x), str(top), str(width), str(height)],
            check=True,
            text=True,
            capture_output=True,
            env=env,
        )
        for line in result.stdout.splitlines():
            parts = line.split("\t", 2)
            if len(parts) != 3:
                continue
            local_y, local_x, text = float(parts[0]), float(parts[1]), parts[2]
            full_y = 1 - top - height + local_y * height
            full_x = x + local_x * width
            rows.append((full_y, full_x, text))
    # Overlapping tiles intentionally create duplicates; collapse same text/position.
    rows.sort(reverse=True)
    deduped = []
    for row in rows:
        if any(row[2] == old[2] and abs(row[0] - old[0]) < 0.008 for old in deduped):
            continue
        deduped.append(row)
    target = OUT / f"page-{page:02d}-{suffix}.tsv"
    target.write_text("".join(f"{y:.6f}\t{xv:.6f}\t{text}\n" for y, xv, text in deduped), encoding="utf-8")


def main():
    if not OCR_BIN.exists():
        raise SystemExit(f"missing Vision OCR helper: {OCR_BIN}")
    jobs = []
    for page in range(4, 53):
        for suffix, (x, width, english) in COLUMNS.items():
            jobs.append((page, suffix, x, width, english))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda args: one(*args), jobs))
    print(f"wrote {len(jobs)} tiled OCR files")


if __name__ == "__main__":
    main()
