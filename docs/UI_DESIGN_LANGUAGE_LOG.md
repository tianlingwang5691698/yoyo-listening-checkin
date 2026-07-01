# 小程序设计语言与改动记录

后续 UI/交互改动先读本文，再看 `PRODUCT_DESIGN_RULES.md`、`DESIGN_STYLE_REQUIREMENTS.md` 和 `UI_CHANGE_CHECKLIST.md`。

## UI 总纲规则

### 产品气质

- 高级、极简、安静、可信，像亲子英语学习产品，不像后台工具。
- 首屏只表达一个主要任务：学习、查看记录、查看日报或继续任务。
- 不堆指标、不堆按钮、不写说明书式长文。

### 字体总纲

- 全项目统一使用 6 层字体：`type-brand`、`type-page-title`、`type-card-title`、`type-section-title`、`type-body`、`type-caption`。
- 页面主标题只用 `type-page-title`，卡片主标题只用 `type-card-title`，列表标题只用 `type-section-title`。
- 正文阅读内容用 `type-body`，说明、时间、数量、状态用 `type-caption`。
- 禁止随手写 `font-weight: 900`；只有成长页核心大数字可用最高权重。
- 禁止负字距；中文标题保持紧凑但不挤压。

### 视觉总纲

- 背景使用暖白或近白，不做复杂装饰、渐变球、装饰图案。
- 卡片使用低圆角、轻阴影、轻边框；同一屏卡片权重不超过 2 种。
- 强调色只给当前关键动作、状态数字和可点击箭头。
- 每页最多一个主按钮，其余操作使用轻按钮或整行点击。
- 列表项行高稳定，左右留白一致，文字不能贴边。

### 信息层级

- 首屏结构固定为：导航标题 -> 主卡片 -> 内容列表。
- 主卡片负责说明当前板块是什么；列表负责承载任务或记录。
- 卡片内顺序固定：标签/状态 -> 标题 -> 副信息 -> 动作。
- 数字必须有语义，不单独做装饰。

### 交互总纲

- 可查看记录的地方统一先显示摘要，点击后展开完整详情。
- 完整详情必须包含：原题/原文、学生作答、结果、模型分析、建议或范文。
- 整行可点时不额外放同权重按钮；按钮只用于明确命令。
- 返回、展开、继续学习等入口必须可预期，不跳到用户没选择的下一步。

## 分板块细则

### 首页

- 职责：进入学习。
- 保留品牌识别：`{{child.nickname || '佑佑'}}的英语小耳朵`。
- 入口海报字体分类：理念标签用小号高亮，主宣言用大标题，解释句用中号加粗，独白正文用正文灰，分类标签用轻胶囊。
- Peppa / Unlock 1 / Songs 顺序固定。
- 今日任务卡固定显示听力主线状态：待完成 / 已完成。
- “继续学习”只进入今日任务表，不直接跳下一个听力。
- 不展示后台式计数，不做数据看板；模块卡只显示最必要的进度短句。

### A1-C2 课程页

- 职责：播放、三遍节奏、文本同步、文本学习包。
- 播放器是主角，技术链路默认隐藏。
- 有文本时先展示“文本学习”，完成生词/短语/句型后再解锁播放。
- 学习包标签必须稳定在卡片内，不能挤压、溢出或变形。
- 同屏只保留一个主要进度表达。

### 考试听力页

- 职责：听力音频、题目练习、文本学习包。
- 有 transcript 的套卷先学文本学习包，再播放音频。
- 无 transcript 的套卷不强制锁音频。
- 答题区保持清晰，不和学习包抢主视觉。
- 今日听力任务是主线任务：未完成时首页显示“今日待完成”。
- 听力记录展开后要能看到任务、答题情况和分析。

### 阅读页

- 职责：阅读答题、提交、解析、学习包。
- 原文、答案句、生词、短语、句型的高亮入口要清楚。
- 学习包卡片不堆长解释，例句和中文解释分层显示。
- 阅读目录页标题要克制，区分“一模 / 二模 / 真题卷”的层级。
- 阅读记录展开后必须显示原文、全部题目、孩子答案、正确答案、逐题分析。

### 语法页

- 职责：按阶段、模考、大类、细分考点练题。
- 目录层级清楚，题目页聚焦题干和解析。
- 不把考点列表做成报表。
- 语法列表以“考点分类”为主，不用大号粗字堆砌。
- 语法记录展开后必须显示原题、选项、孩子答案、正确答案和分析。

### 写作页

- 职责：作文题展示、提交、批改结果。
- 批改结果按内容、结构、语言、建议分块。
- 不用大量红色制造压力。
- 写作记录展开后必须显示作文题目、学生作文、批改、问题、建议和参考范文。
- 家长端也必须能看到作文题目和参考范文。

