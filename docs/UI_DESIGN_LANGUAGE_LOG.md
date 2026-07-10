# 小程序设计语言与改动记录

后续 UI/交互改动先读本文，再看 `PRODUCT_DESIGN_RULES.md`、`DESIGN_STYLE_REQUIREMENTS.md` 和 `UI_CHANGE_CHECKLIST.md`。

## UI 总纲规则

### 2026-07-09 Unlock2 课本/练习册拆分入口

- 改动：A2 级别新增 `Unlock 2 练习册` 独立入口，保留 `Unlock 2 课本` 原入口；练习册使用独立云存储音频目录和 transcript bundle。
- 设计记录：只增量增加素材入口，不改原 `Unlock 2 课本` 路径、数量和展示；练习册 Mid Term / End Term 按测试位置排序。

### 2026-07-09 Unlock1 课本/练习册拆分入口

- 改动：A1 级别新增 `Unlock 1 练习册` 独立入口，保留 `Unlock 1 课本` 原入口；练习册使用独立云存储音频目录和 transcript bundle。
- 设计记录：只增量增加素材入口，不改原 `Unlock 1 课本` 路径、数量和展示，避免影响线上旧用户；练习册 Mid Term / End Term 按测试位置排序。

### 2026-07-07 Unlock3 课本/练习册拆分入口

- 改动：B1 级别新增 `Unlock 3 课本` 独立入口，保留 `Unlock 3 练习册` 独立入口；课本和练习册分别使用独立云存储音频目录和 transcript bundle。
- 设计记录：课本/练习册拆分展示，避免不同素材混在一个入口里；练习册 Mid Term / End Term 继续按测试位置排序。

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

### 主题切换经验规则

- 当前主题命名为“雾蓝玻璃”，代码兼容沿用 `warm` key；后续新增主题必须在 `utils/theme.js` 注册主题 key、label 和导航色。
- “经典暖白”试验主题已取消，不再作为可选主题；旧设备保存的 `classic` 值统一回落到“雾蓝玻璃”。
- 主题不是只换颜色；主题代表一整套产品世界观。切换主题时，页面呈现和设计允许完全不同，包括布局结构、入口形式、图案语言、卡片形态、按钮样式、动效、信息密度和模块呈现方式。
- 后续主题系统必须支持 `themeId + pageSkin`：每个主题下，首页、听力、阅读、写作、口语、词汇、语法、成长、我的等页面都可以有各自专属皮肤和组件版本。
- 同一主题内页面不能做成同质化模板；每页要像同一世界观下的不同场景，例如听力用声波/音频轨道，阅读用纸张/文章排版，写作用稿纸/批注，成长用数据轨迹。
- 新主题必须优先通过 `theme-{{theme}}`、主题 wxss 文件和 CSS 变量覆盖颜色、材质、阴影、按钮、导航、图案语言；页面结构和业务数据不能为某个主题硬编码。
- 如果设计完全不同的主题，先写独立主题规范，再做一个入口页试点，确认首页、底部导航、一个学习入口、一个详情页都能切换后再扩散。
- 页面新增视觉样式时，禁止只写死颜色值；必须先判断它是主题 token、模块图案，还是该页面独有资产。
- 每次换肤验收至少检查：顶部导航、底部导航、主卡、入口卡、列表/抽屉、按钮、空状态、深浅文字对比。

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
- 首次登录昵称必填入口标题统一为“请设置昵称”，不使用“孩子昵称”。
- 保留品牌识别：`{{child.nickname || '同学'}}的英语小耳朵`。
- 新机首次登录的默认学生昵称使用“同学”，头像标志使用“学”，不再默认显示“佑佑/YY”。
- 老版本自动生成且仍为“佑佑/YY”的学生资料，在重新拉取家庭上下文时迁移为“同学/学”。
- 入口海报字体分类：理念标签用小号高亮，主宣言用大标题，解释句用中号加粗，独白正文用正文灰，分类标签用轻胶囊。
- Peppa / Unlock 1 / Songs 顺序固定。
- 今日任务卡固定显示听力主线状态：待完成 / 已完成。
- “继续学习”只进入今日任务表，不直接跳下一个听力。
- 不展示后台式计数，不做数据看板；模块卡只显示最必要的进度短句。
- 身份入口规则固定：每次进入首页且本次未选身份时先显示入口海报；海报第二页固定显示“我是家长 / 我是学生”，不根据缓存改成“进入首页”。
- 如果用户跳过或关闭海报，但本次没有点击身份，首页必须继续显示“我是家长 / 我是学生”身份卡。
- 首页身份卡只按本次进入首页是否已选择身份决定，不受海报缓存、旧身份缓存、运行态全局值或云端身份返回影响。
- 跳过海报后如果在首页身份卡选择了“我是家长 / 我是学生”，同样视为本次已选身份，不允许再跳回海报。
- 每一部手机默认都有自己的本机学号，可独立记录学习记录；这个本机学号是“我是学生”的默认账号。
- 选择“我是学生”必须切回本机学号，不允许继续沿用家长绑定或老师当前选中的学号。
- 学生模式下入口文案必须使用“登录其他学生账号 / 登录”；这是学生主动登录账号，不按老师/家长绑定目标处理。
- 学生登录其他学生账号只输入学号，不显示姓名/备注输入；学号是唯一识别号，登录后展示目标账号姓名。
- 家长/老师模式入口文案必须使用“绑定学生 / 绑定”，绑定目标用于跟踪，不覆盖本机学生默认 ID。
- 家长/老师模式的“绑定学生”列表只显示绑定目标，不混入本机 owner 学生账号；首次用户只能看到自己的本机学号。
- 家长/老师模式下所有练习都是查看或预览，不计入任何学生学习记录；绑定学生只用于跟踪查看，不允许因为选中绑定学生 target 而写入练习记录。
- 家长/老师模式可绑定多个学号，并在绑定学生列表中切换查看对象；切换只影响查看 target，不改变本机学生账号。
- 家长/老师模式的绑定学生列表必须给轻提示：已绑定学生点姓名即可切换查看记录，不需要重新输入 ID。
- “我的”和“家庭”页属于身份信息页，切换身份后必须实时拉取，不使用旧缓存展示学号、昵称或绑定学生。
- “我的”页只保留一个账号入口，文案为“家庭与账号”，不再同时展示“身份”和“家庭”两个跳往同页的入口。
- 家长/老师选择某个绑定学生后，首页、我的页和记录页展示的昵称、ID、记录都必须跟随当前选中的学生 target。
- 家长/老师查看记录时，记录页汇总、热力图、月历、日报和完成记录都必须使用当前选中的绑定学生 target；解绑不会删除该学生历史记录，再绑定后仍应看到原记录。
- 云端无目标学生参数时，必须优先选择本机 owner 家庭；绑定学生即使排在成员列表第一位，也不能作为默认学生身份。
- 点“我是学生”时如果当前微信没有本机 owner 学生家庭，云端必须新建一个本机学号，不能退回绑定学生。
- 海报内已选择身份后，本次进入首页不再二次选择；后续身份切换收敛到家庭页。

### A1-C2 课程页

- 职责：播放、三遍节奏、文本同步、文本学习包。
- 播放器是主角，技术链路默认隐藏。
- 每日任务听力先播放，音频听完即算该条任务完成；文本学习包是听后可选，不阻断播放。
- 学习包标签必须稳定在卡片内，不能挤压、溢出或变形。
- 同屏只保留一个主要进度表达。

### 考试听力页

- 职责：听力音频、题目练习、文本学习包。
- 有 transcript 的套卷先学文本学习包，再播放音频。
- 无 transcript 的套卷不强制锁音频。
- 答题区保持清晰，不和学习包抢主视觉。
- 今日听力任务是主线任务：未完成时首页显示“今日待完成”。
- 听力记录展开后要能看到任务、答题情况和分析。
- 从今日任务进入听力页必须先用任务快照渲染页面，并后台预取音频链接，不能把页面和播放都卡在云端请求上。
- 今日完成和阶段页里的已完成听力仍然可回看；缺音频字段的快照必须回源补完整任务。
- 从今日完成点“查看任务”进入课程页时，播放器音频预加载优先于学习包、口语记录和问题区加载。

### 阅读页

- 职责：阅读答题、提交、解析、学习包。
- 原文、答案句、生词、短语、句型的高亮入口要清楚。
- 学习包卡片不堆长解释，例句和中文解释分层显示。
- 阅读目录页标题要克制，区分“一模 / 二模 / 真题卷”的层级。
- 阅读记录展开后必须显示原文、全部题目、孩子答案、正确答案、逐题分析。
- 阅读页首屏直接展示阅读目录，不设置“今日阅读”任务层。
- 阅读页目录首屏只显示分组和题量；文章正文和全量完成状态不参与首屏请求。

### 语法页

- 职责：按阶段、模考、大类、细分考点练题。
- 顶部语法图案必须保证“主语 / 谓语 / 宾语”等核心结构文字不被装饰层遮挡。
- 目录层级清楚，题目页聚焦题干和解析。
- 不把考点列表做成报表。
- 语法列表以“考点分类”为主，不用大号粗字堆砌。
- 语法记录展开后必须显示原题、选项、孩子答案、正确答案和分析。
- 语法页首屏拉一模/二模目录和题量；题目正文和错题集必须按用户点击后再加载。

### 写作页

- 职责：作文题展示、提交、批改结果。
- 批改结果按内容、结构、语言、建议分块。
- 不用大量红色制造压力。
- 写作记录展开后必须显示作文题目、学生作文、批改、问题、建议和参考范文。
- 家长端也必须能看到作文题目和参考范文。

### 成长/记录页

- 职责：学习记录、连续/累计、热力图、历史回看。
- 进入成长页先显示本地快照/月历缓存，云端刷新后台补齐，不能用强制刷新挡住首屏。
- 成长页快照必须带当前学生目标标记；目标不一致或旧快照缺标记时不能用于首屏。
- 成长页顶部统计优先用云端 `dashboard.stats`；当 stats 为 0 但月历热力已有真实点亮时，只用热力图兜底天数和任务数，时长无来源时显示 0 分钟并输出链路 debug。
- 可以承载数据，但不能做控制台。
- 大数字只用于真正核心指标。
- 所有记录先摘要，点击后展开完整详情。
- 阅读、语法、写作、听力、口语都按同一逻辑：原始内容 + 学生作答 + 模型分析。
- 追赶任务只在用户点击追赶入口且确实可追赶时加载，不参与首屏请求。

### 家长页

- 职责：日报、孩子学习明细、必要管理入口。
- 避免指标堆叠，优先自然语言结论。
- 每页最多一个主动作。
- 家长模式不显示学生自己的学号入口。
- 家长可查看绑定孩子的全部完成内容和分析。
- 家长日报里的完成内容先显示摘要，点开后看详情。
- 家长入口选择后隐藏“我是家长 / 我是学生”切换卡。
- 老绑定用户如果缺少本人昵称或与孩子的关系，进入家庭页必须先补齐；保存后成员显示为“本人昵称 · 关系”。
- 家长页首屏只拉孩子信息、今日日报和最近 7 天日报摘要；90 天完成内容、当天阅读/语法/写作、原题/解析和录音临时链接都必须按需加载。
- 家长日报详情先展示听力/口语日报；阅读/语法/写作完成内容由用户点击后再拉，单条原题和分析继续在展开时补齐。

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

### 2026-07-10 首页今日听力真实时长

- 板块：首页
- 文件：`pages/home/index.js`、`utils/store.js`、`cloudfunctions/yoyo/services/dashboard.service.js`、`cloudfunctions/yoyo/services/shared.service.js`、`cloudfunctions/yoyo/lib/dashboard-engine.js`、`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：首页每次显示时强制刷新 dashboard；完成分钟改用云端当日日报 `totalMinutes`，目标分钟改用当日日报任务快照计算，不再读已打卡后的下一计划日。
- 设计记录：分母仍表示今日计划时长，分子表示已完成的真实音频时长，超额完成可显示大于目标值。
- 验证：本次提交基线云函数 74 项测试全部通过，JS 语法和 diff 检查通过；线上 317613 当日日报实测目标与完成均为 31 分钟。

### 2026-07-10 首页学习报告真实统计恢复

- 板块：首页
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`cloudfunctions/yoyo/services/dashboard.service.js`
- 改动：首页 home dashboard 恢复返回真实 stats；学习报告区补回完成任务数，并继续展示连续学习和累计时长。
- 改动：首页学习报告的累计时长文案改为“累计听力时长”。
- 改动：按最新首页要求移除底部学习报告指标整块区域。
- 设计记录：首页首屏只保留今日听力和学习入口，不再放底部学习报告指标区。
- 验证：已做首页 JS 语法检查、dashboard service JS 语法检查、family identity 测试和 diff 空白检查。

### 2026-07-10 成长页绑定学生统计刷新

- 板块：成长
- 文件：`pages/record/index.js`
- 文件：`pages/record/index.wxml`
- 文件：`pages/record/index.wxss`
- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/dashboard.service.js`
- 文件：`cloudfunctions/yoyo/lib/dashboard-engine.js`
- 改动：成长页增加 dashboard、月历热力和前端合并链路 debug，记录客户端耗时、云端 dashboard 分段耗时、目标学号和关键返回字段。
- 改动：成长页 dashboard 强制刷新；全局 dashboard 缓存有效期从 7 天收敛到记录页缓存时长，避免绑定学号后继续显示旧的 0 统计。
- 改动：累计时长不再显示“待同步”；调试期成长页强制展示 debug，便于真机直接复制链路。
- 改动：云端统计兼容老记录，`playCount >= repeatTarget` 即按完成记录参与累计时长计算。
- 改动：成长页 `getDashboard(view=record)` 改为 stats-only 轻量链路，跳过计划和任务生成；前端 dashboard/monthHeatmap 超时放宽到 30 秒，避免 12 秒默认 0 覆盖真实数据。
- 改动：累计时长统计按分类预建任务时长索引，避免每条记录反复扫描 catalog；调试区恢复为仅 debug 开关显示。
- 设计记录：累计时长异常先定位真实云端返回和当前 target 是否一致；修复确认后撤掉页面 debug。
- 设计记录：成长页核心指标必须跟随当前绑定学号实时更新，不能用旧缓存制造“本地状态”的误导。
- 验证：已做记录页脚本语法检查、store 脚本语法检查和 diff 空白检查。

### 2026-07-10 词汇书库封面雾蓝化

- 板块：词汇
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：初中词汇书标题改为“初中英语词汇 乱序”，并在云端/缓存返回旧标题时仍强制统一；“我的词库 / 初中英语词汇 / 高中英语词汇”三张封面和顶部书架图形改为雾蓝玻璃低饱和样式。
- 设计记录：词汇书图片必须服务于雾蓝玻璃科技感主题，三张封面可有层级差异，但不能是偏粉、厚重或普通实体书封面感。
- 验证：已做词汇页脚本语法检查、旧标题扫描和 diff 空白检查。

### 2026-07-10 主题切换入口规则

- 板块：全局主题
- 文件：`utils/theme.js`
- 文件：`docs/UI_DESIGN_LANGUAGE_LOG.md`
- 文件：`docs/FOG_BLUE_TECH_DESIGN_SPEC.md`
- 改动：当前主题显示名改为“雾蓝玻璃”；补充后续新增完全不同主题时的入口、规范、token 和验收规则。
- 设计记录：以后换肤必须先注册主题入口，再通过主题类和变量扩散，不能在页面里散落硬编码色彩。
- 验证：已做 theme 脚本语法检查和 diff 空白检查。

### 2026-07-10 取消经典暖白试验主题

