# 数据契约

本文件用于固化当前项目最核心的云端返回结构。  
目标是让页面层、`utils/store.js`、云函数 services 在同一套字段约定下演进。

以下契约按“当前主用结构”定义，后续新增字段可以向后兼容追加，但不要随意改已有字段含义。

## 1. DashboardData

用途：

- 首页 `getDashboard`
- 其他页面复用首页主汇总口径

核心字段：

```ts
type DashboardData = {
  user: object
  currentUser: object
  currentMember: {
    studyRole?: 'student' | 'parent'
    [key: string]: any
  }
  family: object | null
  child: object | null
  stats: {
    streakDays: number
    completedDays: number
    completedLessons: number
    completedTasks: number
    totalMinutes: number
    lastCheckinAt: string
    lastCheckinDate: string
  }
  planDayIndex: number
  planPhase: string
  planPhaseLabel: string
  planTaskCount: number
  categorySummaries: TaskSummary[]
  dailyTasks: TaskItem[]
  catchupState: CatchupState
  activeTaskCount: number
  completedTaskCountToday: number
  allDailyDone: boolean
  peppaTask?: TaskSummary
  unlockTask?: TaskSummary
  songTask?: TaskSummary
  planDebug?: {
    day1Categories: string[]
    catalogCounts: Record<string, number>
    todayTaskCounts: Record<string, number>
  }
}
```

约束：

- `planDayIndex` 表示“今天这一天应执行的计划日”，同日完成打卡后不提前跳次日
- `dailyTasks` 是今天实际任务明细
- `categorySummaries` 是按分类聚合后的摘要
- `catchupState` 必须始终存在
- `stats` 必须始终存在，即使值为 0

## 2. TaskDetailData

用途：

- 课程详情页 `getTaskDetail`
- 播放完成后刷新详情

核心字段：

```ts
type TaskDetailData = {
  user: object
  currentUser: object
  currentMember: object
  child: object | null
  stats: DashboardData['stats']
  task: TaskItem | null
  progress: {
    playCount: number
    playStepText: string
    currentPass: number
    repeatTarget: number
    textUnlocked: boolean
    transcriptVisible: boolean
    completedToday: boolean
  }
  categoryTasks: TaskItem[]
  categoryTaskCount: number
  categoryCompletedCount: number
  planDayIndex: number
  planPhaseLabel: string
  planRunType: 'normal' | 'catchup' | 'level'
  targetDate: string
  scriptSource: object | null
  transcriptTrack: object | null
  transcriptLines: any[]
  transcriptPendingLoad: boolean
  todayRecord: object | null
  history: Array<{
    date: string
    taskTitle: string
    playCount: number
  }>
  studyWriteAllowed: boolean
  studyWriteMessage: string
  checkinReady: boolean
}
```

约束：

- `task` 与 `progress` 必须配套返回
- `planRunType` 仅允许 `normal` / `catchup` / `level`
- `checkinReady` 仅在学生设备、正常计划、当天全部完成且尚未打卡时为 `true`
- `targetDate` 必须是 `YYYY-MM-DD`

## 3. ReportData

用途：

- 家长日报
- 成长页单日详情
- 最近 7 天日报

核心字段：

```ts
type ReportData = {
  reportId: string
  userId?: string
  openId?: string
  memberId?: string
  familyId?: string
  childId?: string
  date: string
  completedCategories: string[]
  totalMinutes: number
  streakSnapshot: number
  planDayIndex: number
  planPhase: string
  items: ReportItem[]
  pushStatus: string
  inAppVisible: boolean
  updatedAt: string
}

type ReportItem = {
  category: string
  categoryLabel: string
  taskId: string
  title: string
  playCount: number
  playMoments?: string[]
  repeatTarget: number
  completedToday: boolean
  updatedAt?: string
}
```

约束：

- `items` 必须始终存在
- `completedCategories` 由 `items.completedToday === true` 推导而来
- `totalMinutes` 只统计当天已完成任务
- `date` 必须按中国自然日

## 4. CatchupState

用途：

- 成长页补卡区
- 热力图追赶目标
- 课程页补卡合法性校验

核心字段：

```ts
type CatchupState = {
  canCatchup: boolean
  missedDate: string
  planDayIndex: number
  usedToday: boolean
  reason: 'ready' | 'finish-current-plan-first' | 'catchup-used-today' | 'no-missed-date'
}
```

约束：

- `missedDate` 只允许落在“首次成功打卡日期之后”的漏卡日期
- `planDayIndex` 必须对应 `missedDate` 当天本应执行的计划日
- `canCatchup === false` 时，`planDayIndex` 应为 `0`
- `reason` 只能使用约定枚举值

## 5. TaskItem / TaskSummary

用途：

- 首页任务
- 分类摘要
- 课程页任务组
- 日报任务条目来源

核心字段：

```ts
type TaskItem = {
  category: string
  categoryLabel: string
  taskId: string
  title?: string
  displayTitle?: string
  audioCompactTitle?: string
  playCount: number
  playMoments?: string[]
  repeatTarget: number
  playStepText?: string
  currentPass?: number
  textUnlocked?: boolean
  transcriptVisible?: boolean
  completedToday: boolean
  isPendingAsset?: boolean
  planRunType?: string
  planDayIndex?: number
  targetDate?: string
  updatedAt?: string
}

type TaskSummary = TaskItem & {
  plannedTaskCount?: number
  completedTaskCount?: number
}
```

约束：

- `TaskSummary` 本质上是 `TaskItem + 分类聚合字段`
- `plannedTaskCount` / `completedTaskCount` 仅在分类摘要场景下出现
- `TaskItem` 的日期字段只允许 `targetDate`，格式固定 `YYYY-MM-DD`

## 6. 演进规则

后续修改上述结构时，遵守以下规则：

1. 新增字段优先追加，不直接改旧字段含义
2. 页面已消费的字段，不轻易改名
3. 如果必须改名，先保留旧字段一版过渡
4. 规则型枚举值必须在本文件同步更新
5. `utils/store.js` 默认值应与本文件保持一致
