# 写作与翻译题干、批改字体规范

## 1. 覆盖内容

- 初中、高中、IELTS 写作题纸。
- Directions、写作任务、原文、图表、写作要点、注意事项、开头提示。
- 中译英题干、参考译文、模型解析和修改理由。
- 写作评分、总结、分项反馈、修改建议和范文。

## 2. 写作题纸层级

| 内容 | 字体 | 字号 | 行高 |
| --- | --- | ---: | ---: |
| Directions 标题 | 主题标题角色 | `21-24rpx` | `1.35` |
| Directions 正文 | `--font-body-family` | `25rpx` | `1.68` |
| 写作任务标题 | 主题标题角色 | `28-29rpx` | `1.35` |
| 写作任务正文 | `--font-body-family` | `28rpx` | `1.72-1.78` |
| Summary/题目原文 | `--font-english-serif-family` | `26-28rpx` | `1.78-1.82` |
| 写作要点 | `--font-body-family` | `26-28rpx` | `1.62-1.72` |
| 注意事项/开头提示 | `--font-body-family` | `23-25rpx` | `1.58-1.65` |
| 编号 | `--font-number-family` | `21rpx` | 固定 `42rpx` 容器 |

题纸顺序由真实字段决定，统一为：

`作答说明 -> 写作任务/情景或原文 -> 图表/表格 -> 写作要点 -> 注意事项 -> 开头提示`

各区必须有独立标题、字号、行距和分隔；不得重新压成同字号连续文本。

## 3. 翻译题层级

| 内容 | 字号/Token | 规则 |
| --- | ---: | --- |
| 题号 | `21-22rpx` | 元信息层 |
| 中文题干 | `26-28rpx` | 主作答内容 |
| 学生输入 | `26rpx` | 与正文一致，保证输入可读 |
| 参考译文标题 | `21-22rpx` | 标签层 |
| 参考译文 | `26rpx` | 正文层 |
| 模型讲解标题/结论 | `--result-section-size` 或 `--result-meta-size` | 标题与状态分离 |
| 主解析 | `--result-body-size` | `--result-line-body` |
| 修改理由 | `--result-support-size` | `--result-line-support` |

推荐译文、解析、关键点和修改项按自然顺序展示，不用多张嵌套卡拆散一题。

## 4. 批改结果层级

| 内容 | Token |
| --- | --- |
| 总分/Band | `--result-score-size` |
| 报告标题 | `--result-title-size` |
| 总结、分项标题 | `--result-section-size` |
| 分项正文、建议 | `--result-body-size` |
| 原句/修改句/理由 | `--result-support-size` |
| 等级、任务状态、公式 | `--result-meta-size` |

- 分数只允许一个最高视觉焦点。
- 总结高于分项正文；分项正文高于修改理由。
- 原句与修改句通过颜色、前缀和间距区分，不使用删除线作为唯一信息。
- 英文作文、范文和原句使用英文衬线；中文批改使用正文无衬线。

## 5. 类名映射

| 语义 | 当前主要类名 |
| --- | --- |
| 题纸区块 | `.writing-prompt-section` |
| 题纸标题 | `.writing-prompt-section-title` |
| 题纸正文 | `.writing-prompt-line-copy` |
| 翻译题干 | `.translation-source`、`.library-translation-source` |
| 翻译解析 | `.translation-analysis-row`、`.translation-correction-reason` |
| 批改总结 | `.review-block` |
| 分项批改 | `.review-list`、`.criterion-comment` |
| 分数 | `.score` |

## 6. 验收

- 初中、高中、IELTS 题纸语义顺序一致。
- `requirements[]` 逐项编号，编号不挤压长文本。
- 题目纸存在右上折角时，标题、字数和分值必须预留大于折角宽度的安全区，装饰不得覆盖文字。
- 320-430px 下原图、题干、输入框和报告不横向溢出。
- 四主题共用统一结果变量，主题只改变材质与颜色。