### 成长/记录页

- 职责：学习记录、连续/累计、热力图、历史回看。
- 可以承载数据，但不能做控制台。
- 大数字只用于真正核心指标。
- 所有记录先摘要，点击后展开完整详情。
- 阅读、语法、写作、听力、口语都按同一逻辑：原始内容 + 学生作答 + 模型分析。

### 家长页

- 职责：日报、孩子学习明细、必要管理入口。
- 避免指标堆叠，优先自然语言结论。
- 每页最多一个主动作。
- 家长模式不显示学生自己的 ID 入口。
- 家长可查看绑定孩子的全部完成内容和分析。
- 家长日报里的完成内容先显示摘要，点开后看详情。
- 家长入口选择后隐藏“我是家长 / 我是学生”切换卡。

### 口语页

- 职责：录音、评分、回看回答和模型分析。
- 首屏突出录音任务，不堆历史记录。
- 口语记录展开后必须显示题目、录音/文本、评分和分析。

### 词汇板块

- 职责：统一收集听力、阅读、语法、写作、口语里生成的生词、短语、句型。
- 首屏先是“库”，按生词/短语/句型分门别类浏览，不直接进入单张闪卡。
- 学习入口从词库首页进入，不使用左右滑；单张学习卡底部只保留“不认识 / 我认识”。
- 首页必须能看到词汇背诵进度和最近打卡记录。
- 复习计划按艾宾浩斯节奏推进，同时允许学生设置每天新学量和旧词复习量。

## 组件规则

- 分段标签：使用 3 栏以内，必须 `min-width: 0`，按钮 `margin: 0`，左右留边，禁止贴边、超出卡片或挤压变形。
- 学习卡片：标题、中文解释、英文例句、中文翻译四层，不强行同排。
- 播放按钮：圆形主控，状态文案短。
- 胶囊按钮：只用于轻操作，不承担主动作。
- 列表项：整行点击，不额外放同权重按钮。

## 改动记录

记录规则：

- 每个板块单独记录，不把阅读、听力、语法、写作、词汇等混写在同一条。
- 每条必须写清楚：板块、文件、改动、设计记录、验证。
- 后续改 UI 或交互前先看对应板块最近记录，再继续改。

### 2026-06-30 UI 总纲和分板块细则

- 文件：`docs/UI_DESIGN_LANGUAGE_LOG.md`
- 改动：把原有设计语言扩展为“UI 总纲规则 + 分板块细则”。
- 设计记录：后续所有板块字体、层级、记录详情、家长日报、首页任务入口按本文统一执行。
- 验证：文档规则已覆盖首页、听力、阅读、语法、写作、记录、家长、口语、词汇。

### 2026-06-30 板块字体和目录页重设计

- 文件：`styles/base.wxss`
- 文件：`styles/themes/warm.wxss`
- 文件：`styles/themes/fresh.wxss`
- 文件：`styles/themes/sky.wxss`
- 文件：`pages/reading/index.wxss`
- 文件：`pages/grammar/index.wxss`
- 文件：`pages/material/index.wxss`
- 改动：统一三套主题字体为稳定无衬线层级，降低过重字号和阴影，重做阅读、语法、资料目录页卡片与列表质感。
- 设计记录：目录页统一为“主卡片 + 轻边框列表行”，标题克制，说明文字更舒展，箭头和状态只做轻强调。
- 验证：检查无负字距、无页面新增 900 粗字。

### 2026-06-30 A1-C2 听力文本学习包

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 文件：`domain/cloud/index.js`
- 改动：A1-C2 课程页新增文本学习包，生成生词/短语/句型后解锁音频。
- 修正：`getListeningStudyPack` 前端超时改为 120 秒，避免模型已成功但前端先报失败。
- 设计记录：学习包标签和按钮必须固定在卡片内，避免截图中出现标签挤压、按钮溢出、卡片变形。
- 修正：生词/短语/句型从满宽分段条改成卡片内三枚胶囊按钮，左右留边，避免“句型”贴到卡片边缘。
- 修正：生成按钮加大字号和点击框，使用浅强调底色，避免显得过小、漂浮。
- 逻辑：进入课程页先查云端 `listeningStudyPacks` 缓存，成功命中立即显示；未命中才显示生成按钮。生成失败不写缓存，可重新生成。

### 2026-06-30 考试听力文本学习包

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`cloudfunctions/yoyo/services/listening.service.js`
- 文件：`cloudfunctions/yoyo/index.js`
- 文件：`utils/store.js`
- 改动：二模听力详情页新增文本学习包，支持生词/短语/句型。
- 规则：有 transcript 时先学习再播放；无 transcript 不强制锁音频。
- 逻辑：进入详情页先查云端 `listeningStudyPacks` 缓存，命中立即显示；未命中才由用户手动生成。

