# 图书馆静谧主题：听力模块设计规范

## 1. 范围

- 主题：`themeId=library`，模块皮肤：听力。
- 只覆盖现有听力相关页面，不新增业务路径。
- 页面：
  - `pages/material/index?module=listening`
  - `pages/listening-plan/index?levelId={levelId}`
  - `pages/listening-material/index?levelId={levelId}&category={category}`
  - `pages/material/detail/index?itemId={itemId}`
- 课程音频入口仍走现有 `wx.switchTab('/pages/level/index')`。
- 素材任务预览仍走 `/pages/lesson/index?category={category}&taskId={taskId}&planRunType=preview&source=catalog`。
- 视觉板示例内容只作布局占位；实现必须读取现有字段。

## 2. 真实字段与状态

### 目录页 `material(listening)`

- 入口字段：`moduleId/title/eyebrow/copy/itemUnit/showCefrEntry`。
- 目录字段：`stages/exams/districts/items/selectedStageId/selectedExamId/selectedDistrict`。
- 内容字段：`stage/exam/district/count/title/year/examType/materialItemId/transcript`。
- 状态字段：`loading/pageReady/debugLines`。
- 动作：`openCefrListening/selectStage/selectExam/selectDistrict/backToStages/backToExams/backToDistricts/openItem`。

### 计划页 `listening-plan`

- 入口字段：`selectedLevel/levelTabs/materials/activePlan/fixedPlan/isYoyoFixedPlan`。
- 摘要字段：`selectedRows/selectedCount/dailyTotal/planSummaryText`。
- 行字段：`category/levelId/title/meta/countText/stateText/disabled`。
- 状态字段：`levelLoading/clearing`。
- 动作：`chooseLevel/openMaterial/finishPlan/clearPlan/openFixedStage`。

### 素材设置页 `listening-material`

- 入口字段：`levelId/category/categoryLabel/totalCount/sliderMax/tasks`。
- 计划字段：`startNo/endNo/dailyCount/repeatTarget/isSelected/planDurationText/durationReady`。
- 任务字段：`itemNo/title/subtitle/durationText/exactDurationText/taskId/taskSnapshot`。
- 状态字段：`saving/debugLines`。
- 动作：`changeStart/changeEnd/changeDailyCount/changeRepeatTarget/stepValue/savePlan/cancelPlan/openTask`。

### 套卷详情页 `material/detail`

- 入口字段：`item/title/year/district/examType/questions/images/transcript/answerSummary`。
- 音频字段：`audioSrc/audioLoading/audioError/isPlaying/audioDuration/audioCurrentText/audioDurationText/audioProgress/audioEnded/audioLocked`。
- 答题字段：`selectedAnswer/inputValue/submitted/correctCount/optionsList/answer/correct`。
- 学习包字段：`studyPack/studyLoading/studyError/studyTabs/activeStudyTab/studyCompleted/transcriptVisible/studyDictionaryAddedMap`。
- 状态字段：`debugLines/dictionaryAdding`。
- 动作：`toggleAudio/seekAudio/changingAudioProgress/changeAudioProgress/selectOption/inputAnswer/submit/loadStudyPack/selectStudyTab/addStudyCardToLibrary/completeStudy`。

## 3. 听力主题母题

- 黄铜时间轴：只表达真实播放进度、计划范围、目录层级，不做装饰性假进度。
- 声音书签：用于当前入口、选中素材、当前题组；不在每一行重复同款图标。
- 转写边注：承载 transcript、参考答案、学习包和 debugLines。
- 唱针刻度：播放器主控、素材范围尺、计划节点使用同一套短刻度语言。

## 4. Token

| Token | 值 | 用途 |
|---|---:|---|
| `--library-listening-bg` | `#FAF5EA` | 页面底色 |
| `--library-listening-paper` | `#F3E8D4` | 纸面、答题册、索引页 |
| `--library-listening-ink` | `#14283A` | 标题、深色播放器、选中态 |
| `--library-listening-wood` | `#2B211B` | 桌沿、底栏、深色压边 |
| `--library-listening-brass` | `#B89562` | 主动作、刻度、页签 |
| `--library-listening-moss` | `#7F8C78` | 完成态 |
| `--library-listening-muted` | `#6F675F` | 副信息 |
| `--library-listening-error` | `#9A5F55` | 错误边注 |
| `--library-listening-line` | `rgba(184,149,98,.42)` | 纸线、刻度线 |
| `--library-listening-shadow` | `0 6rpx 18rpx rgba(43,33,27,.12)` | 短纸张阴影 |
| `--library-listening-radius` | `8px` | 圆角上限 |

规则：