- 板块：全局主题
- 文件：`utils/theme.js`
- 文件：`styles/theme-current.wxss`
- 文件：`custom-tab-bar/index.wxss`
- 文件：`pages/profile/index.wxss`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.js`
- 改动：移除“经典暖白”主题入口、窗口色、导航和页面样式覆盖；当前只保留“雾蓝玻璃”，我的页不再显示单选主题入口。
- 设计记录：保留主题注册、页面主题类和 slider token 框架，后续可以接入页面结构完全不同的新主题。
- 验证：旧设备保存的 `classic` 会经主题规范化自动回落到 `warm`。

### 2026-07-10 第二主题图书馆静谧设计启动

- 板块：全局主题
- 文件：`docs/LIBRARY_THEME_DESIGN_SPEC.md`
- 改动：新增第二套可切换主题 `library / 图书馆静谧` 的完整设计规范、页面归属和逐页交付要求。
- 设计记录：新主题使用 `themeId + pageSkin`，允许每页独立布局和图案，但业务数据、路由、状态与性能规则必须复用。
- 设计记录：雾蓝玻璃继续作为默认主题；图书馆静谧所有页面完成并验收后，才恢复主题切换入口。
- 验证：已覆盖听力、阅读、语法、词汇、写作、口语、音频、成长、我的九个模块及其真实页面。

### 2026-07-10 图书馆静谧九模块设计完成

- 板块：第二主题全站设计
- 文件：`docs/design/library-theme/`
- 改动：完成首页基准图、九个模块逐页规范、九张多屏视觉板和统一实施顺序。
- 设计记录：第二主题切换必须同时改变页面结构、入口形式、图案、材质、状态呈现和信息层级；禁止只替换颜色或继续复用雾蓝玻璃卡片骨架。
- 设计记录：每个模块保持独立母题，所有请求、数据、状态、缓存、路由和性能链路继续复用现有实现。
- 验证：九个模块均覆盖真实页面及加载、空、正常、完成、错误状态；设计文件位于已排除上传的 `docs` 目录。

### 2026-07-10 图书馆静谧主题运行时接入

- 板块：全局主题与导航
- 文件：`utils/theme.js`
- 文件：`styles/theme-current.wxss`
- 文件：`styles/themes/library.wxss`
- 文件：`custom-tab-bar/index.wxss`
- 改动：注册 `library / 图书馆静谧` 第二主题，新增独立 token、窗口色与书脊式底部导航。
- 设计记录：主题 token 只挂载在 `.theme-library`，不得写到全局 `page` 选择器，确保雾蓝玻璃不被新主题覆盖。
- 验证：主题切换契约、全页 JS 语法和微信开发者工具编译通过。

### 2026-07-10 图书馆静谧首页与听力

- 板块：首页、听力
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-material/index.wxml`
- 改动：新增书房扉页、羊皮纸今日听力、声音书签目录、黄铜时间轴、范围尺和墨蓝练习台。
- 设计记录：`library` 使用独立 WXML 分支；原雾蓝玻璃结构与听力数据、计划、答题、播放链路不变。
- 验证：相关 JS 语法检查与开发者工具编译通过。

### 2026-07-10 图书馆静谧首页基准图对齐

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/home/index.js`
- 文件：`assets/library/home-library-study.png`
- 文件：`assets/library/library-reading-lamp-cropped.png`
- 文件：`assets/library/library-open-book.png`
- 改动：图书馆首页改为深书房背景、羊皮纸主卡、右侧三段时间轴、圆形目标进度、3×2 学习入口和深色书脊导航。
- 改动：新增深书房实景背景、透明黄铜台灯、木质桌面和翻开的书本前景素材；桌面与书本位于主卡前方，建立桌面在前、学习卡在后、书架在远处的层次。
- 设计记录：首页必须以已确认的图书馆首页基准图为构图来源，禁止退化为浅色列表页；今日目标和入口继续绑定现有真实字段与跳转。
- 验证：首页 JS 语法、diff 空白检查，以及微信开发者工具中 `library` 实际页面分支加载通过。

### 2026-07-10 图书馆静谧阅读、语法与词汇

- 板块：阅读、语法、词汇
- 文件：`pages/reading/index.wxml`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/reading/flashcards/index.wxml`
- 改动：新增馆藏目录与跨栏文章纸、句法字模与校样解析、书脊词库与索引抽屉。
- 设计记录：阅读保留原文、答案、解析和学习包；语法主谓宾文字优先于装饰；词卡操作区保持稳定高度。
- 验证：相关 JS 语法检查与开发者工具编译通过。

### 2026-07-10 图书馆静谧写作与口语

- 板块：写作、口语
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/speaking/index.wxml`
- 改动：新增档案柜稿件入口、题目纸/稿纸/批改回函，以及阅览室录音台、麦克风、回放槽与结果页。
- 设计记录：批改、录音、评分、权限失败和空状态均沿用既有真实字段与操作，不用伪数据补齐视觉。
- 验证：相关 JS 语法检查与开发者工具编译通过。

### 2026-07-10 图书馆静谧音频与成长

- 板块：音频、成长
- 文件：`pages/level/index.wxml`
- 文件：`pages/level-stage/index.wxml`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/record/index.wxml`
- 文件：`pages/home/completed/index.wxml`
- 改动：新增唱片目录、章节索引册、桌面唱机、借阅记录册、日期索引和今日归还单。
- 设计记录：播放器、学习包、累计时长、热力图、快照优先与按需加载均复用既有链路；成长页不使用圆环仪表盘。
- 验证：相关 JS 语法检查与开发者工具编译通过。

### 2026-07-10 图书馆静谧我的与主题切换

- 板块：我的、身份、家庭、日报、管理
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.js`
- 文件：`pages/identity/index.wxml`
- 文件：`pages/family/index.wxml`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`pages/admin/index.wxml`
- 改动：新增读者证、藏书票、家庭档案夹、日报信笺和管理员台账；“我的”页在两套主题下都可切换“雾蓝玻璃 / 图书馆静谧”。
- 设计记录：切换仅更新本地主题偏好和页面主题数据，不能影响身份、绑定关系、缓存目标或业务数据。
- 验证：`profile` JS 语法检查、主题切换契约和开发者工具编译通过。

### 2026-07-09 首页雾蓝科技感定稿

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.json`
- 文件：`custom-tab-bar/index.wxml`
- 文件：`custom-tab-bar/index.wxss`
- 文件：`custom-tab-bar/index.js`
- 改动：首页按用户确认参考图重做：顶部品牌标题、日期行、今日听力玻璃主卡、悬浮字幕、声波、六个学习入口、底部学习报告区。
- 改动：首页标题改为按时间问候；六个入口移除说明文字和进度条；底部导航改为雾蓝玻璃容器与 CSS 图标。
- 改动：首页目标分钟、目标圆环、连续学习、累计学习时长改为 dashboard 真实数据；顶部/底部导航颜色统一到雾蓝白。
- 设计记录：方向从“实验室”改为雾蓝科技感；保留晨光、玻璃、声波、低饱和珊瑚按钮和高级亲子教育气质，不再使用列表式入口。
- 验证：已做首页 JS 语法检查与文案扫描。

### 2026-07-10 雾蓝科技感全入口规范与模块改造

- 板块：全局设计规范
- 文件：`docs/FOG_BLUE_TECH_DESIGN_SPEC.md`
- 改动：新增当前项目视觉规范，明确雾蓝晨光玻璃、珍珠白、低饱和珊瑚、真实数据、禁用实验室/米色/后台列表等规则。
- 设计记录：后续所有入口后页面必须和首页匹配，不再各自发散。
- 验证：已做文档检查。

- 板块：听力、音频入口
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/index.wxss`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 文件：`pages/level/index.wxss`
- 文件：`pages/level-stage/index.wxss`
- 文件：`pages/listening-material/index.wxml`
- 文件：`pages/listening-material/index.wxss`
- 文件：`pages/listening-plan/index.wxss`
- 改动：听力目录、素材、课程播放、音频入口、阶段、计划页统一为雾蓝晨光玻璃体系，去除旧米色/棕色按钮和普通列表感。
- 设计记录：课程页以播放器、声波、文本学习为主角；音频入口像内容库，不像资料表。
- 验证：已做相关 JS 语法检查、文案扫描和 diff 检查。

- 板块：阅读、语法、写作、口语、词汇
- 文件：`pages/reading/index.wxml`
- 文件：`pages/reading/index.wxss`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/speaking/index.wxml`
- 文件：`pages/speaking/index.wxss`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：各学习模块按首页风格重做真实页面视觉：阅读纸感原文、语法轻诊断、写作工作台、口语声音练习、词汇高级卡片库。
- 设计记录：保留各自学习动作差异，但色彩、材质、按钮、留白统一到首页。
- 验证：各模块 worker 已完成 JS 语法、文案扫描和 diff 检查；总控复查通过。

### 2026-07-10 各模块内容呈现与图案语言二次深化

- 板块：全局设计规范
- 文件：`docs/FOG_BLUE_TECH_DESIGN_SPEC.md`
- 改动：补充“内容呈现模式”和“模块图案语言”，明确每个板块不能只是列表，也不能复用同一种圆弧/竖条图案。
- 设计记录：统一风格不等于同质化；听力用声波/字幕，音频用频道/轨道，阅读用纸页/定位线，语法用考点树/矩阵，写作用纸张/笔迹，口语用声圈/仪表，词汇用书库/卡栈。
- 验证：已做文档检查。

- 板块：听力、音频、阅读、语法、写作、口语、词汇
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/index.wxss`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 文件：`pages/level/index.wxml`
- 文件：`pages/level/index.wxss`
- 文件：`pages/level-stage/index.wxml`
- 文件：`pages/level-stage/index.wxss`
- 文件：`pages/listening-material/index.wxml`
- 文件：`pages/listening-material/index.wxss`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-plan/index.wxss`
- 文件：`pages/reading/index.wxml`
- 文件：`pages/reading/index.wxss`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/speaking/index.wxml`
- 文件：`pages/speaking/index.wxss`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：二次深化各模块真实内容呈现方式，减少普通列表；补入模块专属图案和结构。
- 设计记录：各模块仍匹配首页雾蓝晨光体系，但内容形态按学习动作区分。
- 验证：已做 JS/JSON、文案扫描和 diff 检查。

### 2026-07-10 成长我的广告页与全局色彩收口

- 板块：成长、今日完成
- 文件：`pages/record/index.wxml`
- 文件：`pages/record/index.wxss`
- 文件：`pages/home/completed/index.wxml`
- 文件：`pages/home/completed/index.wxss`
- 改动：成长页改为雾蓝晨光玻璃风格，加入日历热力、学习轨迹、累计数据、报告卡；今日完成页改为同色系完成面板与横向成果卡组。
- 设计记录：成长页承载数据但不做后台报表，使用轨迹和日历表达。
- 验证：worker 已做 WXML/WXSS/JS/JSON/diff 检查。

- 板块：我的、家庭
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.wxss`
- 文件：`pages/family/index.wxml`
- 文件：`pages/family/index.wxss`
- 改动：我的页改成个人学习身份页；家庭页改成账号关系面板。
- 设计记录：账号管理也要匹配首页雾蓝玻璃体系，不使用后台列表样式。
- 验证：worker 已做 WXML/WXSS/绑定/diff 检查。

- 板块：首页广告页、全局主题、写作入口
- 文件：`pages/home/index.wxss`
- 文件：`utils/theme.js`
- 文件：`styles/themes/warm.wxss`
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/index.wxss`
- 改动：入口海报两页颜色统一到雾蓝晨光；顶部导航和主题变量去米色；写作入口的通用声波竖条改为纸张/笔迹图案。
- 设计记录：全局背景、导航、广告页、入口图案必须和首页一致；写作不能复用听力声波图案。
- 验证：已做 JS 检查、旧色扫描和 diff 检查。

### 2026-07-09 全局高级感第一批视觉收口

- 板块：首页、写作页、全局主题、底部导航
- 文件：`styles/theme-current.wxss`
- 文件：`styles/themes/warm.wxss`
- 文件：`styles/README.md`
- 文件：`app.json`
- 文件：`custom-tab-bar/index.wxss`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 改动：全局主题入口只保留 warm；补齐 `--radius-pill`；导航栏/底栏、首页海报、首页模块卡、写作页颜色/字号改用主题 token；首页六宫格从 emoji 改为安静文字标识。
- 设计记录：先统一视觉变量来源，降低儿童化装饰和硬编码色值，保持亲子英语产品的暖白、克制、可信气质。
- 验证：已做样式文本检查。

### 2026-07-09 家长侧减压与文案收口

- 板块：家长页、我的页、家庭页
- 文件：`pages/parent/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/family/index.wxml`
- 改动：家长页新增今日自然语言结论卡，分项指标降为二级；`ID`、`后台`、`清误`、`解绑` 等后台感文案改为学号、管理、修正今日记录、解除绑定。
- 设计记录：家长首屏先给可读结论，再给分项数据，减少成绩单和控制台感。
- 验证：已做 `node --check pages/parent/index.js`。

### 2026-07-09 灵动活泼配色重设

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：主色从低饱和棕色改为珊瑚橙，补入湖绿、晴蓝、柠檬黄、柔紫等功能色；首页六宫格使用分区渐变卡；写作页和家长页主卡改为轻彩色渐变。
- 设计记录：保留暖白底和克制留白，但让学习模块更活泼、可识别，避免上一版过于平淡。
- 验证：已做配置与 JS 检查。

### 2026-07-09 高级质感精修

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：彩色体系降饱和，改为矿物色；功能卡去掉大色球装饰，使用细高光、白边、叠层柔影；写作/家长卡片改为更细腻的材质渐变。
- 设计记录：保留灵动，但从糖果色转为低饱和、有纸感和玻璃感的高级视觉。
- 验证：已做配置与 JS 检查。

### 2026-07-09 Apple SpaceX 方向层次重做

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：全局改为陶瓷白、石墨黑、电光蓝体系；首页今日任务、写作题目、家长日报 hero 改为深色主卡；功能卡从彩色底改为白色金属质感卡 + 细色条。
- 设计记录：用黑白材质、细边、局部高亮建立 Apple/SpaceX 式层次，色彩只用于导航和状态识别。
- 验证：已做配置与 JS 检查。

### 2026-07-09 明亮灵动配色回调

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：去掉黑色主卡，改为清透彩色渐变；全局改为浅绿白底、珊瑚橙、青绿、晴蓝、阳光黄、柔紫组合。
- 设计记录：避免黑白冷感和丧葬联想，保留层次边框与阴影，同时恢复亲子学习产品的灵动活泼。
- 验证：已做配置与 JS 检查。

### 2026-07-09 低饱和灵动配色

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：降低明度和饱和度，改为雾蓝、鼠尾草绿、杏桃、淡金、灰紫；保留彩色层次但不刺眼。
- 设计记录：介于黑白冷感和高亮糖果色之间，保持亲子学习的温和活力。
- 验证：已做配置与 JS 检查。

### 2026-07-09 渐变克制与明度下调

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：整体明度继续下调；普通模块卡从明显渐变改为雾面单色，渐变只保留在今日任务、写作题目、家长日报等主卡。
- 设计记录：保留局部渐变层次，但避免全屏过亮、过花。
- 验证：已做配置与 JS 检查。

### 2026-07-09 首页入口去卡片化与图标重绘

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：首页六个学习入口从独立卡片堆叠改为一个整体入口面板；中文圆标替换为 CSS 线性图标；模块识别改为细色条和线性图标色。
- 设计记录：减少幼稚感和卡片感，用更轻的入口密度和更成熟的图标语言承载高级灵动。
- 验证：已做样式文本检查。

### 2026-07-09 首页入口退回上一版

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：撤回整体入口面板和 CSS 线性图标，恢复上一版独立模块入口卡片与文字标识。
- 设计记录：当前线稿图标方向观感不佳，先退回稳定版本。
- 验证：已做样式文本检查。

### 2026-07-09 整体色彩沉稳微调

- 板块：首页、写作页、家长页、全局主题
- 文件：`styles/themes/warm.wxss`
- 文件：`app.json`
- 文件：`utils/theme.js`
- 文件：`pages/home/index.wxss`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/parent/index.wxss`
- 改动：整体背景、模块色和主卡渐变继续降明度、降饱和；保留雾蓝、鼠尾草绿、陶土杏桃、淡金、灰紫的轻微灵动。
- 设计记录：在不改变入口结构的前提下，让界面更沉稳、更高级。
- 验证：已做配置与 JS 检查。

### 2026-07-09 首页轻入口列表改造

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：首页学习入口从六宫格卡片改为一个轻入口列表容器；每行保留小色块、标题、副信息和箭头。
- 设计记录：减少卡片堆叠和儿童感，入口更接近成熟学习产品的信息列表。
- 验证：已做配置与 JS 检查。

### 2026-07-09 写作批改 target 与短文提交修复

