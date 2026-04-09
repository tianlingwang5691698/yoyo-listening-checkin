本地素材整理约定：

- `assets/` 仅用于本地整理、脚本处理和备份，不是小程序运行时的正式素材来源。
- 小程序正式运行时优先读取 CloudBase 云存储目录：
  - `A1/Peppa`
  - `A1/Unlock1`
  - `A1/Super simple song`

本地可按下面结构暂存原始文件：

- `assets/audio/Peppa/第1季/S101 Muddy Puddles.mp3`
- `assets/audio/unlock1/Unlock2e_A1_1.2.mp3`
- `assets/audio/songs/song-d1.mp3`

脚本 PDF 建议放在：

- `assets/scripts/peppa/1-6季英文版台词剧本pdf/PeppaPig第1季英文剧本台词.pdf`
- `assets/scripts/unlock1/Unlock 2e Listening and Speaking 1 Scripts.pdf`

当前规则：

- 所有日常任务都改成纯音频，每条固定听 3 遍。
- 有逐句稿的条目，3 遍都可以边听边看文本。
- 没有逐句稿但有 PDF 的条目，会先展示来源信息，逐句高亮后续补齐。
- `Unlock 1` 目录里只保留大于等于 60 秒的音频。
