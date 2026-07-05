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
