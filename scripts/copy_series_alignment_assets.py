#!/usr/bin/env python3
import argparse
import json
import shutil
from pathlib import Path


def load_canonical_map(path: Path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    tracks = payload.get("tracksByFileName") or {}
    if not tracks:
        raise ValueError(f"Canonical map missing tracksByFileName: {path}")
    return tracks


def copy_file(source: Path, destination: Path, force: bool):
    if not source.exists():
        raise FileNotFoundError(f"Missing source file: {source}")
    if destination.exists() and not force:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Copy a series' audio assets and optional PDF into a local alignment workspace."
    )
    parser.add_argument("--canonical-map", required=True)
    parser.add_argument("--audio-source-dir", required=True)
    parser.add_argument("--audio-output-dir", required=True)
    parser.add_argument("--audio-extension", default="mp3")
    parser.add_argument("--pdf-source", default="")
    parser.add_argument("--pdf-output-name", default="")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    tracks = load_canonical_map(Path(args.canonical_map).expanduser().resolve())
    source_dir = Path(args.audio_source_dir).expanduser().resolve()
    output_dir = Path(args.audio_output_dir).expanduser().resolve()
    copied = 0

    for file_name in sorted(tracks.keys()):
        source = source_dir / f"{file_name}.{args.audio_extension}"
        destination = output_dir / source.name
        did_copy = copy_file(source, destination, args.force)
        copied += int(did_copy)
        print(f"{'copied' if did_copy else 'kept'}: {destination}")

    if args.pdf_source:
        pdf_source = Path(args.pdf_source).expanduser().resolve()
        pdf_name = args.pdf_output_name or pdf_source.name
        pdf_destination = output_dir / pdf_name
        did_copy = copy_file(pdf_source, pdf_destination, args.force)
        copied += int(did_copy)
        print(f"{'copied' if did_copy else 'kept'}: {pdf_destination}")

    print(f"Done. {copied} file(s) copied into {output_dir}")


if __name__ == "__main__":
    main()
