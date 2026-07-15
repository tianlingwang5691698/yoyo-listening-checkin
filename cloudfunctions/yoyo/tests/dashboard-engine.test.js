const test = require('node:test');
const assert = require('node:assert/strict');

const dashboardEngine = require('../lib/dashboard-engine');

test('成长统计只计数完成进度而不加载全量进度和计划', async () => {
  let fullProgressReads = 0;
  let activePlanReads = 0;
  const dashboard = await dashboardEngine.getDashboardData({
    member: { role: 'parent' },
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-07-11',
    getUserScope: () => ({ familyId: 'family-1', childId: 'child-1' }),
    getChildProgressRecords: async () => { fullProgressReads += 1; return []; },
    getCompletedProgressCount: async () => 535,
    getCheckins: async () => [{ date: '2026-07-10' }],
    getActiveListeningPlan: async () => { activePlanReads += 1; return null; },
    buildStats: (_progress, checkins) => ({
      streakDays: 1,
      completedDays: checkins.length,
      completedLessons: checkins.length,
      completedTasks: 0,
      totalMinutes: 0
    })
  }, { statsOnly: true });

  assert.equal(dashboard.stats.completedTasks, 535);
  assert.equal(fullProgressReads, 0);
  assert.equal(activePlanReads, 0);
});

test('首页只读取今日进度和复听所需历史进度', async () => {
  let fullProgressReads = 0;
  let homeProgressReads = 0;
  await dashboardEngine.getDashboardData({
    member: { role: 'student' },
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-07-11',
    getUserScope: () => ({ familyId: 'family-1', childId: 'child-1' }),
    getChildProgressRecords: async () => { fullProgressReads += 1; return []; },
    getHomeProgressRecords: async () => { homeProgressReads += 1; return []; },
    getCheckins: async () => [],
    getDailyReport: async () => null,
    getActiveListeningPlan: async () => null,
    isYoyoChild: () => false,
    getNextPlanDayIndexForDate: () => 1,
    getPlanDayIndexForDate: () => 1,
    getPeppaReviewPlanOptions: () => ({}),
    buildPlanForDay: () => ({ dayIndex: 1, phase: { key: 'none', label: '未设置' }, byCategory: {}, flatTasks: [], categoryOrder: [] }),
    getPlanCategoryOrder: () => [],
    decoratePlanTasks: () => [],
    buildStats: () => ({ streakDays: 0 })
  }, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false,
    includeChildStats: false,
    includeTodayListeningMinutes: true,
    progressScope: 'home',
    reconcileCheckins: false
  });
  assert.equal(homeProgressReads, 1);
  assert.equal(fullProgressReads, 0);
});

test('佑佑首页使用固定计划摘要和字段投影打卡读取', async () => {
  let fullProgressReads = 0;
  let fullCheckinReads = 0;
  let homeProgressReads = 0;
  let fixedPlanStateReads = 0;
  await dashboardEngine.getDashboardData({
    member: { role: 'student' },
    child: { childId: 'child-1', childLoginCode: '317613' }
  }, {
    getTodayString: () => '2026-07-15',
    getUserScope: () => ({ familyId: 'family-1', childId: 'child-1' }),
    getChildProgressRecords: async () => { fullProgressReads += 1; return []; },
    getHomeProgressRecords: async () => { homeProgressReads += 1; return []; },
    getFixedPlanHomeState: async () => {
      fixedPlanStateReads += 1;
      return { summary: { version: 1, slots: {} }, progressRecords: [], source: 'fixed-plan-summary' };
    },
    getCheckins: async () => { fullCheckinReads += 1; return []; },
    getHomeCheckins: async () => [],
    getDailyReport: async () => null,
    getActiveListeningPlan: async () => null,
    isYoyoChild: () => true,
    buildFixedPlanBySlots: () => ({ dayIndex: 86, phase: { key: 'round-2', label: '第2轮' }, byCategory: {}, flatTasks: [] }),
    decorateFixedSlotPlanTasks: () => [],
    getPlanCategoryOrder: () => [],
    getPeppaReviewPlanOptions: () => ({}),
    buildStats: () => ({ streakDays: 0 })
  }, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false,
    includeChildStats: false,
    includeTodayListeningMinutes: true,
    progressScope: 'home',
    reconcileCheckins: false
  });

  assert.equal(fixedPlanStateReads, 1);
  assert.equal(homeProgressReads, 0);
  assert.equal(fullProgressReads, 0);
  assert.equal(fullCheckinReads, 0);
});

