const test = require('node:test');
const assert = require('node:assert/strict');

const planRuntime = require('../lib/plan-runtime');

test('补卡起点取首次成功打卡日期', () => {
  const checkins = [
    { date: '2026-04-12' },
    { date: '2026-04-15' }
  ];
  assert.equal(planRuntime.getPlanStartDate({}, '2026-04-20', checkins), '2026-04-12');
  assert.equal(planRuntime.getPlanStartDate({}, '2026-04-20', []), '');
});

test('补卡只定位首次打卡之后漏掉的日期，并返回漏卡当天计划日', () => {
  const checkins = [
    { date: '2026-04-20', planDayIndex: 1, completedAt: '2026-04-20T12:00:00.000Z', planRunType: 'normal' },
    { date: '2026-04-22', planDayIndex: 3, completedAt: '2026-04-22T12:00:00.000Z', planRunType: 'normal' }
  ];
  const state = planRuntime.buildCatchupState(checkins, '2026-04-22', '2026-04-20', true);
  assert.deepEqual(state, {
    canCatchup: true,
    missedDate: '2026-04-21',
    planDayIndex: 2,
    usedToday: false,
    reason: 'ready'
  });
});

test('当天是否已使用补卡按中国日期判断', () => {
  const checkins = [
    { planRunType: 'catchup', completedAt: '2026-04-20T16:30:00.000Z' }
  ];
  assert.equal(planRuntime.hasCatchupToday(checkins, '2026-04-21'), true);
  assert.equal(planRuntime.hasCatchupToday(checkins, '2026-04-20'), false);
});
