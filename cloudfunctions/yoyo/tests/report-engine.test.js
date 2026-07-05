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

  assert.deepEqual(report.completedCategories, ['peppa', 'song']);
  assert.equal(report.totalMinutes, 9);
  assert.equal(saved.reportId, 'family-1_child-1_2026-04-21');
});

test('已有打卡记录的历史日报按 checkin 修复完成状态', async () => {
  const report = await reportEngine.upsertDailyReport({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, '2026-04-20', {
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{
      date: '2026-04-20',
      completedAt: '2026-04-20T12:00:00.000Z',
      streakSnapshot: 2
    }],
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
    decoratePlannedTasks: (_progressRecords, _childId, category) => [{
      categoryLabel: category,
      taskId: category === 'peppa' ? 'peppa-1' : 'song-1',
      audioCompactTitle: category,
      playCount: 0,
      repeatTarget: 3,
      completedToday: false
    }],
    getCatalog: (category) => [{
      taskId: category === 'peppa' ? 'peppa-1' : 'song-1',
      durationSec: 60,
      repeatTarget: 3
    }],
    findFamilyMembersByFamilyId: async () => [],
    upsertReport: async () => {}
  });

  assert.equal(report.items.every((item) => item.completedToday), true);
  assert.equal(report.items.every((item) => item.playCount === item.repeatTarget), true);
  assert.equal(report.totalMinutes, 6);
});

test('已有 partial completedCategories 的打卡日仍按整日完成修复日报', async () => {
  const report = await reportEngine.upsertDailyReport({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, '2026-05-07', {
    getChildProgressRecords: async () => [],
    getCheckins: async () => [{
      date: '2026-05-07',
      completedCategories: ['peppa', 'unlock1'],
      completedAt: '2026-05-07T12:00:00.000Z'
    }],
    buildPlanForDay: () => ({
      dayIndex: 21,
      phase: { key: 'round-1' },
      byCategory: {
        newconcept1: [{ taskId: 'nce-1' }],
        song: [{ taskId: 'song-1' }]
      }
    }),
    getPlanDayIndexForDate: () => 21,
    getPlanCategoryOrder: () => ['newconcept1', 'song'],
    decoratePlannedTasks: (_progressRecords, _childId, category, _date, tasks) => tasks.map((task) => ({
      categoryLabel: category,
      taskId: task.taskId,
      audioCompactTitle: task.taskId,
      playCount: 0,
      repeatTarget: 3,
      completedToday: false
    })),
    getCatalog: (category) => [{
      taskId: category === 'song' ? 'song-1' : 'nce-1',
      durationSec: 60,
      repeatTarget: 3
    }],
    findFamilyMembersByFamilyId: async () => [],
    upsertReport: async () => {}
  });

  assert.equal(report.items.every((item) => item.completedToday), true);
  assert.equal(report.items.every((item) => item.playCount === 3), true);
});

test('日报生成包含当天 Peppa 复听任务和时长', async () => {
  const report = await reportEngine.upsertDailyReport({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, '2026-05-06', {
    getChildProgressRecords: async () => [{
      childId: 'child-1',
      category: 'peppa',
      date: '2026-05-06',
      taskId: 'peppa-1__review_20_1',
      originalTaskId: 'peppa-1',
      playCount: 1,
      repeatTarget: 1,
      completedToday: true
    }],
    getCheckins: async () => [{ date: '2026-05-06', completedAt: '2026-05-06T12:00:00.000Z' }],
    getPeppaReviewPlanOptions: () => ({ includePeppaReview: true, peppaReviewCursor: 0 }),
    buildPlanForDay: (_dayIndex, options) => ({
      dayIndex: 20,
      phase: { key: 'round-1' },
      byCategory: {
        peppa: options.includePeppaReview ? [
          { taskId: 'peppa-20', category: 'peppa' },
          { taskId: 'peppa-1__review_20_1', originalTaskId: 'peppa-1', category: 'peppa', repeatTarget: 1 }
        ] : [{ taskId: 'peppa-20', category: 'peppa' }]
      }
    }),
    getPlanDayIndexForDate: () => 20,
    getPlanCategoryOrder: () => ['peppa'],
    decoratePlannedTasks: (progressRecords, _childId, category, _date, tasks) => tasks.map((task) => {
      const progress = progressRecords.find((item) => item.taskId === task.taskId) || {};
      return {
        categoryLabel: category,
        taskId: task.taskId,
        originalTaskId: task.originalTaskId || '',
        audioCompactTitle: task.taskId,
        playCount: progress.playCount || 0,
        repeatTarget: task.repeatTarget || 3,
        completedToday: !!progress.completedToday
      };
    }),
    getCatalog: () => [
      { taskId: 'peppa-1', durationSec: 300, repeatTarget: 3 },
      { taskId: 'peppa-20', durationSec: 600, repeatTarget: 3 }
    ],
    findFamilyMembersByFamilyId: async () => [],
    upsertReport: async () => {}
  });

  assert.equal(report.items.some((item) => item.taskId === 'peppa-1__review_20_1'), true);
  assert.equal(report.totalMinutes, 35);
});

test('日报生成包含阅读写作完成内容', async () => {
  const report = await reportEngine.upsertDailyReport({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, '2026-07-05', {
    getChildProgressRecords: async () => [],
    getCheckins: async () => [],
    buildPlanForDay: () => ({
      dayIndex: 1,
      phase: { key: 'round-1' },
      byCategory: {}
    }),
    getPlanDayIndexForDate: () => 1,
    getPlanCategoryOrder: () => [],
    decoratePlannedTasks: () => [],
    getCatalog: () => [],
    findCompletionItemsByDate: async () => [{
      recordId: 'reading-1',
      type: 'reading',
      title: '阅读练习',
      completedToday: true
    }, {
      recordId: 'writing-1',
      type: 'writing',
      title: '写作批改',
      completedToday: true
    }],
    findFamilyMembersByFamilyId: async () => [],
    upsertReport: async () => {}
  });

  assert.equal(report.completionItems.length, 2);
  assert.deepEqual(report.completionItems.map((item) => item.id), ['reading-1', 'writing-1']);
});
