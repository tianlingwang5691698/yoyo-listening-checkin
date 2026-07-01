#!/usr/bin/env python3
import csv
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path("data/dictionary-import")
SOURCE = ROOT / "source"
OUTPUT = ROOT / "output"
AUDIO_OUTPUT = OUTPUT / "audio"
LEVEL_ORDER = {"junior": 1, "senior": 2, "ielts": 3}


def norm_word(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"^[^a-z]+|[^a-z]+$", "", text)
    text = re.sub(r"\s+", "-", text)
    return text


def safe_name(word):
    return re.sub(r"[^a-z0-9'-]+", "-", word).strip("-")


def read_csv(path, level):
    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            word = norm_word(row.get("word"))
            if not word:
                continue
            definitions = []
            for key in ("definition", "definitions", "meaning"):
                value = str(row.get(key) or "").strip()
                if value:
                    definitions.extend([item.strip() for item in re.split(r"[;；|]", value) if item.strip()])
            rows.append({
                "word": word,
                "wordLower": word,
                "level": level,
                "levelRank": LEVEL_ORDER.get(level, 99),
                "phonetic": str(row.get("phonetic") or "").strip().strip("/"),
                "definitions": definitions,
                "example": str(row.get("example") or "").strip(),
                "source": "local-import"
            })
    return rows


def find_audio(level_dir, word):
    audio_dir = level_dir / "audio"
    names = {
        f"{safe_name(word)}.mp3",
        f"{word}.mp3",
        f"{word.replace('-', ' ')}.mp3",
    }
    for path in audio_dir.glob("*.mp3"):
        if path.name.lower() in names:
            return path
    return None


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    AUDIO_OUTPUT.mkdir(parents=True, exist_ok=True)
    entries_by_level = {}
    audio_manifest = []

    for level_dir in sorted([p for p in SOURCE.iterdir() if p.is_dir()]) if SOURCE.exists() else []:
        level = level_dir.name
        csv_path = level_dir / "words.csv"
        if not csv_path.exists():
            continue
        for entry in read_csv(csv_path, level):
            word = entry["wordLower"]
            audio_path = find_audio(level_dir, word)
            if audio_path:
                digest = hashlib.sha1(f"{level}:{word}".encode("utf-8")).hexdigest()[:20]
                out_name = f"{digest}-{safe_name(word)}.mp3"
                rel_cloud = f"_dictionary_audio/{level}/{out_name}"
                local_out = AUDIO_OUTPUT / level / out_name
                local_out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(audio_path, local_out)
                entry["audioCloudPath"] = rel_cloud
                audio_manifest.append({
                    "wordLower": word,
                    "level": level,
                    "localPath": str(local_out),
                    "cloudPath": rel_cloud
                })
            entries_by_level.setdefault(level, {})[word] = entry

    level_counts = {}
    for level, level_entries in entries_by_level.items():
        rows = sorted(level_entries.values(), key=lambda x: x["wordLower"])
        for item in rows:
            item.pop("levelRank", None)
        level_counts[level] = len(rows)
        (OUTPUT / f"word-dictionary-{level}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    legacy_dictionary = OUTPUT / "word-dictionary.json"
    if legacy_dictionary.exists():
        legacy_dictionary.unlink()
    (OUTPUT / "upload-audio-manifest.json").write_text(json.dumps(audio_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "levels": level_counts,
        "audio": len(audio_manifest),
        "dictionaries": {level: str(OUTPUT / f"word-dictionary-{level}.json") for level in sorted(level_counts)},
        "audioManifest": str(OUTPUT / "upload-audio-manifest.json")
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
