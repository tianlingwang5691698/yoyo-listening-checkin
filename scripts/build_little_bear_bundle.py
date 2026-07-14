#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import time
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path


AUDIO_DIR = Path("/Users/wangtianlong/工作/未命名文件夹/3、Little bear 音频MP3")
DOC_DIR = Path("/Users/wangtianlong/工作/未命名文件夹/4、little bear 台词本43本")
OUT_ROOT = Path("data/transcript-build/little-bear/Pre A1/little-bear")
AUDIO_CLOUD_ROOT = "Pre A1/Little Bear/Audio"
TRANSCRIPT_CLOUD_PATH = "_transcripts/Pre A1/little-bear/bundle-sentence-v1.json"


DOC_AUDIO = {
    "Bears band.doc": "03-026-9-2 Little bear`s band_1.MP3",
    "Detective Little Bear.doc": "16-135-1-3 detective little bear_1.MP3",
    "Diva Hen.doc": "13-110-1-2 diva hen_1.MP3",
    "Duck Baby Sitter-.doc": "03-025-9-1 Duck,baby sister_1.MP3",
    "Duck Loses Her Quack-.doc": "16-133-1-1 duck loses her quack_1.MP3",
    "Emilys visit.doc": "03-024-8-3 Emily`s visit_1.MP3",
    "Hiccups-.doc": "03-019-7-1 1-7-1 hiccups_1.MP3",
    "Hop-Frog-Pond-.doc": "03-027-9-3 Hop frog pond_1.MP3",
    "Little Bear Sing Along.doc": "09-082-3-1 Little bear sing a song_1.MP3",
    "Little Sherlock bear.doc": "06-051-5-3 little sherlock bear_1.MP3",
    "Night of the full moon.doc": "08-066-10-3 Night of the full moon_1.MP3",
    "PICNIC ON PUDDING HILL.doc": "08-073-13-1 Picnic on pudding hill_1.MP3",
    "PRINCESS DUCK.doc": "12-101-10-2 princess duck_1.MP3",
    "Party at Owl&#39;s house.doc": "04-033-11-2 party at owl`s house_1.MP3",
    "Pillow hill.doc": "13-109-1-1 pillow hill_1.MP3",
    "Sweet Tooth.doc": "10-093-7-3 little bear`s sweet tooth_1.MP3",
    "The Campfire Tale.doc": "10-087-4-3 the camptire tale_1.MP3",
    "Thunder monster.doc": "14-122-9-2 thunder monster_1.MP3",
    "UP ALL NIGHT.doc": "02-10-1 up all night_1.MP3",
    "between friends.doc": "08-070-12 Between friends_1.MP3",
    "clever cricket.doc": "12-106-13-1 clever crcket_1.MP3",
    "follow the leader.doc": "07-061-9.follow the leader_1.MP3",
    "the raindance play.doc": "04-034-11-3 the rain dance play_1.MP3",
    "under the covers.doc": "11-096-8-3 under the covers_1.MP3",
}


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ffprobe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def slug(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def audio_index(path):
    match = re.match(r"^\d+-(\d+)", path.name)
    if not match:
        raise ValueError(f"missing global index: {path.name}")
    return int(match.group(1))


def title_from_audio(path):
    stem = re.sub(r"_1$", "", path.stem, flags=re.I)
    stem = re.sub(r"^\d+(?:-\d+){1,4}[.-]?\s*", "", stem)
    stem = re.sub(r"^\d+(?:-\d+){1,2}\s+", "", stem)
    stem = stem.replace("`", "'").replace("_", " ")
    return re.sub(r"\s+", " ", stem).strip(" .-").title()


def read_doc(path):
    result = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.replace("\u00a0", " ").replace("\u2028", "\n").replace("´", "'")


def official_title_and_sentences(path):
    raw_lines = [re.sub(r"\s+", " ", line).strip() for line in read_doc(path).splitlines()]
    lines = [line for line in raw_lines if line]
    if not lines:
        raise ValueError(f"empty transcript: {path.name}")
    title = re.sub(r"^LB_", "", lines[0], flags=re.I)
    title = title.replace("&#39;", "'").replace("_", " ").replace(".mp4", "")
    title = re.sub(r"\s+", " ", title).strip()
    title = title.title() if title.isupper() else title[:1].upper() + title[1:]
    title = re.sub(r"['’]S\b", "'s", title)
    started = False
    sentences = []
    for line in lines[1:]:
        match = re.match(r"^([A-Za-z]{1,8}):\s*(.+)$", line)
        if not match:
            if not started:
                continue
            body = line
        else:
            started = True
            body = match.group(2)
        body = body.replace("’", "'").replace("“", '"').replace("”", '"')
        for part in re.findall(r".+?(?:[.!?](?=\s|$)|$)", body):
            text = re.sub(r"\s+", " ", part).strip()
            if text:
                sentences.append(text)
    if not sentences:
        raise ValueError(f"no dialogue sentences: {path.name}")
    return title, sentences


def clean_word(value):
    value = str(value).lower().replace("’", "'")
    value = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", value)
    return value[:-2] if value.endswith("'s") else value


def tokens(text):
    return [word for raw in re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", text) if (word := clean_word(raw))]


def transcribe(model, audio_path, model_name):
    started = time.time()
    result = model.transcribe(
        str(audio_path),
        language="en",
        fp16=False,
        verbose=False,
        word_timestamps=True,
        temperature=0,
    )
    segments = []
    for segment in result.get("segments") or []:
        words = []
        for item in segment.get("words") or []:
            text = re.sub(r"\s+", " ", str(item.get("word") or "")).strip()
            if not text:
                continue
            words.append({
                "text": text,
                "startMs": round(float(item.get("start") or 0) * 1000),
                "endMs": round(float(item.get("end") or 0) * 1000),
                "probability": round(float(item.get("probability") or 0), 6),
            })
        segments.append({
            "text": re.sub(r"\s+", " ", str(segment.get("text") or "")).strip(),
            "startMs": round(float(segment.get("start") or 0) * 1000),
            "endMs": round(float(segment.get("end") or 0) * 1000),
            "words": words,
        })
    return {"model": model_name, "language": result.get("language") or "en", "elapsedSec": round(time.time() - started, 3), "segments": segments}


def flatten_asr_words(asr):
    output = []
    for segment in asr.get("segments") or []:
        for item in segment.get("words") or []:
            token = clean_word(item.get("text") or "")
            if token and int(item.get("endMs") or 0) > int(item.get("startMs") or 0):
                output.append({"token": token, "startMs": int(item["startMs"]), "endMs": int(item["endMs"])})
    return output


def align_sentences(track_id, sentences, asr, duration_ms):
    official = []
    for line_index, sentence in enumerate(sentences):
        official.extend({"token": token, "lineIndex": line_index} for token in tokens(sentence))
    words = flatten_asr_words(asr)
    matcher = SequenceMatcher(None, [item["token"] for item in official], [item["token"] for item in words], autojunk=False)
    matched = defaultdict(list)
    matched_tokens = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            continue
        for official_index, word_index in zip(range(i1, i2), range(j1, j2)):
            matched[official[official_index]["lineIndex"]].append(word_index)
            matched_tokens += 1
    coverage = matched_tokens / max(1, len(official))
    anchored = len(matched) / max(1, len(sentences))
    if coverage < 0.45 or anchored < 0.72:
        raise ValueError(f"alignment below threshold: token={coverage:.3f}, lines={anchored:.3f}")
    lines = []
    previous_end = 0
    for source_index, sentence in enumerate(sentences):
        indexes = matched.get(source_index) or []
        if not indexes:
            continue
        start_ms = words[min(indexes)]["startMs"]
        end_ms = words[max(indexes)]["endMs"]
        start_ms = max(previous_end, min(duration_ms - 1, int(start_ms)))
        end_ms = max(start_ms + 1, min(duration_ms, int(end_ms)))
        lines.append({
            "lineId": f"{track_id}-line-{len(lines) + 1}",
            "text": sentence,
            "startMs": start_ms,
            "endMs": end_ms,
            "sourceLineIndex": source_index + 1,
        })
        previous_end = end_ms
    lines[-1]["endMs"] = duration_ms
    return lines, round(coverage, 4), round(anchored, 4)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_catalog(audio_files):
    items = []
    for path in audio_files:
        index = audio_index(path)
        title = title_from_audio(path)
        digest = sha1_file(path)
        duration = round(ffprobe_duration(path), 3)
        items.append({
            "taskId": f"little-bear-{index:03d}",
            "category": "littlebear",
            "title": title,
            "subtitle": f"Little Bear · {index}/161",
            "audioCloudPath": f"{AUDIO_CLOUD_ROOT}/{index:03d}-{slug(title)}-{digest[:10]}.mp3",
            "size": path.stat().st_size,
            "repeatTarget": 3,
            "durationSec": duration,
            "coverTone": "mint" if index % 2 else "peach",
            "transcriptTrackId": f"track-little-bear-{index:03d}",
            "transcriptStatus": "pending",
            "syncGranularity": "none",
            "validationStatus": "candidate-unverified",
            "_sourcePath": str(path),
            "_sha1": digest,
        })
    return items


def finalize_outputs(catalog, bundle, manifest, rejected):
    by_track = {item["transcriptTrackId"]: item for item in catalog}
    ready_catalog = []
    for track in manifest.get("tracks") or []:
        item = dict(by_track[track["trackId"]])
        item["title"] = track["title"]
        item["transcriptStatus"] = "ready"
        item["syncGranularity"] = "line"
        item["validationStatus"] = "official-transcript-aligned"
        item["textSource"] = {
            "sourceType": "transcript-bundle",
            "title": "Little Bear official transcript",
            "filePath": TRANSCRIPT_CLOUD_PATH,
        }
        item = {key: value for key, value in item.items() if not key.startswith("_") and value is not None}
        ready_catalog.append(item)
    ready_catalog.sort(key=lambda item: item["taskId"])

    all_docs = sorted(path.name for path in DOC_DIR.glob("*.doc"))
    unique_keys = {
        re.sub(r"[^a-z0-9]+", "", re.sub(r"-$", "", Path(name).stem.lower()))
        for name in all_docs
    }
    unmapped_docs = [name for name in all_docs if name not in DOC_AUDIO]
    durations = [int(line["endMs"]) - int(line["startMs"]) for track in bundle.values() for line in track.get("lines") or []]
    report = {
        "sourceAudioCount": len(catalog),
        "sourceTranscriptDocCount": len(all_docs),
        "uniqueTranscriptTitleCount": len(unique_keys),
        "mappedTranscriptCandidateCount": len(DOC_AUDIO),
        "readyTrackCount": len(bundle),
        "readyLineCount": sum(len(track.get("lines") or []) for track in bundle.values()),
        "rejectedMappingCount": len(rejected),
        "unmappedTranscriptDocCount": len(unmapped_docs),
        "unmappedTranscriptDocs": unmapped_docs,
        "validationErrorCount": 0,
        "minimumLineDurationMs": min(durations) if durations else 0,
        "timing": "real-whisper-word-timestamps-unanchored-source-lines-omitted",
    }
    tracks = manifest.get("tracks") or []
    samples = []
    if tracks:
        for offset in sorted({0, len(tracks) // 2, len(tracks) - 1}):
            item = tracks[offset]
            track = bundle[item["trackId"]]
            lines = track["lines"]
            samples.append({
                "trackId": item["trackId"],
                "title": item["title"],
                "firstLine": lines[0],
                "middleLine": lines[len(lines) // 2],
                "lastLine": lines[-1],
                "lastLineEndsAtDuration": lines[-1]["endMs"] == round(track["durationSec"] * 1000),
            })
    write_json(OUT_ROOT / "catalog-items.json", ready_catalog)
    write_json(OUT_ROOT / "clean-report.json", report)
    write_json(OUT_ROOT / "sample-audit.json", samples)


def main():
    parser = argparse.ArgumentParser(description="Build Little Bear official-transcript sentence bundles with real Whisper word timestamps.")
    parser.add_argument("--doc", action="append", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--model", default="base")
    parser.add_argument("--force-asr", action="store_true")
    parser.add_argument("--catalog-only", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--reset-derived", action="store_true")
    args = parser.parse_args()

    audio_files = sorted(AUDIO_DIR.glob("*.[Mm][Pp]3"), key=audio_index)
    if len(audio_files) != 155:
        raise ValueError(f"expected 155 audio files, found {len(audio_files)}")
    catalog = build_catalog(audio_files)
    write_json(OUT_ROOT / "catalog-items.local.json", catalog)

    selected = list(DOC_AUDIO) if args.all else args.doc
    if args.catalog_only or not selected:
        print(f"CATALOG audio={len(catalog)} mapped={len(DOC_AUDIO)}", flush=True)
        return
    invalid = [name for name in selected if name not in DOC_AUDIO]
    if invalid:
        raise ValueError(f"unknown mapped docs: {invalid}")

    bundle_path = OUT_ROOT / "bundle-sentence-v1.json"
    bundle = json.loads(bundle_path.read_text(encoding="utf-8")) if bundle_path.exists() else {}
    rejected_path = OUT_ROOT / "rejected-mappings.json"
    rejected = json.loads(rejected_path.read_text(encoding="utf-8")) if rejected_path.exists() else {}
    if args.skip_existing:
        selected = [
            name for name in selected
            if f"track-little-bear-{audio_index(AUDIO_DIR / DOC_AUDIO[name]):03d}" not in bundle and name not in rejected
        ]
    if not selected:
        print("DONE no remaining mapped transcripts", flush=True)
        return

    import whisper
    model = whisper.load_model(args.model, download_root=str(Path.home() / ".cache" / "whisper"), device="cpu")
    manifest_path = OUT_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"meta": {}, "tracks": []}
    by_track = {item["trackId"]: item for item in manifest.get("tracks") or []}
    if args.reset_derived:
        bundle = {}
        by_track = {}
        rejected = {}
    catalog_by_name = {Path(item["_sourcePath"]).name: item for item in catalog}
    asr_dir = OUT_ROOT / f"asr-{args.model}"

    for position, doc_name in enumerate(selected, 1):
        doc_path = DOC_DIR / doc_name
        audio_path = AUDIO_DIR / DOC_AUDIO[doc_name]
        title, sentences = official_title_and_sentences(doc_path)
        index = audio_index(audio_path)
        track_id = f"track-little-bear-{index:03d}"
        duration_sec = ffprobe_duration(audio_path)
        duration_ms = round(duration_sec * 1000)
        asr_path = asr_dir / f"{index:03d}-{slug(title)}.json"
        if args.force_asr or not asr_path.exists():
            asr = transcribe(model, audio_path, args.model)
            write_json(asr_path, asr)
        else:
            asr = json.loads(asr_path.read_text(encoding="utf-8"))
        bundle.pop(track_id, None)
        by_track.pop(track_id, None)
        try:
            lines, coverage, anchored = align_sentences(track_id, sentences, asr, duration_ms)
        except ValueError as error:
            rejected[doc_name] = {
                "title": title,
                "audioFileName": audio_path.name,
                "reason": str(error),
                "asrPath": str(asr_path),
            }
            write_json(bundle_path, bundle)
            write_json(manifest_path, {"meta": manifest.get("meta") or {}, "tracks": sorted(by_track.values(), key=lambda item: item["index"])})
            write_json(rejected_path, rejected)
            print(f"REJECT {position}/{len(selected)} | {title} | {error}", flush=True)
            continue
        rejected.pop(doc_name, None)
        bundle[track_id] = {
            "trackId": track_id,
            "contentId": f"little-bear-{index:03d}",
            "title": title,
            "fileName": audio_path.name,
            "mediaType": "audio",
            "syncGranularity": "line",
            "source": f"official-doc-plus-whisper-{args.model}-word-timestamps",
            "textSource": str(doc_path),
            "durationSec": round(duration_sec, 3),
            "lines": lines,
        }
        catalog_item = catalog_by_name[audio_path.name]
        by_track[track_id] = {
            "index": index,
            "id": f"little-bear-{index:03d}",
            "trackId": track_id,
            "title": title,
            "sourcePath": str(audio_path),
            "transcriptSourcePath": str(doc_path),
            "audioCloudPath": catalog_item["audioCloudPath"],
            "durationSec": round(duration_sec, 3),
            "size": audio_path.stat().st_size,
            "sha1": catalog_item["_sha1"],
            "lineCount": len(lines),
            "tokenCoverage": coverage,
            "anchoredLineRatio": anchored,
            "asrPath": str(asr_path),
        }
        manifest = {
            "meta": {
                "level": "Pre A1",
                "category": "littlebear",
                "series": "Little Bear",
                "audioSourceDir": str(AUDIO_DIR),
                "transcriptSourceDir": str(DOC_DIR),
                "audioCloudRoot": AUDIO_CLOUD_ROOT,
                "transcriptCloudPath": TRANSCRIPT_CLOUD_PATH,
                "catalogAudioCount": 155,
                "mappedOfficialTranscriptCount": len(DOC_AUDIO),
                "asrModel": args.model,
                "timing": "real-whisper-word-timestamps-no-duration-proportional-allocation",
            },
            "tracks": sorted(by_track.values(), key=lambda item: item["index"]),
        }
        write_json(bundle_path, bundle)
        write_json(manifest_path, manifest)
        write_json(rejected_path, rejected)
        print(
            f"DONE {position}/{len(selected)} | {title} | duration={duration_sec:.3f}s | lines={len(lines)} | token={coverage:.1%} | anchored={anchored:.1%}",
            flush=True,
        )
    finalize_outputs(catalog, bundle, manifest, rejected)


if __name__ == "__main__":
    main()
