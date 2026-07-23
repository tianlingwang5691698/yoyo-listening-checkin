# 写作评分专项规则

## IELTS Writing

- Task 1/2 固定按 Task Achievement/Response、Coherence and Cohesion、Lexical Resource、Grammatical Range and Accuracy 四项 0–9 Band 评分。
- Task 1 与 Task 2 必须分别加载 2023-05 官方公开表的完整 `Band 0–9 × 四项维度` 描述；不得只加载常用高分档或把两个任务的描述混用。
- 模型返回兼容 camelCase、snake_case、官方英文维度名，以及对象或数组形式的逐项反馈。
- 四项 Band 分可恢复即视为有效评分；证据、描述匹配、卡分原因或升档动作缺失时保留评分并标记部分反馈，不得整次失败。
- 仅当四项 Band 分无法恢复时重试一次；重试仍无效才返回 `writing-ielts-review-invalid`。
- Task 1 原图和结构化数据必须同时作为评分依据，不得补造图表数据。
- Task 1 以原图为最终事实来源；模型必须先返回图表事实核对清单，再给四项 Band。`visualData` 只作辅助，不能假设其含有完整曲线数值。
- 四个维度分别只能给 0–9 整数 Band；单项练习分为四项平均后按最近 0.5 Band 报告。
- Task 1 的图表事实核对只提供评分证据，不设置程序自定义封顶；最终档位必须逐条匹配官方 Task Achievement 描述。
- 正式评分调用固定 `temperature=0`；相同评分版本、题目修订和作文正文生成同一 SHA-256 指纹。
- 每项必须引用原文证据，说明为什么完整符合当前官方档位，以及为什么没有完整符合更高一档；不得以目标分数为导向抬分或压分。
- 学生重复提交同题同文时复用其现有 `writingAttempts` 中同评分版本的结果；家长预览使用稳定指纹复用独立 `writingPreviewAttempts`，不得混入学生记录。
- 家长预览不写 `writingAttempts`、`studyCompletedItems` 或日报；预览任务只允许创建者本人按 `userId + memberId + familyId + childId` 读取。学生提交继续先保存记录，再异步评分。
- 学生在“批改中”返回或退出页面后，已发起的云端评分继续执行并写回原 `writingAttempts`；写作记录必须强制读取最新状态，并自动续查待批改记录，不要求先展开记录。
- 学生评分完成后必须确定性覆盖同日同题 `studyCompletedItems`，并立即重建当日日报；不得让日报长期停留在“批改中”。
- `yoyo` 云函数总超时固定 300 秒；写作提交、评分、历史续批和升档范文客户端等待固定 320 秒。该配置只保证云端有时间完成，不能绕过 `wx.cloud.callFunction` 约 65 秒的资源连接中断。
- 家长预览必须快速创建独立任务，再由评分调用写回；同步连接中断后页面与写作记录自动轮询同一预览任务，禁止重新创建模型调用。

## 失败诊断

- 前端错误必须包含页面函数、store action、cloud action、`cloudError.message`、`syncDebug.reason`、`syncDebug.envId` 和 `targetChildId`。
- 不记录作文正文、模型完整返回或密钥；日志只记录错误码和链路字段。

## 回归门禁

- 官方英文维度名可恢复四项 Band 分。
- Task 1、Task 2 的完整官方表均必须包含 Band 0–9，且每个 Band 都包含四项描述。
- 常见证据字段别名可归一为统一结构。
- 四项 Band 分有效但讲解不完整时必须成功返回。
- 四项 Band 分无效时必须被 `hasUsableIeltsReview` 拒绝。
- 图表事实核对不得机械改写 Task Achievement 分数，评分只能由官方描述匹配决定。
- 四项维度必须归一为整数 Band，平均结果才允许出现 0.5 Band。
- 同题同文指纹稳定，不同作文指纹不同；评分请求温度必须为 0。
- 新评分校准必须升级评分版本，使旧评分缓存失效。
- 完成记录更新必须使用确定性覆盖写入，评分完成后必须触发当日日报重建。
- 写作记录不得使用过期列表缓存停留在“批改中”；待批改记录进入列表后必须自动调用详情续查并更新最终分数。
- 回归必须校验 `cloudbaserc.json` 中 `yoyo.timeout=300`，且写作长调用客户端等待为 320000ms；预计超过 60 秒的评分结果还必须先落入可续查记录，禁止仅靠同步返回。
- 家长预览任务 ID 必须指向 `writingPreviewAttempts`，跨用户或跨成员访问必须拒绝；预览评分不得调用学生完成记录写入。