### 2026-07-01 首页/记录入口提速

- 文件：`pages/home/index.js`
- 文件：`utils/page.js`
- 改动：入口海报和身份确认改成本机持久记忆；今日已完成时直接进入完成记录页，不再先等待日报和完成记录云端请求。
- 设计记录：首页保留一个主动作，学生和家长进入核心任务前不被重复说明页阻断；记录页先用缓存摘要展示，再后台刷新。
- 验证：语法检查通过，云函数测试通过。

### 2026-07-01 语法答题链路提速

- 文件：`pages/grammar/index.js`
- 改动：答题后不再自动拉模型讲解；保留“看讲解”手动入口；语法进度和完成记录改为每 3 题或退出页面同步。
- 设计记录：题目页先反馈对错，讲解作为主动查看动作，避免练习节奏被模型请求打断。
- 验证：语法检查通过，云函数测试通过。

### 2026-07-01 词汇复习写入节流

- 文件：`pages/reading/flashcards/index.js`
- 改动：复习选择先本地更新卡片状态，云端复习记录每 5 张或退出页面批量发送。
- 设计记录：词汇学习保持单张卡片即时切换，不让保存动作打断“不认识 / 我认识”的练习节奏。
- 验证：语法检查通过，云函数测试通过。

### 2026-07-01 二次高速和质量优化

- 文件：`pages/home/index.js`
- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/lib/request-context-engine.js`
- 文件：`cloudfunctions/yoyo/services/grammar.service.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：首页首屏完成后后台刷新今日完成数据；写作记录查询走轻量上下文；阅读题库列表增加云函数内存缓存；查词增加短时本地缓存；语法讲解失败不向学生暴露接口错误。
- 设计记录：首屏先可操作，数据随后补齐；错误文案保持学生可理解；查词和记录查看优先复用缓存。
- 验证：语法检查通过，云函数测试通过。

### 2026-07-01 词汇首屏和写作提交提速

- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 文件：`pages/reading/flashcards/index.js`
- 文件：`cloudfunctions/yoyo/services/writing.service.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/writing/detail/index.wxml`
- 改动：词汇首屏新增今日到期轻量接口，先返回复习队列再后台补全词库；写作提交先保存待批改记录，再触发独立批改动作回填结果。
- 设计记录：词汇首页优先进入可复习状态；写作提交不让学生长时间等在按钮 loading 上，批改中状态明确可理解。
- 验证：语法检查通过，云函数测试通过。

### 2026-06-30 统一词汇板块

- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 文件：`cloudfunctions/yoyo/services/listening.service.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 文件：`cloudfunctions/yoyo/index.js`
- 文件：`utils/store.js`
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.json`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：新增云端 `studyFlashcards` 统一词库，听力/阅读学习包生成或命中缓存后同步写入生词、短语、句型。
- 设计记录：词汇板块先展示分类库、背诵进度、最近打卡，再进入单张学习；每日新学量和复习量可调。
- 规则：复习节奏使用 `[0, 1, 2, 4, 7, 15, 30]` 天，答“仍不熟”则次日再复习。

### 2026-06-30 阅读学习包视觉修正

- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读结果底部学习包的生词、短语、句型入口改为卡片内稳定胶囊按钮，空状态增加轻生成按钮。
- 设计记录：阅读学习包标签不使用厚重分段条，不贴边、不挤压；生成入口作为轻操作放在空状态内。
- 验证：已检查样式只影响阅读详情学习包区域。

### 2026-07-01 词汇演示数据

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词库无云端数据时显示一组生词、短语、句型演示卡片。
- 设计记录：演示状态只加轻量标签，保持词库首页先分类浏览，再进入复习卡片。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页加载提示优化

- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 改动：首页首次同步不再显示“加载中”提示卡片，查看记录去掉系统 loading 弹层。
- 设计记录：首页打开时保留现有首屏结构，加载状态静默处理，避免提示遮挡页面观感。
- 验证：已做前端脚本语法检查。

### 2026-07-01 全页面加载提示静默化

- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.js`
- 文件：`pages/reading/index.wxml`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.js`
- 文件：`pages/record/index.wxml`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/identity/index.wxml`
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/level/index.js`
- 文件：`pages/level-stage/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/index.wxml`
- 文件：`pages/profile/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/family/index.wxml`
- 文件：`pages/reading/flashcards/index.wxml`
- 改动：移除页面内“加载中/生成中/查词中/准备中/同步中”等等待提示，加载阶段静默等待，空状态只在确认无数据后显示。
- 设计记录：全页面等待过程不弹提示、不占首屏视觉；保留按钮禁用/转圈这类局部操作反馈。
- 验证：已做前端脚本语法检查。

