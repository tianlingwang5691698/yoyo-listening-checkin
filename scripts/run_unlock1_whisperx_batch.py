#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from pathlib import Path


def run(command, env=None):
    print("+", " ".join(command))
    subprocess.run(command, check=True, env=env)


def main():
    parser = argparse.ArgumentParser(description="Run WhisperX and import real word-level tracks for Unlock1.")
    parser.add_argument(
        "--canonical-map",
        default="data/transcript-build/unlock1-word-align/work/unlock1-canonical-map.json",
    )
    parser.add_argument(
        "--raw-dir",
        default="data/transcript-build/unlock1-word-align/raw",
    )
    parser.add_argument(
        "--whisper-output-dir",
        default="data/transcript-build/unlock1-word-align/output/whisperx",
    )
    parser.add_argument(
        "--imported-dir",
        default="data/transcript-build/unlock1-word-align/output/imported",
    )
    parser.add_argument(
        "--subset",
        default="",
        help="Comma-separated fileName list without extension, e.g. Unlock2e_A1_2.2,Unlock2e_A1_2.3",
    )
    parser.add_argument(
        "--python-bin",
        default="/opt/homebrew/bin/python3.12",
    )
    parser.add_argument(
        "--vendor-dir",
        default="data/transcript-build/unlock1-word-align/vendor312",
    )
    parser.add_argument(
        "--model",
        default="base",
    )
    parser.add_argument(
        "--force",
        action="store_true",
    )
    args = parser.parse_args()

    canonical_map = Path(args.canonical_map).expanduser().resolve()
    tracks = json.loads(canonical_map.read_text(encoding="utf-8"))["tracksByFileName"]
    selected = list(tracks.keys())
    if args.subset.strip():
      requested = [item.strip() for item in args.subset.split(",") if item.strip()]
      selected = [item for item in selected if item in requested]

    base_env = os.environ.copy()
    base_env["PYTHONPATH"] = str(Path(args.vendor_dir).expanduser().resolve())
    base_env["MPLCONFIGDIR"] = base_env.get("MPLCONFIGDIR", "/tmp/mplconfig")
    base_env["XDG_CACHE_HOME"] = base_env.get("XDG_CACHE_HOME", "/tmp/xdg-cache")

    for file_name in selected:
        audio_path = Path(args.raw_dir).expanduser().resolve() / f"{file_name}.mp3"
        whisper_output_dir = Path(args.whisper_output_dir).expanduser().resolve() / file_name
        whisper_json = whisper_output_dir / f"{file_name}.json"
        imported_json = Path(args.imported_dir).expanduser().resolve() / f"{tracks[file_name]['trackId']}.json"

        if not audio_path.exists():
            raise FileNotFoundError(f"Missing audio: {audio_path}")

        if args.force or not whisper_json.exists():
            run([
                args.python_bin,
                "-m",
                "whisperx",
                "--model",
                args.model,
                "--language",
                "en",
                "--device",
                "cpu",
                "--compute_type",
                "int8",
                "--vad_method",
                "silero",
                "--batch_size",
                "4",
                "--output_dir",
                str(whisper_output_dir),
                "--output_format",
                "json",
                str(audio_path),
            ], env=base_env)
        else:
            print(f"skip whisperx: {whisper_json}")

        if args.force or not imported_json.exists():
            run([
                "python3",
                "scripts/import_whisperx_words.py",
                file_name,
                str(whisper_json),
                str(imported_json),
                "--canonical-map",
                str(canonical_map),
            ])
            run([
                "node",
                "scripts/validate_transcript_track.js",
                str(imported_json),
            ])
        else:
            print(f"skip import: {imported_json}")


if __name__ == "__main__":
    main()