- 板块：写作页
- 文件：`utils/store.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxss`
- 改动：`gradeWritingAttempt` 补带当前学生 target；允许少于 `minWords` 的短文提交，由批改模型按题目规则扣分；批改失败时在页面写出提交/批改链路 debug。
- 设计记录：写作结果未返回前不播放完成音和旁白；短文不前端拦截，交给批改结果解释得分。
- 验证：已做 `node --check utils/store.js`、`node --check pages/writing/detail/index.js`。

### 2026-07-09 阅读写作英文旁白接入

- 板块：阅读页、写作页
- 文件：`assets/audio/voice/reading-complete-nice-reading.mp3`
- 文件：`assets/audio/voice/writing-complete-nice-writing.mp3`
- 文件：`assets/audio/voice/tests/reading-complete-nice-reading.wav`
- 文件：`assets/audio/voice/tests/reading-complete-nice-reading.mp3`
- 文件：`assets/audio/voice/tests/writing-complete-nice-writing.wav`
- 文件：`assets/audio/voice/tests/writing-complete-nice-writing.mp3`
- 文件：`utils/effects.js`
- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/reading/detail/index.wxss`
- 文件：`pages/writing/detail/index.js`
- 文件：`docs/SOUND_EFFECTS_GUIDELINES.md`
- 改动：新增 `Nice reading.`、`Nice writing.` 两条英文奖励旁白；阅读解析完成加入结果卡扫光动效和旁白，写作批改完成旁白从纯音效升级为 `Nice writing.`。
- 设计记录：阅读/写作只在整体结果首次出现时奖励，不按题目对错或分数高低播放旁白。
- 验证：已做 `node --check utils/effects.js`、`node --check pages/reading/detail/index.js`、`node --check pages/writing/detail/index.js`。

### 2026-07-09 英文奖励旁白页面接入

- 板块：全局音效
- 文件：`utils/effects.js`
- 文件：`assets/audio/voice/flashcard-complete-great-work.mp3`
- 文件：`assets/audio/voice/listening-complete-great-listening.mp3`
- 文件：`assets/audio/voice/streak-milestone-you-did-it.mp3`
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/record/index.js`
- 文件：`docs/SOUND_EFFECTS_GUIDELINES.md`
- 改动：把 3 条测试英文旁白提升为正式素材，并接入词汇完成、听力完成、连续打卡里程碑。
- 设计记录：旁白延迟约 0.45 秒播放，避开完成音效主峰；仍不用于写作、口语、普通按钮和主音频播放中。
- 验证：已做 `node --check utils/effects.js`、`node --check pages/reading/flashcards/index.js`、`node --check pages/lesson/index.js`、`node --check pages/record/index.js`。

### 2026-07-09 英文奖励旁白测试音色

- 板块：全局音效
- 文件：`assets/audio/voice/tests/flashcard-complete-great-work.wav`
- 文件：`assets/audio/voice/tests/flashcard-complete-great-work.mp3`
- 文件：`assets/audio/voice/tests/listening-complete-great-listening.wav`
- 文件：`assets/audio/voice/tests/listening-complete-great-listening.mp3`
- 文件：`assets/audio/voice/tests/streak-milestone-you-did-it.wav`
- 文件：`assets/audio/voice/tests/streak-milestone-you-did-it.mp3`
- 文件：`docs/SOUND_EFFECTS_GUIDELINES.md`
- 改动：用本地 Chatterbox 生成 3 条英文奖励旁白测试音色，并转出 MP3 测试版。
- 设计记录：旁白仅用于完成奖励测试，不替代课程原音、单词发音、录音或口语回放。
- 验证：已用 `ffprobe` 检查时长，3 条均为约 1 秒。

### 2026-07-09 全项目完成态特效第一版

- 板块：全局交互
- 文件：`utils/effects.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/writing/detail/index.wxml`
- 文件：`pages/writing/detail/index.wxss`
- 文件：`pages/speaking/index.js`
- 文件：`pages/speaking/index.wxml`
- 文件：`pages/speaking/index.wxss`
- 文件：`pages/record/index.js`
- 文件：`pages/record/index.wxml`
- 文件：`pages/record/index.wxss`
- 改动：新增统一完成音效工具，并在听力完成、写作批改完成、口语评分完成、连续打卡里程碑加入克制动效和一次性完成音。
- 设计记录：只在结果首次出现或里程碑触发，不进入普通按钮、答题过程、录音中或音频播放中。
- 验证：已做 `node --check utils/effects.js`、`node --check pages/lesson/index.js`、`node --check pages/writing/detail/index.js`、`node --check pages/speaking/index.js`、`node --check pages/record/index.js`。

### 2026-07-09 全项目特效音效设计地图

- 板块：全局设计规范
- 文件：`docs/SOUND_EFFECTS_GUIDELINES.md`
- 文件：`assets/README.md`
- 文件：`assets/audio/voice/.gitkeep`
- 改动：补充全项目可用特效/音效场景，新增英文原音短旁白使用边界和素材目录约定。
- 设计记录：特效只服务完成、里程碑和结果出现；英文旁白只做短奖励/引导，不覆盖课程原音、发音、录音和口语回放。
- 验证：文档规范改动，无运行检查。

### 2026-07-09 词汇完成音效接入

- 板块：词汇板块
- 文件：`assets/audio/sfx/flashcard-complete-chime.mp3`
- 文件：`pages/reading/flashcards/index.js`
- 改动：下载 Mixkit `Achievement bell` 作为词汇完成音效，完成礼花页出现时播放一次。
- 设计记录：完成音效只在本轮复习结束时触发，尊重系统静音，不覆盖词卡发音播放。
- 验证：已做 `node --check pages/reading/flashcards/index.js`，并检查音频文件类型。

### 2026-07-09 完成音效工具规范

- 板块：全局设计规范
- 文件：`docs/SOUND_EFFECTS_GUIDELINES.md`
- 文件：`docs/DESIGN_STYLE_REQUIREMENTS.md`
- 文件：`assets/README.md`
- 文件：`assets/audio/sfx/.gitkeep`
- 改动：新增 ElevenLabs Sound Effects 作为完成/奖励音效首选工具，并规定生成时长、风格、存放路径和接入规则。
- 设计记录：音效只用于明确完成奖励，不进入普通按钮反馈；完成音效要轻、短、可被操作打断。
- 验证：文档规范改动，无运行检查。

### 2026-07-09 词汇复习完成礼花页

- 板块：词汇板块
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：本轮最后一张词卡完成后显示完成页，含礼花彩带、放射欢呼动效和“返回词库”按钮；有复习回队列时等最后一次完成再出现。
- 设计记录：结束态必须给明确奖励和返回路径，不再停留在“今天没有复习”的空态。
- 验证：已做 `node --check pages/reading/flashcards/index.js`。

### 2026-07-09 词汇进度条持续流光

- 板块：词汇板块
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：词汇首页进度条改为底轨微呼吸、填充流光和右端光点持续动效。
- 设计记录：进度反馈要更明确但不干扰背诵主按钮，动效只作用在条形进度本身。
- 验证：已检查相关样式 diff。

### 2026-07-09 学习包加入词库 target debug

- 板块：词汇板块
- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/reading/flashcards/index.js`
- 改动：学习包加入词库成功后写入按当前 target 隔离的本地待同步卡片并刷新我的词库展示；成功不显示 debug，失败才显示写入链路；我的词库为空时显示空库链路断点，不再显示演示词。
- 设计记录：加入成功后本机必须立刻可见且不能串孩子，云端全量词库刷新可随后同步，空真实库不能用演示数据混淆。
- 验证：已做相关 JS 语法检查。

### 2026-07-09 学习包加入词库真实成功校验

- 板块：词汇板块
- 文件：`utils/store.js`
- 文件：`pages/reading/flashcards/index.js`
- 改动：学习包/词典加入词库必须确认云端返回 `saved=true` 才显示成功；成功后刷新词汇页来源缓存版本。
- 设计记录：加入按钮不能用本地乐观状态代替云端写入结果，我的词库进入后应看到最新加入内容。
- 验证：已做相关 JS 语法检查。

### 2026-07-09 词汇书入口云存储读取修复

- 板块：词汇板块
- 文件：`pages/reading/flashcards/index.js`
- 改动：词汇书入口不再由小程序端直连云存储 HTTPS JSON，改为通过 `store.getDictionaryBook` 读取并渲染；成功时隐藏技术 debug。
- 设计记录：词汇书入口必须稳定进入学习计划，不向正式用户展示云存储域名链路。
- 验证：已做 `node --check pages/reading/flashcards/index.js`。

### 2026-07-09 成长记录日期摘要同步

- 板块：成长/记录页
- 文件：`pages/record/index.js`
- 改动：日期卡片未点“查看”前，先用月历 heatmap 同步显示当天“已完成/未完成”状态；点“查看”后仍按需加载完整日报明细。
- 设计记录：记录页先给可信摘要，完整内容继续延后加载；家长查看绑定学生时，底部日期状态必须和上方点亮日期一致。
- 验证：已做 `node --check pages/record/index.js`。

### 2026-07-09 课程页录音隐私授权弹层

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 改动：录音隐私拦截时改为页内弹层，提供微信 `agreePrivacyAuthorization` 同意按钮；同意后自动继续启动录音。
- 设计记录：录音授权必须给可完成动作，不能只打开隐私指引；弹层保持单一主动作“同意并开始”。
- 验证：已做 `node --check pages/lesson/index.js`。

### 2026-07-07 新概念系统麦克风授权入口

- 文件：`app.json`
- 文件：`pages/lesson/index.js`
- 文件：`docs/PRIVACY_AND_REVIEW.md`
- 改动：开启小程序隐私校验；录音入口先走微信隐私接口授权，通过后暂停课程音频并启动录音；`privacy api banned` 不再展示技术 debug，改为普通授权提示；隐私合规文档补充麦克风录音用途。
- 设计记录：`operateRecorder:fail appid privacy api banned` 属于微信隐私接口拦截，不是模型评分问题；学生正常录音入口只给可理解的授权提示，不暴露链路日志。
- 验证：已做脚本语法检查。

### 2026-07-06 首页身份与材料入口首动作快照

- 文件：`pages/home/index.js`
- 文件：`pages/level/index.js`
- 文件：`pages/record/index.js`
- 文件：`pages/profile/index.js`
- 文件：`pages/material/index.js`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/reading/index.js`
- 文件：`pages/grammar/index.js`
- 文件：`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：首页 dashboard 按目标学生写入快照，选择身份后先显示对应学生今日任务快照再后台刷新；听力套卷点击不再等待完整题目，先用列表音频字段进入详情并后台补完整套卷。
- 补充：材料入口有快照时不再先渲染空配置；阅读/语法入口保留快照首屏，避免慢刷新或空结果造成列表闪烁。
- 补充：底部导航音频页不再因无当前等级快照先清空素材；成长/记录页写入首屏快照并先显示；我的页先显示资料快照再刷新。
- 补充：材料目录恢复 `getMaterialIndex` 读缓存；音频 tab 进入先展示 A1 真实列表字段并预取其他 level；我的页快照只追加云端 `getAdminStatus.isAdmin` 权限字段。
- 补充：写作入口隐藏未识别模块首帧；记录页和我的-日报只首显摘要，点击查看后加载真实明细。
- 设计记录：首页身份切换的首动作是看到对应学生今日任务；材料听力详情的首动作是播放音频，题目、图片、学习包属于后续补齐。
- 验证：已做相关页面脚本语法检查。

### 2026-07-06 全局轻柔按压反馈

- 文件：`styles/base.wxss`
- 文件：`pages/home/completed/index.wxss`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`pages/lesson/index.wxss`
- 文件：`pages/reading/detail/index.wxss`
- 改动：全局按钮、列表行、卡片、轻按钮统一使用更浅的 `translateY(1rpx) scale(0.992)` 按压反馈，过渡改为 0.22s；移除今日完成卡片骤暗 `opacity: 0.72`；播放器 hover 停留时间调到 180ms。
- 设计记录：点击反馈要像真实按键，轻微下沉、柔和回弹，不用快速闪烁或强烈变暗。
- 验证：已做样式 diff 检查。

### 2026-07-06 写作入口与音频素材快照收紧

- 文件：`utils/store.js`
- 文件：`pages/material/index.js`
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/listening-material/index.js`
- 文件：`pages/parent/index.js`
- 文件：`cloudfunctions/yoyo/services/catalog.service.js`
- 文件：`cloudfunctions/yoyo/services/report.service.js`
- 文件：`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：开放同步读取 store 真实缓存；写作/材料入口先同步读 `getMaterialIndex` 缓存；音频分级素材详情恢复 `getListeningMaterialDetail` 缓存首显，并在进入课程前校验云端音频字段。
- 补充：材料入口禁止空目录覆盖已有快照；日报摘要模式返回模块统计，模块分析不依赖完整日报明细。
- 补充：听力套卷列表点击兼容 `_id/id`，目录瘦身保留全部音频字段，详情页用 `audioCloudPath/audioFileId/audioUrl` 兜底预备播放器。
- 设计记录：列表首屏不能等 Promise 微任务；素材进入播放器前必须有云端真实音频字段，不能靠前端猜。
- 验证：已做页面脚本语法检查。

### 2026-07-06 全局首动作快照性能规则

- 文件：`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：新增全局快照字段规则：跨页快照必须覆盖下一个页面首个可操作动作的字段；加载顺序按用户操作顺序排，首动作先可用，次级内容后台或按需加载。
- 设计记录：性能优化不按接口顺序排，而按用户下一步动作排；快照只承接云端真实字段，不能由前端临时猜数据。
- 验证：文档规则更新。

### 2026-07-06 今日完成 Unlock 快照音频字段

