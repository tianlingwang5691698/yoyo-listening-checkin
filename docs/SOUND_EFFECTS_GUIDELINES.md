# 音效规范

## 默认工具

- 首选：[ElevenLabs Sound Effects](https://elevenlabs.io/sound-effects)
- 备用：[Adobe Audition Sound Effects](https://www.adobe.com/products/audition/free-sound-effects.html)

## 使用场景

- 只给明确奖励或完成态加音效，例如词汇复习完成、连续打卡完成。
- 不给普通按钮、列表点击、录音链路加音效。
- 音效只播放一次，不循环，不阻塞返回和继续操作。

## 全项目特效/音效地图

| 场景 | 视觉特效 | 音效 | 规则 |
| --- | --- | --- | --- |
| 词汇复习完成 | 礼花、彩带、完成卡 | 柔和暖色长尾提示音 | 已接入；只在整轮结束播放一次 |
| 今日听力完成 | 轻微勾选扩散、进度归位 | 很轻的完成铃 | 已接入；不盖过课程音频 |
| 连续打卡里程碑 | 小印章/徽章浮现 | 温暖短铃 | 已接入；仅 3/7/14/30/60/100 天触发 |
| 学习包加入词库成功 | 图标轻跳、入库动线 | 默认无声 | 批量加入成功可用极轻 tick |
| 阅读/语法提交完成 | 答案区柔和展开 | 默认无声 | 避免每题反馈都发声 |
| 写作批改完成 | 批改结果渐显 | 柔和完成 tone | 已接入；只在结果首次出现播放 |
| 口语评分完成 | 分数轻量计数、等级浮现 | 低音量 success tap | 已接入；不在录音、回放、评分音频期间播放 |
| 家长日报生成 | 日报卡淡入、重点高亮 | 默认无声 | 家长端保持安静 |
| 错误/失败 | 红色轻提示、按钮回稳 | 不播放 | 失败不用刺耳音效 |

## 禁用场景

- 普通按钮点击、tab 切换、列表展开。
- 课程音频播放中、录音中、口语回放中、单词发音中。
- 每张卡、每道题、每次滑动都触发音效。
- 超过 4.5 秒、循环或需要用户等待的音效。

## 英文原音旁白

可以使用类似英文原音的短旁白，但只作为奖励或引导，不替代课程原音。

- 使用位置：完成页、里程碑、进入下一轮前的轻提示。
- 推荐文案：`Great work.`、`You did it.`、`Ready for the next one?`
- 声音风格：母语感、清晰、温和、儿童友好。
- 时长：`0.8s - 1.5s`
- 音量：低于课程音频，不与主音频同时播放。
- 存放：`assets/audio/voice/`
- 小体积短旁白默认放小程序本地包；只有文件较大、需要频繁替换或做 A/B 测试时才放云存储。
- 命名：`模块-场景-voice.ext`
  - 例：`flashcard-complete-great-work.mp3`

英文旁白不用于：课文朗读替换、单词发音替换、听力题原音替换、录音链路提示。

## 生成要求

- 时长：`2.8s - 4.2s`
- 风格：暖、轻、舒缓，带 `0.2s - 0.35s` 渐入和自然长尾，不刺耳。
- 响度：素材峰值不高于 `-12 dB`，小程序播放音量建议 `0.55` 以下。
- 文件：优先 `mp3`，需要低延迟时可用 `wav`。
- 存放：`assets/audio/sfx/`
- 命名：`模块-场景-用途.ext`
  - 例：`flashcard-complete-chime.mp3`

## 推荐提示词

```text
soft warm mobile app completion tone, slow three-note rise, gentle attack, natural long tail, calm and child-friendly, 3.5 seconds
```

## 接入规则

- 小程序端播放前先确认音效文件存在。
- 完成态音效应尊重系统静音；不要盖过课程音频或录音。
- 若当前页面有主音频正在播放，先不播放音效。
- 新增正式音效前，在本文件记录用途，并在 `docs/UI_DESIGN_LANGUAGE_LOG.md` 记录 UI/交互改动。

## 已用音效

### 词汇复习完成

- 文件：`assets/audio/sfx/flashcard-complete-chime.mp3`
- 来源：本地合成的 C 大调上行四音提示音
- 用途：词汇复习完成礼花页出现时播放一次。
- 接入：`pages/reading/flashcards/index.js`
- 记录：`docs/UI_DESIGN_LANGUAGE_LOG.md` 的 `2026-07-09 词汇完成音效接入`

### 全局完成态第一版

- 文件：`assets/audio/sfx/flashcard-complete-chime.mp3`
- 来源：本地合成的 C 大调上行四音提示音
- 用途：听力整条完成、写作批改结果出现、口语评分结果出现、连续打卡里程碑出现时播放一次。
- 接入：`utils/effects.js`、`pages/lesson/index.js`、`pages/writing/detail/index.js`、`pages/speaking/index.js`、`pages/record/index.js`
- 记录：`docs/UI_DESIGN_LANGUAGE_LOG.md` 的 `2026-07-09 全项目完成态特效第一版`

### 全局完成态随机鼓励组

- 文件：`assets/audio/sfx/flashcard-complete-chime.mp3`
- 文件：`assets/audio/sfx/completion-warm-bloom-you-did-it.mp3`
- 文件：`assets/audio/sfx/completion-solo-chord-you-nailed-it.mp3`
- 用途：学生端首次完成时从三种克制鼓励中随机播放；后两种已内含英文旁白，不再叠加模块旁白。
- 规则：家长端、刷新、重进和当天同内容重复完成不播放。

## 旁白测试音色

### Chatterbox 英文奖励旁白测试

- 工具：本地 Chatterbox Multilingual V3
- 参数：`--language en --device auto --exaggeration 0.42-0.5 --cfg-weight 0.4 --temperature 0.62-0.68`
- 规则：测试文件先放 `assets/audio/voice/tests/`，确认音色后再移动到正式 `assets/audio/voice/` 并接入页面。

| 文件 | 文案 | 建议场景 | 时长 |
| --- | --- | --- | --- |
| `assets/audio/voice/tests/flashcard-complete-great-work.mp3` | `Great work.` | 词汇复习完成 | 1.04s |
| `assets/audio/voice/tests/listening-complete-great-listening.mp3` | `Great listening.` | 今日听力完成 | 1.20s |
| `assets/audio/voice/tests/streak-milestone-you-did-it.mp3` | `You did it.` | 连续打卡里程碑 | 1.00s |
| `assets/audio/voice/tests/reading-complete-nice-reading.mp3` | `Nice reading.` | 阅读解析完成 | 1.12s |
| `assets/audio/voice/tests/writing-complete-nice-writing.mp3` | `Nice writing.` | 写作批改完成 | 1.12s |

### 正式接入旁白

| 文件 | 文案 | 接入页面 |
| --- | --- | --- |
| `assets/audio/voice/flashcard-complete-great-work.mp3` | `Great work.` | `pages/reading/flashcards/index.js` |
| `assets/audio/voice/listening-complete-great-listening.mp3` | `Great listening.` | `pages/lesson/index.js` |
| `assets/audio/voice/streak-milestone-you-did-it.mp3` | `You did it.` | `pages/record/index.js` |
| `assets/audio/voice/reading-complete-nice-reading.mp3` | `Nice reading.` | `pages/reading/detail/index.js` |
| `assets/audio/voice/writing-complete-nice-writing.mp3` | `Nice writing.` | `pages/writing/detail/index.js` |
