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

### 2026-07-15 Magic Tree House 拖拽后文本仍错位

1. 现象：课程播放器拖拽已正确 seek，但 Magic Tree House 部分集数仍显示旧句或跨越数分钟不切换。
2. 账号：不限账号。
3. 查询：`pages/lesson.changeAudioProgress -> getTaskTranscript -> _transcripts/<level>/magic-tree-house/tracks/*`；旧 v1 第 36 集存在 745.9 秒空档，第 48 集单行覆盖 639.3 秒。
4. 结论：PDF 缺页及 `Demo version limitation` 水印使全局文本匹配跳过大段音频；页面又按下一句开始时间延续上一句，拖拽逻辑正常但时间轴数据错误。
5. 修复：以 Whisper 原始分段时间为骨架重建 52 集 v2，PDF 只替换成功匹配正文，缺失区记录为 ASR patch；页面按 `endMs` 结束当前句。v2 使用新路径增量上传，v1 保留。
6. 是否需要发版：v2 目录已部署云函数并立即生效；页面空档显示修复需重新发布小程序。

### 2026-07-13 Pre A1 Songs 同时显示可进入和未开放

1. 现象：音频页 Pre A1 的 Songs 左侧显示“可进入”，右侧显示“未开放”，点击不能进入。
2. 账号：不限账号。
3. 查询：`pages/level.loadOverview -> store.getListeningPlanOverview -> cloud.getListeningPlanOverview.materials[song]` 返回 `totalCount=0 / enabled=false`；线上 `A1/Super simple songs` 实有 103 个 MP3。
4. 结论：轻量 Overview 按性能要求不扫描目录，但 Songs 缺少与其他 Level 一致的静态目录摘要，冷启动把空静态目录误判为未开放；前端又把零数量统一显示为“可进入”。
5. 修复：生成通用静态目录 manifest，Songs 与其他 Level 共用摘要和详情链路；空且禁用时前端统一显示“未开放”。
6. 是否需要发版：需部署 `yoyo` 云函数使线上目录立即可用；前端状态文案修复需重新发布小程序。

### 2026-07-13 初中/高中词汇书被轻量云函数拒绝

1. 现象：初中、高中词汇书读取失败，页面 DEBUG 显示 `dictionary-book-invalid`，Unlock 词汇书可正常读取。
2. 账号：不限账号。
3. 查询：`pages/reading/flashcards.importDictionaryBook -> store.getDictionaryBook -> cloud.dictionary-book.resolveBook`；参数分别为 `junior / senior`。
4. 结论：独立轻量 `dictionary-book` 云函数只识别 Unlock level，遗漏初中和高中词书映射。
5. 修复：轻量云函数补充 `junior / senior` 到现有云存储 JSON 的映射，并保持 Unlock 路径不变。
6. 是否需要发版：部署 `dictionary-book` 云函数后立即生效；前端无需发布。

### 2026-07-11 成长页累计时长被旧缓存覆盖为 0

1. 现象：云端 `getDashboard(view=record)` 已返回非零 `stats.totalMinutes`，成长页最终仍显示 0 分钟，同时天数和任务数来自月历兜底。
2. 账号：不限账号，按当前 `targetChildId` 隔离。
3. 查询：`pages/record.onShow -> store.getDashboard -> cloud.getDashboard`，对比 `stats.totalMinutes` 与后续 `getMonthHeatmap -> mergeStatsWithHeatmap` 的最终显示值。
4. 结论：持久缓存先返回旧的零统计，云端刷新先写入真实值；较慢的月历请求随后又用旧 dashboard Promise 结果覆盖真实值。
5. 修复：成长页保留本地快照首显，但后台 dashboard 使用 `forceRefresh=true`，Promise 合并只接受云端权威统计。
6. 是否需要发版：前端改动，需要重新编译/发布小程序；云函数无需修改。

### 2026-07-11 阅读练习记录长期显示生成解析中

1. 现象：`pages/practice-history` 展开历史阅读后，原文和答案正常，但逐题一直显示“生成解析中”。
2. 账号：不限账号，按当前 `targetChildId` 隔离。
3. 查询：`pages/practice-history.loadReadingDetail -> store.getReadingStudyPack -> cloud.getReadingStudyPack`；记录 `passageId / attemptId / studyPack / analyses / cacheMiss / elapsed / targetChildId / syncMode`。
4. 结论：历史页只读取 `studyCompletions.latestAttempt.review` 的提交瞬间占位快照，没有自动补读公共 `readingStudyPacks`。
5. 修复：文章、完成记录、解析缓存三项并行读取；过滤占位文本；请求超过 3 秒或缓存缺失/不完整时显示链路 DEBUG，成功命中后清除。
6. 是否需要发版：前端改动，需要重新编译/发布小程序；云函数无需再次修改。

### 2026-07-11 阅读单篇白屏 / AI 解析报 text is not a function

