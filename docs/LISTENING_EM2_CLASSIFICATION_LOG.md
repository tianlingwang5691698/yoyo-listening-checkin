# 二模听力板块分类记录

## 当前正式入口

- 板块：资料 -> 听力 -> 初中 -> 二模
- 数据源：`data/listening-em2/listening-practice.json`
- 云存储：`_content/listening-em2/listening-practice.json`
- 图片目录：`_content/listening-em2/images/`
- 音频目录：`_content/listening-em2/audio/`

## 正式可用套卷

| 显示年份 | 源文件夹年份 | 区县 | 套卷 ID | 图片数 | 题数 | 文本 |
| --- | --- | --- | --- | ---: | ---: | --- |
| 2021 | 2022 | 徐汇 | `sh-em2-2021-徐汇-listening` | 6 | 20 | 有 |
| 2022 | 2023 | 宝山 | `sh-em2-2022-宝山-listening` | 6 | 20 | 有 |
| 2022 | 2023 | 浦东 | `sh-em2-2022-浦东-listening` | 6 | 20 | 有 |
| 2022 | 2023 | 黄浦 | `sh-em2-2022-黄浦-listening` | 7 | 20 | 无真实原文 |
| 2023 | 2024 | 普陀 | `sh-em2-2023-普陀-listening` | 6 | 20 | 有 |

## 清洗准入

- 只保留可进入练习的正式套卷。
- 每套必须有音频、A 部分图片、20 题结构、20 个答案。
- 图片只从 A 部分 `Listen and choose the right picture` 到 B 部分之前抽取。
- 文件夹年份按实际考试年份显示为 `sourceYear - 1`，保留 `sourceYear` 追溯原始来源。
- 不再把整份 docx 的学科网 logo、阅读图片或其他素材当听力图片。
- 文本只收真实听力原文或文字稿；只有答案或“原文略”的套卷不写 `transcript`。

## 剔除原因

- 缺完整答案：不进入正式练习。
- A 部分图片无法稳定抽取：不进入正式练习。
- 音频、题目、图片不能稳定对齐：不进入正式练习。