- 文件：`cloudfunctions/yoyo/lib/dashboard-engine.js`
- 文件：`cloudfunctions/yoyo/tests/dashboard-engine.test.js`
- 文件：`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：首页 `home view` 的任务分组保留云端返回的 `audioUrl/audioCloudPath/audioFileId/audioSource`，今日完成缓存里的 Unlock 任务不再丢播放字段。
- 设计记录：快照只能承接云端真实字段；为控制首页体积，只剥离 transcript、reward 等大字段，不能剥离播放器必需字段。
- 验证：已做 dashboard、request-context、catalog、report 测试。

### 2026-07-06 听力回看云端音频字段

- 文件：`cloudfunctions/yoyo/lib/report-engine.js`
- 文件：`cloudfunctions/yoyo/services/completion.service.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/parent/detail/index.js`
- 文件：`pages/record/index.js`
- 文件：`docs/PAGE_LOADING_QUALITY_STANDARD.md`
- 改动：日报、完成记录、家长详情和记录追赶入口保留云端任务快照里的 `audioUrl/audioCloudPath/audioFileId/audioSource`，回看 Unlock 时先用云端快照渲染播放器。
- 设计记录：听力回看不能只保存标题和完成状态；播放器可用性优先于学习包、口语记录和完成明细。
- 验证：已用 SDK 查线上 Unlock 云存储和云函数返回字段；已做页面/云函数脚本语法检查，并通过 request-context、catalog、report 测试。

### 2026-07-06 今日完成查看任务播放器优先

- 文件：`pages/home/completed/index.js`
- 文件：`pages/lesson/index.js`
- 改动：今日完成点“查看任务”时带上进入时间；课程页先加载播放器音频，学习包、口语记录和问题区后台加载；控制台输出从点击到播放的 `lesson-route` 性能点。
- 设计记录：课程页首屏以播放器可用为先，附属学习模块不能阻塞音频。
- 验证：已做页面脚本语法检查，并通过 request-context 与 catalog 测试。

### 2026-07-06 音频页等级切换快照

- 文件：`pages/level/index.js`
- 文件：`pages/listening-plan/index.js`
- 文件：`pages/listening-material/index.js`
- 文件：`pages/level-stage/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/listening-plan.service.js`
- 文件：`cloudfunctions/yoyo/services/task.service.js`
- 文件：`cloudfunctions/yoyo/lib/request-context-engine.js`
- 文件：`cloudfunctions/yoyo/lib/catalog-engine.js`
- 文件：`cloudfunctions/yoyo/lib/listening-plan-engine.js`
- 改动：音频页、阶段页、课程详情页读取本地快照先渲染；继续学习进入阶段页默认展开全部分组，每条任务整行可点，且首页快照直开时不再二次请求云端；云端 `getListeningPlanOverview/getLevelOverview` 改为不首屏扫描素材目录；课程详情带 task 快照时不刷新/扫描素材目录，不再打开时强制加载 transcript。
- 设计记录：家长查看继续学习时，首页已拿到当前孩子任务，阶段页直接使用该快照并展示所有条目；学生可自主选择先完成哪一条。
- 验证：已做前端脚本语法检查、云函数脚本语法检查，并通过 request-context 与 plan-runtime 测试。

### 2026-07-06 新概念素材回答评分入口

- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`cloudfunctions/yoyo/lib/speaking-engine.js`
- 改动：New Concept 1/2/3/4 课程文本加载后，如识别到 `Answer this/these question(s)`，显示回答问题评分入口；提交评分时带当前任务快照，云端按对应文本评分。
- 设计记录：素材列表不强制每条录音，只有文本明确含回答问题时给学生手动选择评分。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-06 口语评分录音链路调试

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 改动：回答评分提交时在页面写出本地录音文件大小、上传目标、上传结果和云端评分返回字段。
- 设计记录：测试期口语评分失败必须显示链路断点，方便区分开发者工具录音为空、上传失败和云端下载失败。
- 验证：已做页面脚本语法检查。

### 2026-07-06 首页身份切换后任务刷新

- 文件：`pages/home/index.js`
- 文件：`cloudfunctions/yoyo/services/dashboard.service.js`
- 文件：`cloudfunctions/yoyo/lib/dashboard-engine.js`
- 改动：选择家长/学生身份成功后立即重新拉首页任务；首页 dashboard 跳过历史打卡补偿和孩子统计，减少首屏无关计算。
- 设计记录：首页首屏只保证身份、今日任务和模块入口准确，不在首屏做历史补偿类工作。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-06 开发者工具录音格式适配

- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`cloudfunctions/yoyo/lib/speaking-engine.js`
- 改动：微信开发者工具录音优先使用 `aac`，真机继续使用 `mp3`；云端评分按实际音频格式上传转写，开发者工具优先用腾讯 ASR 模型转写，并把模型判空归类为音频转写问题。
- 设计记录：真机录音链路保持不变，开发者工具只切换模型转写路线，不做本地假分。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-06 回退开发者工具录音适配

- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`cloudfunctions/yoyo/lib/speaking-engine.js`
- 改动：撤回开发者工具 `aac/wav` 和 ASR 优先路由，录音评分恢复统一 `mp3` 稳定链路；云端上传地址也锁定 `mp3`，保留 `audio-transcript` 错误归类。
- 设计记录：优先恢复真机稳定可用，开发者工具录音评分另行隔离处理，不能影响正式录音链路。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-06 真机口语评分恢复

- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`cloudfunctions/yoyo/lib/speaking-engine.js`
- 改动：真机评分默认只走一个模型转写链路，不再被旧 `TENCENT_ASR_ENABLED` 开关切到 ASR；评分结果返回不再同步等待反馈语音合成；模型请求默认 12 秒且不连环重试，模型异常只返回待评分，不做本地分。
- 设计记录：先保证真机录音上传后能尽快拿到模型评分结果，开发者工具兼容不进入主链路。
- 验证：已做云函数脚本语法检查。

### 2026-07-06 口语评分调试显示收敛

- 文件：`pages/lesson/index.js`
- 改动：口语评分提交过程中不再展示 debug 链路；只有评分失败、异常或待评分时才显示原因，评分成功后保持隐藏。
- 设计记录：学生正常录音评分过程只看状态，不显示技术链路；失败时再暴露断点。
- 验证：已做页面脚本语法检查。

### 2026-07-06 资料听力目录调试链路

- 文件：`pages/material/index.js`
- 文件：`pages/material/index.wxml`
- 文件：`pages/material/index.wxss`
- 改动：听力/写作资料目录返回空或云端错误时，在页面显示 `getMaterialIndex` 调试链路和关键字段；听力目录改为瘦身列表，点击套卷后再拉 `getMaterialItem` 完整详情。
- 设计记录：测试期 debug 区只在异常/空结果时出现，不改变正常目录视觉。
- 验证：已做前端脚本语法检查。

### 2026-07-06 听力素材 Unlock 课本/练习册标识

- 文件：`cloudfunctions/yoyo/lib/catalog-engine.js`
- 文件：`cloudfunctions/yoyo/lib/task-presenter.js`
- 文件：`cloudfunctions/yoyo/lib/listening-plan-engine.js`
- 文件：`utils/labels.js`
- 改动：Unlock 1/2/4 显示为第二版课本，Unlock 3 显示为练习册；期中/期末听力排序只作用于 Unlock 3 练习册素材。
- 设计记录：素材列表、计划设置、任务徽章统一暴露“课本/练习册”属性，避免只显示 Unlock 编号造成误解。
- 验证：已做云函数和前端脚本语法检查，并通过 catalog 与 plan-runtime 测试。

### 2026-07-06 家长日报词汇模块统计

- 文件：`pages/parent/index.js`
- 文件：`pages/record/index.js`
- 文件：`pages/record/index.wxml`
- 改动：家长日报“模块分析”新增词汇模块，并把当天词汇背诵营完成记录计入；成长页当天记录同步合并词汇完成项。
- 设计记录：词汇背诵营作为独立学习模块展示，沿用模块分析卡片样式，不新增说明文字。
- 验证：已做前端脚本语法检查。

### 2026-07-05 绑定家长代做孩子练习

- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/shared.service.js`
- 文件：`cloudfunctions/yoyo/facades/study.facade.js`
- 文件：`cloudfunctions/yoyo/services/task.service.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 文件：`cloudfunctions/yoyo/services/writing.service.js`
- 文件：`cloudfunctions/yoyo/services/grammar.service.js`
- 文件：`cloudfunctions/yoyo/services/completion.service.js`
- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 改动：绑定家长选中学生后，练习、口语评分、阅读、写作、语法、词汇和学习包记录按选中学生写入；日报和打卡仍只由学生身份触发。
- 设计记录：绑定家长可代孩子完成同一套学习动作，但不把家长设备本身纳入学生日报入口。
- 验证：已做前端/云函数脚本语法检查，并通过云函数全量测试。

### 2026-07-05 新概念录音权限保护

- 文件：`app.json`
- 文件：`pages/lesson/index.js`
- 改动：补充麦克风授权说明；新概念录音前主动检查录音权限；录音不可用、拒权或启动失败时不再自动把任务按听力完成跳过。
- 设计记录：新概念回答问题必须让学生可重试录音，不能因为权限失败直接跳过回答流程。
- 验证：已做前端脚本语法检查、app.json JSON 校验，并通过云函数全量测试。

### 2026-07-05 全局按钮触感反馈

- 文件：`styles/base.wxss`
- 文件：`pages/lesson/index.wxss`
- 改动：全局按钮增加轻凹陷按压反馈；课程页播放器和录音按钮增加更明确的内阴影按压状态。
- 设计记录：按钮反馈保持轻、短、安静，不加音效，不影响录音内容。
- 验证：已做前端脚本语法检查、app.json JSON 校验，并通过云函数全量测试。

### 2026-07-04 后台隐藏家长本机学号

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 改动：同一微信已作为家长绑定其他学生时，后台学生列表不再返回该微信本机 owner 学生账号。
- 设计记录：家长绑定目标用于跟踪查看，后台默认聚焦被绑定学生，避免把家长自己的本机学号混入管理列表。
- 验证：已做云函数脚本语法检查。

### 2026-07-04 后台敏感 ID 默认收起

- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`pages/admin/index.wxss`
- 改动：诊断 openId、家庭 ID、家长 userId/openId 和学生设备 ID 默认收起，点击查看详情后才显示。
- 设计记录：后台列表默认只看学生、家长姓名和关系，敏感标识按需查看和复制。
- 验证：已做前端脚本语法检查。

### 2026-07-04 后台活跃用户分组

- 文件：`cloudfunctions/yoyo/lib/bootstrap-engine.js`
- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`pages/admin/index.wxss`
- 改动：记录用户登录次数；后台默认只显示登录 2 次以上的活跃用户；不活跃用户切到单独列表查看；学生卡片默认折叠。
- 设计记录：后台首页先看真实使用用户，低频或首次登录用户不干扰主列表，展开后再看绑定关系和敏感标识。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台活跃用户身份标签

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.wxml`
- 改动：活跃用户如果绑定过其他学号，列表身份显示为家长；否则显示为学生。
- 设计记录：后台身份按当前用户用途呈现，避免绑定孩子后的家长仍被误看成学生。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台本机设备与空绑定隐藏

- 文件：`cloudfunctions/yoyo/lib/bootstrap-engine.js`
- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.wxml`
- 改动：指定本机 owner 设备显示为“王天龙”；无绑定家长时不显示 0 位家长和空绑定区域。
- 设计记录：后台只显示真实发生的绑定关系，未主动绑定账号时不展示绑定信息。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台活跃判断补学习记录

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.js`
- 改动：活跃用户判断从只看登录次数，改为登录 2 次以上或存在打卡、任务进度、答题记录；列表显示学习记录数。
- 设计记录：老用户可能没有登录次数累计，但只要有学习行为就应归入活跃用户。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台绑定家长误判修正

- 文件：`pages/admin/index.js`
- 改动：本机 owner 即使处于家长模式也不计入绑定家长；只有真实 role=parent 的成员才显示为绑定。
- 设计记录：未主动输入学号绑定时，不展示绑定关系。
- 验证：已做前端脚本语法检查。

### 2026-07-04 后台关系展示极简化

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`pages/admin/index.wxss`
- 改动：学生卡片展开后只显示学生、学号、家长姓名；前端不再展示学生设备、本机学生、userId、openId、家庭 ID、诊断信息或详情入口，云端成员信息也只返回姓名和角色。
- 设计记录：后台关系只表达“哪个学生由哪些家长绑定”，学生自己不显示为绑定自己。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台绑定家长口径修正

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.js`
- 改动：只有 role=parent 且 studyRole 不是 student 的成员才算绑定家长；家长身份用户自己的学生行不再进入学生列表；家长昵称避开“学生设备”等默认占位名。
- 设计记录：后台主列表只放学生账号，家长只出现在对应学生的绑定关系里。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 后台隐藏未活跃佑佑占位

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 改动：不活跃且昵称仍为“佑佑”的学生账号默认不进入后台列表；已有真实家长绑定时保留。
- 设计记录：清理未使用的默认占位账号，不影响已有绑定关系。
- 验证：已做云函数脚本语法检查。

### 2026-07-04 后台展开信息去重

- 文件：`pages/admin/index.wxml`
- 改动：学生昵称已在卡片标题显示，展开区移除重复的“学生：昵称”行，只保留学号和家长。
- 设计记录：后台关系展开区只补充标题没有的信息。
- 验证：已做前端脚本语法检查。

### 2026-07-04 后台 ID 文案与家长显示

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.wxml`
- 改动：展开区“学号”简化为“ID”；家长绑定判断改为 role=parent 且不是“学生设备”占位，确保有绑定时展开区显示家长昵称。
- 设计记录：后台关系字段短且稳定，绑定关系按实际家长成员展示。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-04 绑定学生使用本机昵称

- 文件：`cloudfunctions/yoyo/services/family.service.js`
- 改动：家长绑定学号时如果未填写备注，默认使用本机 owner 学生昵称作为家长昵称；本机昵称仍为占位时拒绝绑定并提示先设置昵称。
- 设计记录：家长昵称来自已确认的本机身份，避免后台出现“新家长/学生设备”等占位关系名。
- 验证：已做云函数脚本语法检查。

### 2026-07-04 后台登录统计按学生设备汇总

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 文件：`pages/admin/index.js`
- 改动：学生登录次数改为汇总该学生账号下所有非家长绑定成员；最近时间取登录和学习记录中的最新时间。
- 设计记录：后台学生行反映学生账号整体使用情况，不被 owner 老字段或历史学习时间误导。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 每日任务听力先听后学

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 文件：`cloudfunctions/yoyo/services/task.service.js`
- 改动：A1-C2 每日任务听力不再要求先完成文本学习包；播放器提前，文本学习移到播放器后；音频播完一次即完成该条任务。
- 设计记录：每日任务听力和初三一模二模练习分开处理，主线是先听，学习包作为听后可选深化。
- 验证：已做页面和云函数语法检查。

### 2026-07-03 昵称必填门槛

- 文件：`cloudfunctions/yoyo/facades/family.facade.js`
- 文件：`cloudfunctions/yoyo/lib/family-engine.js`
- 文件：`utils/contracts.js`
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 文件：`pages/profile/index.js`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.wxss`
- 改动：默认昵称为空、同学、我时标记为必改；佑佑只允许学号 317613 使用；首页显示必填昵称卡并拦截学习入口；我的页同步提示；云端拒绝保存不合规默认昵称。
- 设计记录：首次注册和老用户补改都在进入学习前完成，不用弹窗堆叠，使用页面内轻卡片承载。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 首页海报身份按钮对齐

- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：海报底部“我是家长 / 我是学生”从 button 改为等宽 view，固定两列网格。
- 设计记录：身份选择按钮必须在底部两列网格中左右对称，不被 button 默认样式挤出屏幕。
- 验证：已做页面脚本语法检查。

### 2026-07-03 我的页后台入口

- 文件：`pages/profile/index.js`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`pages/admin/index.wxss`
- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 改动：取消顶部隐藏点击入口，改为“我的”页账号类列表项；管理员 openId 命中或当前页面已是家长模式时直接显示入口；后台页按学生展示家长绑定关系和可复制 ID，并增加云函数版本、openId、白名单命中情况的诊断流程。
- 设计记录：管理入口进入后台时仍由云端白名单二次校验，非管理员即使看到入口也无法读取后台数据。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 隐藏管理员后台

- 文件：`pages/profile/index.js`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`pages/admin/index.wxss`
- 改动：我的页头像区点击 1 次后尝试进入管理员后台；后台页只展示学号、学生昵称和成员绑定关系。
- 设计记录：后台不进入普通导航，不给普通用户可见入口；页面保持列表式信息，不做复杂控制台。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 听力主播放器点击播放兜底

- 文件：`pages/lesson/index.js`
- 改动：主播放器已有音频地址但预加载状态未释放时，点击播放直接触发音频播放；播放开始后同步清掉等待状态。
- 设计记录：播放器按钮必须以用户点击为准，不让“等待播放”状态挡住已可播放音频。
- 验证：已做页面脚本语法检查。

### 2026-07-03 听力学习包词典能力统一

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 改动：听力学习包生词/短语卡片对齐阅读学习包；补查词、发音、加入词库和词典弹层。
- 设计记录：听力学习包使用项目词典同一套音符、轻按钮、底部词典弹层；发音按最快可播优先，已有缓存先播，无现成音频再走有道，失败再走云端兜底。
- 验证：已做页面脚本语法检查。

### 2026-07-03 家长日报录音播放

- 文件：`cloudfunctions/yoyo/lib/speaking-engine.js`
- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`pages/parent/detail/index.wxss`
- 文件：`pages/record/index.js`
- 文件：`pages/home/completed/index.js`
- 改动：日报详情里的录音播放按钮改为带状态图标的轻量胶囊；支持只有云存储路径的旧录音生成临时播放链接；评分链路有转写时用保守分兜底，避免单段模型失败导致整条记录显示失败。
- 设计记录：口语/录音回看保留明确按钮，但视觉降噪，不使用整行高权重主按钮。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-02 口语独立入口页

- 文件：`app.json`
- 文件：`pages/home/index.js`
- 文件：`pages/speaking/index.js`
- 文件：`pages/speaking/index.wxml`
- 文件：`pages/speaking/index.wxss`
- 文件：`pages/speaking/index.json`
- 改动：首页口语卡片从“暂未开放”改为进入独立口语页；口语页提供短句选择、录音、提交腾讯 SOE 发音评分和本次分项结果。
- 设计记录：口语首屏只突出一次短句跟读，不堆历史记录；独立口语页不写入听力任务，不改变听力完成/打卡链路。
- 验证：已执行 `node -c pages/speaking/index.js`、`node -c pages/home/index.js`、`node -c cloudfunctions/yoyo/services/speaking.service.js`。

### 2026-07-02 首页/我的身份入口隐藏

- 文件：`pages/home/index.js`
- 文件：`pages/profile/index.wxml`
- 改动：首页引导层关闭后本机记住，不再反复遮挡“我是家长 / 我是学生”；我的页不再直接展示两枚身份切换文案，改为当前身份行并跳转家庭页切换。
- 设计记录：首次使用仍必须先选身份；完成选择后隐藏首页身份卡，后续切换收敛到家庭页，避免首页和我的页重复出现同权重身份入口。
- 验证：语法检查通过。

### 2026-07-02 首页海报身份入口修复

- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：入口海报最后一页直接显示“我是家长 / 我是学生”，点击后确认身份并关闭海报。
- 设计记录：首次使用路径不再让用户从海报退回首页找身份按钮；身份选择仍是第一次进入的必要动作。
- 验证：语法检查通过。

### 2026-07-02 阅读解析生成提示

- 文件：`pages/reading/detail/index.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：逐题解析临时占位文案统一为“生成解析中”；旧题库里的“结合原文判断。”也按占位处理。
- 设计记录：阅读提交后的模型解析生成阶段必须给学生明确等待提示，避免误以为解析内容已经完成。
- 验证：语法检查通过。

