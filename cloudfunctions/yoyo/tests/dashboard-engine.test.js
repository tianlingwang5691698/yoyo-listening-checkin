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
