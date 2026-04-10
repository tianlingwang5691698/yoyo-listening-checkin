# unlock1-preprocess

独立云函数，用于扫描 `Unlock1` 云端音频并建立听力训练素材池。

当前已实现：

- 扫描 `A1/Unlock1/Unlock1 听口音频 Class Audio`
- 仅识别 `.mp3 / .m4a / .wav`
- 读取音频时长
- 过滤 `< 60s` 音频
- 将结果写入 `unlock1AudioTrainingPool`
- 预留后续 transcript 接口动作

当前动作：

- `scanUnlock1Audio`
- `alignTranscriptWithAudio`（占位）
- `generateTranscriptFromAudio`（占位）
