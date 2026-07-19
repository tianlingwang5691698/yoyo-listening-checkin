const assert = require('node:assert/strict');
const test = require('node:test');

const fixedPlanSummary = require('../lib/fixed-plan-summary');
const planEngine = require('../lib/plan-engine');
const planRuntime = require('../lib/plan-runtime');

function record(overrides = {}) {
  return Object.assign({
    progressId: 'progress-1',
    childId: 'child-1',
    category: 'grammar',
    date: '2026-07-15',
    taskId: 'grammar-1',
    planSource: 'fixed-yoyo',
    planRunType: 'normal',
    planSlotIndex: 1,
    playCount: 1,
    repeatTarget: 1,
    completedToday: true,
    updatedAt: '2026-07-15T10:00:00.000Z'
  }, overrides);
}

test('固定计划摘要保留槽位完成次数和最近进度', () => {
  const records = [
    record(),
    record({ progressId: 'progress-2', date: '2026-07-16', taskId: 'grammar-2', playCount: 0, completedToday: false, updatedAt: '2026-07-16T10:00:00.000Z' })
  ];
  const summary = fixedPlanSummary.buildSummaryDocument(records, { familyId: 'family-1', childId: 'child-1' });
  const slot = summary.slots.grammar__1;
  assert.equal(summary.sourceRecordCount, 2);
  assert.equal(slot.completedCount, 1);
  assert.equal(slot.lastCompletedDate, '2026-07-15');
  assert.equal(slot.latestProgress.taskId, 'grammar-2');
});

test('固定计划摘要当天完成不提前推进，次日才推进', () => {
  const catalogs = {
    grammar: Array.from({ length: 12 }, (_, index) => ({ taskId: `grammar-${index + 1}`, category: 'grammar' }))
  };
  const deps = {
    planSlotCount: 24,
    getCatalog: (category) => catalogs[category] || [],
    planLib: planRuntime,
    getCompletedCountBeforeDate: fixedPlanSummary.getCompletedCountBeforeDate
  };
  const initial = planEngine.buildFixedPlanBySlots([], 'child-1', '2026-07-15', deps);
  const summary = fixedPlanSummary.buildSummaryDocument([record({ taskId: initial.byCategory.grammar[0].taskId })], {
    familyId: 'family-1',
    childId: 'child-1'
  });
  const progress = [record({ taskId: initial.byCategory.grammar[0].taskId })];
  const sameDay = planEngine.buildFixedPlanBySlots(progress, 'child-1', '2026-07-15', Object.assign({}, deps, { fixedPlanSummary: summary }));
  const nextDay = planEngine.buildFixedPlanBySlots(progress, 'child-1', '2026-07-16', Object.assign({}, deps, { fixedPlanSummary: summary }));
  assert.equal(sameDay.byCategory.grammar[0].taskId, initial.byCategory.grammar[0].taskId);
  assert.notEqual(nextDay.byCategory.grammar[0].taskId, initial.byCategory.grammar[0].taskId);
});

test('首页摘要只注入每个槽位最近进度并保留今日记录', () => {
  const summary = fixedPlanSummary.buildSummaryDocument([
    record({ progressId: 'old', date: '2026-07-15' }),
    record({ progressId: 'latest', date: '2026-07-16', taskId: 'grammar-2', completedToday: false, playCount: 0, updatedAt: '2026-07-16T10:00:00.000Z' })
  ], { familyId: 'family-1', childId: 'child-1' });
  const progress = fixedPlanSummary.buildProgressRecords(summary, [record({ progressId: 'today', taskId: 'grammar-3' })]);
  assert.deepEqual(progress.map((item) => item.progressId).sort(), ['latest', 'today']);
});