### 2026-07-02 阅读学习包生成提示

- 文件：`pages/reading/detail/index.wxml`
- 改动：学习包生词、短语、句型点击生成后，空状态保留并显示“生词生成中 / 短语生成中 / 句型生成中”，按钮进入 loading。
- 设计记录：学生点击生成学习包后必须立刻看到生成中反馈，不能只隐藏按钮留下空白等待。
- 验证：语法检查通过。

### 2026-07-02 首页身份缓存兜底

- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：海报缓存已关闭但身份未确认时，首页强制显示身份选择卡；身份卡增加一句轻提示。
- 设计记录：海报缓存和身份确认缓存必须解耦，未选身份不能进入不可用状态；海报内选身份则不再二次选择。
- 验证：语法检查通过。

### 2026-07-02 身份确认缓存升级

- 文件：`utils/page.js`
- 改动：身份确认缓存升级到 `yoyoIdentityConfirmedV2`，旧 `V1` 缓存不再直接放行。
- 设计记录：真机旧缓存可能只有海报关闭或旧身份确认状态，必须强制重新完成一次身份选择，避免首页无海报、无身份选择且无法使用。
- 验证：语法检查通过。

### 2026-07-02 首页海报每次显示

- 文件：`pages/home/index.js`
- 改动：首页每次进入都显示入口海报。
- 设计记录：真机调试和正式真机都先显示海报；已选身份时海报最后进入首页，未选身份时海报最后选择家长/学生。
- 验证：语法检查通过。

### 2026-07-02 真机身份判断修正

- 文件：`utils/page.js`
- 改动：身份判断只读取 `yoyoIdentityConfirmedV2` 本机缓存，不再用运行态 `globalData.identityConfirmed` 放行。
- 设计记录：真机调试热更新或清缓存后，运行态全局值不能覆盖真实本机身份缓存；否则会出现海报第二页和首页都不显示身份选择。
- 验证：语法检查通过。

### 2026-07-02 海报身份选择写死

- 文件：`pages/home/index.wxml`
- 改动：入口海报第二页固定显示“我是家长 / 我是学生”，不再根据身份缓存切换成“进入首页”。
- 设计记录：真机和调试环境每次海报流程都给出明确身份选择入口，避免缓存状态导致无入口。
- 验证：语法检查通过。

### 2026-07-02 首页身份选择写死

- 文件：`pages/home/index.js`
- 改动：首页身份卡显示固定为“没有 V2 身份确认就显示”，不受海报缓存、运行态全局值或云端返回影响。
- 设计记录：如果用户没在海报内选择身份而跳过/离开海报，首页必须继续显示“我是家长 / 我是学生”。
- 验证：语法检查通过。

### 2026-07-02 首页身份按本次会话兜底

- 文件：`pages/home/index.js`
- 改动：身份卡不再由历史身份缓存决定，改为本次进入首页是否点过身份决定；本次没选就一直显示。
- 设计记录：真机调试和真实手机可能保留旧 V2 缓存，但每次海报流程如果没有选择身份，跳过后首页必须显示身份入口。
- 验证：语法检查通过。

### 2026-07-02 首页海报身份后不回弹

- 文件：`pages/home/index.js`
- 改动：首页 `onShow` 不再重置本次身份选择状态；本次已选“我是家长 / 我是学生”后不再重新弹海报。
- 设计记录：每次真机先显示海报的目的，是保证未选身份时有入口；不是在已选身份后把用户再次带回海报。
- 验证：语法检查通过。

### 2026-07-02 学生身份使用本机孩子

- 文件：`utils/store.js`
- 改动：选择“我是学生”时清除当前选中的绑定学生目标，再调用身份切换。
- 设计记录：学生设备身份代表本机孩子；家长或老师当前查看的绑定学生不能污染学生设备 ID。
- 验证：语法检查通过。

### 2026-07-02 学生输入 ID 迁移账号

- 文件：`pages/family/index.wxml`
- 文件：`pages/family/index.js`
- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/family.service.js`
- 改动：学生模式下显示“登录其他学生账号 / 登录”，只输入学号；输入已有学号后以学生身份进入该学生账号。家长/老师模式显示“绑定学生 / 绑定”，保留备注输入；绑定列表排除本机 owner 学生账号。
- 设计记录：每台手机默认有自己的学号，但学生主动输入已有学号时，表示这台手机要进入那个学生账号。
- 验证：语法检查通过。

### 2026-07-02 身份页禁用旧缓存

- 文件：`utils/store.js`
- 改动：`getProfileData` 和 `getFamilyPageData` 改为实时请求；切到学生身份时清除读缓存。
- 设计记录：身份页不能先显示旧绑定学生，尤其是开发者工具和真机调试里会放大缓存误判。
- 验证：语法检查通过。

### 2026-07-02 云端默认本机学生

- 文件：`cloudfunctions/yoyo/lib/bootstrap-engine.js`
- 文件：`cloudfunctions/yoyo/facades/family-context.facade.js`
- 文件：`cloudfunctions/yoyo/lib/request-context-engine.js`
- 文件：`cloudfunctions/yoyo/services/identity.service.js`
- 文件：`cloudfunctions/yoyo/tests/family-identity.test.js`
- 改动：云端无 target 时优先选本机 owner 家庭；点“我是学生”强制本机学生上下文，没有 owner 时自动创建本机学生家庭。
- 设计记录：老师或家长绑定过学生后，成员列表第一项可能是绑定学生；点“我是学生”仍必须回本机学号。
- 验证：身份测试通过。

### 2026-07-02 我的页账号入口合并

- 文件：`pages/profile/index.wxml`
- 改动：删除单独“身份”入口，把“家庭”改为“家庭与账号”，副文案合并身份和同步状态。
- 设计记录：“身份”和“家庭”都进入同一个家庭页，不能在我的页做成两个并列入口。
- 验证：结构检查通过。

### 2026-07-02 绑定学生记录目标

- 文件：`utils/store.js`
- 改动：记录页 `getDashboard(view=record)`、`getHeatmap`、`getMonthHeatmap` 统一带当前选中的绑定学生 target。
- 设计记录：家长/老师解绑再绑定同一学生后，学习记录仍属于该学号；记录查询不能回落到本机学号。
- 验证：语法检查通过。

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

### 2026-07-02 首页入口海报显示

- 文件：`app.js`
- 文件：`pages/home/index.js`
- 改动：入口海报不再写入或读取“已跳过”缓存，每次进入首页都显示。
- 设计记录：首页保留入口说明作为固定首屏引导，关闭只影响当前页面。
- 验证：语法检查通过。

### 2026-07-02 阅读提交后模型解析补全

- 文件：`pages/reading/detail/index.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：阅读提交先显示快速判分和标准答案解析，再后台生成模型逐题解析并补全原文依据句。
- 设计记录：阅读练习不让模型等待阻断提交结果，但解析区最终恢复为模型讲解。
- 验证：语法检查通过。

### 2026-07-02 阅读学习包发音限定

- 文件：`pages/reading/detail/index.js`
- 改动：阅读学习包单词/短语播放限定为有道音频，不再走 TTS 兜底。
- 设计记录：短语发音只用有道 type=2/type=1 两路尝试，不生成 TTS。
- 验证：语法检查通过。

### 2026-07-02 阅读正文查词点击优先

- 文件：`pages/reading/detail/index.wxml`
- 改动：阅读正文单击单词查词，长按句子触发翻译；题目和选项查词保持点击。
- 设计记录：正文主交互优先查词，整句翻译作为长按动作。
- 验证：绑定检查通过。

### 2026-07-02 阅读发音词典兜底

- 文件：`pages/reading/detail/index.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：有道 type=2/type=1 播放失败后，单词再走 Merriam-Webster 官方免费非商用词典音频；该链路不使用 TTS。
- 设计记录：短语仍只尝试有道，单词可接官方词典音频兜底。
- 验证：语法检查通过。

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
- 改动：第二页改为家长 ID 绑定使用说明，并新增家长与学号轻动画。
- 设计记录：使用说明先讲身份选择和学号绑定，再讲今日听力任务；动画只做轻浮动和连接线呼吸。
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

### 2026-07-01 练习结果高速同步

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/record/index.js`
- 改动：阅读提交改为云端直接写完成记录；写作批改中/已批改状态由云端同步；词汇复习按批次写入家长记录；记录页显示写作批改中/失败状态。
- 设计记录：学生侧提交必须先完成做题反馈，家长侧结果同步由云端兜底，避免依赖页面停留。
- 验证：已做前端/云函数脚本语法检查和云函数测试。

### 2026-07-01 记录页最终提速

- 文件：`pages/record/index.js`
- 文件：`pages/parent/index.js`
- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/report.service.js`
- 文件：`pages/reading/flashcards/index.js`
- 改动：学生过去 7 天改为一次轻量完成记录查询；家长 dashboard 收窄到近 7 天；记录类缓存改短时刷新；历史日报优先读已有记录；词汇完成同步避免退出重复写。
- 设计记录：记录页先展示轻量摘要，点进单日才拉完整详情；家长全部记录保留范围但避免首屏重算长周期日报。
- 验证：已做前端/云函数脚本语法检查和云函数测试。

### 2026-07-02 阅读提交结果修复

- 文件：`pages/reading/detail/index.js`
- 改动：阅读提交成功判断不再要求模型学习包来源，只要云端返回题目解析即可展示结果；历史提交记录同样按题目解析显示。
- 设计记录：提交反馈和模型学习包解耦，学生先看到分数与对错，学习卡按需生成。
- 验证：已做前端脚本语法检查。

### 2026-07-03 家长日报范围文案

- 文件：`pages/parent/index.wxml`
- 改动：家长日报列表标题从“最近 30 天”改为“最近 7 天”。
- 设计记录：家长日报标题必须和实际查询范围一致，避免误导为 30 天。
- 验证：文案改动，无脚本检查。

### 2026-07-03 二模听力目录刷新

- 文件：`pages/material/index.js`
- 文件：`cloudfunctions/yoyo/services/catalog.service.js`
- 改动：考试听力目录改读正式练习 JSON，并在云端刷新返回后重算目录数量。
- 设计记录：资料目录只展示可进入练习的正式内容，缓存命中后也要静默刷新，避免旧数量停留为 0。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 二模听力练习可用性修复

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`domain/cloud/index.js`
- 改动：听力图片/音频云路径补全为可取临时链接的 fileID，T/F 选项不再重复显示字母。
- 设计记录：练习页必须优先保证媒体可播放、图片可见、选项文案不挤压错乱。
- 验证：已重建二模听力练习 JSON，并完成前端脚本和 JSON 校验。

### 2026-07-03 二模听力选项防溢出

- 文件：`pages/material/detail/index.wxss`
- 改动：听力选项按钮固定在两列网格内，长句自动换行，不再横向撑出屏幕。
- 设计记录：练习题选项必须稳定在卡片内，长文本优先换行而不是压缩或溢出。
- 验证：样式改动，无脚本检查。

### 2026-07-03 二模听力播放控件

- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxss`
- 改动：播放控件从原生 button 改为 view，实现稳定禁用态和统一视觉。
- 设计记录：主播放控件使用自定义视图承载状态，避免原生按钮默认样式破坏听力页卡片秩序。
- 验证：已做前端脚本语法检查。

### 2026-07-03 二模听力答题区重排

- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxss`
- 改动：A 部分图片增加 A-F 角标；文本学习区移到页面末尾；学习标签改为 view；选项短文本双列、长文本自动跨整行。
- 设计记录：听力答题区优先保证题目和选项完整可读，图片编号由界面补齐，文本学习不抢答题主流程。
- 验证：已做前端脚本语法检查。

### 2026-07-03 一模听力入口

- 文件：`pages/material/index.js`
- 改动：资料听力目录的“一模”入口改读 `listeningEm1` 正式练习数据。
- 设计记录：一模和二模沿用同一层级入口，不新增独立页面。
- 验证：已做前端脚本语法检查。

### 2026-07-03 听力目录与播放修复

- 文件：`utils/store.js`
- 文件：`pages/material/detail/index.js`
- 改动：资料目录不再使用旧缓存读取；听力音频播放不再被文本学习完成状态锁住。
- 设计记录：考试听力以可见、可播放为优先，文本学习只作为辅助区块，不阻断播放主流程。
- 验证：已做前端脚本语法检查。

### 2026-07-03 家长首次进入家庭页

- 文件：`pages/family/index.js`
- 改动：首次直接选择“我是家长”不再进入强制绑定学号的极简态，家庭页正常显示身份、绑定学生和本机成员信息。
- 设计记录：家长模式可以先进入家庭页再绑定学生，不要求先经过学生模式。
- 验证：已做前端脚本语法检查。

### 2026-07-03 家长上次学生恢复

- 文件：`utils/store.js`
- 文件：`pages/parent/index.js`
- 文件：`pages/family/index.js`
- 文件：`cloudfunctions/yoyo/services/identity.service.js`
- 改动：家长切换绑定学生时保存上次查看目标；从学生模式再切回“我是家长”时自动按上次绑定学生刷新返回；旧家长没有本地缓存时，从云端绑定列表自动恢复第一个绑定学生。
- 设计记录：学生模式只清当前查看目标，不清家长历史目标；老用户家长回到家长模式必须看到上次绑定学生。
- 验证：已做前端脚本语法检查。

### 2026-07-03 身份切换确认态

- 文件：`pages/family/index.js`
- 文件：`pages/profile/index.js`
- 改动：家庭页和我的页切换身份后同步写入身份已确认状态，回到首页不再误提示“先选择身份”。
- 设计记录：所有身份切换入口都必须更新同一份确认态，不只写最后身份缓存。
- 验证：已做前端脚本语法检查。

### 2026-07-03 记录页信息收敛

- 文件：`pages/record/index.wxml`
- 文件：`pages/record/index.js`
- 改动：移除“过去 7 天”和“作文记录”独立区块，停止对应后台请求；月历提示改为点日期查看当天记录。
- 设计记录：学生记录页不重复家长日报的 7 天列表，写作回看收敛到按日期日报记录；页面只保留月历、追赶和当天记录。
- 验证：已做前端脚本语法检查。

### 2026-07-03 家长页按需加载

- 文件：`pages/parent/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`pages/parent/detail/index.wxss`
- 改动：家长首页不再首屏拉 90 天完成内容；日报详情不再首屏拉阅读/语法/写作，当用户点击对应入口时再加载。
- 设计记录：家长页首屏只取必要摘要，重内容按用户动作加载，避免翻页时无意义请求。
- 验证：已做前端脚本语法检查。

### 2026-07-03 首页板块年级文案

- 文件：`pages/home/index.wxml`
- 改动：听力和写作入口副标题从“初中一模/二模”改为“初三一模/二模”。
- 设计记录：首页模块卡副标题必须直接对应当前练习年级和卷型。
- 验证：文案改动，无脚本检查。

### 2026-07-03 词汇发音预缓存

- 文件：`pages/reading/flashcards/index.js`
- 改动：词汇复习进入当前卡后，快速自动发音并后台预取后面两张可发音词卡音频；单词和短语无本机缓存时优先有道直播，不再先等云端链路。
- 设计记录：词汇发音保持音符按钮不变，速度优化应在后台完成；单词/短语优先即时播放，云端链路只做兜底。
- 验证：已做前端脚本语法检查。

### 2026-07-03 查词发音提速

- 文件：`pages/reading/detail/index.js`
- 文件：`pages/grammar/index.js`
- 改动：阅读和语法查词弹层的发音改为单词/短语优先有道即时播放，云端音频只做兜底。
- 设计记录：全项目查词发音保持音符按钮和轻反馈，播放链路优先即时响应。
- 验证：已做前端脚本语法检查。

