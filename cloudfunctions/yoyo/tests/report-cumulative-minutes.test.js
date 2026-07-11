const test = require('node:test');
const assert = require('node:assert/strict');

const reportRepository = require('../repositories/report.repository');
const study = require('../facades/study.facade');
const dashboardService = require('../services/dashboard.service');

test('累计听力时长按日期去重并保留同日最大值', () => {
  assert.equal(reportRepository.sumCumulativeMinutes([
    { date: '2026-07-01', totalMinutes: 20 },
    { date: '2026-07-01', totalMinutes: 0 },
    { date: '2026-07-02', totalMinutes: 31 },
    { date: '', totalMinutes: 99 }
  ]), 51);
});

test('成长页 dashboard 使用日报累计值补全旧统计', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { family: { familyId: 'family-1' }, child: { childId: 'child-1' } }
  }));
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  t.mock.method(study, 'getDashboardData', async () => ({ stats: { totalMinutes: 18 } }));
  t.mock.method(study, 'getCumulativeListeningMinutes', async () => 51);

  const result = await dashboardService.getDashboard({ payload: { view: 'record' } });

  assert.equal(result.stats.totalMinutes, 51);
});

test('成长页以日报累计为权威值而不是取旧目录估算较大值', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { family: { familyId: 'family-1' }, child: { childId: 'child-1' } }
  }));
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  t.mock.method(study, 'getDashboardData', async () => ({ stats: { totalMinutes: 80 } }));
  t.mock.method(study, 'getCumulativeListeningMinutes', async () => 51);

  const result = await dashboardService.getDashboard({ payload: { view: 'record' } });

  assert.equal(result.stats.totalMinutes, 51);
});
