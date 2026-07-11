const test = require('node:test');
const assert = require('node:assert/strict');

const recordHome = require('../services/record-home.service');

test('轻量成长统计使用日报累计和完成任务计数', () => {
  const stats = recordHome.buildRecordStats([
    { date: '2026-07-10', completedAt: '2026-07-10T12:00:00.000Z' }
  ], 535, 3453, '2026-07-11');
  assert.equal(stats.completedTasks, 535);
  assert.equal(stats.totalMinutes, 3453);
  assert.equal(stats.completedDays, 1);
});

test('无自定义计划时月历只按打卡记录构建', () => {
  const result = recordHome.buildFixedHeatmap([
    { date: '2026-07-10', planRunType: 'normal' }
  ], '2026-07-11', 2026, 7);
  assert.equal(result.heatmap.find((item) => item.date === '2026-07-10').completed, true);
  assert.equal(result.heatmap.find((item) => item.date === '2026-07-11').completed, false);
});

test('所有学生的自定义计划在加量后不会沿用旧打卡点亮今天', () => {
  const checkins = [{
    date: '2026-07-11',
    planRunType: 'normal',
    completedAt: '2026-07-11T08:00:00.000Z'
  }];
  const activePlan = {
    active: true,
    updatedAt: '2026-07-11T09:00:00.000Z'
  };
  const result = recordHome.buildFixedHeatmap(checkins, '2026-07-11', 2026, 7, activePlan);
  assert.equal(recordHome.isTodayComplete(checkins, '2026-07-11', activePlan), false);
  assert.equal(result.heatmap.find((item) => item.date === '2026-07-11').completed, false);
});
