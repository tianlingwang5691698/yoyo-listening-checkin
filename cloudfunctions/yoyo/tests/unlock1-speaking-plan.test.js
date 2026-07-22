const test = require('node:test');
const assert = require('node:assert/strict');
const catalogEngine = require('../lib/catalog-engine');
const plan = require('../lib/unlock1-speaking-plan');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const planService = require('../services/unlock1-speaking-plan.service');

test('Unlock 1 练习册跟读计划在 32 天覆盖全部 318 句', () => {
  const catalogs = {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  };
  const dailyTasks = Array.from({ length: 32 }, (_, index) => plan.buildPlanTasks(73 + index, catalogs));
  const sentenceTaskIds = dailyTasks.flatMap((tasks) => tasks.flatMap((task) => task.sentenceTaskIds));
  const dailyWordCounts = dailyTasks.map((tasks) => tasks.reduce((sum, task) => sum + task.wordCount, 0));
  const dailySentenceCounts = dailyTasks.map((tasks) => tasks.reduce((sum, task) => sum + task.sentenceCount, 0));
  assert.equal(plan.SENTENCES.length, 318);
  assert.equal(plan.TOTAL_WORDS, 3023);
  assert.equal(sentenceTaskIds.length, 318);
  assert.equal(new Set(sentenceTaskIds).size, 318);
  assert.ok(dailyWordCounts.every((count) => count >= 49 && count <= 126));
  assert.ok(dailySentenceCounts.every((count) => count >= 8 && count <= 12));
  assert.ok(dailyTasks.flat().every((task) => task.audioCategory === 'unlock1workbook'));
});

test('第 33–77 天每天 3 段课本并覆盖全部 135 段', () => {
  const catalogs = {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  };
  const dailyTasks = Array.from({ length: 45 }, (_, index) => plan.buildPlanTasks(73 + 32 + index, catalogs));
  assert.equal(plan.TEXTBOOK_PARAGRAPHS.length, 135);
  assert.ok(dailyTasks.every((tasks) => tasks.length === 3));
  assert.equal(new Set(dailyTasks.flat().map((task) => task.taskId)).size, 135);
  assert.ok(dailyTasks.flat().every((task) => task.audioCategory === 'unlock1'));
});

test('独立跟读日历从 2026-07-23 开始并按 77 天循环', () => {
  assert.equal(plan.getRoundDayForDate('2026-07-22'), 0);
  assert.equal(plan.getRoundDayForDate('2026-07-23'), 1);
  assert.equal(plan.getRoundDayForDate('2026-08-23'), 32);
  assert.equal(plan.getRoundDayForDate('2026-08-24'), 33);
  assert.equal(plan.getRoundDayForDate('2026-10-07'), 77);
  assert.equal(plan.getRoundDayForDate('2026-10-08'), 1);
});

test('每日完成状态要求该段每一句都有学生评分记录', async (t) => {
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  const firstTask = plan.buildPlanTasks(73, {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  })[0];
  t.mock.method(attemptRepository, 'findByDate', async () => firstTask.sentenceTaskIds.map((taskId) => ({
    category: 'speaking',
    attemptType: 'standalone_sentence_repeat',
    taskId
  })));
  const summary = await planService.getDailyPlanSummary({ child: {} }, '2026-07-23', 86);
  assert.equal(summary.roundDay, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.completedToday, false);
  assert.equal(summary.tasks[0].completedToday, true);
  assert.equal(summary.tasks[1].completedToday, false);
});
