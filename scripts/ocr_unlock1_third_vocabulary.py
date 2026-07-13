#!/usr/bin/env python3
import csv
import io
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "tmp/pdfs/unlock1-third-vocab/render300"
OUTPUT = ROOT / "tmp/pdfs/unlock1-third-vocab/columns"


def ocr_word_column(image_path):
    image = Image.open(image_path)
    width, height = image.size
    crop = image.crop((round(width * 0.12), round(height * 0.04), round(width * 0.37), round(height * 0.98)))
    with tempfile.NamedTemporaryFile(suffix=".png") as temp:
        crop.save(temp.name)
        result = subprocess.run(
            ["tesseract", temp.name, "stdout", "-l", "eng", "--psm", "6", "tsv"],
            check=True,
            capture_output=True,
            text=True,
        )
    groups = {}
    for row in csv.DictReader(io.StringIO(result.stdout), delimiter="\t"):
        text = str(row.get("text") or "").strip()
        if not text or float(row.get("conf") or -1) < 20:
            continue
        key = (row["block_num"], row["par_num"], row["line_num"])
        groups.setdefault(key, []).append(row)
    lines = []
    for words in groups.values():
        words.sort(key=lambda row: int(row["left"]))
        text = " ".join(row["text"].strip() for row in words)
        left = min(int(row["left"]) for row in words)
        top = min(int(row["top"]) for row in words)
        bottom = max(int(row["top"]) + int(row["height"]) for row in words)
        y = 1 - ((top + bottom) / 2 / crop.height)
        x = left / crop.width
        lines.append((y, x, text))
    return sorted(lines, key=lambda row: (-row[0], row[1]))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for image_path in sorted(IMAGES.glob("page-*.jpg")):
        target = OUTPUT / f"{image_path.stem}-tess-word.tsv"
        rows = ocr_word_column(image_path)
        target.write_text("".join(f"{y:.6f}\t{x:.6f}\t{text}\n" for y, x, text in rows), encoding="utf-8")
    print(f"ocr-pages={len(list(IMAGES.glob('page-*.jpg')))}")


if __name__ == "__main__":
    main()
