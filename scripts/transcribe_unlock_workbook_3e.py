#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

import whisper


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_dir")
    parser.add_argument("out_dir")
    parser.add_argument("--model", default="medium")
    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(audio_dir.glob("*.mp3"), key=lambda item: item.name.lower())
    model = whisper.load_model(args.model)
    for index, audio_path in enumerate(files, 1):
        out_path = out_dir / f"{audio_path.stem}.json"
        if out_path.exists():
            print(f"skip {index}/{len(files)} {audio_path.name}", flush=True)
            continue
        result = model.transcribe(
            str(audio_path), language="en", fp16=False, verbose=False,
            word_timestamps=True,
        )
        payload = {
            "model": args.model,
            "language": result.get("language") or "en",
            "text": re.sub(r"\s+", " ", str(result.get("text") or "")).strip(),
            "segments": result.get("segments") or [],
        }
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"done {index}/{len(files)} {audio_path.name}", flush=True)


if __name__ == "__main__":
    main()