### 2026-07-01 写作输入框信纸样式

- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/writing/detail/index.wxss`
- 改动：作文输入框改为信纸横线底纹、左侧竖线和鹅毛笔装饰，聚焦时增强边框与阴影。
- 设计记录：写作输入区域保持安静纸张质感，不使用高压红色；原生输入光标仅设置暖棕色，鹅毛笔作为装饰提示。
- 验证：已检查样式只影响写作详情页输入框。

### 2026-07-01 写作输入框横线对齐修正

- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxss`
- 改动：写作输入框改为纯白底深灰横线，去掉左侧竖线、黄纸底色和鹅毛笔装饰。
- 设计记录：写作信纸使用和题干下划线一致的横线风格，横线间距必须等于输入行高。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇数量步进控件

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：今日新学和今日复习数量控件改为更大的胶囊步进器，支持长按按 5 增减。
- 设计记录：数量设置保留在词库首屏主卡片内，按钮到边界时弱化，数字作为控件中心。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇数量控件防溢出

- 文件：`pages/reading/flashcards/index.wxss`
- 改动：数量设置改为两个等宽竖向设置卡，标签和步进器居中排列。
- 设计记录：步进器必须固定在卡片内，不横向挤压或超出屏幕。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇数量控件显示修正

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：数量加减控件从 `button` 改为 `view`，避免小程序按钮渲染造成白块和错位。
- 设计记录：小型数字步进器不用原生按钮，保持控件居中、简洁、稳定。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阅读顶部按钮对称规则

- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读详情顶部高亮入口和学习包标签固定为三等分屏幕宽度。
- 设计记录：阅读板块顶部按钮写死为 3 栏等宽、无间距、左右贴齐卡片内边界，首尾圆角对称，中间按钮不带圆角。
- 验证：已检查样式只影响阅读详情页顶部按钮组。

### 2026-07-01 阅读 A 选项排版规则

- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读选择题选项改为左侧编号/状态、右侧正文的两列排版。
- 设计记录：选项必须占满题卡宽度；状态徽标不占正文列；长选项只按卡片自然宽度换行，不做窄卡片居中。
- 验证：已检查样式只影响阅读详情页选择题选项。

### 2026-07-01 阅读分段控件统一规格

- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读顶部高亮按钮和底部学习包标签统一为同一套分段控件。
- 设计记录：分段控件只由外层容器控制圆角和边框，内部项不用原生 `button`，用 `view + flex-wrap + 33.333333%` 固定三等分，保证上下左右对称。
- 验证：已检查顶部 6 项和底部 3 项使用同一规格。

### 2026-07-01 阅读 C 解析展示

- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：首字母填空提交后新增独立逐题订正卡，显示答案对比、模型解析和答案句。
- 设计记录：C 类解析不塞进原文卡片；按“题号/状态 -> 你的答案/正确答案 -> 解析 -> 答案句”固定层级展示。

### 2026-07-01 词汇数量选择器

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 改动：今日新学和今日复习改为 5 步进，点数字可选择 5 到 500，云端保存同样按 500 封顶。
- 设计记录：数量控件仍保留在首屏主卡片内，中间数字作为可点选择入口，左右按钮只做快速微调。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-01 词汇数量滑轮选中态

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：数量选择从原生选择器改为自定义底部滑轮，滑动时当前选中数字加大显示。
- 设计记录：选中数字只增强字号和字重，不增加复杂装饰，保持底部选择层简洁。
- 验证：已做前端脚本语法检查。
- 验证：已检查只影响 `passage.isClozePassage` 的提交后状态。

### 2026-07-01 阅读短语高亮匹配

