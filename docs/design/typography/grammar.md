# 语法题干、解析字体规范

## 1. 覆盖内容

- 单题题头、题干、选项、标准答案。
- 考点标题、主讲解、排除说明、重新讲。
- 微课堂例句及其中文辅助说明。

## 2. 层级表

| 内容 | 字体 | 字号/Token | 行高 |
| --- | --- | ---: | ---: |
| 年份、地区、原卷题号 | `--font-body-family` | `21-22rpx` | `1.35-1.45` |
| 英文题干 | `--font-english-sans-family` | `32rpx` | `1.65` |
| 选项正文 | `--font-body-family` | `26rpx` | `1.55` |
| 选项字母 | `--font-number-family` | `21-22rpx` | 固定容器居中 |
| 解析/考点标题 | 主题标题角色 | `--result-section-size` | `1.4` |
| 标准答案状态 | `--font-number-family` | `--result-meta-size` | `1.25` |
| 主讲解 | `--font-body-family` | `--result-body-size` | `--result-line-body` |
| 排除说明 | `--font-body-family` | `--result-support-size` | `--result-line-support` |
| 重新讲 | `--font-body-family` | `--result-meta-size` | 稳定点击高度 |

## 3. 排版顺序

`题号/来源 -> 题干 -> 选项 -> 正误与标准答案 -> 看讲解 -> 解析标题 -> 主讲解 -> 排除说明 -> 重新讲`

- 题干是作答态最高文字层，不得被题号、诊断图形或选项字母抢占。
- 解析展开后，解析标题低于题干、高于主讲解。
- 排除说明使用左侧细线和支持字号，不复制主解析的标题权重。
- “看讲解/收起讲解/重新讲”属于命令，不得伪装成解析标题。

## 4. 四主题规则

- 暖色和龙珠解析标题使用正文无衬线角色。
- 图书馆和航海解析标题可使用主题标题衬线角色。
- 主题只改变颜色、分隔线和材质；题干 `32rpx` 及统一结果变量不变。
- 解析区使用透明背景与分隔，不新增结果页或卡片嵌套。

## 5. 类名映射

| 语义 | 当前主要类名 |
| --- | --- |
| 题头 | `.question-meta`、`.library-question-meta` |
| 题干 | `.question-prompt`、`.library-question-prompt` |
| 选项 | `.option-item`、`.library-option` |
| 解析标题 | `.analysis-head`、`.library-analysis-head` |
| 答案状态 | `.analysis-state`、`.library-analysis-answer` |
| 主讲解 | `.analysis-text.is-primary`、`.library-analysis-text.is-primary` |
| 排除说明 | `.analysis-text.is-support`、`.library-analysis-text.is-support` |

## 6. 验收

- 题干比选项和解析正文更醒目，但不使用 `800/900` 字重。
- 四主题解析正文均为 `26rpx/1.72`，排除说明均为 `23rpx/1.58`。
- 长选项可跨整行，字母容器不随文字长度变形。
- 展开/收起解析不改变题干和选项位置层级。
