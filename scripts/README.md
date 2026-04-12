# 通用 WhisperX 音频文本对齐工具

这套脚本现在已经内置在当前项目里，职责是：

- 从项目内 transcript 模块生成 canonical map
- 复制该系列音频和可选 PDF 到本地工作区
- 批量运行 WhisperX 并导入词级时间戳
- 合并成最终 bundle JSON
- 支持 `Peppa 第一季` 的 `docx -> module` 生成链路

## 核心主链路脚本

- `build_series_canonical_map.js`
- `copy_series_alignment_assets.py`
- `run_series_whisperx_batch.py`
- `build_series_transcript_bundle.js`
- `run_series_transcript_pipeline.py`
- `import_whisperx_words.py`
- `validate_transcript_track.js`
- `build_peppa_s1_from_docx.py`

## Unlock1 示例

一步跑完整流水线：

```bash
python3 scripts/run_series_transcript_pipeline.py \
  --module ./data/transcripts/unlock1 \
  --tracks-export unlockTranscriptTracks \
  --status-export unlockTranscriptBuildStatus \
  --output-root data/transcript-build/unlock1-word-align \
  --audio-source-dir "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/Unlock1/LS/Unlock1 听口音频Class Audio" \
  --pdf-source "/Users/wangtianlong/工作/01_教学与备考/unlock 第二版/Unlock1/LS/Unlock 2e Listening and Speaking 1 Scripts.pdf" \
  --bundle-output cloudfunctions/yoyo/transcripts/unlock1-word-tracks.json
```

## Peppa 第一季正式工作流

原始素材固定放在：

- `data/transcript-build/peppa-s1/source/docs/PeppaPig第1季剧本台词.docx`
- `data/transcript-build/peppa-s1/source/audio/第1季/*.mp3`

### 1. 从 docx + 音频生成 52 集模块

```bash
python3 scripts/build_peppa_s1_from_docx.py \
  --docx "./data/transcript-build/peppa-s1/source/docs/PeppaPig第1季剧本台词.docx" \
  --audio-dir "./data/transcript-build/peppa-s1/source/audio/第1季" \
  --output-root "./data/transcript-build/peppa-s1"
```

生成结果：

- `data/transcript-build/peppa-s1/source/paragraphs.json`
- `data/transcript-build/peppa-s1/source/manifest.json`
- `data/transcript-build/peppa-s1/generated/episodes.json`
- `data/transcript-build/peppa-s1/generated/anomalies.json`
- `data/transcript-build/peppa-s1/generated/peppa_tracks.js`
- `data/transcript-build/peppa-s1/generated/peppa_build_status.js`
- `data/transcript-build/peppa-s1/generated/peppa_s1_module.js`

### 2. 先跑前三集冒烟

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

### 3. 再跑整季

```bash
python3 scripts/run_series_transcript_pipeline.py \
  --module ./data/transcripts/peppa \
  --tracks-export peppaTranscriptTracks \
  --status-export peppaTranscriptBuildStatus \
  --output-root ./data/transcript-build/peppa-s1/run \
  --audio-source-dir ./data/transcript-build/peppa-s1/source/audio/第1季 \
  --bundle-output ./cloudfunctions/yoyo/transcripts/peppa-word-tracks.json
```

## 关键默认行为

- 默认导出名是 `transcriptTracks` / `transcriptBuildStatus`
- 音频文件名来自 canonical map 的 `fileName`
- 默认音频扩展名是 `mp3`
- 默认 WhisperX 使用英文 `--language en`
- 默认在 CPU 上跑 `base` 模型
- `python-bin` 会优先尝试显式参数，再尝试 `~/whisper-env/bin/python`，再退回系统 `python3.12` / `python3`
- `vendor-dir` 默认使用当前 `output-root/vendor312`
- `Peppa` 这类对白型文本会自动走更保守的“顺序局部匹配”模式，不建议再用整轨自由匹配直接落盘

## 阻塞判定

`Peppa` 生成后请检查 `data/transcript-build/peppa-s1/generated/anomalies.json`：

- 出现 `missing-audio`：阻塞
- 出现 `audio-without-docx-section`：阻塞
- 出现大量 `title-mismatch`：阻塞
- 出现 `empty-episode`：阻塞

少量标题规范化差异可以先人工复核，再决定是否继续跑 WhisperX。
