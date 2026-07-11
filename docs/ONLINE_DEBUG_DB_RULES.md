# 线上 Debug 数据库规则

## 默认规则

1. 先只读查询，不直接改库。
2. 每次先定位 `childLoginCode -> familyId -> childId -> familyMembers`。
3. 再查行为链路：`dailyTaskProgress`、`taskAttempts`、`dailyCheckins`、`dailyReports`。

## 前端 Debug 提示规则

所有板块调试时遵循同一规则：

1. 测试阶段先在前端写出具体失败原因，不只提示“保存失败/加载失败”。
2. 提示内容必须指向链路上不通的代码点位置，而不是泛泛原因；至少包含：前端页面/函数名、store action、云函数 action、关键返回字段、target child。
3. 只写已经被当前返回值明确锁定的代码点和修复点；不能写猜测原因。
4. 不能只用 `wx.showToast`；必须写到页面 debug 区、可复制文本、console 日志或 debug 文档中，方便按代码点继续查。
5. 修复确认后撤掉页面 debug 区和临时 console，只保留用户可理解的正式提示。
6. 同类问题再次出现时，先查前端已写出的代码点和云端返回，不反复修改 UI 表层。
7. 涉及身份、计划、打卡、记录、学习包的功能，都必须先验证“云端真实返回”和“前端当前 target”一致。
8. `syncMode=cloud-error` 时必须写出 `cloudError.message`、`syncDebug.reason`、`syncDebug.envId`。

调试提示格式：

`DEBUG: 页面/函数 -> store.action -> cloud.action -> 字段名：具体值或缺失`

示例：

`DEBUG: listening-material.savePlan -> saveListeningPlanMaterial -> activePlan.materials 缺少 unlock4；targetChildId=xxx`

禁止格式：

`保存失败`

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

### 2026-07-11 成长页累计听力时长偏低

1. 现象：家长绑定 317613 后，成长页累计时长小于线上真实累计值。
2. 账号：317613 / family-1776427951478 / child-yoyo。
3. 查询：dailyTaskProgress=540，其中 535 条完成但均无 durationSec；dailyReports=110，按 103 个日期去重后的 totalMinutes=3453（57 小时 33 分）。
4. 结论：getDashboard(view=record) 只用当前内存听力目录反查历史任务时长；目录未刷新且历史 newconcept/song 等任务不在内存目录，累计只得到 1854 分钟。
5. 修复：成长页累计时长改用 dailyReports 的轻量字段按日期去重汇总并作为权威值；查询与原 dashboard 并行。新任务进度固化 `durationSec`，日报按“音频时长 × 完成遍数”计算，不按页面停留时间计算。
6. 是否需要发版：需部署 yoyo 云函数；前端不需要重新发布。

### 2026-07-11 词库刷新返回体超过 1MB

1. 现象：词库本地缓存可显示，但后台 `getFlashcardReview` 刷新约 10 秒后报 `response size exceeded 1048576 bytes`。
2. 账号：`child-yoyo / family-1776427951478`。
3. 查询：`pages/reading/flashcards.loadCards -> store.getFlashcardReview -> cloud.getFlashcardReview.library`返回全量卡片、`reviewSchedule`、身份和时间字段。
4. 结论：云接口未按个人词库/词书拆分，并返回首屏不需要的大字段，超过云函数 1MB 响应限制。
5. 修复：`getFlashcardReview` 支持 `scope=personal / sourceId`，查询只投影卡片展示与进度字段，并改用轻量请求上下文。
6. 是否需要发版：需部署 `yoyo` 云函数，并重新发布小程序前端。

### 2026-07-09 写作批改 review=null 后更新失败

1. 现象：写作提交后停在“批改中”，页面 debug 显示 `cloud.gradeWritingAttempt -> review：missing`，云函数报 `document.update:fail ... Cannot create field 'content' in element {review: null}`。
2. 账号：不限定账号。
3. 查询：`writingAttempts` 新建记录里 `review=null`；`gradeWritingAttempt` 生成 review 后直接 `update({ review })`。
4. 结论：CloudBase 更新对象字段时会按嵌套路径写入，旧值为 `review=null` 时不能创建 `review.content`。
5. 修复：云函数 `writing.service.js` 更新 review 时使用 `db.command.set(review)` 整体替换。
6. 是否需要发版：需要上传部署 `yoyo` 云函数；前端不需要重新改。

### 2026-07-09 词汇书入口 request fail url not in domain list

1. 现象：线上真实词汇入口点击初中词汇书后只显示演示 3 词，并出现 `request:fail url not in domain list` debug。
2. 账号：child-yoyo / family-1776427951478。
3. 查询：前端 debug 锁定 `pages/reading/flashcards/index.js importDictionaryBook -> cloudStorage.dictionary_books/word-dictionary-junior.json`。
4. 结论：小程序端直接 `wx.request` 云存储 CDN 域名，被正式版 request 合法域名拦截。
5. 修复：新增云函数 `getDictionaryBook` 服务端读取云存储 JSON；前端词汇书入口改走 `store.getDictionaryBook`。
6. 是否需要发版：需要部署 `yoyo` 云函数，并重新发布小程序前端。

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