- 背景是米白纸面加局部木纹/桌沿，不做整屏棕色。
- 深色只给播放器、书脊入口和底部导航，避免雾蓝玻璃感。
- 禁用大圆角、玻璃模糊、珊瑚渐变、圆形声波 orb。
- 主按钮：墨蓝底、米白字、黄铜细边；完成态用苔藓绿。
- 错误态：砖红边注和文字，不铺满红底。

## 5. 目录页：`pages/material/index?module=listening`

### 入口

- 从首页“听力”模块进入。
- 首屏保留真实文案：`英语听力 / 听力 / 按学段和模考类型选择听力音频。`
- 顶部右侧为竖向声音书签，替代雾蓝波形。

### 布局层级

1. 馆藏题录页眉：标题、说明、声音书签。
2. 课程音频库入口：单本墨蓝书脊，文案 `A1-C2 听力内容 / 课程音频库`。
3. 考试听力索引册：学段、模考、区县、套卷在同一纸册位置原位切换。
4. 当前层级返回：`‹ 学段`、`‹ 模考`、`‹ 区县`，作为轻量文本图标。

### 状态

- 加载：`pageReady` 后先显示页眉；无缓存时索引册显示 3 行纸张骨架，文案“正在整理馆藏”。
- 空：当前层级数组为空时显示现有“暂无内容。”；保留返回，不推荐其他内容。
- 正常：行内显示真实 `stage/exam/district/count`；套卷行显示 `title` 与 `year · district · examType`。
- 完成：本页无完成字段，不显示完成率、已练或进度。
- 错误：`debugLines.length` 时作为可复制边注，保留缓存目录；无缓存时仍显示空索引页。

### 交互

- 整行点击下钻或进入套卷；不再放同权重“练习”按钮。
- `openCefrListening` 入口视觉权重最高，但只作为课程音频库入口。
- 套卷行不展开 transcript 作为主交互；现有展开能力只作调试/兼容，不作为 library 主视觉。

### 区别于雾蓝玻璃

- 雾蓝：玻璃 hero、横向 tile、圆形声波。
- 图书馆：书脊入口、纸质索引册、黄铜编号页签。

## 6. 计划页：`pages/listening-plan/index`

### 入口

- 从课程音频或计划设置入口进入，默认 `selectedLevel=A1`，也支持路由 `levelId`。
- `isYoyoFixedPlan` 为真时保留“佑佑当前计划 / 查看”入口。

### 布局层级

1. 借阅计划单页头：`听力计划 / 设置计划 / {selectedLevel} · 选择素材和范围`。
2. 今日计划尺：`planSummaryText` 为主句，`dailyTotal` 做黄铜圆章。
3. 已选时间轴：`selectedRows` 沿纵向黄铜线排列，每行显示 `title` 与 `meta`。
4. 添加素材目录：`levelTabs` 做书页索引签，`materials` 做书目行。
5. 底部动作：轻操作“清空计划”，强动作“完成”。

### 状态

- 加载：`levelLoading` 只影响添加素材区；已选计划和缓存摘要不被骨架遮住。
- 空：`!selectedRows.length` 显示“还没有听力计划 / 先从下面添加一个素材。”，下方素材仍可添加。
- 正常：已选行显示真实 `start-end · 每天 n 条 · n 遍 · 每日约...`。
- 完成：素材保存后回到本页，新增项成为时间轴节点；点击“完成”才 `navigateBack`。
- 错误：加载返回 `cloud-error` 且无缓存时，添加区显示“暂时无法加载”；清空失败只 toast“清空失败”，不先清空 UI。

### 交互

- `chooseLevel`：C1/C2 仍显示“未开放”，点击 toast“暂未开放”。
- `openMaterial`：整行进入素材设置，右侧 `添加/等待/编辑` 只是状态文字。
- `clearPlan`：保留现有确认弹窗文案“清空后今日听力计划会重新设置。”
- `finishPlan`：页面唯一强动作。

### 区别于雾蓝玻璃

- 雾蓝：摘要卡、素材卡、列表同形。
- 图书馆：计划单 + 时间轴 + 书目目录，信息密度更像借阅排程。

## 7. 素材设置页：`pages/listening-material/index`

### 入口

- 从计划页 `openMaterial` 进入。
- 路由参数为 `levelId` 与 `category`，不得新增素材详情路由。

### 布局层级

1. 素材卷首：显示 `{levelId}`、`{categoryLabel}`、`共 {totalCount} 条`。
2. 黄铜范围尺：`startNo/endNo` 两条 slider 视觉合并为一条双端范围尺。
3. 练习节奏区：`dailyCount/repeatTarget` 使用固定尺寸步进器。
4. 计划落款：显示 `{startNo} - {endNo} · 每天 {dailyCount} 条` 与 `planDurationText`。
5. 唱片目录：`tasks` 连续编号行，整行进入 lesson 预览。