- 文件：`pages/reading/detail/index.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：短语高亮同时匹配短语文本和原文例句，生成规则要求短语必须能在原文定位。
- 设计记录：点击短语后原文必须有可见反馈；短语卡不允许只生成泛化表达导致无法高亮。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-01 词汇数量滑轮触摸修正

- 文件：`pages/reading/flashcards/index.wxml`
- 改动：移除数量选择遮罩对纵向触摸移动的拦截，恢复滑轮顺滑上下滑动。
- 设计记录：底部滑轮弹层不能在外层拦截 `touchmove`，避免影响 picker-view 原生滚动。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇数量滑轮重做

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：数量选择器从 `picker-view` 改为 `scroll-view` 自定义滑轮，解决弹层内不易上下滑动的问题。
- 设计记录：底部数量选择优先保证触摸滚动稳定；选中数字用中线和加大字号表达，不依赖原生 picker。
- 验证：已做前端脚本语法检查，并确认页面不再使用 `picker-view`。

### 2026-07-01 词汇复习卡片音标布局

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：复习卡片顶部增加居中头部容器，音标和发音按钮改为对称网格布局。
- 设计记录：生词、音标、发音入口必须围绕卡片中轴排列，避免音标左飘、按钮右飘。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇全屏复习态

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：开始复习后隐藏词库统计、数量设置和标签，进入全屏闪卡，只显示返回词库、当前进度和闪卡。
- 设计记录：闪卡态只显示轻量进度 `当前/总数`，不显示每日数量设置，判断按钮避开底部安全区。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇闪卡正反面逻辑

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：闪卡默认只显示单词、音标和发音；点“我认识”直接过；第一次点“不认识”翻出释义和例句，第二次确认继续复习。
- 设计记录：正面只用于回忆，背面才显示释义和例句，避免提前暴露答案。
- 验证：已做前端脚本语法检查。

### 2026-07-01 项目词典加入词库

- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 文件：`cloudfunctions/yoyo/index.js`
- 文件：`utils/store.js`
- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/grammar/index.js`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 改动：项目词典弹窗新增“加入词库”，语法题答题后题干和选项英文词可点开查词、发音并加入当前孩子词库。
- 设计记录：词典弹窗保持底部轻弹层；语法页只在做完题后启用点词，不干扰答题；词典发音统一使用按钮内轻反馈，不弹“生成发音中”大提示。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-01 词汇闪卡判断提交逻辑

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 改动：点击“我认识/不认识”先翻背面，背面点“下一个”才提交；不认识标红并留在今天强化复习，太简单不进入学习计划且提交前可撤销。
- 设计记录：判断和提交分离；背面允许调整“太简单”，避免误操作立即写入学习计划。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-01 首页入口动态海报

- 文件：`app.js`
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：首页首次展示全屏动态海报，跳过或进入首页后露出原首页。
- 设计记录：入口海报围绕“先把听力打通”，只使用轻量声波和字幕淡入，不改变首页学习入口职责。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页入口海报文案字体

- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`docs/UI_DESIGN_LANGUAGE_LOG.md`
- 改动：海报主文案改为“听力先行”，新增解释句和三枚理念分类标签。
- 设计记录：入口海报字体按“理念标签 / 主宣言 / 解释句 / 独白正文 / 分类标签”分层，底部按钮固定避开导航栏。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报导航显隐

- 文件：`custom-tab-bar/index.js`
- 文件：`custom-tab-bar/index.wxml`
- 文件：`pages/home/index.js`
- 改动：入口海报显示时隐藏底部导航，跳过海报后再显示导航。
- 设计记录：海报是进入主页前的独立入口态，不能露出主页导航。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报字体重设计

- 文件：`pages/home/index.wxss`
- 改动：海报文字区整体下移，标题、说明和标签改为更轻的现代字体层级。
- 设计记录：入口海报标题不使用过重字体；理念标签使用轻胶囊，正文保持松弛行高。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报第二页寄语

- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：入口海报新增第二页个人介绍和寄语，第一页下一页后进入寄语，第二页再进入首页。
- 设计记录：第二页保持独立入口态，不显示主页导航；文案围绕听力先行、持续输入和自然成长。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报第二页使用说明

- 文件：`pages/home/index.wxml`
- 改动：第二页从个人介绍改为小程序使用说明。
- 设计记录：使用说明只保留三段短说明，强调先完成今日听力，再进入其他模块。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报家长绑定说明

- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：第二页改为家长 ID 绑定使用说明，并新增家长与孩子 ID 轻动画。
- 设计记录：使用说明先讲身份选择和孩子 ID 绑定，再讲今日听力任务；动画只做轻浮动和连接线呼吸。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报作者署名

- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：第二页右下角新增“设计与内容 / 王天龙”署名。
- 设计记录：作者署名放在说明卡片末尾，低调展示，不抢主说明层级。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报标签文案

- 文件：`pages/home/index.wxml`
- 改动：第一页标签从“我的英语学习理念”改为“开始前想说的话”。
- 设计记录：入口海报避免专家式表达，使用更真诚、中性的开场标签。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报初心文案

- 文件：`pages/home/index.wxml`
- 改动：第一页正文加入“最初给侄子佑佑使用，如适合也欢迎使用”的说明。
- 设计记录：海报正文保持真实家长口吻，不使用专家式背书。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报说明字体

- 文件：`pages/home/index.wxss`
- 改动：第二页标题、正文和署名改为更轻的楷体风格，并加大行距。
- 设计记录：说明页使用更飘逸的文字气质，但保留标签和按钮的产品字体，避免整页变成书法风。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报英文字体感