test('首页 Day 使用累计打卡日数而不是计划日', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    member: {}, child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-07-11',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [
      { date: '2026-07-06' },
      { date: '2026-07-09' },
      { date: '2026-07-09', planRunType: 'catchup' }
    ],
    getActiveListeningPlan: async () => null,
    isYoyoChild: () => false,
    getPlanDayIndexForDate: () => 9,
    getNextPlanDayIndexForDate: () => 9,
    getCatalog: () => [],
    getPeppaReviewPlanOptions: () => ({}),
    buildStats: () => ({ streakDays: 0 })
  }, { includeDailyTasks: false, includeCategorySummaries: false, includeCatchupState: false, includePlanDebug: false, includeTaskProgressSummary: false });

  assert.equal(dashboard.planDayIndex, 1);
  assert.equal(dashboard.checkinDayCount, 2);
});

test('自定义计划生成任务前加载当前素材目录', async () => {
  let loadedCategories = [];
  const plan = { planId: 'plan-1', active: true, materials: [{ category: 'newconcept1', enabled: true }] };
  await dashboardEngine.getDashboardData({ member: {}, child: { childId: 'child-1' } }, {
    getTodayString: () => '2026-07-11',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [],
    getActiveListeningPlan: async () => plan,
    refreshRuntimeCatalogs: async (_force, categories) => { loadedCategories = categories; },
    getCatalog: () => [],
    isYoyoChild: () => false,
    getCustomPlanDayIndex: () => 1,
    buildListeningPlanForDay: () => ({ dayIndex: 1, phase: { key: 'custom', label: '自定义' }, byCategory: {}, flatTasks: [], categoryOrder: [] }),
    decorateListeningPlanTasks: () => [],
    buildStats: () => ({ streakDays: 0 })
  }, { includeDailyTasks: false, includeCategorySummaries: false, includeCatchupState: false, includePlanDebug: false, includeTaskProgressSummary: false });

  assert.deepEqual(loadedCategories, ['newconcept1']);
});

test('当天已打卡时，同日内返回下一天计划', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: {},
    family: {},
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-04-21',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{ date: '2026-04-21', planDayIndex: 1 }],
    isYoyoChild: () => true,
    getNextPlanDayIndexForDate: (checkins, date) => {
      assert.equal(date, '2026-04-21');
      assert.equal(checkins[0].date, '2026-04-21');
      return 2;
    },
    buildPlanForDay: (dayIndex) => ({
      dayIndex,
      phase: { key: 'round-1', label: '第1轮' },
      byCategory: {
        peppa: [{ taskId: 'peppa-1' }]
      }
    }),
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlannedTasks: () => [{ category: 'peppa', completedToday: true, isPendingAsset: false }],
    buildCategorySummary: () => ({ category: 'peppa', completedToday: true, isPendingAsset: false }),
    decoratePlanTasks: () => [{ category: 'peppa', completedToday: true, isPendingAsset: false }],
    buildStats: () => ({ streakDays: 1 }),
    buildCatchupState: () => ({ canCatchup: false, missedDate: '', planDayIndex: 0, usedToday: false, reason: 'no-missed-date' }),
    getPlanStartDate: () => '2026-04-21',
    getCatalog: () => []
  });

  assert.equal(dashboard.planDayIndex, 2);
  assert.equal(dashboard.planPhaseLabel, '第1轮');
  assert.equal(dashboard.allDailyDone, true);
});

test('非佑佑且未设置自定义计划时不生成固定听力任务', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: {},
    family: {},
    child: { childId: 'child-2', childLoginCode: '888888' }
  }, {
    getTodayString: () => '2026-07-05',
    getUserScope: () => ({ childId: 'child-2' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [],
    getActiveListeningPlan: async () => null,
    isYoyoChild: () => false,
    getPlanDayIndexForDate: () => 1,
    getNextPlanDayIndexForDate: () => 1,
    buildPlanForDay: () => {
      throw new Error('普通学生无计划时不应生成固定计划');
    },
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlanTasks: () => {
      throw new Error('普通学生无计划时不应装饰固定任务');
    },
    buildCategorySummary: () => ({}),
    buildStats: () => ({ streakDays: 0 }),
    buildCatchupState: () => ({}),
    getPlanStartDate: () => '',
    getCatalog: () => [],
    getCategoryLabel: () => 'Peppa'
  }, {
    includeDailyTasks: true,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true
  });

  assert.equal(dashboard.planSource, 'none');
  assert.equal(dashboard.needsListeningPlanSetup, true);
  assert.equal(dashboard.groupedDailyTasks.length, 0);
  assert.equal(dashboard.activeTaskCount, 0);
});

