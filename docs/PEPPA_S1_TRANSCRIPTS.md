# Peppa 第一季逐词能力

## 素材目录

- 文稿：`data/transcript-build/peppa-s1/source/docs/PeppaPig第1季剧本台词.docx`
- 音频：`data/transcript-build/peppa-s1/source/audio/第1季/*.mp3`
- 生成模块：`data/transcript-build/peppa-s1/generated/`
- 运行目录：`data/transcript-build/peppa-s1/run/`

## 标准顺序

### 1. 生成 52 集 transcript 模块

```bash
python3 scripts/build_peppa_s1_from_docx.py \
  --docx "./data/transcript-build/peppa-s1/source/docs/PeppaPig第1季剧本台词.docx" \
  --audio-dir "./data/transcript-build/peppa-s1/source/audio/第1季" \
  --output-root "./data/transcript-build/peppa-s1"
```

### 2. 前三集冒烟

```bash
python3 scripts/run_series_transcript_pipeline.py \
  --module ./data/transcripts/peppa \
  --tracks-export peppaTranscriptTracks \
  --status-export peppaTranscriptBuildStatus \
  --output-root ./data/transcript-build/peppa-s1/run \
  --audio-source-dir ./data/transcript-build/peppa-s1/source/audio/第1季 \
  --bundle-output ./cloudfunctions/yoyo/transcripts/peppa-word-tracks.json \
  --subset "S101 Muddy Puddles,S102 Mr Dinosaur Is Lost,S103 Best Friend"
```

### 3. 整季运行

```bash
python3 scripts/run_series_transcript_pipeline.py \
  --module ./data/transcripts/peppa \
  --tracks-export peppaTranscriptTracks \
  --status-export peppaTranscriptBuildStatus \
  --output-root ./data/transcript-build/peppa-s1/run \
  --audio-source-dir ./data/transcript-build/peppa-s1/source/audio/第1季 \
  --bundle-output ./cloudfunctions/yoyo/transcripts/peppa-word-tracks.json
```

## 生成产物

- `source/paragraphs.json`
- `source/manifest.json`
- `generated/episodes.json`
- `generated/anomalies.json`
- `generated/peppa_tracks.js`
- `generated/peppa_build_status.js`
- `generated/peppa_s1_module.js`
- `run/output/imported/*.json`
- `cloudfunctions/yoyo/transcripts/peppa-word-tracks.json`

## anomalies 判定

以下情况视为阻塞：

- `missing-audio`
- `audio-without-docx-section`
- 大量 `title-mismatch`
- `empty-episode`

少量标题标准化差异可以先人工核对，再决定是否继续跑整季。