- 文件：`pages/home/index.wxss`
- 改动：入口海报两页标题、正文和署名统一改为偏英文排版感的细 sans 字体。
- 设计记录：海报不使用楷体；用更轻的字重、更松的行距和 Helvetica/Avenir 系字体表达现代感。
- 验证：已做前端脚本语法检查。

### 2026-07-01 首页海报返回按钮与轻字体

- 文件：`pages/home/index.wxss`
- 改动：第二页“返回理念”固定到分页点上方，海报标题和正文进一步改细。
- 设计记录：返回入口不能遮挡分页点；海报正文使用 PingFang/Avenir 细字重和更松行距。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阅读提交后题干选项查词

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读提交后，题干和选项里的英文单词支持轻点查词。
- 设计记录：查词入口延续原文轻点单词样式，不新增大按钮，不干扰提交前答题。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词典发音轻反馈

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/grammar/index.js`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 改动：阅读和语法查词弹窗的发音按钮统一改为 `…` 轻反馈和呼吸动画。
- 设计记录：词典发音只用于单词和短语；点击发音时只改变按钮自身状态，播放结束后恢复“发音”，不出现大块生成提示。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词典取消句子发音

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 改动：词汇闪卡只给单词和短语显示发音入口，句型和例句不再触发 TTS。
- 设计记录：所有词典/词库发音只保留单词和短语级别，句子、句型、例句不提供发音功能。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阅读学习包发音统一

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读生成的生词和短语统一使用音符发音入口，句型不提供发音。
- 设计记录：阅读学习包发音沿用原生词音符样式，播放时音符轻跳动；发音不震动、不显示生成文案。
- 验证：已做前端脚本语法检查。

### 2026-07-01 查词启用时机统一

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/grammar/index.js`
- 文件：`pages/grammar/index.wxml`
- 改动：阅读提交前不允许查词；语法题选择答案后，题干和选项才允许查词。
- 设计记录：查词只在答题结果出现后启用，不干扰作答；词典发音继续使用统一轻反馈。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阅读学习包不熟按钮

- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读学习包“不熟/已加入”按钮改为固定尺寸居中布局。
- 设计记录：轻操作胶囊按钮文字必须水平和垂直居中，不能受原生 button 行高影响偏上。
- 验证：已做样式检查。

### 2026-07-01 阅读原文背景统一

- 文件：`pages/reading/detail/index.wxss`
- 改动：阅读原文句子块去掉浅灰底卡片，改为白卡片内连续文本，仅保留轻点击反馈。
- 设计记录：阅读原文背景必须和全局暖白页面、白卡片主题一致，不把每句渲染成突兀浅灰块。
- 验证：已做前端脚本语法检查。

### 2026-07-01 全局词典音符发音

- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：语法词典、阅读词典和词汇闪卡的发音入口统一为音符按钮。
- 设计记录：全局词典发音使用 `♪` 音符，播放时音符轻跳动；不再使用“发音/…”文字按钮。
- 验证：已做前端脚本语法检查。

### 2026-07-01 全局页面统一风格

- 文件：`utils/theme.js`
- 文件：`styles/themes/warm.wxss`
- 文件：`styles/theme-tabbar.wxss`
- 文件：`styles/base.wxss`
- 文件：`pages/profile/index.wxml`
- 改动：除入口海报外，页面统一收敛到一套护眼暖白、白卡片、暖咖主按钮、金棕轻强调的产品风格。
- 设计记录：普通页面要和海报气质一致，保持暖白护眼底色和克制色彩；不再暴露多套明显不同的主题色。
- 验证：已做前端脚本语法检查。

### 2026-07-01 身份切换分段按钮

- 文件：`pages/profile/index.wxss`
- 改动：我的页身份切换改为两列独立胶囊按钮，中间留缝。
- 设计记录：分段按钮不能交叉覆盖；每个选项必须固定在自己的网格内，文字水平和垂直居中。
- 验证：已做前端脚本语法检查。

### 2026-07-01 全局活力护眼主题

- 文件：`styles/themes/warm.wxss`
- 文件：`styles/theme-tabbar.wxss`
- 文件：`utils/theme.js`
- 改动：全局主强调色由深咖调整为低饱和暖杏橙，纸张底色降低黄感。
- 设计记录：普通页面以纸白灰底承载长时间阅读，完成、选中、主按钮统一用暖杏橙提升活力；避免茶绿和重黑色压住页面。
- 验证：已做前端脚本语法检查和样式差异检查。