test('home view 任务分组保留播放字段但不返回大字段', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: { userId: 'user-1' },
    member: { memberId: 'member-1', studyRole: 'student' },
    family: { familyId: 'family-1' },
    child: { childId: 'child-1', nickname: '佑佑' }
  }, {
    getTodayString: () => '2026-04-21',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [],
    getDailyReport: async () => ({
      totalMinutes: 31,
      items: [
        { repeatTarget: 1, taskSnapshot: { durationSec: 900 } },
        { repeatTarget: 1, taskSnapshot: { durationSec: 960 } }
      ]
    }),
    isYoyoChild: () => true,
    getPlanDayIndexForDate: () => 1,
    buildPlanForDay: (dayIndex) => ({
      dayIndex,
      phase: { key: 'round-1', label: '第1轮' },
      byCategory: {
        peppa: [{ taskId: 'peppa-1' }]
      }
    }),
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlannedTasks: () => [],
    buildCategorySummary: () => ({}),
    decoratePlanTasks: () => [{
      category: 'peppa',
      categoryLabel: 'Peppa',
      taskId: 'peppa-1',
      title: 'Peppa 1',
      displayTitle: 'Peppa 1',
      playCount: 1,
      repeatTarget: 3,
      durationSec: 120,
      completedToday: false,
      isPendingAsset: false,
      audioUrl: 'https://large-audio.example.com/file.mp3',
      audioCloudPath: 'A1/Peppa/file.mp3',
      audioFileId: 'cloud://env.bucket/A1/Peppa/file.mp3',
      audioSource: 'static-cloud-url',
      transcriptTrack: { lines: new Array(100).fill({ text: 'large' }) },
      rewardCopy: 'large reward copy'
    }],
    buildStats: () => ({ streakDays: 0 }),
    buildCatchupState: () => ({}),
    getPlanStartDate: () => '',
    getCatalog: () => [],
    getCategoryLabel: () => 'Peppa'
  }, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false,
    includeTodayListeningMinutes: true
  });

  const task = dashboard.groupedDailyTasks[0].tasks[0];
  assert.equal(dashboard.user, undefined);
  assert.equal(dashboard.family, undefined);
  assert.equal(dashboard.stats, undefined);
  assert.equal(dashboard.todayListeningMinutes, 31);
  assert.equal(dashboard.todayListeningGoalMinutes, 31);
  assert.equal(dashboard.dailyTasks, undefined);
  assert.equal(task.audioUrl, 'https://large-audio.example.com/file.mp3');
  assert.equal(task.audioCloudPath, 'A1/Peppa/file.mp3');
  assert.equal(task.audioFileId, 'cloud://env.bucket/A1/Peppa/file.mp3');
  assert.equal(task.audioSource, 'static-cloud-url');
  assert.equal(task.transcriptTrack, undefined);
  assert.equal(task.rewardCopy, undefined);
  assert.equal(dashboard.groupedDailyTasks[0].durationSec, 360);
  assert.deepEqual(Object.keys(task).sort(), [
    'audioCloudPath',
    'audioFileId',
    'audioSource',
    'audioUrl',
    'category',
    'completedToday',
    'displayTitle',
    'durationSec',
    'isPendingAsset',
    'lessonId',
    'lessonNumber',
    'meta',
    'progressText',
    'repeatTarget',
    'taskId',
    'textType',
    'title',
    'topic',
    'topicLabel'
  ].sort());
});

