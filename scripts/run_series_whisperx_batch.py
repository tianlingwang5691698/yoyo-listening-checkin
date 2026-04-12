#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def run(command, env=None):
    print("+", " ".join(command))
    subprocess.run(command, check=True, env=env)


def resolve_python_bin(explicit_value: str):
    if explicit_value:
        return explicit_value
    local_whisper_env = Path.home() / "whisper-env" / "bin" / "python"
    if local_whisper_env.exists():
        return str(local_whisper_env)
    return shutil.which("python3.12") or shutil.which("python3") or sys.executable


def resolve_vendor_dir(explicit_value: str):
    if explicit_value:
        return Path(explicit_value).expanduser().resolve()
    return Path.cwd() / "vendor312"


def main():
    parser = argparse.ArgumentParser(
        description="Run WhisperX and import word-level transcript tracks for a series canonical map."
    )
    parser.add_argument("--canonical-map", required=True)
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--whisper-output-dir", required=True)
    parser.add_argument("--imported-dir", required=True)
    parser.add_argument("--audio-extension", default="mp3")
    parser.add_argument("--subset", default="")
    parser.add_argument("--python-bin", default="")
    parser.add_argument("--vendor-dir", default="")
    parser.add_argument("--model", default="base")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    canonical_map = Path(args.canonical_map).expanduser().resolve()
    tracks = json.loads(canonical_map.read_text(encoding="utf-8"))["tracksByFileName"]
    selected = list(tracks.keys())
    if args.subset.strip():
        requested = [item.strip() for item in args.subset.split(",") if item.strip()]
        selected = [item for item in selected if item in requested]

    python_bin = resolve_python_bin(args.python_bin)
    vendor_dir = resolve_vendor_dir(args.vendor_dir)
    script_dir = Path(__file__).resolve().parent

    base_env = os.environ.copy()
    base_env["PYTHONPATH"] = str(vendor_dir)
    base_env["MPLCONFIGDIR"] = base_env.get("MPLCONFIGDIR", "/tmp/mplconfig")
    base_env["XDG_CACHE_HOME"] = base_env.get("XDG_CACHE_HOME", "/tmp/xdg-cache")

    for file_name in selected:
        audio_path = Path(args.raw_dir).expanduser().resolve() / f"{file_name}.{args.audio_extension}"
        whisper_output_dir = Path(args.whisper_output_dir).expanduser().resolve() / file_name
        whisper_json = whisper_output_dir / f"{file_name}.json"
        imported_json = Path(args.imported_dir).expanduser().resolve() / f"{tracks[file_name]['trackId']}.json"

        if not audio_path.exists():
            raise FileNotFoundError(f"Missing audio: {audio_path}")

        if args.force or not whisper_json.exists():
            run(
                [
                    python_bin,
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
                ],
                env=base_env,
            )
        else:
            print(f"skip whisperx: {whisper_json}")

        if args.force or not imported_json.exists():
            run(
                [
                    "python3",
                    str(script_dir / "import_whisperx_words.py"),
                    file_name,
                    str(whisper_json),
                    str(imported_json),
                    "--canonical-map",
                    str(canonical_map),
                ]
            )
            run(["node", str(script_dir / "validate_transcript_track.js"), str(imported_json)])
        else:
            print(f"skip import: {imported_json}")


if __name__ == "__main__":
    main()