### 2026-07-01 词汇云存储词书

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 文件：`utils/store.js`
- 文件：`domain/cloud/index.js`
- 改动：词汇板块入口改为“我的书库”，先选择“我的词库”或某本词汇书，再进入该来源的学习计划和词表；书库第一屏增加书本封面和轻动态书架效果；页面返回按“闪卡 -> 计划 -> 书库 -> 上一页”处理；词汇书按批导入，避免大书首次进入超时，并把每个来源缓存到本机；词表条目不再重复显示书名。
- 设计记录：词书卡使用原书名展示；书库第一屏用小书本封面和错峰轻浮动表达书架感；每个来源各自保存学习计划数量，数量上限是该来源总数，不再用全局 500 上限；自定义顶部返回必须逐级处理页内层级，再退出页面；已进入过的词书优先读本机缓存秒开，再后台刷新；书名只在计划标题/书库展示，不在每个词条重复渲染。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-01 词汇数量保存不清空

- 文件：`pages/reading/flashcards/index.js`
- 改动：词书数量保存改为基于当前已加载词库本地重算计划，不再保存后立刻重拉云端导致真机清零；没有缓存的词书先进入页面，再直接拉词书文件。
- 设计记录：数量选择是当前词书内的轻量设置，确认后必须保持词书内容稳定，不跳空状态；计划设置不依赖词书缓存。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词书手机本地缓存

- 文件：`pages/reading/flashcards/index.js`
- 改动：词书缓存优先写入手机本地文件，旧 Storage 缓存只做兜底读取。
- 设计记录：词书首次拉取后必须保存在手机本地，下次进入同一词书直接秒开。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇统计进度

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页补充总词汇、今日学习、总共已学统计，进度条改为细航线和小帆船标记；0% 时也显示起点。
- 设计记录：词汇计划首屏只保留总量、今日量、累计量三类核心指标，航线进度保持克制，不让装饰压过数据。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阅读句子翻译轻提示

- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 改动：提交后轻触原文句子翻译时，等待期间显示“翻译中...”。
- 设计记录：句子翻译反馈使用行内弱提示，不打断阅读。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇学习自动发音

- 文件：`pages/reading/flashcards/index.js`
- 改动：开始复习和进入下一张可发音词卡时自动播放发音，保留手动点词和发音按钮。
- 设计记录：词汇学习以声音先行，自动发音失败静默处理，不打断答题。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇学习发音完成规则

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇书本地计划答题后写回词书进度，避免反复从前几个开始；可发音词卡听完后才可点下一个。
- 设计记录：词汇学习按“先听音，再判断，再进入下一张”推进。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇首页层级收纳

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页默认只保留核心进度和主行动，词库明细、计划设置、最近记录下沉到二级展开；“开始复习”改为醒目的“开始背诵”主按钮。
- 设计记录：学习入口页首屏优先服务开始动作，管理型信息默认收起。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇首页打卡指标

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页增加独立词汇打卡天数，标题区去掉长句，首屏指标改为已学、今日学习、词汇打卡三项。
- 设计记录：词汇首页用三项短指标承载核心状态，长来源信息只保留一行，避免首屏拥挤。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词书进度和本机发音缓存

- 文件：`pages/reading/flashcards/index.js`
- 改动：词书进度加载时合并本机缓存状态，答题后同步写本机和云端；词卡发音优先播放本机音频文件，没有本机文件时才联网获取并落本机缓存。
- 设计记录：词书背诵进度必须稳定向后推进；已缓存发音不重复联网。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇背诵队列重建

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 改动：开始背诵时按最新词库状态重建本轮队列，答题后所有真实词卡都先更新本地队列再同步云端；“下一个”只在发音加载或播放中禁用。
- 设计记录：背诵队列必须由最新状态生成，发音不能成为永久阻塞条件。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇背诵会话冻结

- 文件：`pages/reading/flashcards/index.js`
- 改动：背诵中禁止后台加载、词书导入刷新覆盖当前本轮队列，避免“不认识”的少量词被重新排到队首形成来回循环。
- 设计记录：一轮背诵开始后，本轮词卡顺序和范围必须稳定，后台同步只更新元信息。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇首页疏朗化

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页指标取消小卡盒子，进度条和开始按钮拉开间距，二级入口改为轻量文字按钮。
- 设计记录：词汇入口页避免卡片套卡片，核心动作周围保留呼吸空间。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇首页结构拆分

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页取消大白卡包裹，把标题、状态、进度、开始背诵、二级入口拆成独立层级；设置面板仅展开时显示卡片。
- 设计记录：首屏主入口不使用大容器压缩内容，视觉层级通过留白和分隔线表达。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇首页与闪卡隔离

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：首页入口内容只在词库模式渲染，复习闪卡页不再显示开始按钮和二级入口。
- 设计记录：入口页和闪卡页必须结构隔离，不能靠隐藏部分样式混用布局。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇闪卡上下间距