test('自定义计划晚于旧日报更新时首页使用当前任务时长', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {}, member: { studyRole: 'student' }, family: {}, child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-07-11',
    getUserScope: () => ({ familyId: 'family-1', childId: 'child-1' }),
    getHomeProgressRecords: async () => [],
    getCheckins: async () => [],
    getDailyReport: async () => ({
      totalMinutes: 0,
      planSource: 'fixed-yoyo',
      listeningPlanId: '',
      updatedAt: '2026-07-11T14:35:07.901Z',
      items: [{ repeatTarget: 3, taskSnapshot: { durationSec: 760 } }]
    }),
    getActiveListeningPlan: async () => ({
      _id: 'plan-1', active: true, updatedAt: '2026-07-11T14:36:59.865Z', materials: []
    }),
    getCustomPlanDayIndex: () => 1,
    buildListeningPlanForDay: () => ({ dayIndex: 1, phase: { key: 'custom', label: '自定义' }, byCategory: {}, categoryOrder: ['newconcept1'] }),
    decorateListeningPlanTasks: () => [{
      category: 'newconcept1', taskId: 'newconcept1-1', durationSec: 72, repeatTarget: 1,
      playCount: 0, completedToday: false, isPendingAsset: false
    }],
    getPlanCategoryOrder: () => ['newconcept1'],
    buildStats: () => ({ streakDays: 0 }),
    getCategoryLabel: () => 'New Concept 1'
  }, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false,
    includeTodayListeningMinutes: true,
    progressScope: 'home',
    reconcileCheckins: false
  });

  assert.equal(dashboard.todayListeningMinutes, 0);
  assert.equal(dashboard.todayListeningGoalMinutes, 1);
});

test('缺失昨日打卡时，dashboard 先使用修复后的 checkins 再计算当天计划', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: {},
    family: {},
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-04-21',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [],
    isYoyoChild: () => true,
    reconcileCheckins: async (_scope, progressRecords, checkins) => ({
      progressRecords,
      checkins: checkins.concat([{ date: '2026-04-20', planDayIndex: 1 }])
    }),
    getPlanDayIndexForDate: (checkins, date) => {
      assert.equal(date, '2026-04-21');
      assert.equal(checkins.length, 1);
      assert.equal(checkins[0].date, '2026-04-20');
      return 2;
    },
    buildPlanForDay: (dayIndex) => ({
      dayIndex,
      phase: { key: 'round-1', label: '第1轮' },
      byCategory: {
        peppa: [{ taskId: 'peppa-2' }]
      }
    }),
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlannedTasks: () => [{ category: 'peppa', completedToday: false, isPendingAsset: false }],
    buildCategorySummary: () => ({ category: 'peppa', completedToday: false, isPendingAsset: false }),
    decoratePlanTasks: () => [{ category: 'peppa', completedToday: false, isPendingAsset: false }],
    buildStats: () => ({ streakDays: 1 }),
    buildCatchupState: () => ({ canCatchup: false, missedDate: '', planDayIndex: 0, usedToday: false, reason: 'no-missed-date' }),
    getPlanStartDate: () => '2026-04-20',
    getCatalog: () => []
  });

  assert.equal(dashboard.planDayIndex, 2);
});

test('已有当天打卡记录时，home 进度按整日完成兜底', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: { studyRole: 'student' },
    family: {},
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-05-07',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{ date: '2026-05-07', completedCategories: ['peppa'] }],
    isYoyoChild: () => true,
    getPlanDayIndexForDate: () => 21,
    buildPlanForDay: (dayIndex) => ({
      dayIndex,
      phase: { key: 'round-1', label: '第1轮' },
      byCategory: {
        newconcept1: [{ taskId: 'nce-1' }],
        song: [{ taskId: 'song-1' }]
      }
    }),
    getPlanCategoryOrder: () => ['newconcept1', 'song'],
    decoratePlannedTasks: () => [],
    buildCategorySummary: (tasks, category) => ({
      category,
      completedToday: tasks.every((item) => item.completedToday),
      completedCount: tasks.filter((item) => item.completedToday).length,
      plannedTaskCount: tasks.length
    }),
    decoratePlanTasks: () => [
      { category: 'newconcept1', taskId: 'nce-1', title: 'NCE', playCount: 0, repeatTarget: 3, completedToday: false, isPendingAsset: false },
      { category: 'song', taskId: 'song-1', title: 'Song', playCount: 0, repeatTarget: 3, completedToday: false, isPendingAsset: false }
    ],
    buildStats: () => ({ streakDays: 1 }),
    buildCatchupState: () => ({ canCatchup: false }),
    getPlanStartDate: () => '2026-04-17',
    getCatalog: () => [],
    getCategoryLabel: (category) => category
  }, {
    includeDailyTasks: true,
    includeHomeTaskGroups: true
  });

  assert.equal(dashboard.allDailyDone, true);
  assert.equal(dashboard.groupedDailyTasks[0].tasks[0].progressText, '3/3 遍');
  assert.equal(dashboard.groupedDailyTasks[1].tasks[0].progressText, '3/3 遍');
});

