#!/usr/bin/env python3
import argparse
import difflib
import json
import re
from pathlib import Path


def normalize_token(token: str) -> str:
    token = str(token or "").lower().strip()
    token = token.replace("’", "'").replace("‘", "'")
    token = token.replace("“", '"').replace("”", '"')
    token = token.replace("–", "-").replace("—", "-")
    token = re.sub(r"^[^a-z0-9']+|[^a-z0-9']+$", "", token)
    replacements = {
        "okay": "ok",
        "coco": "koko",
        "nihia": "nehir",
        "nihir": "nehir",
        "nadia": "nadiya",
        "abdel": "abdal",
        "claire": "clare",
        "dawood": "dawud",
        "v": "b",
    }
    return replacements.get(token, token)


def token_weight(token: str) -> int:
    return max(len(normalize_token(token) or token), 1)


def split_tokens(text: str):
    return [token for token in str(text or "").split() if token]


def allocate_tokens(tokens, start_ms, end_ms, line_id, start_index):
    if not tokens:
        return []
    start_ms = int(round(start_ms))
    end_ms = int(round(max(end_ms, start_ms + len(tokens))))
    total_weight = sum(token_weight(token) for token in tokens)
    cursor = start_ms
    results = []
    for offset, token in enumerate(tokens):
        is_last = offset == len(tokens) - 1
        weight = token_weight(token)
        next_end = end_ms if is_last else cursor + max(1, round(((end_ms - start_ms) * weight) / total_weight))
        next_end = min(max(next_end, cursor + 1), end_ms if not is_last else max(end_ms, cursor + 1))
        results.append(
            {
                "wordId": f"{line_id}-w{start_index + offset + 1}",
                "text": token,
                "startMs": int(cursor),
                "endMs": int(next_end),
            }
        )
        cursor = next_end
    results[-1]["endMs"] = max(results[-1]["endMs"], end_ms)
    return results


