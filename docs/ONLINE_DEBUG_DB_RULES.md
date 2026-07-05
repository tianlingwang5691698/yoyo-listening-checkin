# 线上 Debug 数据库规则

## 默认规则

1. 先只读查询，不直接改库。
2. 每次先定位 `childLoginCode -> familyId -> childId -> familyMembers`。
3. 再查行为链路：`dailyTaskProgress`、`taskAttempts`、`dailyCheckins`、`dailyReports`。

## 查询顺序

1. 身份关系
   - `children`
   - `familyMembers`
   - `users`
   - `families`
2. 学习记录
   - `dailyTaskProgress`
   - `taskAttempts`
   - `studyCompletedItems`
   - `studyFlashcards`
3. 日报/打卡
   - `dailyCheckins`
   - `dailyReports`

## 删除规则

只有同时满足下面条件才删除：

1. 明确是脏家庭、重复家庭或误生成账号。
2. 没有真实学习记录：`dailyTaskProgress=0`、`dailyCheckins=0`、`taskAttempts=0`、`studyCompletedItems=0`。
3. 删除前先输出将删除的集合和数量。
4. 删除后复查目标账号不存在，主账号绑定仍存在。

## 正式版问题定位

1. 先查正式库真实记录，不以真机调试现象为准。
2. 如果库里没有 `taskAttempts`，说明没有走到录音提交链路。
3. 如果有 `taskAttempts` 但 `status=score-pending`，查评分链路。
4. 如果有 `dailyTaskProgress` 但无口语记录，优先查前端入口、权限、身份 target。

## 发布规则

代码类问题必须重新发版才会到正式用户手机。

云函数逻辑改动：上传部署云函数后立即影响线上调用。

小程序前端改动：必须上传新版本并发布；已经发布的版本不会自动变。

数据库脏数据修复：SDK 改库后立即生效，不需要发新版。

## 问题记录模板

每次线上报错后追加一条：

1. 现象：
2. 账号：
3. 查询：
4. 结论：
5. 修复：
6. 是否需要发版：

## 已知案例

### 2026-07-05 绑定 317613 后跳到本机新概念 1

1. 现象：正式版绑定 317613 后仍跳到本机默认新概念任务。
2. 账号：317613，另有本机学生 986209 和脏家庭 665032。
3. 查询：`children`、`familyMembers`、`dailyTaskProgress`、`taskAttempts`。
4. 结论：绑定关系存在；请求没带 selected target 时云端默认 owner 本机家庭。
5. 修复：前端提交类接口补 selected target；删除脏家庭 665032。
6. 是否需要发版：target 传参是前端改动，需要发版；删脏数据不需要。

### 2026-07-05 新概念录音失败后被跳过

1. 现象：孩子本人新概念录音失败后没有 `taskAttempts`，但任务继续往后走。
2. 账号：317613。
3. 查询：`taskAttempts=0`，`dailyTaskProgress` 和 `dailyCheckins` 有记录。
4. 结论：前端录音失败时调用“按听力完成”，导致新概念回答问题被跳过。
5. 修复：增加麦克风权限检查；录音不可用、拒权或启动失败时不再自动完成任务。
6. 是否需要发版：前端改动，需要发版。

### 2026-07-05 后台阅读记录和家长昵称缺失

1. 现象：后台活跃列表没有体现部分阅读完成；317613 有家长绑定但展开不显示家长昵称。
2. 账号：不限定账号；重点复查 317613。
3. 查询：`studyCompletedItems` 有阅读完成记录；317613 的 parent 成员昵称仍是“学生设备”。
4. 结论：后台学习数只统计 `dailyCheckins/dailyTaskProgress/taskAttempts`，漏了 `studyCompletedItems`；绑定家长被占位昵称过滤。
5. 修复：后台活跃统计加入 `studyCompletedItems`；绑定家长按 `role=parent` 判断，王天龙 openId 显示为“王天龙”。
6. 是否需要发版：云函数逻辑改动，部署 `yoyo` 后生效。

### 2026-07-05 家长记录口径统一

1. 现象：家长绑定后应能看到孩子听力、阅读、写作等全部记录。
2. 账号：不限定账号。
3. 查询：听力主要在 `dailyTaskProgress/dailyCheckins/dailyReports`；阅读、语法、写作主要在 `studyCompletedItems`。
4. 结论：日报和热力图只看听力打卡会漏掉纯阅读、写作完成日。
5. 修复：日报生成带上 `completionItems`；家长页今日和最近 7 天按总完成数展示；日历仍只按原听力打卡规则点亮。
6. 是否需要发版：云函数和前端均有改动，需要部署 `yoyo` 并发布小程序。

### 2026-07-05 郑若依阅读解析和短语详情

1. 现象：家长日报里 2021 静安阅读显示 0/10，短语学习无法展开看内容。
2. 账号：265565，郑若依。
3. 查询：`studyCompletedItems` 有 3 条；2021 阅读分数为 `0/10`，不是漏分；当时 attempt 内解析为“生成解析中”，完整解析在 `readingStudyPacks`。
4. 结论：详情页只展示 attempt 快照，未按 passageId 补拉完整学习包；reading-study 记录没有展开逻辑。
5. 修复：阅读展开时拉 `questions` 学习包补全解析；短语学习展开时拉 `phrases` 学习包展示短语、含义和例句。
6. 是否需要发版：前端改动，需要发布小程序；如学习包未缓存，云函数会按需生成。
