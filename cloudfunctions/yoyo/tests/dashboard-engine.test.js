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
