const test = require('node:test');
const assert = require('node:assert/strict');

const reportService = require('../services/report.service');
const study = require('../facades/study.facade');

test('getMonthHeatmap 会先使用修复后的 checkins 计算点亮状态', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { child: { childId: 'child-1' } },
    today: '2026-04-21'
  }));
  t.mock.method(study, 'getUserScope', () => ({ childId: 'child-1' }));
  t.mock.method(study, 'getCheckins', async () => []);
  t.mock.method(study, 'getChildProgressRecords', async () => []);
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
    payload: { year: 2026, month: 4 }
  });

  const day19 = result.heatmap.find((item) => item.date === '2026-04-19');
  assert.equal(!!day19.completed, true);
  assert.equal(day19.count, 1);
});
