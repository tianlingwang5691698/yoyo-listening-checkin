const test = require('node:test');
const assert = require('node:assert/strict');

const dashboardEngine = require('../lib/dashboard-engine');

test('当天已打卡时，同日内仍返回当天计划，不提前跳次日', async () => {
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
    getPlanDayIndexForDate: (checkins, date) => {
      assert.equal(date, '2026-04-21');
      assert.equal(checkins[0].date, '2026-04-21');
      return 1;
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

  assert.equal(dashboard.planDayIndex, 1);
  assert.equal(dashboard.planPhaseLabel, '第1轮');
  assert.equal(dashboard.allDailyDone, true);
});

test('home view 任务分组不返回首页不用的大字段', async () => {
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
      completedToday: false,
      isPendingAsset: false,
      audioUrl: 'https://large-audio.example.com/file.mp3',
      audioCloudPath: 'A1/Peppa/file.mp3',
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
    includeStats: false
  });

  const task = dashboard.groupedDailyTasks[0].tasks[0];
  assert.equal(dashboard.user, undefined);
  assert.equal(dashboard.family, undefined);
  assert.equal(dashboard.stats, undefined);
  assert.equal(dashboard.dailyTasks, undefined);
  assert.equal(task.audioUrl, undefined);
  assert.equal(task.audioCloudPath, undefined);
  assert.equal(task.transcriptTrack, undefined);
  assert.equal(task.rewardCopy, undefined);
  assert.deepEqual(Object.keys(task).sort(), [
    'category',
    'completedToday',
    'displayTitle',
    'isPendingAsset',
    'progressText',
    'taskId',
    'textType',
    'title'
  ].sort());
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
