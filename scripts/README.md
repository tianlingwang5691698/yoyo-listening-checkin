PDF 逐句稿导入说明

1. 把 PDF 放到本机任意位置。
2. 运行：

```bash
python3 scripts/extract_pdf_transcript.py /path/to/your.pdf a1-l1 data/transcripts/a1-l1.json
```

3. 脚本会：
- 提取 PDF 文本
- 自动切成一句一句
- 生成一个初始的 JSON 时间轴

4. 然后手工修改 JSON 里的 `startMs` 和 `endMs`，让每一句和音频对齐。

5. 最后把生成的逐句数据挂到课程对象的 `transcriptTrackId` 或导入到项目数据层。

说明：
- 这个脚本只负责提取和初步切句，不会自动精确对齐音频。
- 需要先安装 `pypdf`：

```bash
python3 -m pip install pypdf
```

额外素材目录建议：

- 本地整理目录可继续使用：
  - `assets/audio/Peppa/第1季/S101 Muddy Puddles.mp3`
  - `assets/audio/unlock1/Unlock2e_A1_1.2.mp3`
  - `assets/audio/songs/song-d1.mp3`
  - `assets/scripts/peppa/1-6季英文版台词剧本pdf/PeppaPig第1季英文剧本台词.pdf`
  - `assets/scripts/unlock1/Unlock 2e Listening and Speaking 1 Scripts.pdf`
- 小程序正式读取以 CloudBase 云存储目录为准：
  - `A1/Peppa`
  - `A1/Unlock1`
  - `A1/Super simple song`

当前规则：

- `Unlock 1` 音频时长低于 60 秒：自动排除，不计入当天打卡
- `Unlock 1` 音频时长大于等于 60 秒：纳入当天打卡，需要听 3 遍
- 有逐句稿的任务，3 遍都可以同步显示文本
- 没有逐句稿的任务，也不会阻塞当天完成
