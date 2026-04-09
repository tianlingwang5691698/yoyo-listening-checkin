#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


def load_text(pdf_path: Path) -> str:
    try:
        from pypdf import PdfReader
    except Exception as exc:
        raise SystemExit(
            "Missing dependency: pypdf. Install with `python3 -m pip install pypdf`."
        ) from exc

    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
      pages.append(page.extract_text() or "")
    return "\n".join(pages)


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def split_sentences(text: str):
    pieces = []
    for block in text.split("\n"):
        chunk = block.strip()
        if not chunk:
            continue
        chunk = re.sub(r"\s+", " ", chunk)
        parts = re.split(r"(?<=[.!?。！？；;])\s+", chunk)
        for part in parts:
            sentence = part.strip()
            if sentence:
                pieces.append(sentence)
    return pieces


def to_track(content_id: str, lines):
    items = []
    cursor = 0
    step = 3000
    for index, text in enumerate(lines, start=1):
        items.append(
            {
                "lineId": f"{content_id}-{index}",
                "text": text,
                "startMs": cursor,
                "endMs": cursor + step,
            }
        )
        cursor += step
    return {
        "trackId": f"track-{content_id}",
        "contentId": content_id,
        "mediaType": "shared",
        "lines": items,
    }


def main():
    if len(sys.argv) < 4:
        raise SystemExit(
            "Usage: python3 scripts/extract_pdf_transcript.py <input.pdf> <content_id> <output.json>"
        )

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    content_id = sys.argv[2].strip()
    output_path = Path(sys.argv[3]).expanduser().resolve()

    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    text = normalize_text(load_text(pdf_path))
    lines = split_sentences(text)
    track = to_track(content_id, lines)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(track, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Extracted {len(lines)} lines -> {output_path}")
    print("Next step: manually adjust startMs/endMs for accurate line sync.")


if __name__ == "__main__":
    main()