1. 现象：真机进入已有学习包的文章（如 2015 嘉定一模阅读 A）白屏；或答题正误可显示但 AI 解析失败，页面 debug 显示 `text is not a function`。
2. 账号：不限账号。
3. 查询：`pages/reading/detail/index.js termEntries`。
4. 结论：局部题目文本变量 `text` 覆盖了页面翻译函数 `text()`。
5. 修复：局部变量改名为 `termText`；详情跳转统一编码、解码 `passageId`；阅读继续使用依赖主包公共模块的普通分包，不改为独立分包。
6. 是否需要发版：需重新发布小程序前端。

### 2026-07-11 学生阅读提交后解析一直生成中

1. 现象：学生提交阅读后可看正误，但逐题解析长时间停在“生成解析中”；重新进入也不续接。
2. 账号：不限学生。
3. 查询：`readingAttempts.review.analysis` 可能只有占位文案；`readingStudyPacks.studyPack.questionAnalyses` 可能存在数组但缺少完整 `analysis / answerSentence`。
4. 结论：前端丢弃了非模型解析的已提交 attempt；云端又把“有数组但内容不完整”的学习包误判为缓存命中。主备模型各 110 秒，总超时还可超过云函数 180 秒上限。
5. 修复：保留已提交 attempt 并自动续接；缓存必须通过完整模型解析校验；主备模型各限制 50 秒，失败页面显示具体链路 debug。
6. 是否需要发版：需部署 `yoyo` 云函数，并重新发布小程序前端。

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

### 2026-07-11 成长页云端时长正确但页面仍显示 0

1. 现象：学生和家长成长页的天数、任务数正确，累计时长显示 0。
2. 线上证据：同时段 `getDashboard(view=record)` 对学生 986209 返回 14 分钟，对家长绑定 317613 返回 2826 分钟；直接按 `dailyReports` 日期去重聚合分别为 10 和 3453，需另行核对历史日报更新时序。
3. 定位：云端已返回非零值，故不能继续修改数据集合；真机页面需埋点 `cloud stats.totalMinutes -> display.totalDurationText`。
4. 测试期处理：成长页强制显示上述链路 DEBUG，时长文案嵌入同一 `stats` 对象，避免并发日历更新使用旧页面文案。
5. 是否需要发版：需重新编译小程序前端；本次不需要重新部署云函数。
6. 复测：18:42 同账号云日志返回 14 分钟，截图仍显示的 `cloud=182ms / totalMinutes=0` 为持久化的旧 DEBUG 快照；成长快照升级为 V2 并禁止保存 DEBUG 行。
7. 二次复测：18:46 页面显示的 `cloud=189ms / totalMinutes=0` 在同时段云函数日志中无对应请求，确认为旧 `getDashboard` 持久读缓存；全局云读缓存由 V3 升级为 V4。
8. 三次复测：18:53 仍无对应云日志；成长页改为直接 `cloud.callYoyo(getDashboard)`，不再经过 store 任何读缓存，DEBUG 同步显示固定云环境 ID。
9. 最终定位：18:57 直连仍无 SCF 日志，说明开发者工具正在使用本地云函数代理。本地 SDK 的 `dailyReports.aggregate()` 返回成功但汇总为 0，未触发 catch 分页兜底。
10. 修复：累计时长统一使用轻字段分页查询，再按日期取最大值去重求和；不再依赖本地/线上表现不一致的聚合 SDK。需重新部署 `yoyo` 云函数。
11. 验证：学生 986209 显示 10 分钟；家长绑定 317613 显示 3453 分钟（57 小时 33 分钟）。链路确认后撤掉强制可见 DEBUG，仅保留内部调试开关。
### 2026-07-11 修改听力计划后首页仍显示旧目标时长

1. 现象：学生当前自定义计划只有 1 条、音频约 72 秒，任务页显示 1 分钟，首页显示 38 分钟。
2. 账号：986209 / `family-1775753655054` / `child-yoyo`。
3. 查询：旧 `dailyReports` 于 14:35 保存固定计划 7 条任务，目标合计 38 分钟；当前 `listeningPlans` 于 14:36 更新为 1 条新概念任务。
4. 结论：首页无条件优先使用今日日报任务快照，未校验日报是否属于当前计划。
5. 修复：自定义计划的 ID、来源或更新时间与日报不一致时，首页改按当前任务 `durationSec × repeatTarget` 汇总；已完成时长也只统计当前任务。
6. 是否需要发版：需重新部署 `yoyo` 云函数；前端无需修改。
7. 部署后复测：22:53 首页显示“待设置”，同时段正式环境无 `getDashboard` 日志，证明页面未发起当次云刷新。首页快照升级 V2，后台 dashboard 请求附加唯一 `requestNonce`，避免任何旧读缓存或同请求复用。

### 2026-07-15 Magic Tree House 拖拽后文本不同步

1. 现象：播放 Magic Tree House 时拖动进度条，文本仍停留在原播放位置。
2. 账号：不限账号。
3. 查询：`pages/lesson.changingAudioProgress -> innerAudioContext.onTimeUpdate -> updateTranscriptByTime`。
4. 结论：拖动时未主动更新文本，且播放中的旧 `currentTime` 持续覆盖拖动预览位置。
5. 修复：拖动期间按目标时间更新文本；拖动时暂停接受旧时间回调；`onSeeked` 按实际落点再校正。
6. 是否需要发版：前端改动，需重新发布小程序；不需要部署云函数。