### 2026-07-03 记录和语法按需加载

- 文件：`pages/record/index.js`
- 文件：`pages/record/index.wxml`
- 文件：`pages/grammar/index.js`
- 改动：记录页追赶任务改为用户点击后再加载；语法页首屏只拉二模目录，一模目录和错题集都按点击加载。
- 设计记录：记录页追赶和语法页非默认目录不参与首屏请求，避免无意义后台拉取。
- 验证：已做前端脚本语法检查。

### 2026-07-03 素材索引按模块加载

- 文件：`pages/home/index.js`
- 文件：`pages/material/index.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/parent/detail/index.js`
- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/catalog.service.js`
- 改动：首页不再后台预拉素材索引和当日日报；听力/写作目录和写作题回填只请求当前模块素材索引。
- 设计记录：素材索引按入口模块加载，完成记录按进入记录页/完成页再拉，不在首页或无关模块里提前拉全量列表和日报。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 阅读目录按需加载

- 文件：`pages/reading/index.js`
- 文件：`pages/reading/index.wxml`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：已废弃。阅读页不再设置“今日阅读”任务入口。
- 设计记录：以 2026-07-03“阅读入口去除今日阅读”为准。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 阅读入口去除今日阅读

- 文件：`pages/reading/index.js`
- 文件：`pages/reading/index.wxml`
- 改动：阅读入口不再展示“今日阅读”，首屏直接进入一模、二模、真题卷目录。
- 设计记录：阅读板块不设置每日任务入口，只保留目录选择和完成状态。

### 2026-07-03 听力任务快照和音频预取

- 文件：`pages/home/index.js`
- 文件：`pages/level-stage/index.js`
- 文件：`pages/lesson/index.js`
- 改动：首页和阶段页进入听力任务前写入任务快照；听力页先用快照渲染，再后台刷新详情和预取音频链接。
- 设计记录：继续学习不能先进入空白加载页，播放按钮优先使用已预取的音频地址。
- 验证：已做前端脚本语法检查。

### 2026-07-03 听力练习分段显示

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：听力练习按原卷 A/B/C/D 分段显示，并避免段落标题混入选项。
- 设计记录：听力题区必须保留原卷段落层级，图片区属于 A 段，后续题目按 B/C/D 分组阅读。
- 验证：已做前端脚本语法检查。

### 2026-07-03 写作素材缓存秒开

- 文件：`utils/store.js`
- 改动：写作/听力素材索引恢复前端读缓存，页面先用缓存展示再后台刷新。
- 设计记录：写作题库不是实时数据，进入写作目录不能每次强制重拉云存储。
- 验证：已做前端脚本语法检查。

### 2026-07-03 语法题量首屏显示

- 文件：`pages/grammar/index.js`
- 改动：语法入口首屏同时拉一模和二模目录题量，但题目正文仍保持点考点后再加载。
- 设计记录：目录题量属于导航信息，应首屏完整显示；题目正文属于练习内容，继续按需加载。
- 验证：已做前端脚本语法检查。

### 2026-07-03 阅读目录题量首屏显示

- 文件：`pages/reading/index.wxml`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 改动：阅读目录首屏只返回一模/二模/真题分组和篇数，不再查询全量今日完成状态。
- 设计记录：阅读目录题量属于导航信息，应首屏显示；完成状态和正文详情按用户进入具体内容后再补。
- 验证：已做前端和云函数脚本语法检查。

### 2026-07-03 听力图片标签和文本按需显示

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 改动：A 部分图片标签扩展到 G/H 等更多选项；参考文本改为点击生成后立即显示，学习包后台生成。
- 设计记录：图片题选项必须逐张标注；参考答案/文本不在进入练习时直接露出，但用户主动点击生成后应立刻展开已有文本。
- 验证：已做前端脚本语法检查。

### 2026-07-03 记录页历史课程回看

- 文件：`pages/record/index.js`
- 文件：`utils/store.js`
- 改动：记录页点击听力记录按历史日期预览打开，并让课程详情请求携带家长当前查看学生。
- 设计记录：记录页“查看”是回看动作，只读历史任务快照，不触发学习写入。
- 验证：已做前端脚本语法检查。

### 2026-07-03 Unlock2/3/4 级别入口

- 文件：`cloudfunctions/yoyo/services/level.service.js`
- 文件：`cloudfunctions/yoyo/lib/catalog-engine.js`
- 文件：`cloudfunctions/yoyo/lib/task-presenter.js`
- 改动：A2/B1/B2 级别页分别接入 Unlock2/3/4，和 New Concept 并列展示。
- 设计记录：A2/B1/B2 级别页保持节目入口结构，只展示通过本地清洗且不短于 60 秒的 Unlock 音频。
- 验证：已做云函数脚本语法检查和关键单测。

### 2026-07-03 级别课程首屏快进

- 文件：`pages/level/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`utils/store.js`
- 改动：A1 阶段页和 A2/B1/B2 级别页进入课程详情时先使用任务快照首屏渲染，后台再刷新云端详情。
- 设计记录：课程详情首屏优先展示上一页已有课程信息；云端刷新失败时不覆盖成错误页，云端刷新请求携带当前任务快照兜底。
- 验证：已做前端脚本语法检查。

### 2026-07-03 通用详情快照

- 文件：`utils/snapshot.js`
- 文件：`pages/home/index.js`
- 文件：`pages/level/index.js`
- 文件：`pages/level-stage/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/record/index.js`
- 文件：`pages/reading/index.js`
- 文件：`pages/reading/detail/index.js`
- 改动：课程详情和阅读详情统一使用本地快照先渲染，再后台刷新云端数据。
- 设计记录：列表页已有信息必须可作为详情页首屏快照；快照读写记录性能日志，过期后自动丢弃。
- 验证：已做前端脚本语法检查、快照工具单测和关键云函数单测。

### 2026-07-03 全板块首屏快照

- 文件：`pages/material/index.js`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/grammar/index.js`
- 文件：`pages/home/index.js`
- 文件：`pages/level-stage/index.js`
- 改动：听力材料、写作题、语法考点、A1 阶段页统一先读本地快照，再刷新云端。
- 设计记录：学习入口点击后不得先出现空态/待生成；只要上一页已有可用内容，详情或阶段页必须先展示本地快照。
- 验证：已做前端脚本语法检查、快照工具单测和关键云函数单测。

### 2026-07-03 A1 阶段今日任务打卡

- 文件：`cloudfunctions/yoyo/services/level.service.js`
- 文件：`pages/level-stage/index.js`
- 改动：A1 阶段页统一按学生实际打卡进度渲染当天任务，标题跟随真实计划阶段，并避免缓存全等待快照。
- 设计记录：阶段页只承载当前学生今天该做的任务，不再按固定阶段生成预览任务。
- 验证：已做前端和云函数语法检查、云函数测试。

### 2026-07-03 词书音标缓存刷新

- 文件：`pages/reading/flashcards/index.js`
- 改动：词书本机缓存如果没有任何音标，自动视为旧缓存并重新拉取线上词书。
- 设计记录：词书展示字段升级后，旧缓存不能挡住线上新数据。
- 验证：已做前端脚本语法检查。

### 2026-07-03 词汇书库图标降噪

- 文件：`pages/reading/flashcards/index.wxss`
- 改动：书库入口的书本图标去掉上下浮动动画，封面改为低饱和静态书脊。
- 设计记录：词汇书库图标只做来源识别，不使用高饱和色块和持续动效。
- 验证：样式改动，无脚本检查。

### 2026-07-03 首页身份门禁

- 文件：`pages/home/index.js`
- 改动：首页所有内容入口统一先检查身份选择，未选择时提示“请先选择身份”。
- 设计记录：跳过海报后，首页内容区不能绕过身份选择；只有身份按钮负责进入后续流程。
- 验证：已做前端脚本语法检查。

### 2026-07-03 阶段二口语继续按钮

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 改动：阶段二口语回答提交成功后自动计入本题进度，保留“满意，继续”作为反馈后的继续按钮。
- 设计记录：口语录音保存成功就是本题完成条件，不能依赖学生再点击反馈区按钮。
- 验证：已做前端脚本语法检查。

### 2026-07-04 考试听力 A 区综合图

- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxss`
- 改动：A 区只有一张综合选项图时改为整宽展示；重复综合图数据只保留一张。
- 设计记录：单张综合图已经包含全部选项，不再按 A/B/C/D/E 重复渲染；图片优先保证一屏可读。
- 验证：已检查 2019 嘉定、崇明二模图片数量。

### 2026-07-04 课程口语录音权限

- 文件：`app.json`
- 文件：`pages/lesson/index.js`
- 改动：补充麦克风权限用途说明；开始录音前主动申请 `scope.record`，拒绝时引导打开设置。
- 设计记录：口语录音按钮必须明确处理权限，不让真机用户点了无反馈。

### 2026-07-04 课程口语评分学生目标

- 文件：`utils/store.js`
- 文件：`pages/lesson/index.js`
- 改动：口语上传、提交评分、独立发音评分和重评分统一携带当前选中学生目标；课程页是否可计入以后端 `studyWriteAllowed` 为准。
- 设计记录：真实学生评分必须落到当前课程对应学生，不能因本机/绑定身份切换落到错误账号或进入试做分支。

### 2026-07-04 口语录音写入家长日报

- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 文件：`pages/speaking/index.js`
- 改动：学生口语提交/重评分后立即刷新当日日报；独立口语页从只评分改为提交记录并保存评分。
- 设计记录：学生本人完成录音评分后，家长端当天记录必须立刻可见。

### 2026-07-04 A1 阶段二录音启动

- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 改动：A1 阶段二回答评分录音启动流程回到上一版稳定方式；保留上传路径扩展名兼容。
- 设计记录：阶段二口语评分按钮优先保持已验证过的真机录音路径。

### 2026-07-04 家长云端试做评分

- 文件：`pages/lesson/index.js`
- 文件：`cloudfunctions/yoyo/services/speaking.service.js`
- 改动：家长/预览录音不再使用本地假分，改为上传录音走云端模型评分；云函数对 `preview` 只返回结果不写入记录。
- 设计记录：家长可以真实试做评分，但不污染学生正式学习记录和家长日报。

### 2026-07-04 考试听力综合图放大

- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：A 区单张综合图改为固定大图容器展示，避免综合选项图过小。
- 设计记录：单张综合图承载全部 A 区选项时，优先保证一屏内可读，不按小图选项格压缩。
- 验证：已检查页面脚本语法和 2020 二模条目。

### 2026-07-04 考试听力选项图角标

- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：A 区选项图字母改为图片外层角标，图片文件本身不写字母；综合图切分后仍按外层角标展示。
- 设计记录：图片内容保持原图主体，选项字母属于 UI 标识，不压进图片主体。
- 验证：已抽查 2020 嘉定、崇明、黄浦切分图。

### 2026-07-04 考试听力生成区答案

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：文本学习点生成后同步显示本套参考答案。
- 设计记录：参考答案属于生成后的辅助信息，不在未生成状态提前展开。
- 验证：已确认 2020 二模云端每套 25 个答案。

### 2026-07-04 考试听力答案可用提示

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：有参考答案但未提交时只提示已收录答案；提交后才允许生成并展开答案。
- 设计记录：答案状态要可见，但答案内容不能在完成答题前暴露。
- 验证：已做前端脚本语法检查。

### 2026-07-05 口语失败不阻断听力

- 文件：`pages/lesson/index.js`
- 改动：口语录音、上传或评分失败时，若音频已听完，继续按听力完成本条任务。
- 设计记录：口语评分是听后练习，不阻断每日听力打卡主线。
- 验证：已做页面脚本语法检查。

### 2026-07-05 后台阅读活跃与家长昵称

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 改动：后台活跃统计加入阅读完成记录；绑定家长按成员角色展示，王天龙绑定其他学生时显示真实昵称。
- 设计记录：后台学习数以真实完成行为为准，家长关系不因历史占位昵称被隐藏。
- 验证：已查线上 `studyCompletedItems` 与 317613 绑定数据。

### 2026-07-05 家长日报完成记录

- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.js`
- 文件：`pages/parent/detail/index.js`
- 文件：`cloudfunctions/yoyo/services/report.service.js`
- 改动：家长日报和最近记录展示听力、阅读、语法、写作完成内容，详情页直接展示云端完成内容。
- 设计记录：家长视角能看到孩子当天真实完成了什么；日历点亮仍只按原听力打卡规则。
- 验证：已补日报 completionItems 测试。

### 2026-07-05 家长日报阅读详情展开

- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 改动：阅读记录展开时补拉完整题目解析；短语学习记录展开时补拉短语卡片。
- 设计记录：家长日报先显示轻量结果，点开后再加载原题、解析、短语含义和例句。
- 验证：已查 265565 的 `studyCompletedItems` 与 `readingStudyPacks`。

### 2026-07-05 自定义听力计划

- 文件：`pages/level/index.js`
- 文件：`pages/listening-material/index.js`
- 文件：`cloudfunctions/yoyo/services/listening-plan.service.js`
- 改动：音频页按 Pre A1-A2 等级展示素材，素材详情可查看每一条并设置起止、每日数量和遍数。
- 设计记录：佑佑 317613 默认固定阶段计划不迁移；其他学生优先用自定义听力计划，素材预览不计入打卡。
- 验证：已跑云函数测试和页面脚本语法检查。

### 2026-07-05 听力素材计划控件

- 文件：`pages/listening-material/index.js`
- 文件：`pages/listening-material/index.wxml`
- 文件：`pages/listening-material/index.wxss`
- 改动：起止集数、每日数量和遍数增加步进微调；保存计划改为卡片底部对称 action view。
- 设计记录：长范围用滑块，精确集数用步进；主操作嵌入卡片底部，不使用突兀按钮。
- 验证：已做页面脚本语法检查。

### 2026-07-05 佑佑阶段任务展开

- 文件：`cloudfunctions/yoyo/services/level.service.js`
- 文件：`utils/labels.js`
- 文件：`pages/level-stage/index.js`
- 文件：`pages/level-stage/index.wxml`
- 文件：`pages/level-stage/index.wxss`
- 改动：佑佑阶段页材料行先展开当天具体集数，再点击单条进入学习。
- 设计记录：阶段页保留摘要，具体任务按需展开，避免直接跳到未选择的下一步。
- 验证：已做云函数和页面脚本语法检查，并通过云函数全量测试。

### 2026-07-05 听力计划预览加速

- 文件：`cloudfunctions/yoyo/lib/catalog-engine.js`
- 文件：`utils/store.js`
- 改动：New Concept 按真实云存储目录优先扫描，B2 优先 `B2/NewConcept4-US` 并保留旧目录兜底；听力计划预览恢复短缓存；佑佑阶段页不再读取旧阶段缓存；读缓存版本升级避免继续显示旧的“待加入”；New Concept 额外按文件大小识别音频，避免混放 LRC 时漏掉 B1/B2 音频；云函数不再把 New Concept 空数组当作有效运行时缓存。
- 设计记录：级别切换先使用短缓存快速展示，再后台刷新；素材不存在时不把已缓存的 New Concept 目录覆盖为空。
- 验证：已做脚本语法检查，并通过云函数全量测试。

### 2026-07-05 听力计划设置入口

- 文件：`app.json`
- 文件：`pages/level/index.js`
- 文件：`pages/level/index.wxml`
- 文件：`pages/listening-plan/index.js`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-plan/index.wxss`
- 改动：音频页「听力计划」卡片跳转到独立设置页；设置页先选级别，再进入对应素材设置。
- 设计记录：音频页保留素材浏览，计划设置收敛到独立流程；佑佑固定计划只读展示，不影响自定义计划入口。
- 验证：已做页面脚本语法检查。

### 2026-07-05 首页听力计划状态

