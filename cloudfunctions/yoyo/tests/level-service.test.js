const test = require('node:test');
const assert = require('node:assert/strict');

const levelService = require('../services/level.service');
const study = require('../facades/study.facade');
const flashcardService = require('../services/flashcard.service');
const unlock1SpeakingPlanService = require('../services/unlock1-speaking-plan.service');

test('佑佑阶段详情返回周期和固定内容范围', async (t) => {
  const grammarTasks = [{
    category: 'grammar',
    categoryLabel: '词法微课',
    taskId: 'grammar-noun-1',
    title: '名词的定义与本质',
    meta: '给人、事物、地点和概念命名',
    topic: 'noun',
    lessonNumber: 1,
    repeatTarget: 1,
    completedToday: false
  }];
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { user: {}, member: {}, child: { childId: 'child-yoyo' } },
    today: '2026-07-15'
  }));
  t.mock.method(study, 'getUserScope', () => ({ childId: 'child-yoyo' }));
  t.mock.method(study, 'getChildProgressRecords', async () => []);
  t.mock.method(study, 'getDashboardData', async () => ({
    planSource: 'fixed-yoyo',
    planDayIndex: 86,
    planPhase: 'round-2',
    planPhaseLabel: '阶段二',
    stats: { completedTasks: 0 }
  }));
  t.mock.method(study, 'buildPlanForDay', () => ({
    dayIndex: 86,
    phase: { key: 'round-2', label: '阶段二' },
    byCategory: { grammar: grammarTasks }
  }));
  t.mock.method(study, 'decoratePlanTasks', () => grammarTasks);
  t.mock.method(study, 'buildCategorySummary', (tasks) => Object.assign({
    plannedTaskCount: tasks.length,
    isPendingAsset: false
  }, tasks[0] || {}));
  t.mock.method(study, 'buildEmptyProgress', () => ({}));
  t.mock.method(study, 'getCategoryLabel', () => '词法微课');
  t.mock.method(study, 'getPlanCatalog', () => grammarTasks);
  t.mock.method(study, 'getCatalog', () => []);
  t.mock.method(study, 'getResourceDebugSnapshot', () => ({}));
  t.mock.method(study, 'isYoyoChild', () => true);
  t.mock.method(flashcardService, 'getJuniorListPlanSummary', async () => ({
    active: true,
    planId: 'yoyo-junior-list-plan',
    round: 2,
    currentList: 3,
    title: '初中词汇第2轮 · List 3',
    summary: '主学 List 3 · 艾宾浩斯复习到期 List',
    completedToday: false
  }));
  t.mock.method(unlock1SpeakingPlanService, 'getDailyPlanSummary', async () => ({
    active: true,
    completedCount: 0,
    totalCount: 2,
    tasks: [{
      category: 'speaking',
      taskId: 'unlock1workbook-1-paragraph-1-sentences-1-5',
      audioTaskId: 'unlock1workbook-1',
      paragraphIndex: 1,
      sentenceStartIndex: 1,
      sentenceEndIndex: 5,
      sentenceCount: 5,
      durationSec: 175,
      completedToday: false
    }]
  }));

  const result = await levelService.getLevelOverview({ payload: { phase: 'round-2' } });

  assert.equal(result.fixedPlanOutline.cycleDays, 72);
  assert.equal(result.fixedPlanOutline.progression, 'independent-slots');
  const grammar = result.fixedPlanOutline.items.find((item) => item.category === 'grammar');
  assert.equal(grammar.syntaxTotalCount, 106);
  assert.match(grammar.scheduleText, /第2轮每天10课/);
  const newConcept = result.fixedPlanOutline.items.find((item) => item.category === 'newconcept1');
  assert.deepEqual([newConcept.startNo, newConcept.endNo, newConcept.totalCount], [1, 76, 76]);
  const vocabulary = result.fixedPlanOutline.items.find((item) => item.category === 'vocabulary');
  assert.deepEqual([vocabulary.startNo, vocabulary.endNo, vocabulary.totalCount], [1, 32, 1690]);
  const vocabularyCategory = result.categories.find((item) => item.category === 'vocabulary');
  assert.equal(vocabularyCategory.todayTask.displayTitle, '初中词汇第2轮 · List 3');
  assert.equal(result.categories.find((item) => item.category === 'speaking').todayTask.taskId, 'unlock1workbook-1-paragraph-1-sentences-1-5');
});
