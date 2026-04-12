Unlock1 逐词对齐工作流

1. 生成 Unlock1 canonical 文稿映射：

```bash
node scripts/build_unlock1_canonical_map.js
```

2. 把 Unlock1 需要的 24 条音频和 scripts PDF 复制到本地工作目录：

```bash
python3 scripts/download_unlock1_alignment_assets.py
```

3. 如需检查 PDF 原始文本，可抽取全文：

```bash
python3 scripts/extract_pdf_transcript.py \
  "data/transcript-build/unlock1-word-align/raw/Unlock 2e Listening and Speaking 1 Scripts.pdf" \
  unlock1-scripts \
  data/transcript-build/unlock1-word-align/work/unlock1-scripts.raw.json
```

4. 如需检查某一段在 PDF 里的切分情况，可运行：

```bash
python3 scripts/slice_unlock1_scripts.py \
  data/transcript-build/unlock1-word-align/work/unlock1-scripts.raw.json \
  1.2 \
  1.3 \
  data/transcript-build/unlock1-word-align/work/unlock1-1.2.slice.json
```

5. 如果只想处理单条音频，可先手动运行 WhisperX，再导入项目格式：

```bash
/opt/homebrew/bin/python3.12 -m whisperx \
  --model base \
  --language en \
  --device cpu \
  --compute_type int8 \
  --vad_method silero \
  --batch_size 4 \
  --output_dir data/transcript-build/unlock1-word-align/output/whisperx/Unlock2e_A1_1.2 \
  --output_format json \
  data/transcript-build/unlock1-word-align/raw/Unlock2e_A1_1.2.mp3
```

```bash
python3 scripts/import_whisperx_words.py \
  Unlock2e_A1_1.2 \
  data/transcript-build/unlock1-word-align/output/whisperx/Unlock2e_A1_1.2/Unlock2e_A1_1.2.json \
  data/transcript-build/unlock1-word-align/output/imported/track-unlock1-1-2.json
```

6. 如需全量跑 24 条，直接使用批量脚本：

```bash
python3 scripts/run_unlock1_whisperx_batch.py
```

只跑某几条：

```bash
python3 scripts/run_unlock1_whisperx_batch.py \
  --subset Unlock2e_A1_2.2,Unlock2e_A1_2.3,Unlock2e_A1_2.5
```

7. 批量导入后，生成 `yoyo` 使用的 transcript bundle：

```bash
node scripts/build_unlock1_transcript_bundle.js
```

8. 最后做时间轴校验：

```bash
node scripts/validate_transcript_track.js \
  data/transcript-build/unlock1-word-align/output/imported/track-unlock1-1-2.json
```

9. 再重新部署 `yoyo` 并在开发者工具试听。

说明：
- `build_unlock1_canonical_map.js` 会从现有 `data/transcripts/unlock1` 生成正式句子稿映射。
- `download_unlock1_alignment_assets.py` 当前会复制 Unlock1 需要的 24 条音频和 1 个 scripts PDF。
- `run_unlock1_whisperx_batch.py` 会自动串起 WhisperX、导入和校验。
- `build_unlock1_transcript_bundle.js` 会把已导入的单条 JSON 合并成 `cloudfunctions/yoyo/transcripts/unlock1-word-tracks.json`。
- `prepare_transcript_words.js` 仍可用于本地兜底显示，但 Unlock1 云端主链路应优先使用真实 WhisperX 结果。
- `import_whisperx_words.py` 现在使用 canonical 文稿映射，不再只支持 2 条。

如果只需要逐句兜底时间轴，可以继续用：

```bash
node scripts/prepare_transcript_words.js data/transcripts/a1-l1.json data/transcripts/a1-l1.words.json
```

依赖：

```bash
python3 -m pip install pypdf
```

当前规则：

- `Unlock 1` 音频时长低于 60 秒：自动排除，不计入当天打卡
- `Unlock 1` 音频时长大于等于 60 秒：纳入当天打卡，需要听 3 遍
- 有逐词稿的任务，3 遍都可以同步显示文本
- 没有逐词稿的任务，也不会阻塞当天完成