test('自定义计划已有当天打卡后新增任务不按旧 checkin 兜底完成', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: { studyRole: 'student' },
    family: {},
    child: { childId: 'child-1', childLoginCode: '888888' }
  }, {
    getTodayString: () => '2026-07-06',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{ date: '2026-07-06', planSource: 'custom-listening', planDayIndex: 1 }],
    getActiveListeningPlan: async () => ({ active: true, planId: 'plan-1', materials: [] }),
    isYoyoChild: () => false,
    getCustomPlanDayIndex: () => 1,
    buildListeningPlanForDay: () => ({
      dayIndex: 1,
      phase: { key: 'custom', label: '自定义' },
      byCategory: { unlock4: [] },
      categoryOrder: ['unlock4']
    }),
    decorateListeningPlanTasks: () => [
      { category: 'unlock4', taskId: 'u1', playCount: 3, repeatTarget: 3, completedToday: true, isPendingAsset: false },
      { category: 'unlock4', taskId: 'u2', playCount: 0, repeatTarget: 3, completedToday: false, isPendingAsset: false }
    ],
    getPlanCategoryOrder: () => ['unlock4'],
    buildCategorySummary: () => ({}),
    buildStats: () => ({ streakDays: 1 }),
    buildCatchupState: () => ({ canCatchup: false }),
    getPlanStartDate: () => '',
    getCatalog: () => [],
    getCategoryLabel: (category) => category
  }, {
    includeDailyTasks: true,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true
  });

  assert.equal(dashboard.planSource, 'custom-listening');
  assert.equal(dashboard.allDailyDone, false);
  assert.equal(dashboard.completedTaskCountToday, 1);
  assert.equal(dashboard.activeTaskCount, 2);
  assert.equal(dashboard.groupedDailyTasks[0].completedCount, 1);
});

test('home view 显示当天 Peppa 旧集完成记录', async () => {
  const dashboard = await dashboardEngine.getDashboardData({
    user: {},
    member: { studyRole: 'student' },
    family: {},
    child: { childId: 'child-1' }
  }, {
    getTodayString: () => '2026-05-08',
    getUserScope: () => ({ childId: 'child-1' }),
    getChildProgressRecords: async () => [{
      childId: 'child-1',
      category: 'peppa',
      date: '2026-05-08',
      taskId: 'peppa-5__review_22_1',
      originalTaskId: 'peppa-5',
      playCount: 1,
      repeatTarget: 1,
      completedToday: true
    }],
    getCheckins: async () => [{ date: '2026-05-08' }],
    isYoyoChild: () => true,
    getPlanDayIndexForDate: () => 22,
    buildPlanForDay: (dayIndex) => ({
      dayIndex,
      phase: { key: 'round-1', label: '第1轮' },
      byCategory: {
        peppa: [{ category: 'peppa', taskId: 'peppa-22', title: 'S122 The Tooth Fairy', repeatTarget: 3 }]
      }
    }),
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlannedTasks: () => [],
    decorateTask: (task, progress, category) => ({
      category,
      taskId: task.taskId,
      title: task.title,
      displayTitle: 'Hide and Seek',
      playCount: progress.playCount,
      repeatTarget: task.repeatTarget,
      completedToday: progress.completedToday,
      isPendingAsset: false
    }),
    buildCategorySummary: () => ({}),
    decoratePlanTasks: () => [{
      category: 'peppa',
      taskId: 'peppa-22',
      title: 'S122 The Tooth Fairy',
      displayTitle: 'The Tooth Fairy',
      playCount: 3,
      repeatTarget: 3,
      completedToday: true,
      isPendingAsset: false
    }],
    buildStats: () => ({ streakDays: 1 }),
    buildCatchupState: () => ({}),
    getPlanStartDate: () => '',
    getCatalog: () => [{ category: 'peppa', taskId: 'peppa-5', title: 'S105 Hide and Seek' }],
    getCategoryLabel: () => 'Peppa'
  }, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false
  });

  const peppaGroup = dashboard.groupedDailyTasks[0];
  assert.equal(peppaGroup.tasks.length, 2);
  assert.equal(peppaGroup.completedCount, 2);
  assert.equal(peppaGroup.totalCount, 2);
  assert.equal(peppaGroup.tasks.some((item) => item.taskId === 'peppa-5__review_22_1' && item.progressText === '1/1 遍'), true);
});
