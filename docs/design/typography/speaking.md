# 口语题干、评分反馈字体规范

## 1. 覆盖内容

- 分级跟读、独立口语练习、IELTS 口语。
- 当前题干、题组信息、录音状态、总分、分项评分和中文反馈。
- 课程页内的跟读与问答题干。

## 2. 层级表

| 内容 | 字体 | 字号/Token | 行高 |
| --- | --- | ---: | ---: |
| 当前英文题干 | `--font-english-sans-family` | `33-34rpx` | `1.5` |
| 中文回答要求 | `--font-body-family` | `26-28rpx` | `1.6` |
| 题组、Part、题号 | `--font-body-family` | `21-23rpx` | `1.35` |
| 总分/Band | `--font-number-family` | `--result-score-size` | `1.08` |
| 结果标题 | 主题标题角色 | `--result-title-size` | `1.3` |
| 准确度/流利度/完整度标题 | `--font-body-family` | `--result-section-size` | `1.4` |
| 中文反馈 | `--font-body-family` | `--result-body-size` | `--result-line-body` |
| 录音时长、状态、说明 | `--font-body-family` | `--result-meta-size` | `1.35` |

## 3. 规则

- 口语题干是页面唯一允许高于普通题干的内容，因为它承担朗读和回答对象。
- “听问题”“按住回答”“松手评分”是操作层，不得大于题干。
- 录音中、评分中必须保持题干尺寸和位置稳定。
- 总分高于分项分；中文反馈低于分项标题，高于录音元信息。
- 最低分项改进建议属于解析正文，不得压缩为 caption。
- IELTS Part 标题和来源信息属于元信息，不得抢占题干焦点。

## 4. 类名映射

| 语义 | 当前主要类名 |
| --- | --- |
| 题干 | `.prompt-text`、`.library-prompt-text`、`.speaking-prompt` |
| 题组信息 | `.prompt-label`、`.library-prompt-meta` |
| 总分 | `.score-value` |
| 分项 | `.score-metric`、`.ielts-band-row` |
| 中文反馈 | `.ielts-band-feedback` 及结果反馈类 |
| 状态 | 录音/评分状态文案类 |

## 5. 验收

- 题干在录音、上传、评分、结果四态不跳动。
- 最长 IELTS 题干在 320px 宽度自然换行。
- 分数使用数字字体，反馈使用正文无衬线。
- 四主题题干字号允许 `33-34rpx` 的 1rpx 视觉校正，语义层级必须一致。