- 文件：`cloudfunctions/yoyo/lib/dashboard-engine.js`
- 文件：`cloudfunctions/yoyo/services/level.service.js`
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/level-stage/index.js`
- 改动：非佑佑学生没有自定义计划时，首页显示“设置计划”；保存计划后首页按自定义计划展示今日任务并进入今日计划页。
- 设计记录：首页主任务必须反映真实听力计划状态；未设置计划不展示继续学习，自定义计划不套用 A1 阶段命名。
- 验证：已做页面和云函数脚本语法检查。

### 2026-07-05 听力混合计划展示

- 文件：`pages/listening-plan/index.js`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-plan/index.wxss`
- 文件：`pages/level/index.js`
- 文件：`pages/level/index.wxml`
- 文件：`cloudfunctions/yoyo/tests/plan-runtime.test.js`
- 改动：计划设置页展示全部已选素材、每日总条数；音频页顶部同步显示混合计划摘要。
- 设计记录：自定义听力计划按多素材组合呈现，已选状态不只依赖当前级别列表。
- 验证：已补自定义计划多素材混合生成任务测试。

### 2026-07-05 听力计划保存后即时刷新

- 文件：`pages/listening-material/index.js`
- 文件：`pages/level/index.js`
- 文件：`cloudfunctions/yoyo/repositories/listening-plan.repository.js`
- 改动：素材保存后用返回的 activePlan 立即刷新上一页并返回；支持从设置页和音频页两种入口即时更新已选状态；云端 active 计划按最新更新时间读取。
- 设计记录：保存计划是即时反馈动作，不能让用户返回后仍看到旧组合或当前级别未标“已选”。
- 验证：已做页面和云函数脚本语法检查。

### 2026-07-05 听力素材取消计划

- 文件：`pages/listening-material/index.js`
- 文件：`pages/listening-material/index.wxml`
- 文件：`pages/listening-material/index.wxss`
- 文件：`cloudfunctions/yoyo/lib/listening-plan-engine.js`
- 文件：`cloudfunctions/yoyo/services/listening-plan.service.js`
- 文件：`cloudfunctions/yoyo/services/shared.service.js`
- 文件：`cloudfunctions/yoyo/repositories/listening-plan.repository.js`
- 文件：`utils/store.js`
- 改动：已选素材详情页增加取消计划；保存后校验返回 plan 是否包含当前素材，未生效时提示上传云函数。
- 设计记录：素材设置必须有保存和取消两个明确动作；取消到空计划时关闭自定义计划。
- 验证：已补自定义计划取消单个素材测试。

### 2026-07-05 听力保存云函数错误断点

- 文件：`pages/listening-material/index.js`
- 改动：保存计划调试区区分 `cloud-error` 和 activePlan 缺素材，并写出 `cloudError.message`、`syncDebug.reason`、`syncDebug.envId`。
- 设计记录：测试提示只展示已锁定链路代码点；云函数调用失败优先锁定调用链，不误判为计划合并问题。
- 验证：已做页面脚本语法检查。

### 2026-07-05 听力计划极简版式

- 文件：`pages/listening-plan/index.js`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-plan/index.wxss`
- 改动：设置页拆成“听力计划”和“添加素材”，已选素材只在上方显示，底部固定清空和完成。
- 设计记录：计划页只保留当前结果、添加入口、完成动作；已选素材不在可选列表重复出现。
- 验证：已做页面脚本语法检查。

### 2026-07-05 听力级别快照加载

- 文件：`pages/level/index.js`
- 文件：`pages/level/index.wxml`
- 文件：`pages/level/index.wxss`
- 文件：`pages/listening-plan/index.js`
- 文件：`pages/listening-plan/index.wxml`
- 文件：`pages/listening-plan/index.wxss`
- 文件：`utils/store.js`
- 改动：音频页和设置计划页切换级别改为快照优先、按需加载、后台刷新；首次无快照时显示轻量加载态。
- 设计记录：切级别不等待全量云端扫描；已加载级别作为页面快照即时展示，云端返回只更新当前级别。
- 验证：已做页面脚本语法检查。

### 2026-07-06 听力计划时长展示

- 文件：`cloudfunctions/yoyo/lib/listening-plan-engine.js`
- 文件：`cloudfunctions/yoyo/lib/dashboard-engine.js`
- 文件：`cloudfunctions/yoyo/services/listening-plan.service.js`
- 文件：`pages/listening-material/index.js`
- 文件：`pages/listening-material/index.wxml`
- 文件：`pages/listening-material/index.wxss`
- 文件：`pages/listening-plan/index.js`
- 文件：`pages/level/index.js`
- 文件：`pages/home/index.js`
- 改动：素材设置页、设置计划页、音频页和首页今日任务展示真实音频时长与预计每日总时长。
- 设计记录：时长只放在计划决策点；单条显示精确时长，总计划显示预计分钟，缺少时长时显示“时长待生成”。
- 验证：已做页面和云函数脚本语法检查。

### 2026-07-06 听力学习包返回兜底

- 文件：`pages/lesson/index.js`
- 文件：`pages/material/detail/index.js`
- 改动：听力学习包首次请求未返回卡片时，立即二次读取云端缓存；仍失败时显示具体返回异常。
- 设计记录：生成中断不能停在无反馈状态；已生成内容优先展示，错误只作为兜底提示。
- 验证：已做页面脚本语法检查。

### 2026-07-06 考试听力播放器

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：听力练习页从单一播放按钮升级为播放器，支持播放/暂停、前后 15 秒、拖动进度和当前/总时长。
- 设计记录：考试听力播放器只保留完成听题必需控制，主播放键居中，时间与进度始终可见。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 考试听力播放器触感

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：播放器控制区改为更轻的 view 控件样式，增加凹陷按压态，并把拖动精度提升到 1000 档。
- 设计记录：播放器按钮避免整块矩形压迫感；轻操作用胶囊按钮，主操作保持居中但保留按下反馈。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 考试听力播放器按键距离

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 改动：撤掉震动反馈，按钮组改为居中紧凑布局，并用下沉和内阴影表达按下状态。
- 设计记录：播放器控制键不贴边分散；三个高频按钮保持在拇指短距离移动范围内。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 后台家长可同时作为学生

- 文件：`cloudfunctions/yoyo/services/admin.service.js`
- 改动：不再因账号绑定过其他学生就隐藏其本机学生账号。
- 设计记录：学生列表表达学生账号，绑定关系表达家长身份，两种角色可并存。
- 验证：已做云函数脚本语法检查。

### 2026-07-06 首页听力查看记录调试

- 文件：`pages/home/completed/index.js`
- 文件：`pages/home/completed/index.wxml`
- 文件：`pages/home/completed/index.wxss`
- 改动：今日听力入口进入完成页时只展示听力相关记录，非听力返回项写入页面调试断点。
- 设计记录：测试阶段错误必须在页面写出具体链路位置；正式确认后再撤调试卡片。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 听力学习包超时提示

- 文件：`pages/lesson/index.js`
- 文件：`pages/material/detail/index.js`
- 文件：`domain/cloud/index.js`
- 文件：`cloudfunctions/yoyo/services/listening.service.js`
- 文件：`cloudbaserc.json`
- 改动：学习包未拿到卡片时不再提示生成成功；前端和云函数生成链路最长等待 180 秒。
- 设计记录：学习包生成结果必须以实际卡片为准，允许慢生成，但不能把失败说成成功。
- 验证：已做页面和云函数脚本语法检查。

### 2026-07-06 今日完成查看任务顺滑进入

- 文件：`pages/home/index.js`
- 文件：`pages/home/completed/index.js`
- 改动：首页完成缓存带上任务快照，今日完成页点击任务前写入课程快照，避免课程页先闪加载/异常态。
- 设计记录：从已完成列表查看任务应使用当前页面已有快照先渲染，云端刷新只做后台补全。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 Unlock3 练习册学习包入口保留

- 文件：`pages/lesson/index.wxml`
- 改动：文本加载为空时保留文本学习卡片并展示错误，不因 `transcriptPendingLoad=false` 整块消失。
- 设计记录：学习包入口点击后必须保留反馈位置，不能把失败态从页面移除。
- 验证：已做页面脚本语法检查；已上传 Unlock3 transcript bundle 到云存储。

### 2026-07-06 今日完成查看学习包

- 文件：`pages/home/completed/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 改动：听力学习包记录显示“查看学习包”，进入课程页后自动加载缓存学习包并滚到文本学习区。
- 设计记录：完成列表的动作文案必须匹配记录类型；学习包入口进入后直接定位学习包内容。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 今日完成仅保留听力打卡

- 文件：`pages/home/index.js`
- 文件：`pages/home/completed/index.js`
- 改动：首页今日任务入口只保留听力/口语播放任务，学习包、词汇、阅读等学习记录不再进入该入口。
- 设计记录：今日任务卡片承载当天听力音频播放打卡；学习包查看放在记录/日报链路。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 家长日报按日期和模块归类

- 文件：`pages/parent/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 改动：完成内容先按日期归组，再在日期内按听力、口语、阅读、语法、写作、词汇归类。
- 设计记录：日报内容先回答“哪一天”，再回答“哪个模块”，避免不同日期和模块混排。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 日报听力学习包可查看

- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 改动：日报详情识别听力学习包，点击前写入课程快照，再进入课程页并定位学习包区。
- 设计记录：学习包记录的主动作必须是“查看学习包”；跨页查看先用快照渲染，云端刷新只做补全。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 家长日报移除独立完成内容入口

- 文件：`pages/parent/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 改动：家长日报首页移除“完成内容”区块，不再主动拉 90 天完成内容。
- 设计记录：今日看今日，历史从“最近 7 天”进入日期详情后按需加载，避免首页入口重复。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 日报学习包只读缓存

- 文件：`pages/parent/detail/index.js`
- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 改动：日报进入已生成学习包前只读缓存并写快照，课程页优先用快照恢复；已生成状态下按钮显示“已生成”且不再调用模型。
- 设计记录：已生成学习包是查看行为，不是生成行为；只有没有成功记录或失败状态的主动生成才允许调用模型。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 已生成学习包同步查看

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 改动：已生成但本页未显示卡片时，按钮改为“同步”，只读快照/缓存并显示学习包。
- 设计记录：已生成但未展示时不能禁用入口；同步查看只读缓存，不能触发模型生成。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-06 词汇音标格式兜底

- 文件：`pages/reading/flashcards/index.js`
- 改动：词汇闪卡渲染前统一把音标格式化为 `/.../`，兼容真机旧缓存。
- 设计记录：音标展示必须稳定带边界符号，不能受缓存版本影响。
- 验证：已做页面脚本语法检查。

### 2026-07-06 口语评分成功后隐藏调试

- 文件：`pages/lesson/index.js`
- 改动：口语评分成功返回后清空页面 DEBUG，只在评分 pending 或失败时保留链路信息。
- 设计记录：调试信息只服务异常定位，成功态只展示学生可理解的评分反馈。
- 验证：已做页面脚本语法检查。

### 2026-07-06 家长日报模块分析首显

- 文件：`pages/parent/index.js`
- 文件：`cloudfunctions/yoyo/services/report.service.js`
- 改动：日报首页先显示摘要快照；模块分析云端摘要并发读取，不再等待完整 dashboard。
- 设计记录：日报模块分析属于首屏摘要，必须先可见，详情数据按点击查看再加载。
- 验证：已做页面和云函数脚本语法检查、服务测试和 diff 空白检查。

### 2026-07-07 听力练习详情调试断点

- 文件：`pages/material/index.js`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`cloudfunctions/yoyo/services/catalog.service.js`
- 改动：听力练习详情兼容旧快照包裹结构，展示素材链路 DEBUG，并用素材真实字段兜底回源。
- 设计记录：测试阶段素材详情缺标题、音频或题目时，页面必须显示具体链路断点。
- 验证：已做页面和云函数脚本语法检查、diff 空白检查。

### 2026-07-07 新概念回答问题快照补全

- 文件：`cloudfunctions/yoyo/services/task.service.js`
- 改动：课程页从快照进入时，普通计划先用当天 canonical task 补齐第二阶段新概念回答问题字段；补全失败才显示链路 DEBUG。
- 设计记录：快照只用于快速首显，不能覆盖云端任务规则；关键交互状态必须以云端 canonical task 为准；测试断点成功态不显示，失败态写明页面、store、云函数和 target child。
- 验证：已做云函数脚本语法检查。

### 2026-07-07 词汇书音标调试断点

- 文件：`pages/reading/flashcards/index.js`
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 文件：`utils/store.js`
- 改动：初中词汇书列表显示音标；进入词汇书时写出云存储 JSON、phonetic、缓存和 target debug；词书写云端补 selected target。
- 设计记录：测试阶段词汇书字段异常必须在页面给可复制链路断点；词库浏览态也要显示音标，不只在单张背诵卡显示。
- 验证：已拉取线上初中词汇 JSON 确认 1690/1690 条有 `/.../`；已做页面和 store 脚本语法检查。

### 2026-07-07 家长日报今日学习量

- 文件：`pages/parent/index.js`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`cloudfunctions/yoyo/services/report.service.js`
- 改动：家长日报“模块分析”改为“今日学习量”，只统计当天；听力显示分钟，阅读/写作显示篇数，语法显示题数，词汇显示单词数；最近 7 天折叠，点击查看后再加载；日期详情里的学习内容只按需展示阅读、语法、写作和已完整生成的听力学习包，不展示词汇背诵。
- 设计记录：家长页首屏模块数字必须有明确单位；最近 7 天和日期详情学习内容属于次级内容，不参与首屏加载；听力学习包必须已有生词、短语、句型三类内容才进入日期详情学习内容列表。
- 验证：已做页面和云函数脚本语法检查。

### 2026-07-07 听力练习文本学习门槛

- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 改动：一模二模听力未提交前隐藏生成入口，只提示是否有参考答案；提交后才可查看答案并生成文本学习。
- 设计记录：听力练习顺序必须是先完成答题提交，再进入答案和文本学习，避免学生先看材料。
- 验证：已做页面脚本语法检查和 diff 空白检查。

### 2026-07-07 学习包手动加入词库

- 文件：`cloudfunctions/yoyo/services/listening.service.js`
- 文件：`cloudfunctions/yoyo/services/reading.service.js`
- 文件：`cloudfunctions/yoyo/services/flashcard.service.js`
- 文件：`pages/material/detail/index.js`
- 文件：`pages/material/detail/index.wxml`
- 文件：`pages/material/detail/index.wxss`
- 文件：`pages/reading/detail/index.js`
- 文件：`pages/reading/detail/index.wxml`
- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 改动：学习包生成只展示，不自动写入词库；学生可逐条把单词、短语、句型加入我的词库。
- 设计记录：我的词库必须来自学生明确选择，学习包内容不默认进入。
- 验证：已做相关页面和云函数脚本语法检查、diff 空白检查。

### 2026-07-07 口语按键轻柔反馈

- 文件：`pages/speaking/index.wxml`
- 文件：`pages/speaking/index.wxss`
- 文件：`pages/lesson/index.wxml`
- 文件：`pages/lesson/index.wxss`
- 改动：口语听问题、按住回答、开始/停止录音、播放录音和播放建议统一使用轻柔按压反馈。
- 设计记录：口语录音和回放属于高频动作，按压反馈必须与全局按钮一致，轻微下沉、柔和回弹。
- 验证：已做口语和课程页脚本语法检查、diff 空白检查。

### 2026-07-07 词汇背诵按键轻柔反馈

- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：背诵态“不认识 / 我认识 / 下一个”显式使用全局轻柔按压反馈。
- 设计记录：背诵选择是高频动作，反馈必须轻微下沉、柔和回弹，避免快速闪烁。
- 验证：已做词汇页脚本语法检查、diff 空白检查。

### 2026-07-07 我的页真实身份快照

- 文件：`pages/profile/index.js`
- 文件：`pages/profile/index.wxml`
- 改动：我的页按当前学生目标读取身份快照，空昵称/默认昵称不参与首屏首显；无真实快照时不先展示“同学”和昵称必填区。
- 设计记录：身份页首屏必须先展示真实学生字段或保持等待，不允许用默认昵称制造闪烁。
- 验证：已做页面脚本语法检查、diff 空白检查。

### 2026-07-07 首页身份切换首显加速

- 文件：`pages/home/index.js`
- 改动：选择学生/家长后立即隐藏身份卡并用本地首页缓存首显，云端身份确认和真实首页刷新后台补齐；提示停留缩短。
- 设计记录：首页身份切换的第一反馈必须轻，首屏列表优先展示已有真实缓存，不等待身份接口串行返回。
- 验证：已做页面脚本语法检查、diff 空白检查。

### 2026-07-07 我的页与音频页首显性能收口

