const test = require('node:test');
const assert = require('node:assert/strict');

const reportEngine = require('../lib/report-engine');

test('日报生成已完成分类和总时长', async () => {
  let saved = null;
  const report = await reportEngine.upsertDailyReport({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, '2026-04-21', {
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{ date: '2026-04-21', streakSnapshot: 3 }],
    buildPlanForDay: () => ({
      dayIndex: 1,
      phase: { key: 'round-1' },
      byCategory: {
        peppa: [{ taskId: 'peppa-1' }],
        song: [{ taskId: 'song-1' }]
      }
    }),
    getPlanDayIndexForDate: () => 1,
    getPlanCategoryOrder: () => ['peppa', 'song'],
    decoratePlannedTasks: (_progressRecords, _childId, category) => {
      if (category === 'peppa') {
        return [{ categoryLabel: 'Peppa', taskId: 'peppa-1', audioCompactTitle: 'Peppa Ep1', playCount: 3, repeatTarget: 3, completedToday: true, updatedAt: '2026-04-21T10:00:00.000Z' }];
      }
      return [{ categoryLabel: 'Songs', taskId: 'song-1', audioCompactTitle: 'Song 1', playCount: 1, repeatTarget: 3, completedToday: false, updatedAt: '2026-04-21T11:00:00.000Z' }];
    },
    getCatalog: (category) => {
      if (category === 'peppa') {
        return [{ taskId: 'peppa-1', durationSec: 120, repeatTarget: 3 }];
      }
      return [{ taskId: 'song-1', durationSec: 60, repeatTarget: 3 }];
    },
    findFamilyMembersByFamilyId: async () => [],
    upsertReport: async (_scope, _date, next) => {
      saved = next;
    }
  });

  assert.deepEqual(report.completedCategories, ['peppa']);
  assert.equal(report.totalMinutes, 6);
  assert.equal(saved.reportId, 'family-1_child-1_2026-04-21');
});
