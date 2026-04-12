#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def find_marker(lines, marker, start_index=0):
    marker = marker.strip()
    for index in range(start_index, len(lines)):
        if lines[index].strip() == marker:
            return index
    raise ValueError(f"Marker not found: {marker}")


def main():
    parser = argparse.ArgumentParser(
        description="Slice extracted Unlock1 PDF transcript lines between two section markers."
    )
    parser.add_argument("input_json", help="Path to the raw JSON produced by extract_pdf_transcript.py")
    parser.add_argument("start_marker", help="Section start marker, e.g. 1.2")
    parser.add_argument("end_marker", help="Section end marker, e.g. 1.3")
    parser.add_argument("output_json", help="Path to save the sliced section JSON")
    args = parser.parse_args()

    input_path = Path(args.input_json).expanduser().resolve()
    output_path = Path(args.output_json).expanduser().resolve()
    data = json.loads(input_path.read_text(encoding="utf-8"))
    lines = [item["text"] for item in data.get("lines", [])]

    start = find_marker(lines, args.start_marker)
    end = find_marker(lines, args.end_marker, start + 1)
    section_lines = lines[start + 1:end]

    payload = {
        "startMarker": args.start_marker,
        "endMarker": args.end_marker,
        "startIndex": start + 1,
        "endIndexExclusive": end + 1,
        "lines": section_lines,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Sliced {len(section_lines)} line(s) -> {output_path}")


if __name__ == "__main__":
    main()
