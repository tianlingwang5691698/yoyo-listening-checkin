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
  --bundle-output ./data/transcript-build/peppa-s1/run/output/peppa-word-tracks.json \
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
  --bundle-output ./data/transcript-build/peppa-s1/run/output/peppa-word-tracks.json
```

### 4. 问题集保守重跑参数

对白型、前 10 句有明显断层的集，优先用：

```bash
--vad-onset 0.35 --vad-offset 0.2 --chunk-size 10
```

这组参数更适合把 `Peppa` 里短句密集的前半段重新切回来。

## 生成产物

- `source/paragraphs.json`
- `source/manifest.json`
- `generated/episodes.json`
- `generated/anomalies.json`
- `generated/peppa_tracks.js`
- `generated/peppa_build_status.js`
- `generated/peppa_s1_module.js`
- `run/output/imported/*.json`
- `run/output/peppa-word-tracks.json`

## CloudBase 正式上传路径

线上正式读取入口放这里：

- `_transcripts/A1/peppa/bundle.json`
- `_transcripts/A1/peppa/build-status.json`
- `_transcripts/A1/peppa/items/<trackId>.json`

也就是：

- 本地生成在 `run/output/`
- 线上正式上传到 CloudBase `_transcripts/A1/peppa/`
- `yoyo` 不再使用本地 transcript fallback，必须以上传到 CloudBase 的 `bundle.json` 为准
- 如果云端 `bundle.json` 没上传成功，前台不会再回退到本地 transcript

推荐上传映射：

- `run/output/peppa-word-tracks.json` -> `_transcripts/A1/peppa/bundle.json`
- `generated/peppa_build_status.js` 或转成 json -> `_transcripts/A1/peppa/build-status.json`
- `run/output/imported/track-peppa-s101.json` -> `_transcripts/A1/peppa/items/track-peppa-s101.json`

## anomalies 判定

以下情况视为阻塞：

- `missing-audio`
- `audio-without-docx-section`
- 大量 `title-mismatch`
- `empty-episode`

少量标题标准化差异可以先人工核对，再决定是否继续跑整季。

## 质量判定补充

- 前 10 句不能出现明显断层，例如 `9s -> 34s` 这种无理由跳跃
- 相邻短句不能连续挤在同一秒附近后再被整体推到后面
- 如果 WhisperX 原始转写本身漏掉前半段对白，优先重跑单集，再重新导入，不要直接手工改 bundle
