#!/usr/bin/env python3
import argparse
import json
import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
HEADING_RE = re.compile(r"^(?P<number>\d{2})\.\s+(?P<title>.+)$")
AUDIO_RE = re.compile(r"^S1(?P<number>\d{2})\s+(?P<title>.+)$")


def normalize_space(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_title(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def load_docx_paragraphs(docx_path: Path):
    with ZipFile(docx_path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))

    paragraphs = []
    for index, paragraph in enumerate(root.findall(".//w:body/w:p", WORD_NS), start=1):
        text = "".join(node.text for node in paragraph.findall(".//w:t", WORD_NS) if node.text)
        text = normalize_space(text)
        if text:
            paragraphs.append({"index": index, "text": text})
    return paragraphs


def split_toc_and_body(paragraphs):
    body_start = None
    for offset, paragraph in enumerate(paragraphs):
        match = HEADING_RE.match(paragraph["text"])
        if match and not paragraph["text"][-1].isdigit():
            body_start = offset
            break
    if body_start is None:
        raise ValueError("Could not find the first episode heading in the DOCX body.")
    return paragraphs[:body_start], paragraphs[body_start:]


def build_audio_index(audio_dir: Path):
    items = {}
    for path in sorted(audio_dir.glob("*.mp3")):
        stem = path.stem
        match = AUDIO_RE.match(stem)
        if not match:
            continue
        episode_number = int(match.group("number"))
        items[episode_number] = {
            "fileName": stem,
            "title": match.group("title"),
            "path": str(path.resolve()),
        }
    if not items:
        raise ValueError(f"No matching Peppa audio files found in {audio_dir}")
    return items


def build_episode_sections(body_paragraphs):
    starts = []
    for offset, paragraph in enumerate(body_paragraphs):
        match = HEADING_RE.match(paragraph["text"])
        if match and not paragraph["text"][-1].isdigit():
            starts.append((offset, int(match.group("number")), match.group("title")))

    if len(starts) != 52:
        raise ValueError(f"Expected 52 episode headings in DOCX body, found {len(starts)}")

    sections = []
    for index, (start_offset, episode_number, title) in enumerate(starts):
        end_offset = starts[index + 1][0] if index + 1 < len(starts) else len(body_paragraphs)
        body_lines = [item["text"] for item in body_paragraphs[start_offset + 1 : end_offset] if item["text"]]
        sections.append(
            {
                "episodeNumber": episode_number,
                "episodeTitle": title,
                "headingIndex": body_paragraphs[start_offset]["index"],
                "canonicalSegments": body_lines,
            }
        )
    return sections


def build_track(episode_number: int, canonical_segments):
    content_id = f"peppa-{episode_number}"
    track_id = f"track-peppa-s1{episode_number:02d}"
    lines = []
    cursor = 0
    step = 3000
    for line_index, text in enumerate(canonical_segments, start=1):
        lines.append(
            {
                "lineId": f"peppa-s1{episode_number:02d}-{line_index}",
                "text": text,
                "startMs": cursor,
                "endMs": cursor + step,
            }
        )
        cursor += step
    return {
        "trackId": track_id,
        "contentId": content_id,
        "mediaType": "audio",
        "lines": lines,
    }


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_js_module(path: Path, export_name: str, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = (
        f"const {export_name} = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n\nmodule.exports = {\n"
        + f"  {export_name},\n"
        + "};\n"
    )
    path.write_text(text, encoding="utf-8")


def write_entry_module(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "const { peppaTranscriptTracks } = require('./peppa_tracks');\n"
        "const { peppaTranscriptBuildStatus } = require('./peppa_build_status');\n\n"
        "module.exports = {\n"
        "  peppaTranscriptTracks,\n"
        "  peppaTranscriptBuildStatus,\n"
        "};\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(
        description="Build a full Peppa Season 1 transcript module from the local DOCX scripts and audio folder."
    )
    parser.add_argument("--docx", required=True)
    parser.add_argument("--audio-dir", required=True)
    parser.add_argument("--output-root", required=True)
    args = parser.parse_args()

    docx_path = Path(args.docx).expanduser().resolve()
    audio_dir = Path(args.audio_dir).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve()
    source_dir = output_root / "source"
    generated_dir = output_root / "generated"

    paragraphs = load_docx_paragraphs(docx_path)
    toc_paragraphs, body_paragraphs = split_toc_and_body(paragraphs)
    audio_index = build_audio_index(audio_dir)
    sections = build_episode_sections(body_paragraphs)

    episodes = []
    tracks = []
    statuses = []
    anomalies = []

    for section in sections:
        episode_number = section["episodeNumber"]
        audio = audio_index.get(episode_number)
        if not audio:
            anomalies.append(
                {
                    "type": "missing-audio",
                    "episodeNumber": episode_number,
                    "episodeTitle": section["episodeTitle"],
                }
            )
            continue

        title_mismatch = normalize_title(section["episodeTitle"]) != normalize_title(audio["title"])
        if title_mismatch:
            anomalies.append(
                {
                    "type": "title-mismatch",
                    "episodeNumber": episode_number,
                    "docxTitle": section["episodeTitle"],
                    "audioTitle": audio["title"],
                }
            )

        if not section["canonicalSegments"]:
            anomalies.append(
                {
                    "type": "empty-episode",
                    "episodeNumber": episode_number,
                    "episodeTitle": section["episodeTitle"],
                }
            )

        track = build_track(episode_number, section["canonicalSegments"])
        status = {
            "trackId": track["trackId"],
            "taskId": f"peppa-{episode_number}",
            "fileName": audio["fileName"],
            "batch": math.ceil(episode_number / 10),
            "status": "ready",
        }
        episodes.append(
            {
                "episodeNumber": episode_number,
                "episodeTitle": section["episodeTitle"],
                "fileName": audio["fileName"],
                "trackId": track["trackId"],
                "contentId": track["contentId"],
                "canonicalSegments": section["canonicalSegments"],
            }
        )
        tracks.append(track)
        statuses.append(status)

    for episode_number, audio in sorted(audio_index.items()):
        if not any(item["episodeNumber"] == episode_number for item in episodes):
            anomalies.append(
                {
                    "type": "audio-without-docx-section",
                    "episodeNumber": episode_number,
                    "fileName": audio["fileName"],
                }
            )

    source_manifest = {
        "docxPath": str(docx_path),
        "audioDir": str(audio_dir),
        "tocParagraphs": toc_paragraphs,
        "bodyParagraphCount": len(body_paragraphs),
        "episodeHeadingCount": len(sections),
    }

    write_json(source_dir / "paragraphs.json", paragraphs)
    write_json(source_dir / "manifest.json", source_manifest)
    write_json(generated_dir / "episodes.json", episodes)
    write_json(generated_dir / "anomalies.json", anomalies)
    write_js_module(generated_dir / "peppa_tracks.js", "peppaTranscriptTracks", tracks)
    write_js_module(generated_dir / "peppa_build_status.js", "peppaTranscriptBuildStatus", statuses)
    write_entry_module(generated_dir / "peppa_s1_module.js")

    print(f"Generated {len(episodes)} episode entries into {generated_dir}")
    if anomalies:
        print(f"Detected {len(anomalies)} anomaly record(s) -> {generated_dir / 'anomalies.json'}")
    else:
        print("Detected 0 anomalies")


if __name__ == "__main__":
    main()
