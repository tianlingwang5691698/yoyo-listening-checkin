const test = require('node:test');
const assert = require('node:assert/strict');

const reportService = require('../services/report.service');
const study = require('../facades/study.facade');
const reportRepository = require('../repositories/report.repository');

test('getMonthHeatmap 会先使用修复后的 checkins 计算点亮状态', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { child: { childId: 'child-1' } },
    today: '2026-04-21'
  }));
  t.mock.method(study, 'getUserScope', () => ({ childId: 'child-1' }));
  t.mock.method(study, 'getCheckins', async () => []);
  t.mock.method(study, 'getChildProgressRecords', async () => []);
  t.mock.method(study, 'getActiveListeningPlan', async () => null);
  t.mock.method(study, 'reconcileCheckins', async (_scope, progressRecords, checkins) => ({
    progressRecords,
    checkins: checkins.concat([{ date: '2026-04-19', planDayIndex: 1 }])
  }));
  t.mock.method(study, 'buildPlanForDay', () => ({ byCategory: {}, dayIndex: 1 }));
  t.mock.method(study, 'getPlanDayIndexForDate', () => 1);
  t.mock.method(study, 'decoratePlanTasks', () => []);
  t.mock.method(study, 'buildCatchupState', () => ({ canCatchup: false, missedDate: '', planDayIndex: 0, usedToday: false, reason: 'no-missed-date' }));
  t.mock.method(study, 'getPlanStartDate', () => '2026-04-19');

  const result = await reportService.getMonthHeatmap({
    payload: { year: 2026, month: 4, reconcile: true }
  });

  const day19 = result.heatmap.find((item) => item.date === '2026-04-19');
  assert.equal(!!day19.completed, true);
  assert.equal(day19.count, 1);
});

test('自定义计划当天新增未完成任务后，热力图今天不被旧 checkin 点亮', async (t) => {
  let reconcileCalls = 0;
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { child: { childId: 'child-1' } },
    today: '2026-07-06'
  }));
  t.mock.method(study, 'getUserScope', () => ({ childId: 'child-1' }));
  t.mock.method(study, 'getCheckins', async () => [{ date: '2026-07-06', planSource: 'custom-listening', planDayIndex: 1 }]);
  t.mock.method(study, 'getChildProgressRecords', async () => []);
  t.mock.method(study, 'getChildProgressRecordsByDate', async () => []);
  t.mock.method(study, 'reconcileCheckins', async (_scope, progressRecords, checkins) => {
    reconcileCalls += 1;
    return { progressRecords, checkins };
  });
  t.mock.method(study, 'getActiveListeningPlan', async () => ({ active: true, planId: 'plan-1', materials: [] }));
  t.mock.method(study, 'getCustomPlanDayIndex', () => 1);
  t.mock.method(study, 'buildListeningPlanForDay', () => ({
    dayIndex: 1,
    phase: { key: 'custom', label: '自定义' },
    byCategory: { unlock4: [] },
    categoryOrder: ['unlock4']
  }));
  t.mock.method(study, 'decorateListeningPlanTasks', () => [
    { category: 'unlock4', taskId: 'u1', completedToday: true, isPendingAsset: false },
    { category: 'unlock4', taskId: 'u2', completedToday: false, isPendingAsset: false }
  ]);
  t.mock.method(study, 'buildCatchupState', (_records, _today, _start, todayDone) => ({
    canCatchup: false,
    todayDone,
    missedDate: '',
    planDayIndex: 0,
    usedToday: false,
    reason: todayDone ? 'done' : 'finish-current-plan-first'
  }));
  t.mock.method(study, 'getPlanStartDate', () => '2026-07-06');

  const result = await reportService.getMonthHeatmap({
    payload: { year: 2026, month: 7 }
  });

  const todayCell = result.heatmap.find((item) => item.date === '2026-07-06');
  assert.equal(todayCell.count, 0);
  assert.equal(todayCell.completed, false);
  assert.equal(result.catchupState.todayDone, false);
  assert.equal(reconcileCalls, 0);
});

test('getParentDashboard summaryOnly 不等待完整 dashboard', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openid: 'parent-1' },
      member: { role: 'parent' },
      family: { familyId: 'family-1' },
      child: { childId: 'child-1' },
      members: [],
      studentLinks: []
    },
    today: '2026-07-06'
  }));
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  t.mock.method(study, 'getDashboardData', async () => {
    throw new Error('summaryOnly should not call getDashboardData');
  });
  t.mock.method(study, 'upsertDailyReport', async (_scope, date) => ({
    date,
    completionItems: [{ type: 'writing', title: '作文练习' }]
  }));
  t.mock.method(reportRepository, 'findByScopeAndDate', async (_scope, date) => ({
    date,
    completionItems: [{ type: 'writing', title: '作文练习' }]
  }));
  t.mock.method(study, 'getChildProgressRecordsByDate', async () => []);
  t.mock.method(study, 'getCompletionItemsByDate', async (_scope, date) => (
    date === '2026-07-06' ? [{ recordId: 'writing-1', type: 'writing', title: '作文练习' }] : []
  ));

  const result = await reportService.getParentDashboard({
    payload: { days: 7, summaryOnly: true }
  });

  assert.equal(result.recentReports.length, 7);
  assert.equal(result.moduleStats.writing.value, 1);
  assert.deepEqual(result.stats, {});
});

test('历史日报保留当日未完成快照并用真实进度覆盖状态', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { child: { childId: 'child-1' } },
    today: '2026-07-17'
  }));
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  t.mock.method(reportRepository, 'findByScopeAndDate', async () => ({
    date: '2026-07-16',
    items: [{
      category: 'grammar',
      taskId: 'grammar-noun-1',
      title: '名词第 1 课',
      completedToday: false,
      playCount: 0,
      repeatTarget: 1,
      completionEvidence: 'dailyPlanSnapshot',
      taskSnapshot: { completedToday: false, playCount: 0 }
    }],
    completionItems: [],
    planSnapshotCaptured: true,
    recordSourceVersion: 'daily-plan-snapshot-v2'
  }));
  t.mock.method(study, 'getChildProgressRecordsByDate', async () => [{
    category: 'unlock1',
    taskId: 'unlock1-19',
    date: '2026-07-16',
    playCount: 1,
    repeatTarget: 1,
    completedToday: true,
    updatedAt: '2026-07-16T14:30:49.044Z'
  }]);
  t.mock.method(study, 'getCompletionItemsByDate', async () => [{
    recordId: 'pack-1',
    type: 'listening',
    title: '听力学习包',
    targetId: 'unlock1:unlock1-19'
  }]);
  t.mock.method(study, 'getCatalog', () => [{
    taskId: 'unlock1-19',
    title: '7.3',
    durationSec: 60,
    repeatTarget: 1
  }]);
  t.mock.method(study, 'decorateTask', (task, progress, category) => Object.assign({}, task, progress, {
    category,
    categoryLabel: 'Unlock 1',
    audioCompactTitle: 'Unlock 1 · 7.3'
  }));

  const result = await reportService.getDailyReportByDate({
    payload: { date: '2026-07-16', summaryOnly: true }
  });

  assert.deepEqual(result.report.items.map((item) => item.taskId), ['grammar-noun-1', 'unlock1-19']);
  assert.equal(result.report.items[0].completedToday, false);
  assert.equal(result.report.totalMinutes, 1);
  assert.equal(result.report.completionItemCount, 1);
  assert.equal(result.report.completionItems[0].recordId, 'pack-1');
  assert.equal(result.report.recordSourceVersion, 'daily-plan-snapshot-v2');
});
