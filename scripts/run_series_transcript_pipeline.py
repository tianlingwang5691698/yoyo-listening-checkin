#!/usr/bin/env python3
import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def run(command):
    print("+", " ".join(command))
    subprocess.run(command, check=True)


def resolve_python_bin(explicit_value: str):
    if explicit_value:
        return explicit_value
    local_whisper_env = Path.home() / "whisper-env" / "bin" / "python"
    if local_whisper_env.exists():
        return str(local_whisper_env)
    return shutil.which("python3.12") or shutil.which("python3") or sys.executable


def main():
    parser = argparse.ArgumentParser(
        description="Run the end-to-end WhisperX transcript pipeline for a series module."
    )
    parser.add_argument("--module", required=True, help="JS module that exports transcript tracks and build status")
    parser.add_argument(
        "--output-root",
        required=True,
        help="Workspace root for this series, for example ./workspaces/series-a",
    )
    parser.add_argument("--audio-source-dir", required=True)
    parser.add_argument("--bundle-output", required=True)
    parser.add_argument("--audio-extension", default="mp3")
    parser.add_argument("--tracks-export", default="transcriptTracks")
    parser.add_argument("--status-export", default="transcriptBuildStatus")
    parser.add_argument("--pdf-source", default="")
    parser.add_argument("--pdf-output-name", default="")
    parser.add_argument("--subset", default="")
    parser.add_argument("--vendor-dir", default="")
    parser.add_argument("--python-bin", default="")
    parser.add_argument("--model", default="base")
    parser.add_argument("--vad-onset", default="")
    parser.add_argument("--vad-offset", default="")
    parser.add_argument("--chunk-size", default="")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    output_root = Path(args.output_root).expanduser().resolve()
    work_dir = output_root / "work"
    raw_dir = output_root / "raw"
    whisper_dir = output_root / "output" / "whisperx"
    imported_dir = output_root / "output" / "imported"
    canonical_map = work_dir / "canonical-map.json"
    script_dir = Path(__file__).resolve().parent

    vendor_dir = args.vendor_dir or str(output_root / "vendor312")
    python_bin = resolve_python_bin(args.python_bin)

    run(
        [
            "node",
            str(script_dir / "build_series_canonical_map.js"),
            "--module",
            args.module,
            "--tracks-export",
            args.tracks_export,
            "--status-export",
            args.status_export,
            "--output",
            str(canonical_map),
        ]
    )

    copy_command = [
        "python3",
        str(script_dir / "copy_series_alignment_assets.py"),
        "--canonical-map",
        str(canonical_map),
        "--audio-source-dir",
        args.audio_source_dir,
        "--audio-output-dir",
        str(raw_dir),
        "--audio-extension",
        args.audio_extension,
    ]
    if args.pdf_source:
        copy_command.extend(["--pdf-source", args.pdf_source])
    if args.pdf_output_name:
        copy_command.extend(["--pdf-output-name", args.pdf_output_name])
    if args.force:
        copy_command.append("--force")
    run(copy_command)

    batch_command = [
        "python3",
        str(script_dir / "run_series_whisperx_batch.py"),
        "--canonical-map",
        str(canonical_map),
        "--raw-dir",
        str(raw_dir),
        "--whisper-output-dir",
        str(whisper_dir),
        "--imported-dir",
        str(imported_dir),
        "--audio-extension",
        args.audio_extension,
        "--vendor-dir",
        vendor_dir,
        "--python-bin",
        python_bin,
        "--model",
        args.model,
    ]
    if args.vad_onset:
        batch_command.extend(["--vad-onset", args.vad_onset])
    if args.vad_offset:
        batch_command.extend(["--vad-offset", args.vad_offset])
    if args.chunk_size:
        batch_command.extend(["--chunk-size", args.chunk_size])
    if args.subset:
        batch_command.extend(["--subset", args.subset])
    if args.force:
        batch_command.append("--force")
    run(batch_command)

    run(
        [
            "node",
            str(script_dir / "build_series_transcript_bundle.js"),
            str(imported_dir),
            args.bundle_output,
        ]
    )

    print("Pipeline complete.")


if __name__ == "__main__":
    main()
