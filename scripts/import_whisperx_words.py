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


def load_asr_segments(whisper_data):
    segments = []
    for item in whisper_data.get("segments", []):
        words = []
        for word in item.get("words") or []:
            token = str(word.get("word", "")).strip()
            if not token:
                continue
            start = word.get("start")
            end = word.get("end")
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
        if words and re.fullmatch(r"\d+(?:\.\d+)+", words[0]["word"]):
            words = words[1:]
        if not words:
            continue
        segments.append(
            {
                "text": str(item.get("text", "")).strip(),
                "startMs": words[0]["startMs"],
                "endMs": words[-1]["endMs"],
                "words": words,
            }
        )
    return segments


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


def split_speaker_prefix(tokens):
    for index, token in enumerate(tokens[:3]):
        if token.endswith(":"):
            return tokens[: index + 1], tokens[index + 1 :]
    return [], tokens


def sequence_overlap_score(anchor_tokens, segment_tokens):
    if not anchor_tokens or not segment_tokens:
        return 0.0
    matcher = difflib.SequenceMatcher(a=anchor_tokens, b=segment_tokens, autojunk=False)
    blocks = matcher.get_matching_blocks()
    matched = sum(block.size for block in blocks)
    ratio = matcher.ratio()
    return max(ratio, matched / max(len(anchor_tokens), 1))


def is_dialogue_series(canonical_lines):
    if not canonical_lines:
        return False
    speaker_lines = 0
    for line in canonical_lines:
        tokens = split_tokens(line)
        prefix, _ = split_speaker_prefix(tokens)
        if prefix:
            speaker_lines += 1
    return speaker_lines / max(len(canonical_lines), 1) >= 0.35


def assign_line_windows_dialogue(canonical_lines, asr_segments):
    assignments = [None] * len(canonical_lines)
    segment_cursor = 0
    window_size = 8

    for line_index, line in enumerate(canonical_lines):
        tokens = split_tokens(line)
        _, anchor = split_speaker_prefix(tokens)
        anchor_norm = [normalize_token(token) for token in anchor if normalize_token(token)]
        if not anchor_norm:
            anchor_norm = [normalize_token(token) for token in tokens if normalize_token(token)]

        best_index = None
        best_score = 0.0
        best_distance_penalty = 0
        upper = min(len(asr_segments), segment_cursor + window_size)
        for candidate in range(segment_cursor, upper):
            segment_tokens = [word["norm"] for word in asr_segments[candidate]["words"] if word["norm"]]
            score = sequence_overlap_score(anchor_norm, segment_tokens)
            if score <= 0:
                continue
            distance_penalty = candidate - segment_cursor
            if score > best_score or (score == best_score and distance_penalty < best_distance_penalty):
                best_index = candidate
                best_score = score
                best_distance_penalty = distance_penalty

        min_score = 0.55 if len(anchor_norm) >= 5 else 0.42 if len(anchor_norm) >= 3 else 0.28
        if best_index is not None and best_score >= min_score:
            assignments[line_index] = best_index
            segment_cursor = best_index + 1

    return assignments


def slice_line_words_from_segment(line_text, segment, line_id):
    tokens = split_tokens(line_text)
    prefix_tokens, anchor_tokens = split_speaker_prefix(tokens)
    anchor_words = segment_words_to_project_words(
        " ".join(anchor_tokens) if anchor_tokens else line_text,
        segment["words"],
        line_id,
        segment["startMs"],
        segment["endMs"],
    )
    if not prefix_tokens:
        return anchor_words

    if anchor_words:
        prefix_end = anchor_words[0]["startMs"]
        prefix_start = max(segment["startMs"], prefix_end - max(len(prefix_tokens), 1))
    else:
        prefix_start = segment["startMs"]
        prefix_end = min(segment["endMs"], prefix_start + max(len(prefix_tokens), 1))
    prefix_words = allocate_tokens(prefix_tokens, prefix_start, prefix_end, line_id, 0)
    merged = []
    merged.extend(prefix_words)
    for index, item in enumerate(anchor_words, start=len(prefix_words) + 1):
        merged.append(
            {
                "wordId": f"{line_id}-w{index}",
                "text": item["text"],
                "startMs": item["startMs"],
                "endMs": item["endMs"],
            }
        )
    for index in range(1, len(merged)):
        if merged[index]["startMs"] < merged[index - 1]["endMs"]:
            merged[index]["startMs"] = merged[index - 1]["endMs"]
        if merged[index]["endMs"] <= merged[index]["startMs"]:
            merged[index]["endMs"] = merged[index]["startMs"] + 1
    return merged


