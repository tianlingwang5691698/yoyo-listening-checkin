# 写作评分专项规则

## IELTS Writing

- Task 1/2 固定按 Task Achievement/Response、Coherence and Cohesion、Lexical Resource、Grammatical Range and Accuracy 四项 0–9 Band 评分。
- 模型返回兼容 camelCase、snake_case、官方英文维度名，以及对象或数组形式的逐项反馈。
- 四项 Band 分可恢复即视为有效评分；证据、描述匹配、卡分原因或升档动作缺失时保留评分并标记部分反馈，不得整次失败。
- 仅当四项 Band 分无法恢复时重试一次；重试仍无效才返回 `writing-ielts-review-invalid`。
- Task 1 原图和结构化数据必须同时作为评分依据，不得补造图表数据。
- Task 1 以原图为最终事实来源；模型必须先返回图表事实核对清单，再给四项 Band。`visualData` 只作辅助，不能假设其含有完整曲线数值。
- Task 1 overview 遗漏最终排名、重要交叉、共同最高/最低、峰值或主导趋势等重大特征时，Task Achievement 最高 7；只遗漏一个中间年份数值但主要趋势完整时不机械降档。
- 正式评分调用固定 `temperature=0`；相同评分版本、题目修订和作文正文生成同一 SHA-256 指纹。
- 学生重复提交同题同文时复用其现有 `writingAttempts` 中同评分版本的结果；家长预览仅使用云函数实例内有界缓存，不落库。
- 家长预览不写 `writingAttempts`；学生提交先保存记录，再异步评分。

## 失败诊断

- 前端错误必须包含页面函数、store action、cloud action、`cloudError.message`、`syncDebug.reason`、`syncDebug.envId` 和 `targetChildId`。
- 不记录作文正文、模型完整返回或密钥；日志只记录错误码和链路字段。

## 回归门禁

- 官方英文维度名可恢复四项 Band 分。
- 常见证据字段别名可归一为统一结构。
- 四项 Band 分有效但讲解不完整时必须成功返回。
- 四项 Band 分无效时必须被 `hasUsableIeltsReview` 拒绝。
- 重大图表遗漏触发 Task Achievement 7 分上限，次要中间值遗漏不触发。
- 同题同文指纹稳定，不同作文指纹不同；评分请求温度必须为 0。
