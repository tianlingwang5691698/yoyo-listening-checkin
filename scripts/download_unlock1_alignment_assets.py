#!/usr/bin/env python3
import argparse
import shutil
from pathlib import Path


AUDIO_FILE_NAMES = [
    "Unlock2e_A1_1.2.mp3",
    "Unlock2e_A1_1.5.mp3",
    "Unlock2e_A1_2.2.mp3",
    "Unlock2e_A1_2.3.mp3",
    "Unlock2e_A1_2.5.mp3",
    "Unlock2e_A1_3.3.mp3",
    "Unlock2e_A1_3.5.mp3",
    "Unlock2e_A1_3.6.mp3",
    "Unlock2e_A1_4.2.mp3",
    "Unlock2e_A1_4.3.mp3",
    "Unlock2e_A1_4.4.mp3",
    "Unlock2e_A1_4.9.mp3",
    "Unlock2e_A1_5.3.mp3",
    "Unlock2e_A1_5.6.mp3",
    "Unlock2e_A1_6.2.mp3",
    "Unlock2e_A1_6.5.mp3",
    "Unlock2e_A1_6.6.mp3",
    "Unlock2e_A1_7.2.mp3",
    "Unlock2e_A1_7.3.mp3",
    "Unlock2e_A1_7.4.mp3",
    "Unlock2e_A1_7.9.mp3",
    "Unlock2e_A1_8.3.mp3",
    "Unlock2e_A1_8.5.mp3",
    "Unlock2e_A1_8.6.mp3",
]

LOCAL_AUDIO_DIR_CANDIDATES = [
    Path("~/工作/01_教学与备考/unlock 第二版/Unlock1/LS/Unlock1 听口音频Class Audio").expanduser(),
    Path("~/工作/01_教学与备考/unlock 第二版/Unlock1/LS/Unlock1 听口音频 Class Audio").expanduser(),
]


ASSETS = {
    **{
        file_name: [audio_dir / file_name for audio_dir in LOCAL_AUDIO_DIR_CANDIDATES]
        for file_name in AUDIO_FILE_NAMES
    },
    "Unlock 2e Listening and Speaking 1 Scripts.pdf": [
        Path("~/工作/01_教学与备考/unlock 第二版/Unlock1/LS/Unlock 2e Listening and Speaking 1 Scripts.pdf").expanduser(),
    ],
}


def resolve_source(candidates):
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def copy_asset(name, destination_dir: Path, force: bool):
    destination = destination_dir / name
    source = resolve_source(ASSETS[name])
    if source is None:
        raise FileNotFoundError(f"Asset not found locally: {name}")
    if destination.exists() and not force:
        return source, destination, False
    destination_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return source, destination, True


def main():
    parser = argparse.ArgumentParser(
        description="Copy Unlock1 alignment assets into the local transcript-build workspace."
    )
    parser.add_argument(
        "--output-dir",
        default="data/transcript-build/unlock1-word-align/raw",
        help="Directory where the audio and PDF files should be copied.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files in the output directory.",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir).expanduser().resolve()
    copied = 0
    for asset_name in ASSETS:
        source, destination, did_copy = copy_asset(asset_name, output_dir, args.force)
        status = "copied" if did_copy else "kept"
        copied += int(did_copy)
        print(f"{status}: {destination} <- {source}")
    print(f"Done. {copied} file(s) copied into {output_dir}")


if __name__ == "__main__":
    main()