- 文件：`pages/profile/index.js`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.wxss`
- 文件：`pages/level/index.js`
- 文件：`pages/level/index.wxml`
- 文件：`pages/level/index.wxss`
- 文件：`cloudfunctions/yoyo/services/family.service.js`
- 改动：撤掉真机调试可见断点；保留我的页快照/缓存首显后延迟后台刷新；保留音频页手动切换 level 时已有真实缓存直接首显、随后静默刷新。
- 补充：`getProfileData` 收窄为只返回身份页字段，不再等待 dashboard 统计。
- 设计记录：验证完成后不保留页面 debug 区；首屏必须按真实快照/缓存先展示，云端刷新只做后台校准。
- 验证：已做页面脚本语法检查、diff 空白检查。

### 2026-07-07 家长音频试听态

- 文件：`pages/lesson/index.js`
- 文件：`pages/lesson/index.wxml`
- 文件：`cloudfunctions/yoyo/services/shared.service.js`
- 改动：课程详情页只有学生身份且云端允许写进度时显示“训练中”；家长/预览听音频显示“试听中”，听完只轻提示“试听完成”。
- 设计记录：家长身份听音频属于试听，不进入打卡训练态；“训练中”只用于学生打卡记录链路。
- 验证：已做课程页和云函数脚本语法检查、身份测试、diff 空白检查。

### 2026-07-07 设备级身份

- 文件：`utils/store.js`
- 文件：`cloudfunctions/yoyo/services/identity.service.js`
- 文件：`cloudfunctions/yoyo/services/shared.service.js`
- 文件：`cloudfunctions/yoyo/lib/request-context-engine.js`
- 文件：`cloudfunctions/yoyo/repositories/device-session.repository.js`
- 改动：每台设备生成隐藏 `deviceId`，云端按 `openId + deviceId + familyId + childId` 保存家长/学生身份。
- 设计记录：同一微信多设备身份互不覆盖；学生设备进入训练与打卡，家长设备进入查看与试听。
- 验证：已做前端/云函数脚本语法检查、身份测试、diff 空白检查。

### 2026-07-07 绑定关系显示名

- 文件：`pages/identity/index.wxml`
- 文件：`pages/family/index.wxml`
- 文件：`cloudfunctions/yoyo/services/family.service.js`
- 文件：`cloudfunctions/yoyo/lib/family-engine.js`
- 改动：学号绑定显示为“绑定账号自己的学生昵称 · 和孩子关系”，并保存昵称与关系字段。
- 设计记录：绑定列表必须同时说明“谁绑定了”和“与学生是什么关系”，避免只显示设备或单一称呼。
- 验证：已做页面和云函数脚本语法检查、身份测试、diff 空白检查。

### 2026-07-08 入口快照规则收紧

- 文件：`utils/store.js`
- 文件：`pages/home/completed/index.js`
- 改动：课程详情和家庭页恢复读缓存首显；今日完成进入课程页时不再前端推断音频路径，只保留云端真实播放字段。
- 设计记录：快照只能承接上一页已有的云端真实字段；缺首动作字段时由详情页回源补全，不能用前端猜测字段制造可播放假象。
- 验证：已做脚本语法检查、身份/请求上下文测试、diff 空白检查。

### 2026-07-08 阅读写作语法入口瘦身

- 文件：`cloudfunctions/yoyo/services/catalog.service.js`
- 文件：`pages/writing/detail/index.js`
- 文件：`pages/grammar/index.js`
- 改动：写作入口目录只返回列表字段，作文详情点击后按需补完整题干；语法入口不再等待一模/二模都返回，任一目录先到先渲染。
- 设计记录：入口首屏只承载目录字段；完整题干、题目正文和解析必须按用户点击后加载，不能让首屏承担全量内容体积。
- 验证：已做脚本语法检查、身份/请求上下文测试、diff 空白检查。

### 2026-07-08 首页听力入口预热

- 文件：`pages/home/index.js`
- 改动：首页空闲时预取听力一模/二模目录并写入听力入口快照。
- 设计记录：首页入口可提前准备下一页首屏字段，但只能写云端返回的真实目录字段，不能补造播放字段。
- 验证：已做脚本语法检查、身份/请求上下文测试、diff 空白检查。

### 2026-07-08 后台剪切板权限移除

- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 改动：后台学号改为仅展示，不再点击复制到剪切板。
- 设计记录：非必要调试便利功能不占用用户隐私权限；后台只展示 ID，避免触发剪切板隐私声明。
- 验证：已做剪切板 API 搜索。

### 2026-07-08 后台复制学号保留

- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`docs/PRIVACY_AND_REVIEW.md`
- 改动：恢复后台点击复制学号，并补充剪切板写入用途说明。
- 设计记录：保留管理员排查效率时，隐私说明必须限定为复制学生登录 ID，不描述读取剪切板。
- 验证：已做脚本语法检查和剪切板 API 搜索。

### 2026-07-08 后台复制学号再移除

- 文件：`pages/admin/index.js`
- 文件：`pages/admin/index.wxml`
- 文件：`docs/PRIVACY_AND_REVIEW.md`
- 改动：删除后台复制学号能力，并移除剪切板用途说明。
- 设计记录：为减少提审隐私能力，后台 ID 仅展示不写入剪切板。
- 验证：已做脚本语法检查和剪切板 API 搜索。

### 2026-07-09 音频分级切换首显

- 文件：`pages/level/index.js`
- 改动：音频页进入后立即并行预取各级别；无快照时先显示本地级别素材骨架，云端返回后覆盖真实数量和选中状态。
- 设计记录：级别切换不能等待当前级别刷新完成才预热其他级别；B1/B2 这类多素材级别必须先给可点击目录，再后台刷新真实字段。
- 验证：已做脚本语法检查、身份/请求上下文测试、diff 空白检查。

### 2026-07-09 口语评分前端等待时长

- 文件：`domain/cloud/index.js`
- 改动：新概念问题回答和口语评分云函数前端等待时长从 70 秒放宽到 160 秒。
- 设计记录：口语评分链路会串行经过录音下载、转写、可选 SOE、内容模型和记录写入；前端等待必须低于云函数 180 秒上限但不能早于云端正常返回。
- 验证：已做脚本语法检查。

### 2026-07-09 Unlock4 练习册入口

- 文件：`cloudfunctions/yoyo/lib/listening-plan-engine.js`
- 文件：`cloudfunctions/yoyo/lib/task-presenter.js`
- 文件：`utils/labels.js`
- 改动：B2 音频材料新增 Unlock 4 练习册独立入口，课本和练习册标签分开展示。
- 设计记录：同级别同系列的课本/练习册必须作为独立材料项出现，不能合并到课本目录里。
- 验证：已做 catalog、request-context、level-engine  focused tests。

### 2026-07-10 家长日报高级内容化

- 文件：`pages/parent/index.wxml`
- 文件：`pages/parent/index.wxss`
- 文件：`pages/parent/detail/index.js`
- 文件：`pages/parent/detail/index.wxml`
- 文件：`pages/parent/detail/index.wxss`
- 改动：家长日报首页改为家庭观察、今日结论、学习画像和最近节奏；日报详情改为学习节奏、声音档案、内容案卷。
- 设计记录：家长日报不再使用后台列表和指标堆叠；真实数据用叙事卡、节奏轨迹、录音声纹和内容案卷承载，保持雾蓝科技感与首页一致。
- 验证：已做父母日报 JS 语法检查、diff 空白检查、旧米色/旧列表类扫描。

### 2026-07-10 语法、计划、词汇、学号细节修正

- 板块：语法
- 文件：`pages/grammar/index.wxml`
- 文件：`pages/grammar/index.wxss`
- 改动：语法首页文案改为“把一句话讲明白”，右侧图形改为主谓宾语法讲解板。
- 设计记录：语法入口强调讲解与理解，不使用网络节点或诊断后台感图形。
- 验证：已做页面脚本语法检查、diff 空白检查和旧文案扫描。

- 板块：首页计划入口
- 文件：`pages/home/index.js`
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：今日听力有计划/无计划统一两行信息结构，设置计划按钮改为雾蓝玻璃轻按钮，无计划时目标区显示待设置。
- 设计记录：计划入口必须在有计划和无计划状态下保持文案长度、按钮位置和视觉重心对称。
- 验证：已做首页脚本语法检查、diff 空白检查和旧箭头文案扫描。

- 板块：词汇背诵
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：背诵页收紧单词、音标、听音和判断按钮之间的距离，降低底部割裂感。
- 设计记录：背诵页要让视觉焦点和手部操作在同一学习区域内，不用大面积空白把词和动作拆开。
- 验证：已做词汇页脚本语法检查、WXSS 结构检查和 diff 空白检查。

- 板块：身份文案
- 文件：`pages/family/index.js`
- 文件：`pages/family/index.wxml`
- 文件：`pages/profile/index.wxml`
- 文件：`pages/parent/index.wxml`
- 文件：`pages/identity/index.js`
- 文件：`pages/identity/index.wxml`
- 文件：`pages/home/index.wxml`
- 文件：`cloudfunctions/yoyo/services/family.service.js`
- 文件：`cloudfunctions/yoyo/facades/family-context.facade.js`
- 文件：`cloudfunctions/yoyo/tests/family-identity.test.js`
- 改动：用户可见的账号编号类文案统一改为学号。
- 设计记录：面向家长和学生的账号识别文案统一使用“学号”，降低后台字段感。
- 验证：已做残留文案扫描、相关脚本语法检查和 family-identity 测试。

### 2026-07-10 我的页昵称与入口减噪

- 板块：我的
- 文件：`pages/profile/index.wxml`
- 文件：`pages/profile/index.wxss`
- 改动：昵称卡左侧竖形装饰改为轻量学习签名图形；移除“学习身份”标题和分隔线。
- 设计记录：我的页身份入口不再使用无信息量标题行，昵称图形必须服务于个人学习档案语义。
- 验证：已做 profile 脚本语法检查、diff 空白检查和旧类名/旧文案扫描。

### 2026-07-10 词汇背诵操作区固定

- 板块：词汇背诵
- 文件：`pages/reading/flashcards/index.wxml`
- 文件：`pages/reading/flashcards/index.wxss`
- 改动：复习卡加入单词/短语/句型类型样式；词面区、释义区、操作区改为固定分段，“我认识”和“下一个”保持同一操作高度。
- 设计记录：词汇背诵页的主操作按钮必须在翻面前后保持稳定位置，短语和句型通过字号与行高自适应，不挤压操作区。
- 验证：已做 flashcards 脚本语法检查、WXSS 结构检查和 diff 空白检查。

### 2026-07-10 首页设置计划按钮强调色

- 板块：首页
- 文件：`pages/home/index.wxss`
- 改动：“设置计划”和“继续学习”按钮统一为低饱和橙色渐变。
- 设计记录：首页今日听力主动作统一使用橙色强调，但保留当前圆角、尺寸和对称布局。
- 验证：已做首页脚本语法检查和 diff 空白检查。

### 2026-07-10 首页今日听力说明减噪

- 板块：首页
- 文件：`pages/home/index.wxml`
- 文件：`pages/home/index.wxss`
- 改动：移除今日听力主卡内的任务进度/预计时长说明，仅保留标题和主动作。
- 设计记录：今日目标已有进度与分钟数时，主卡不重复展示同类说明，避免信息堆叠。
- 验证：已做首页脚本语法检查、diff 空白检查和旧说明类名扫描。

### 2026-07-10 首页学习报告连接日报

- 板块：首页
- 文件：`pages/home/index.js`
- 改动：首页底部“学习报告”入口从成长页改为直接进入家长日报页。
- 设计记录：首页学习报告承接日报心智，点击后直接查看当天家庭观察日报。
- 验证：已做首页脚本语法检查和 diff 空白检查。

## 后续记录格式

### 2026-07-09 首页今日完成调试信息收口

- 文件：`pages/home/completed/index.wxml`
- 改动：今日完成页调试断点仅在 `showCloudDebug` 开启时显示。
- 设计记录：首页“查看记录”入口面向正式用户时不能出现 DEBUG、修复点或调试断点文案。
- 验证：已做首页入口静态检查和脚本语法检查。

每次 UI/交互改动后追加：

```md
### YYYY-MM-DD 模块名

- 文件：`path`
- 改动：一句话说明。
- 设计记录：本次新增或修正的视觉/交互规则。
- 验证：实际跑过的检查。
```

### 2026-07-10 全入口首屏性能验收

- 文件：`utils/page.js`、`pages/material/index.js`、`pages/level/index.js`、`pages/reading/index.js`、`pages/grammar/index.js`、`pages/record/index.js`、`pages/profile/index.js`
- 文件：`pages/material/index.wxml`、`pages/material/index.wxss`、`pages/material/detail/index.wxml`、`pages/level/index.wxml`、`pages/grammar/index.wxml`、`pages/record/index.wxml`、`pages/profile/index.wxml`、`pages/profile/index.wxss`
- 改动：补齐听力/写作、音频、阅读、我的入口的 `pageReady`、`cacheHit`、`cloudRefresh` 埋点和自动门槛判断；音频/成长页移除等待文案，材料页和我的页冷启动显示稳定骨架。
- 设计记录：入口速度必须能区分快照、缓存、云端和失败来源；冷启动不显示空主体或“加载中/同步中”等等待文案。
- 验证：已做相关页面脚本语法、等待文案、WXSS 结构、快照测试和云函数全量测试。

### 2026-07-10 全页面加载性能收口

- 文件：`pages/**/index.js`、`pages/**/index.wxml`、`utils/page.js`、`utils/store.js`
- 改动：22 个注册页面全部接入 `pageReady` 性能埋点和自动门槛判断；二级页补齐快照、持久缓存或静态首显；后台列表加入短缓存。
- 设计记录：所有页面都必须可量化区分缓存与冷启动，缓存目标小于 300ms、冷启动目标小于 1200ms；页面与次级操作不显示等待文案，状态通过稳定骨架、按钮禁用或已有内容表达。
- 验证：全页面埋点覆盖 22/22；全局等待文案和 `showLoading` 扫描为 0；页面脚本语法检查通过；快照测试 2/2、云函数测试 73/73 通过。

### 2026-07-10 阅读入口预取加速

- 文件：`pages/home/index.js`、`pages/reading/index.wxml`
- 改动：首页稳定后后台预取阅读目录并写入快照，进入阅读时再次确保预取；目录骨架移除等待文案。
- 设计记录：首页入口页的重目录在用户点击前预取，页面跳转优先命中真实云端快照。
- 验证：阅读首次实测暴露 2901ms 不达标后完成修复，需重新编译复测快照首显。

### 2026-07-10 全入口实机复测收口

- 文件：`pages/home/index.js`、`pages/level/index.js`、`pages/record/index.js`、`pages/profile/index.js`、`pages/material/index.js`、`pages/reading/flashcards/index.js`、`pages/speaking/index.wxml`
- 改动：首页预取阅读、音频、成长和我的首屏数据；音频、材料、成长、个人快照按模块/身份分区；词汇书库改为静态首显，去除非必要云端刷新与等待文案。
- 设计记录：首屏埋点以“首个可操作内容已渲染”为准，云端刷新不阻断已有快照或本地入口。
- 验证：开发者工具实测阅读 23ms、语法 701ms、词汇 21ms、写作 938ms、听力 4ms、口语 19ms、音频 9ms、成长 7ms、我的 6ms，均通过首屏门槛。

### 2026-07-10 语法与写作二次提速

- 文件：`pages/home/index.js`、`pages/material/index.js`、`pages/grammar/index.js`、`pages/reading/index.js`、`pages/level/index.js`
- 改动：首页新增写作目录和一模/二模语法摘要预取；目录快照改为 7 天内先显后刷新；音频次级分级从首屏并发改为首屏完成后串行预取。
- 设计记录：静态目录类数据允许 7 天快照首显，后台刷新不清空已有内容；骨架屏不显示等待文案。
- 验证：开发者工具复测写作 9ms、语法 3ms，均命中快照并低于 300ms。

### 2026-07-10 雾蓝玻璃首页目标时长防换行

- 板块：首页
- 文件：`pages/home/index.wxss`
- 改动：“今日目标”玻璃卡向右加宽，目标数值及“分钟/小时”单位强制保持同一行，进度圆环禁止压缩。
- 设计记录：大数值下优先保证时长语义完整，不允许单位单独掉到下一行。
- 验证：已做 WXSS 结构和 diff 空白检查。
