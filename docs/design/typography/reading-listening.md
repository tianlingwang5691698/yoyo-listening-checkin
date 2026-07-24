# 阅读与听力题干、解析字体规范

## 1. 覆盖内容

- 阅读文章、题干、选项、填空题订正。
- 听力题干、选项、提交后逐题解析。
- 答案句、原文证据、中文翻译和学习包入口。

## 2. 层级表

| 内容 | 字体 | 字号/Token | 行高 |
| --- | --- | ---: | ---: |
| 英文文章正文 | `--font-english-serif-family` | 模块正文规格 | `1.72-1.82` |
| 普通题干、选项 | `--font-body-family` | `26rpx` | `1.6-1.72` |
| 结果标题 | 主题标题角色 | `--result-title-size` | `1.3` |
| 逐题解析标题 | 主题标题角色 | `--result-section-size` | `1.4` |
| 中文主解析 | `--font-body-family` | `--result-body-size` | `--result-line-body` |
| 英文答案句/证据 | `--font-english-serif-family` | `--result-support-size` | `--result-line-support` |
| 答案句翻译 | `--font-body-family` | `--result-support-size` | `--result-line-support` |
| 正误、答案标签、题号 | `--font-number-family` 或正文角色 | `--result-meta-size` | `1.25-1.35` |

## 3. 阅读规则

- 普通选择题顺序固定为：`题干 -> 选项 -> 正误/标准答案 -> 解析 -> 答案句 -> 翻译`。
- 首字母、填空和语篇选词顺序固定为：`题号/状态 -> 你的答案/正确答案 -> 解析 -> 证据句 -> 翻译`。
- 英文文章和证据句使用英文衬线；题干、选项和中文解析使用无衬线。
- 答案句是证据层，不得大于主解析，不得在填空类正文中整句高亮。
- `inline-analysis` 使用透明背景、上分隔线或左侧证据线，不新增内嵌结果卡。
- 学生可见文案统一写“逐题解析”，不写 AI、模型、云端来源、生成链路或内部状态。
- 正确题数只在结果主数字显示一次；辅助文案只给订正或积累建议，不换算另一套分值重复展示。
- 解析最多两句，不重复答案、答案句或同义结论；历史记录、详情页和 PDF 使用同一字段顺序。
- 阅读 PDF 使用 A4 固定层级：报告标题 `20pt`、分区标题 `16.5pt`、题号 `13.5pt`、英文正文 `11pt`、题干与答案句 `10.3–10.8pt`、中文解析 `10.5pt`、元信息 `10pt`。
- PDF 中原题正文连续排版；答题结果、每类学习卡分别从新页开始，单题和单张卡片按测量高度整体避让页尾。

## 4. 听力规则

- 无文章正文时，听力题干是当前主阅读对象，使用 `26rpx/1.6-1.72`。
- 音频播放状态、题号和时间属于元信息层，不得超过 `22rpx`。
- 提交后解析与阅读共用结果变量，不建立另一套听力解析字号。
- Transcript 属于原文层；中文释义属于支持层，不能与题干争夺焦点。

## 5. 类名映射

| 语义 | 当前主要类名 |
| --- | --- |
| 题干 | `.question-title` |
| 结果标题 | `.review-title` |
| 解析标题 | `.analysis-head`、`.cloze-review-number` |
| 主解析 | `.analysis-text.is-primary`、`.cloze-analysis-text` |
| 证据句 | `.answer-sentence-text`、`.cloze-evidence-text` |
| 证据翻译 | `.answer-sentence-translation`、`.cloze-evidence-translation` |
| 元信息 | `.analysis-state`、`.answer-sentence-label`、`.cloze-review-state` |

## 6. 验收

- 四主题的解析字号一致。
- 题干、解析、证据、翻译可一眼区分。
- 长题干和长证据句在 320px 宽度不溢出。
- 解析出现后不遮挡文章、题干或选项。