def load_canonical_map(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    tracks = data.get("tracksByFileName") or {}
    if not tracks:
        raise ValueError(f"Canonical map missing tracksByFileName: {path}")
    return tracks


def load_asr_words(whisper_data):
    words = []
    source = whisper_data.get("word_segments") or []
    if not source:
        for segment in whisper_data.get("segments", []):
            source.extend(segment.get("words") or [])
    for item in source:
        token = str(item.get("word", "")).strip()
        if not token:
            continue
        start = item.get("start")
        end = item.get("end")
        if start is None or end is None:
            continue
        words.append(
            {
                "word": token,
                "norm": normalize_token(token),
                "startMs": int(round(float(start) * 1000)),
                "endMs": int(round(float(end) * 1000)),
            }
        )
    while words and re.fullmatch(r"\d+(?:\.\d+)+", words[0]["word"]):
        words.pop(0)
    return words


def build_token_plan(canonical_lines):
    plan = []
    for line_index, line in enumerate(canonical_lines, start=1):
        tokens = split_tokens(line)
        for token_index, token in enumerate(tokens, start=1):
            plan.append(
                {
                    "lineIndex": line_index,
                    "tokenIndex": token_index,
                    "text": token,
                    "norm": normalize_token(token),
                }
            )
    return plan


def assign_timings(canonical_tokens, asr_words):
    if not canonical_tokens:
        return []
    if not asr_words:
        total_tokens = [token["text"] for token in canonical_tokens]
        return allocate_tokens(total_tokens, 0, max(len(total_tokens), 1), "line", 0)

    canonical_norm = [token["norm"] for token in canonical_tokens]
    asr_norm = [word["norm"] for word in asr_words]
    matcher = difflib.SequenceMatcher(a=canonical_norm, b=asr_norm, autojunk=False)

    assigned = [None] * len(canonical_tokens)
    prev_assigned_end = asr_words[0]["startMs"]

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                asr_word = asr_words[j1 + offset]
                assigned[i1 + offset] = {
                    "startMs": asr_word["startMs"],
                    "endMs": max(asr_word["endMs"], asr_word["startMs"] + 1),
                }
                prev_assigned_end = assigned[i1 + offset]["endMs"]
            continue
        if i1 == i2:
            continue
        canon_slice = canonical_tokens[i1:i2]
        if j1 < j2:
            slice_start = asr_words[j1]["startMs"]
            slice_end = asr_words[j2 - 1]["endMs"]
        else:
            next_start = (
                asr_words[j1]["startMs"]
                if j1 < len(asr_words)
                else max(prev_assigned_end + len(canon_slice), asr_words[-1]["endMs"])
            )
            slice_start = prev_assigned_end
            slice_end = max(next_start, slice_start + len(canon_slice))
        allocated = allocate_tokens([item["text"] for item in canon_slice], slice_start, slice_end, "tmp", 0)
        for offset, item in enumerate(allocated):
            assigned[i1 + offset] = {
                "startMs": item["startMs"],
                "endMs": item["endMs"],
            }
        prev_assigned_end = allocated[-1]["endMs"]

    for index, item in enumerate(assigned):
        if item is None:
            start = assigned[index - 1]["endMs"] if index > 0 and assigned[index - 1] else 0
            end = start + 1
            assigned[index] = {"startMs": start, "endMs": end}

    for index in range(1, len(assigned)):
        if assigned[index]["startMs"] < assigned[index - 1]["endMs"]:
            assigned[index]["startMs"] = assigned[index - 1]["endMs"]
        if assigned[index]["endMs"] <= assigned[index]["startMs"]:
            assigned[index]["endMs"] = assigned[index]["startMs"] + 1
    return assigned


def build_track(file_name: str, whisper_json_path: Path, canonical_map_path: Path):
    canonical_map = load_canonical_map(canonical_map_path)
    if file_name not in canonical_map:
        raise KeyError(f"Canonical entry not found for {file_name}")
    track_config = canonical_map[file_name]
    canonical_lines = track_config["canonicalSegments"]
    canonical_tokens = build_token_plan(canonical_lines)
    whisper_data = json.loads(whisper_json_path.read_text(encoding="utf-8"))
    asr_words = load_asr_words(whisper_data)
    token_timings = assign_timings(canonical_tokens, asr_words)

    lines = []
    cursor = 0
    for line_index, text in enumerate(canonical_lines, start=1):
        line_tokens = split_tokens(text)
        line_id = f"{track_config['contentId']}-{line_index}"
        line_words = []
        for token_offset, token_text in enumerate(line_tokens):
            timing = token_timings[cursor]
            line_words.append(
                {
                    "wordId": f"{line_id}-w{token_offset + 1}",
                    "text": token_text,
                    "startMs": timing["startMs"],
                    "endMs": timing["endMs"],
                }
            )
            cursor += 1
        if line_words:
            line_start = line_words[0]["startMs"]
            line_end = line_words[-1]["endMs"]
        else:
            previous_end = lines[-1]["endMs"] if lines else 0
            line_start = previous_end
            line_end = previous_end + 1
        lines.append(
            {
                "lineId": line_id,
                "text": text,
                "startMs": line_start,
                "endMs": line_end,
                "words": line_words,
            }
        )

    return {
        "trackId": track_config["trackId"],
        "contentId": track_config["contentId"],
        "mediaType": "audio",
        "syncGranularity": "word",
        "source": "whisperx",
        "fileName": file_name,
        "lines": lines,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Convert WhisperX JSON output into a series transcript track JSON file."
    )
    parser.add_argument("file_name", help="Audio file name without extension")
    parser.add_argument("whisper_json", help="Path to the WhisperX JSON output file")
    parser.add_argument("output_json", help="Path to save the converted track JSON")
    parser.add_argument(
        "--canonical-map",
        required=True,
        help="Path to the canonical map JSON generated from the source series module.",
    )
    args = parser.parse_args()

    track = build_track(
        file_name=args.file_name,
        whisper_json_path=Path(args.whisper_json).expanduser().resolve(),
        canonical_map_path=Path(args.canonical_map).expanduser().resolve(),
    )
    output_path = Path(args.output_json).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(track, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Built {track['trackId']} with {len(track['lines'])} line(s) -> {output_path}")


if __name__ == "__main__":
    main()