### 2026-07-05 A2/B1/B2 New Concept 显示等待

1. 现象：音频页 A2、B1、B2 中 New Concept 2/3/4 显示“待加入/等待”，但 CloudBase 路径和文件真实存在。
2. 账号：不限定账号；317613 只用于确认佑佑固定计划不受影响。
3. 查询：真实路径为 `A2/NewConcept2-US`、`B1/NewConcept3-US`、`B2/NewConcept4-US`；目录内混有小体积 LRC 和 MB 级音频。
4. 结论：不是文件夹末尾 `/` 或空格问题；主要是 New Concept 空扫描结果被运行时缓存当作有效目录，且只按扩展名识别音频时会漏掉混放目录里的 MB 级音频。
5. 修复：New Concept 使用真实目录优先，父级发现兜底；音频识别改为扩展名或大于 100KB 且非 LRC/PDF/JSON/图片；New Concept 空数组不再命中运行时缓存；前端缓存版本升级。
6. 是否需要发版：需要上传部署 `yoyo` 云函数；前端缓存版本变化需要重新编译/发布小程序。

### 2026-07-05 听力计划保存后不显示已选

1. 现象：保存 Unlock4 后，音频页或设置计划页仍不显示 Unlock4 已选；顶部可能只显示“已选 1 个素材”，但列表行没有对应已选状态。
2. 账号：不限定账号；重点确认当前选中学生 target，不只看本机 owner。
3. 查询：先查云函数 `saveListeningPlanMaterial` 返回的 `activePlan.materials` 是否含当前 `category`；再查 `listeningPlans` 中同一 `familyId + childId + active=true` 是否存在多条旧计划；最后查前端当前页入口是 `pages/level/index` 还是 `pages/listening-plan/index`。
4. 结论：不要先反复改 UI。若返回的 `activePlan.materials` 不含当前素材，问题在云函数未上传、读到旧 active 计划或数据库有重复 active 计划；若返回含当前素材但页面不显示，才处理前端即时刷新和缓存。
5. 修复：保存后必须用返回的 `activePlan` 校验当前素材；active 计划按 `updatedAt desc` 读取最新；必要时清理同一学生重复 active 计划；前端从音频页和设置页进入都要即时刷新上一页。
6. 是否需要发版：云函数读写逻辑改动需上传 `yoyo`；前端即时刷新改动需重新编译/发布小程序。

### 2026-07-05 保存听力计划报不能更新 `_id`

1. 现象：保存 Unlock4 后前端 debug 写出 `cloud.callFunction:fail`，云函数错误为 `document.update:fail -501007 invalid parameters. 不能更新_id的值`。
2. 账号：不限定账号。
3. 查询：`cloudfunctions/yoyo/repositories/listening-plan.repository.js upsertActive/deactivateActive`。
4. 结论：`Object.assign({}, existing, ...)` 把数据库文档 `_id` 带进 `update({ data })`，CloudBase 禁止更新 `_id`。
5. 修复：repository update 前统一移除 `_id`，返回给前端时再补回 `_id`。
6. 是否需要发版：需要上传部署 `yoyo` 云函数。

### 2026-07-06 首页查看记录进入其他内容

1. 现象：首页今日任务完成后点“查看记录”，进入“今日完成”但内容可能不是当前学生。
2. 账号：986209。
3. 查询：`pages/home/index.js openCompleted/buildCompletedUrl`、`pages/home/completed/index.js onShow/filterItemsByScope`、`todayCompletedItemsV1`、`getStudyCompletions`。
4. 结论：完成页先读本机缓存 `todayCompletedItemsV1`，缓存没有按 `targetChildId/date` 隔离；同时首页“今日任务”的查看记录是听力入口，但完成页会展示 `getStudyCompletions` 返回的 `vocabulary/listening-study`。
5. 修复：首页写入带 `date + target` 的完成缓存，并带 `scope=listening` 进入完成页；写入缓存和完成页过滤都只保留 `type=listening/speaking + category + taskId` 的播放任务；学习包、词汇、阅读记录放到记录/日报，不进入今日任务完成页；缺缓存时在页面 debug 区写出缓存链路断点。
6. 是否需要发版：前端改动，需要发布小程序。

### 2026-07-10 首页今日目标长时间不更新

1. 现象：首页显示 25/25 分钟，与当日真实听力记录不符。
2. 账号：317613。
3. 查询：`dailyTaskProgress` 当日 11 条全完成；`dailyCheckins` 已打卡；`dailyReports.totalMinutes=31`，任务快照目标合计也为 31 分钟。
4. 结论：首页 `getDashboard` 可命中 7 天持久缓存；已打卡后 dashboard 的任务分组已切到下一计划日，且前端将完成分钟封顶到目标值。
5. 修复：首页每次 `onShow` 强制刷新 dashboard；完成分钟读当日日报，目标分钟读当日日报任务快照。
6. 是否需要发版：需部署 `yoyo` 云函数，并重新发布小程序前端。
