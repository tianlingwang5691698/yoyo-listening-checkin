const test = require('node:test');
const assert = require('node:assert/strict');
const catalogEngine = require('../lib/catalog-engine');
const plan = require('../lib/unlock1-speaking-plan');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const planService = require('../services/unlock1-speaking-plan.service');

test('Unlock 1 跟读计划在前 68 天覆盖全部 135 段', () => {
  const catalog = catalogEngine.getCatalog('unlock1');
  const tasks = Array.from({ length: 68 }, (_, index) => plan.buildPlanTasks(73 + index, catalog)).flat();
  assert.equal(plan.PARAGRAPHS.length, 135);
  assert.equal(tasks.length, 135);
  assert.equal(new Set(tasks.map((item) => item.taskId)).size, 135);
  assert.equal(tasks.reduce((sum, item) => sum + item.sentenceCount, 0), 571);
});

test('第 69–72 天每天安排两段巩固复习', () => {
  const catalog = catalogEngine.getCatalog('unlock1');
  for (let roundDay = 69; roundDay <= 72; roundDay += 1) {
    const tasks = plan.buildPlanTasks(72 + roundDay, catalog);
    assert.equal(tasks.length, 2);
    assert.ok(tasks.every((item) => item.isReviewTask));
  }
});

test('独立跟读日历从 2026-07-23 开始并按 72 天循环', () => {
  assert.equal(plan.getRoundDayForDate('2026-07-22'), 0);
  assert.equal(plan.getRoundDayForDate('2026-07-23'), 1);
  assert.equal(plan.getRoundDayForDate('2026-07-24'), 2);
  assert.equal(plan.getRoundDayForDate('2026-10-02'), 72);
  assert.equal(plan.getRoundDayForDate('2026-10-03'), 1);
});

test('每日完成状态要求该段每一句都有学生评分记录', async (t) => {
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  t.mock.method(attemptRepository, 'findByDate', async () => Array.from({ length: 5 }, (_, index) => ({
    category: 'speaking',
    attemptType: 'standalone_sentence_repeat',
    taskId: `unlock1-1-paragraph-1-sentence-${index + 1}`
  })));
  const summary = await planService.getDailyPlanSummary({ child: {} }, '2026-07-23', 86);
  assert.equal(summary.roundDay, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.completedToday, false);
  assert.equal(summary.tasks[0].completedToday, true);
  assert.equal(summary.tasks[1].completedToday, false);
});