def allocate_missing_lines(canonical_lines, assignments, asr_segments, content_id):
    lines = [None] * len(canonical_lines)

    for line_index, segment_index in enumerate(assignments):
        if segment_index is None:
            continue
        line_id = f"{content_id}-{line_index + 1}"
        words = slice_line_words_from_segment(canonical_lines[line_index], asr_segments[segment_index], line_id)
        lines[line_index] = {
            "lineId": line_id,
            "text": canonical_lines[line_index],
            "startMs": words[0]["startMs"] if words else asr_segments[segment_index]["startMs"],
            "endMs": words[-1]["endMs"] if words else asr_segments[segment_index]["endMs"],
            "words": words,
        }

    matched_indices = [index for index, item in enumerate(lines) if item]
    if not matched_indices:
        return []

    total_lines = len(canonical_lines)
    for index in range(total_lines):
        if lines[index]:
            continue
        previous_match = max([item for item in matched_indices if item < index], default=None)
        next_match = min([item for item in matched_indices if item > index], default=None)
        if previous_match is None and next_match is None:
            continue

        gap_start = 0 if previous_match is None else lines[previous_match]["endMs"]
        gap_end = gap_start + 1000 if next_match is None else lines[next_match]["startMs"]

        missing_group = [idx for idx in range(index, total_lines) if lines[idx] is None]
        if next_match is not None:
            missing_group = [idx for idx in missing_group if idx < next_match]
        else:
            contiguous = []
            for idx in missing_group:
                if contiguous and idx != contiguous[-1] + 1:
                    break
                contiguous.append(idx)
            missing_group = contiguous
        total_tokens = sum(max(len(split_tokens(canonical_lines[idx])), 1) for idx in missing_group)
        cursor = gap_start
        for idx in missing_group:
            tokens = split_tokens(canonical_lines[idx])
            token_count = max(len(tokens), 1)
            is_last = idx == missing_group[-1]
            segment_end = gap_end if is_last else cursor + max(1, round(((gap_end - gap_start) * token_count) / total_tokens))
            line_id = f"{content_id}-{idx + 1}"
            words = allocate_tokens(tokens, cursor, segment_end, line_id, 0)
            lines[idx] = {
                "lineId": line_id,
                "text": canonical_lines[idx],
                "startMs": words[0]["startMs"] if words else cursor,
                "endMs": words[-1]["endMs"] if words else segment_end,
                "words": words,
            }
            cursor = lines[idx]["endMs"]

    for index in range(1, len(lines)):
        if lines[index]["startMs"] < lines[index - 1]["endMs"]:
            shift = lines[index - 1]["endMs"] - lines[index]["startMs"]
            lines[index]["startMs"] += shift
            lines[index]["endMs"] += shift
            for word in lines[index]["words"]:
                word["startMs"] += shift
                word["endMs"] += shift
    return lines


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


def segment_words_to_project_words(canonical_text, asr_words, line_id, segment_start_ms, segment_end_ms):
    canonical_tokens = split_tokens(canonical_text)
    if not canonical_tokens:
        return []
    if not asr_words:
        return allocate_tokens(canonical_tokens, segment_start_ms, segment_end_ms, line_id, 0)

    asr_clean_words = [item for item in asr_words if str(item.get("word", "")).strip()]
    if asr_clean_words:
        first_token = str(asr_clean_words[0].get("word", "")).strip()
        if re.fullmatch(r"\d+(?:\.\d+)+", first_token) and not re.fullmatch(r"\d+(?:\.\d+)+", canonical_tokens[0]):
            asr_clean_words = asr_clean_words[1:]
            if asr_clean_words:
                segment_start_ms = int(round(asr_clean_words[0]["startMs"]))

    asr_tokens = [str(item.get("word", "")).strip() for item in asr_clean_words]
    asr_norm = [normalize_token(token) for token in asr_tokens]
    canonical_norm = [normalize_token(token) for token in canonical_tokens]
    matcher = difflib.SequenceMatcher(a=canonical_norm, b=asr_norm, autojunk=False)

    built = []
    built_count = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        canon_slice = canonical_tokens[i1:i2]
        asr_slice = asr_clean_words[j1:j2]
        if tag == "equal":
            for offset, token in enumerate(canon_slice):
                asr_word = asr_slice[offset]
                built.append(
                    {
                        "wordId": f"{line_id}-w{built_count + 1}",
                        "text": token,
                        "startMs": int(round(asr_word["startMs"])),
                        "endMs": int(round(asr_word["endMs"])),
                    }
                )
                built_count += 1
            continue
        if not canon_slice:
            continue
        if asr_slice:
            chunk_start = asr_slice[0]["startMs"]
            chunk_end = asr_slice[-1]["endMs"]
        else:
            prev_end = built[-1]["endMs"] if built else segment_start_ms
            next_start = segment_end_ms
            if j1 < len(asr_clean_words):
                next_start = int(round(asr_clean_words[j1]["startMs"]))
            chunk_start = prev_end
            chunk_end = max(next_start, chunk_start + len(canon_slice))
        allocated = allocate_tokens(canon_slice, chunk_start, chunk_end, line_id, built_count)
        built.extend(allocated)
        built_count += len(allocated)

    if not built:
        built = allocate_tokens(canonical_tokens, segment_start_ms, segment_end_ms, line_id, 0)
    built.sort(key=lambda item: (item["startMs"], item["endMs"]))
    for index in range(1, len(built)):
        if built[index]["startMs"] < built[index - 1]["endMs"]:
            built[index]["startMs"] = built[index - 1]["endMs"]
        if built[index]["endMs"] <= built[index]["startMs"]:
            built[index]["endMs"] = built[index]["startMs"] + 1
    if built:
        built[0]["startMs"] = min(built[0]["startMs"], int(round(segment_start_ms)))
        built[-1]["endMs"] = max(built[-1]["endMs"], int(round(segment_end_ms)))
    return built


def build_track(file_name: str, whisper_json_path: Path, canonical_map_path: Path):
    canonical_map = load_canonical_map(canonical_map_path)
    if file_name not in canonical_map:
        raise KeyError(f"Canonical entry not found for {file_name}")
    track_config = canonical_map[file_name]
    canonical_lines = track_config["canonicalSegments"]
    whisper_data = json.loads(whisper_json_path.read_text(encoding="utf-8"))

    if is_dialogue_series(canonical_lines):
        asr_segments = load_asr_segments(whisper_data)
        assignments = assign_line_windows_dialogue(canonical_lines, asr_segments)
        lines = allocate_missing_lines(canonical_lines, assignments, asr_segments, track_config["contentId"])
        return {
            "trackId": track_config["trackId"],
            "contentId": track_config["contentId"],
            "mediaType": "audio",
            "syncGranularity": "word",
            "source": "whisperx",
            "fileName": file_name,
            "lines": lines,
        }

    canonical_tokens = build_token_plan(canonical_lines)
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
