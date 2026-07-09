const test = require('node:test');
const assert = require('node:assert/strict');

const planRuntime = require('../lib/plan-runtime');
const planEngine = require('../lib/plan-engine');
const listeningPlanEngine = require('../lib/listening-plan-engine');

test('补卡起点取首次成功打卡日期', () => {
  const checkins = [
    { date: '2026-04-12' },
    { date: '2026-04-15' }
  ];
  assert.equal(planRuntime.getPlanStartDate({}, '2026-04-20', checkins), '2026-04-12');
  assert.equal(planRuntime.getPlanStartDate({}, '2026-04-20', []), '');
});

test('补卡点亮最早漏日，但任务继续推进到下一计划日', () => {
  const checkins = [
    { date: '2026-04-20', planDayIndex: 1, completedAt: '2026-04-20T12:00:00.000Z', planRunType: 'normal' },
    { date: '2026-04-22', planDayIndex: 2, completedAt: '2026-04-22T12:00:00.000Z', planRunType: 'normal' }
  ];
  const state = planRuntime.buildCatchupState(checkins, '2026-04-22', '2026-04-20', true);
  assert.deepEqual(state, {
    canCatchup: true,
    missedDate: '2026-04-21',
    planDayIndex: 3,
    usedToday: false,
    reason: 'ready'
  });
});

test('当天任务已完成但打卡记录未入库时，补卡任务仍按完成后下一天推进', () => {
  const checkins = [
    { date: '2026-04-20', planDayIndex: 1, completedAt: '2026-04-20T12:00:00.000Z', planRunType: 'normal' }
  ];
  assert.equal(planRuntime.getCatchupPlanDayIndex(checkins, '2026-04-22', true), 3);
});

test('当天是否已使用补卡按中国日期判断', () => {
  const checkins = [
    { planRunType: 'catchup', completedAt: '2026-04-20T16:30:00.000Z' }
  ];
  assert.equal(planRuntime.hasCatchupToday(checkins, '2026-04-21'), true);
  assert.equal(planRuntime.hasCatchupToday(checkins, '2026-04-20'), false);
});

test('当天完成 Day 74 后继续显示 Day 75', () => {
  const checkins = [
    { date: '2026-07-03', planDayIndex: 74, planRunType: 'normal' }
  ];
  assert.equal(planRuntime.getPlanDayIndexForDate(checkins, '2026-07-03'), 74);
  assert.equal(planRuntime.getNextPlanDayIndexForDate(checkins, '2026-07-03'), 75);
});

test('自定义听力计划支持多个素材混合生成任务', () => {
  const catalogs = {
    newconcept3: Array.from({ length: 10 }, (_, index) => ({ taskId: `nce3-${index + 1}`, category: 'newconcept3' })),
    unlock3: Array.from({ length: 10 }, (_, index) => ({ taskId: `unlock3-${index + 1}`, category: 'unlock3' }))
  };
  const plan = listeningPlanEngine.buildPlanForDay({
    planId: 'plan-1',
    materials: [
      { levelId: 'B1', category: 'newconcept3', startNo: 1, endNo: 10, dailyCount: 1, repeatTarget: 3 },
      { levelId: 'B1', category: 'unlock3', startNo: 1, endNo: 10, dailyCount: 1, repeatTarget: 2 }
    ]
  }, 1, {
    getCatalog: (category) => catalogs[category] || []
  });

  assert.deepEqual(plan.categoryOrder, ['newconcept3', 'unlock3']);
  assert.deepEqual(Object.keys(plan.byCategory), ['newconcept3', 'unlock3']);
  assert.equal(plan.flatTasks.length, 2);
  assert.equal(plan.byCategory.newconcept3[0].taskId, 'nce3-1');
  assert.equal(plan.byCategory.unlock3[0].taskId, 'unlock3-1');
});

test('自定义听力计划支持取消单个素材', () => {
  const nextMaterials = listeningPlanEngine.removePlanMaterial({
    materials: [
      { category: 'newconcept4', dailyCount: 1 },
      { category: 'unlock4', dailyCount: 2 }
    ]
  }, 'unlock4');

  assert.deepEqual(nextMaterials, [{ category: 'newconcept4', dailyCount: 1 }]);
});

test('Unlock1 首轮后循环任务每条只听 1 遍', () => {
  const catalog = Array.from({ length: 24 }, (_, index) => ({
    taskId: `unlock1-${index + 1}`,
    category: 'unlock1',
    repeatTarget: 3
  }));
  const deps = {
    planSlotCount: 24,
    getCatalog: () => catalog,
    planLib: planRuntime
  };

  assert.equal(planEngine.buildPlanForDay(24, deps).byCategory.unlock1[0].repeatTarget, 3);
  assert.deepEqual(
    planEngine.buildPlanForDay(25, deps).byCategory.unlock1.map((task) => task.repeatTarget),
    [1, 1, 1]
  );
});

test('阶段二 New Concept 1 每天排 3 条', () => {
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(73, 'newconcept1', 76),
    [0, 1, 2]
  );
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(74, 'newconcept1', 76),
    [3, 4, 5]
  );
});

test('阶段二 Unlock1 每天安排三个音频', () => {
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(73, 'unlock1', 24),
    [0, 1, 2]
  );
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(144, 'unlock1', 24),
    [21, 22, 23]
  );
});

test('阶段二 Peppa 每天五集，取消 Songs', () => {
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(73, 'peppa', 100),
    [72, 73, 74, 75, 76]
  );
  assert.deepEqual(
    planRuntime.getPlanCategoryOrder(73),
    ['newconcept1', 'peppa', 'unlock1']
  );
});

test('阶段二 Peppa 不额外叠加旧集复听', () => {
  const catalogs = {
    newconcept1: Array.from({ length: 76 }, (_, index) => ({ taskId: `nce-${index}`, category: 'newconcept1' })),
    peppa: Array.from({ length: 80 }, (_, index) => ({ taskId: `peppa-${index}`, category: 'peppa' })),
    unlock1: Array.from({ length: 24 }, (_, index) => ({ taskId: `unlock-${index}`, category: 'unlock1' })),
    song: Array.from({ length: 30 }, (_, index) => ({ taskId: `song-${index}`, category: 'song' }))
  };
  const plan = planEngine.buildPlanForDay(73, {
    planSlotCount: 24,
    getCatalog: (category) => catalogs[category],
    planLib: planRuntime
  }, { includePeppaReview: true });

  assert.equal(plan.byCategory.peppa.length, 5);
  assert.equal(plan.byCategory.song, undefined);
  assert.deepEqual(plan.byCategory.newconcept1.map((task) => task.repeatTarget), [1, 1, 1]);
  assert.deepEqual(plan.byCategory.peppa.map((task) => task.repeatTarget), [1, 1, 1, 1, 1]);
  assert.deepEqual(plan.byCategory.unlock1.map((task) => task.repeatTarget), [1, 1, 1]);
});