### 状态

- 加载：先显示路由中的 `levelId/category`；请求未完成前不显示“共 0 条”。
- 空：`totalCount=0` 且请求完成时显示“暂无听力素材”，隐藏保存主动作。
- 正常：范围、每天条数、遍数变更后即时刷新 `planDurationText`。
- 完成：保存成功 toast“计划已保存”并返回；取消成功 toast“已取消”并返回。
- 错误：保存/取消失败保留当前选择；`debugLines` 作为“调试断点”边注可复制。

### 交互

- `stepValue` 的 `−/+` 做黄铜方键，数值区固定宽度。
- 保存态按钮文案沿用 `保存中/保存计划/保存修改`。
- 取消计划为轻文字动作，不与保存同权重。
- `openTask` 缺音频字段时只显示“音频字段同步中”，不进入空播放器。

### 区别于雾蓝玻璃

- 雾蓝：大 hero、玻璃设置卡、卡片任务列表。
- 图书馆：卷首、仪器式范围尺、连续唱片目录。

## 8. 套卷详情页：`pages/material/detail/index`

### 入口

- 从目录页套卷行进入，上一页先写入 `currentListeningSetV1` 快照。
- 页面先用快照渲染，再通过 `getMaterialItem` 回源补全。

### 布局层级

1. 墨蓝聆听台：`听力练习`、`item.title`、`year · district · examType`、音频状态。
2. 唱针播放器：中央主控 `加载/播放/暂停/重播`，外圈刻度映射 `audioProgress`。
3. 黄铜时间轴：slider + `audioCurrentText / audioDurationText`。
4. 答题册：图片题、选择题、填空题连续纸面排版。
5. 提交按钮：提交前唯一强动作 `提交听力`。
6. 转写边注：提交后承载 transcript、参考答案、学习包、加入词库、完成学习。

### 状态

- 加载：快照标题和题目先出现；音频区显示“音频准备中”，唱针停在起点。
- 空：无题目显示“暂无题目”；无 transcript 显示“暂无文本”；缺 item 显示错误纸页并保留返回。
- 正常：音频可播放、暂停、拖动、前后 15 秒；选择题和填空按真实输入更新。
- 完成/结果：提交后显示 `{correctCount} / {questions.length}`，每题显示 `正确/订正：{answer}`；学习包完成后显示“已完成文本学习”。
- 错误：`audioError` 原位显示“音频暂时无法加载/音频播放失败”；`studyError` 原位显示生成失败、暂无文本或提交前提示；`debugLines` 为可复制边注。

### 交互

- 播放主控是首屏唯一强动作；播放中切“暂停”，结束后切“重播”。
- `-15秒/+15秒` 为等宽次控，不抢主控权重。
- 提交前文本学习只显示现有提示；提交后才出现“生成/刷新”。
- `生词/短语/句型` 使用三段纸质索引签，最多三栏且 `min-width:0`。
- 选项整行可点；选中为墨蓝左边线 + 浅黄铜纸底。
- “加入/已加入”是轻按钮；`dictionaryAdding` 期间不改变列表布局。

### 区别于雾蓝玻璃

- 雾蓝：玻璃播放器、珊瑚圆按钮、浮动学习卡。
- 图书馆：墨蓝聆听台、黄铜唱针刻度、连续答题册、页边转写。

## 9. 跨页规则

- 页面结构可为 `library` 独立呈现，但复用现有请求、状态计算、storage key、路由和云字段。
- 主题切换不能重建音频实例、清空答题、重置 slider 或丢失计划编辑值。
- 缓存/快照优先：有缓存先显示，刷新失败不覆盖已有内容。
- `debugLines` 只用于调试期定位链路，修复确认后按线上调试规则撤掉。
- 每个视区只保留一个强动作：
  - 目录页：当前行进入下一层/套卷。
  - 计划页：完成。
  - 素材页：保存计划/保存修改。
  - 详情页：首屏为播放；答题册视区为提交；提交后学习包主动作按真实状态出现，不能同屏同权重并列。
- 320px 与 430px 必验：长标题、区县名、C1/C2、`时长待生成`、英文题组标题不溢出。

## 10. 视觉板

- 文件：`docs/design/library-theme/listening-board.png`。
- 内容：4 个手机屏，分别展示目录页、计划页、素材设置页、套卷详情页。
- 视觉板只用于评审，不进入小程序上传包。
