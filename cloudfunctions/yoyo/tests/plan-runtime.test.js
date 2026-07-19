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

test('自定义计划只按本计划启动后的完成记录推进', () => {
  const progressRecords = [
    { date: '2026-07-06', updatedAt: '2026-07-06T12:00:00.000Z', category: 'newconcept3', taskId: 'nce3-1', completedToday: true, planSource: 'fixed-yoyo', listeningPlanId: '' },
    { date: '2026-07-07', updatedAt: '2026-07-07T12:00:00.000Z', category: 'newconcept3', taskId: 'nce3-1', completedToday: true, planSource: 'custom-listening', listeningPlanId: 'old-plan' },
    { date: '2026-07-08', updatedAt: '2026-07-08T12:00:00.000Z', category: 'newconcept3', taskId: 'nce3-1', completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1' },
    { date: '2026-07-09', updatedAt: '2026-07-09T12:00:00.000Z', category: 'newconcept3', taskId: 'nce3-1', completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1' },
    { date: '2026-07-10', updatedAt: '2026-07-10T12:00:00.000Z', category: 'newconcept3', taskId: 'nce3-2', completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1' },
    { date: '2026-07-10', updatedAt: '2026-07-10T13:00:00.000Z', category: 'newconcept3', taskId: 'nce3-3', completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1', planRunType: 'catchup' }
  ];
  const plan = {
    planId: 'plan-1',
    materials: [{ category: 'newconcept3', progressStartedAt: '2026-07-09T00:00:00.000Z' }]
  };

  assert.equal(listeningPlanEngine.getCustomPlanDayIndex(progressRecords, '2026-07-09', plan), 1);
  assert.equal(listeningPlanEngine.getCustomPlanDayIndex(progressRecords, '2026-07-10', plan), 2);
  assert.equal(listeningPlanEngine.getCustomPlanDayIndex(progressRecords, '2026-07-11', plan), 3);
  assert.equal(listeningPlanEngine.getCustomPlanDayIndex(progressRecords, '2026-07-20', plan), 3);
  assert.equal(listeningPlanEngine.getCustomPlanDayIndex(progressRecords, '2026-07-20'), 1);
});

test('自定义计划每个槽位独立推进并跨日保留未完成遍数', () => {
  const catalog = Array.from({ length: 6 }, (_, index) => ({
    taskId: `nce3-${index + 1}`,
    category: 'newconcept3'
  }));
  const plan = {
    planId: 'plan-1',
    materials: [{
      category: 'newconcept3',
      startNo: 1,
      endNo: 6,
      dailyCount: 3,
      repeatTarget: 3,
      progressStartedAt: '2026-07-09T00:00:00.000Z'
    }]
  };
  const progressRecords = [
    { childId: 'child-1', date: '2026-07-10', updatedAt: '2026-07-10T10:00:00.000Z', category: 'newconcept3', taskId: 'nce3-1', playCount: 3, repeatTarget: 3, completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1' },
    { childId: 'child-1', date: '2026-07-10', updatedAt: '2026-07-10T10:10:00.000Z', category: 'newconcept3', taskId: 'nce3-2', playCount: 1, repeatTarget: 3, completedToday: false, planSource: 'custom-listening', listeningPlanId: 'plan-1' },
    { childId: 'child-1', date: '2026-07-11', updatedAt: '2026-07-11T10:20:00.000Z', category: 'newconcept3', taskId: 'nce3-3', playCount: 3, repeatTarget: 3, completedToday: true, planSource: 'custom-listening', listeningPlanId: 'plan-1' }
  ];
  const dayPlan = listeningPlanEngine.buildPlanForDate(plan, '2026-07-11', progressRecords, {
    getCatalog: () => catalog
  });

  assert.deepEqual(dayPlan.byCategory.newconcept3.map((item) => item.taskId), ['nce3-4', 'nce3-2', 'nce3-3']);

  const decorated = listeningPlanEngine.decoratePlanTasks(progressRecords, 'child-1', '2026-07-11', dayPlan, {
    listeningPlanId: 'plan-1'
  }, {
    decoratePlannedTasks: (records, childId, category, date, tasks) => tasks.map((task) => {
      const progress = records.find((item) => item.childId === childId && item.category === category && item.taskId === task.taskId && item.date === date) || {};
      return Object.assign({}, task, { playCount: Number(progress.playCount || 0), completedToday: !!progress.completedToday });
    })
  });
  assert.equal(decorated.find((item) => item.taskId === 'nce3-2').playCount, 1);
  assert.equal(decorated.find((item) => item.taskId === 'nce3-3').completedToday, true);
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

test('佑佑第 86 天从名词前 5 节开始词法计划', () => {
  const catalog = planRuntime.buildGrammarCatalog();
  assert.equal(catalog.length, 168);
  assert.equal(catalog[0].title, '名词的定义与本质');
  assert.equal(catalog[0].meta, '给人、事物、地点和概念命名');
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(86, 'grammar', catalog.length),
    [0, 1, 2, 3, 4]
  );
  assert.deepEqual(
    planRuntime.getPlanIndicesForCategory(87, 'grammar', catalog.length),
    [5, 6, 7, 8, 9]
  );
});

test('语法固定目录在同一云函数实例内复用', () => {
  assert.equal(planRuntime.buildGrammarCatalog(), planRuntime.buildGrammarCatalog());
});

test('佑佑语法固定计划按已完成课程连续推进', () => {
  const catalogs = {
    newconcept1: Array.from({ length: 76 }, (_, index) => ({ taskId: `nce-${index}`, category: 'newconcept1' })),
    peppa: Array.from({ length: 100 }, (_, index) => ({ taskId: `peppa-${index}`, category: 'peppa' })),
    unlock1: Array.from({ length: 24 }, (_, index) => ({ taskId: `unlock-${index}`, category: 'unlock1' }))
  };
  const deps = {
    planSlotCount: 24,
    getCatalog: (category) => catalogs[category] || [],
    planLib: planRuntime
  };
  const initial = planEngine.buildFixedPlanBySlots([], 'child-yoyo', '2026-07-15', deps);
  const firstBatch = initial.byCategory.grammar;
  const progress = firstBatch.slice(0, 3).map((task, index) => ({
    childId: 'child-yoyo', category: 'grammar', taskId: task.taskId, date: '2026-07-15',
    planSource: 'fixed-yoyo', planRunType: 'normal', planSlotIndex: index + 1,
    repeatTarget: 1, completedToday: true
  }));
  const sameDay = planEngine.buildFixedPlanBySlots(progress, 'child-yoyo', '2026-07-15', deps);
  const nextDay = planEngine.buildFixedPlanBySlots(progress, 'child-yoyo', '2026-07-16', deps);
  assert.deepEqual(sameDay.byCategory.grammar.map((task) => task.taskId), firstBatch.map((task) => task.taskId));
  assert.deepEqual(nextDay.byCategory.grammar.map((task) => task.taskId), [
    'grammar-noun-4', 'grammar-noun-5', 'grammar-noun-6', 'grammar-noun-7', 'grammar-noun-8'
  ]);
});

test('佑佑从每天 3 节切到 5 节后不跳过第 10 节', () => {
  const catalog = planRuntime.buildGrammarCatalog();
  const progress = catalog.slice(0, 9).map((task, index) => ({
    childId: 'child-yoyo', category: 'grammar', taskId: task.taskId, date: `2026-07-${17 + Math.floor(index / 3)}`,
    planSource: 'fixed-yoyo', planRunType: 'normal', planSlotIndex: (index % 3) + 1,
    repeatTarget: 1, completedToday: true
  }));
  const plan = planEngine.buildFixedPlanBySlots(progress, 'child-yoyo', '2026-07-20', {
    planSlotCount: 24,
    getCatalog: () => [],
    planLib: planRuntime
  });
  assert.deepEqual(plan.byCategory.grammar.map((task) => task.taskId), catalog.slice(9, 14).map((task) => task.taskId));
  assert.deepEqual(plan.byCategory.grammar.map((task) => task.planSlotIndex), [1, 2, 3, 4, 5]);
});