- 文件：`pages/reading/flashcards/index.wxss`
- 改动：闪卡页取消按钮贴底布局，词头区和操作区向中段收拢，同时保留释义和例句展示空间。
- 设计记录：闪卡正面上下内容应围绕中段，背面预留说明区，不使用全屏拉伸制造空白。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇闪卡按钮稳定

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：闪卡未翻开和翻开后的底部按钮保持同一行、同一高度，“下一个”与“我认识”位置一致。
- 设计记录：闪卡操作区不能因状态切换上下跳动或改变按钮高度。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇闪卡释义占位

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：闪卡正面也保留背面释义区占位，未翻开时隐藏内容但不移除空间，避免按钮纵向跳动。
- 设计记录：翻面前后内容区高度必须稳定，操作按钮位置不能被释义插入推开。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇闪卡移除轻提示

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：移除闪卡底部轻提示文案，按钮区保留稳定间距。
- 设计记录：高频背诵页不重复解释操作，减少视觉噪音。
- 验证：已做前端脚本语法检查。

### 2026-07-01 词汇页首屏速度

- 文件：`pages/reading/flashcards/index.js`
- 文件：`utils/store.js`
- 改动：词汇页命中本机缓存后立即显示，云端数据后台刷新；完整词库明细不再进入首屏渲染数据，点“查看词库”时再生成分组。
- 设计记录：词汇页首屏只保留书库、摘要、进度和开始按钮，词表明细属于二级展开内容。
- 验证：已做前端脚本语法检查。

### 2026-07-01 重点页面速度埋点

- 文件：`utils/page.js`
- 文件：`utils/store.js`
- 文件：`pages/home/index.js`
- 文件：`pages/reading/index.js`
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/grammar/index.js`
- 文件：`pages/record/index.js`
- 改动：首页、阅读目录、词汇、语法、记录页增加 `pageReady`、`cacheHit` 和后台刷新耗时日志。
- 设计记录：速度优化先记录真实首屏耗时和缓存命中，再按数据继续压慢页面。
- 验证：已做前端脚本语法检查。

### 2026-07-01 听力学习包完成记录

- 文件：`pages/material/detail/index.js`
- 文件：`pages/lesson/index.js`
- 改动：听力学习包成功拉取/生成后写入云端完成记录，供家长端查看；本机完成按钮只负责解锁音频。
- 设计记录：学生端拿到学习包即形成家长端可见记录，本机状态只负责当前设备解锁。
- 验证：已做前端脚本语法检查。

### 2026-07-01 家长学习记录秒开

- 文件：`utils/store.js`
- 文件：`pages/parent/index.js`
- 文件：`pages/parent/detail/index.js`
- 改动：学习完成记录 `getStudyCompletions` 增加本地缓存和后台刷新，家长首页/详情先显示缓存再合并云端新记录。
- 设计记录：家长端高频查看记录必须缓存秒开，云端刷新只做增量修正体验。
- 验证：已做前端脚本语法检查。

### 2026-07-01 阶段页取消中转加载

- 文件：`pages/level-stage/index.js`
- 文件：`pages/level-stage/index.wxml`
- 改动：阶段页进入时立即按参数显示阶段标题，任务数据用快照/缓存先渲染再后台刷新；无数据空态只在真实加载完成后显示。
- 设计记录：阶段切换不显示中转加载页，目标页首屏必须先呈现稳定结构。
- 验证：已做前端脚本语法检查。

### 2026-07-01 家长多学生切换

- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 文件：`pages/family/index.wxml`
- 文件：`pages/family/index.wxss`
- 改动：家长端支持多学生列表和当前学生切换，家庭页显示“学生列表”和已绑定人数；单学生也展示继续绑定提示。
- 设计记录：老师/家长切换学生必须是轻量入口；单学生也要明确这是列表入口，避免误以为只有当前状态。
- 验证：已做前端脚本语法检查和云函数相关测试。

### 2026-07-01 词汇书本机计划

- 文件：`pages/reading/flashcards/index.wxml`
- 改动：词汇书入口文案改为首次下载到本机，进度显示为有进度数量。
- 设计记录：词汇书学习计划应表达本机缓存和云端进度分离，避免用户误解为每次从云存储建计划。
- 验证：已做前端脚本语法检查。

## 后续记录格式

每次 UI/交互改动后追加：

```md
### YYYY-MM-DD 模块名

- 文件：`path`
- 改动：一句话说明。
- 设计记录：本次新增或修正的视觉/交互规则。
- 验证：实际跑过的检查。
```
