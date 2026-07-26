const test = require('node:test');
const assert = require('node:assert/strict');
const catalogEngine = require('../lib/catalog-engine');
const plan = require('../lib/unlock1-speaking-plan');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const planService = require('../services/unlock1-speaking-plan.service');

test('佑佑每日跟读从旧计划已排的 23 句后接续，每天固定 20 句', () => {
  const catalogs = {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  };
  const firstDayTasks = plan.buildPlanTasks(73, catalogs);
  const firstDaySentenceIds = firstDayTasks.flatMap((task) => task.sentenceTaskIds);
  assert.equal(plan.SENTENCES.length, 318);
  assert.equal(plan.TEXTBOOK_SENTENCES.length, 571);
  assert.equal(plan.TOTAL_SENTENCES, 889);
  assert.equal(plan.TOTAL_WORDS, 3023);
  assert.equal(firstDaySentenceIds.length, 20);
  assert.equal(firstDaySentenceIds[0], 'unlock1workbook-1-paragraph-5-sentence-4');
  assert.ok(firstDayTasks.every((task) => task.audioCategory === 'unlock1workbook'));
});

test('连续日历每天恰好 20 句并覆盖练习册与课本全部 889 句', () => {
  const catalogs = {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  };
  const dailyTasks = Array.from({ length: plan.CYCLE_DAYS }, (_, index) => plan.buildPlanTasks(73 + index, catalogs));
  const sentenceTaskIds = dailyTasks.flatMap((tasks) => tasks.flatMap((task) => task.sentenceTaskIds));
  assert.equal(plan.TEXTBOOK_PARAGRAPHS.length, 135);
  assert.ok(dailyTasks.every((tasks) => tasks.reduce((sum, task) => sum + task.sentenceCount, 0) === 20));
  assert.equal(new Set(sentenceTaskIds).size, 889);
  assert.ok(dailyTasks.flat().some((task) => task.audioCategory === 'unlock1workbook'));
  assert.ok(dailyTasks.flat().some((task) => task.audioCategory === 'unlock1'));
});

test('20 句日历从 2026-07-25 开始并保持稳定轮转', () => {
  assert.equal(plan.getRoundDayForDate('2026-07-24'), 0);
  assert.equal(plan.getRoundDayForDate('2026-07-25'), 1);
  assert.equal(plan.getRoundDayForDate('2026-07-26'), 2);
  const cycleEnd = new Date('2026-07-25T12:00:00Z');
  cycleEnd.setUTCDate(cycleEnd.getUTCDate() + plan.CYCLE_DAYS - 1);
  const nextCycle = new Date(cycleEnd);
  nextCycle.setUTCDate(nextCycle.getUTCDate() + 1);
  assert.equal(plan.getRoundDayForDate(cycleEnd.toISOString().slice(0, 10)), plan.CYCLE_DAYS);
  assert.equal(plan.getRoundDayForDate(nextCycle.toISOString().slice(0, 10)), 1);
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
  const summary = await planService.getDailyPlanSummary({ child: {} }, '2026-07-25', 86);
  assert.equal(summary.roundDay, 1);
  assert.equal(summary.sentenceCount, 20);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.completedToday, false);
  assert.equal(summary.tasks[0].completedToday, true);
  assert.equal(summary.tasks[1].completedToday, false);
});

test('重复提交已完成段落不能抵消遗漏段落', async (t) => {
  t.mock.method(study, 'getUserScope', () => ({ familyId: 'family-1', childId: 'child-1' }));
  const tasks = plan.buildPlanTasks(74, {
    workbook: catalogEngine.getCatalog('unlock1workbook'),
    textbook: catalogEngine.getCatalog('unlock1')
  });
  const missingTask = tasks.find((task) => task.taskId === 'unlock1workbook-2-paragraph-4-sentences-1-4');
  const duplicatedTask = tasks.find((task) => task.taskId === 'unlock1workbook-2-paragraph-5-sentences-1-3');
  let attempts = tasks
    .filter((task) => task !== missingTask)
    .flatMap((task) => task.sentenceTaskIds.map((taskId) => ({
      category: 'speaking',
      attemptType: 'standalone_sentence_repeat',
      taskId
    })))
    .concat(duplicatedTask.sentenceTaskIds.map((taskId) => ({
      category: 'speaking',
      attemptType: 'standalone_sentence_repeat',
      taskId
    })));
  t.mock.method(attemptRepository, 'findByDate', async () => attempts);

  const incomplete = await planService.getDailyPlanSummary({ child: {} }, '2026-07-26', 87);
  assert.equal(incomplete.completedToday, false);
  assert.equal(incomplete.completedCount, 4);
  assert.equal(incomplete.tasks.find((task) => !task.completedToday).taskId, missingTask.taskId);

  attempts = attempts.concat(missingTask.sentenceTaskIds.map((taskId) => ({
    category: 'speaking',
    attemptType: 'standalone_sentence_repeat',
    taskId
  })));
  const complete = await planService.getDailyPlanSummary({ child: {} }, '2026-07-26', 87);
  assert.equal(complete.completedToday, true);
  assert.equal(complete.tasks.reduce((sum, task) => sum + task.completedSentenceCount, 0), 20);
});
