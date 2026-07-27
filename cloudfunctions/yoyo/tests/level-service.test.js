const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  t.mock.method(study, 'getChildProgressRecords', async () => {
    throw new Error('fixed-yoyo overview must not load legacy progress records');
  });
  t.mock.method(study, 'getDashboardData', async (ctx, options) => {
    assert.equal(options.progressScope, 'home');
    assert.equal(options.includeHomeTaskGroups, true);
    assert.equal(options.includeTaskProgressSummary, true);
    return {
      planSource: 'fixed-yoyo',
      planDayIndex: 86,
      planPhase: 'round-2',
      planPhaseLabel: '阶段二',
      stats: { completedTasks: 0 },
      groupedDailyTasks: [{
        category: 'grammar',
        categoryLabel: '词法微课',
        totalCount: 1,
        completedCount: 0,
        durationSec: 60,
        nextTask: grammarTasks[0],
        tasks: grammarTasks
      }, {
        category: 'newconcept2',
        categoryLabel: 'New Concept 2',
        totalCount: 1,
        completedCount: 0,
        durationSec: 180,
        nextTask: {
          category: 'newconcept2',
          taskId: 'newconcept2-2__fixed_listening_round_1',
          title: '02－Breakfast or Lunch',
          completedToday: false
        },
        tasks: [{
          category: 'newconcept2',
          taskId: 'newconcept2-2__fixed_listening_round_1',
          title: '02－Breakfast or Lunch',
          completedToday: false
        }]
      }, {
        category: 'unlock1workbook',
        categoryLabel: 'Unlock 1 听口练习册 第二版',
        totalCount: 1,
        completedCount: 0,
        durationSec: 180,
        nextTask: {
          category: 'unlock1workbook',
          taskId: 'unlock1workbook-5__fixed_listening_round_1',
          title: 'MID 1',
          completedToday: false
        },
        tasks: [{
          category: 'unlock1workbook',
          taskId: 'unlock1workbook-5__fixed_listening_round_1',
          title: 'MID 1',
          completedToday: false
        }]
      }]
    };
  });
  t.mock.method(study, 'buildPlanForDay', () => {
    throw new Error('fixed-yoyo overview must not rebuild the legacy calendar plan');
  });
  t.mock.method(study, 'decoratePlanTasks', () => {
    throw new Error('fixed-yoyo overview must not decorate legacy calendar tasks');
  });
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
    dailySentenceCount: 20,
    curriculumSentenceCount: 889,
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
  const junie = result.fixedPlanOutline.items.find((item) => item.category === 'juniebjones');
  assert.deepEqual([junie.startNo, junie.endNo, junie.totalCount], [1, grammarTasks.length, grammarTasks.length]);
  const vocabulary = result.fixedPlanOutline.items.find((item) => item.category === 'vocabulary');
  assert.deepEqual([vocabulary.startNo, vocabulary.endNo, vocabulary.totalCount], [1, 32, 1690]);
  const speaking = result.fixedPlanOutline.items.find((item) => item.category === 'speaking');
  assert.equal(speaking.dailySentenceCount, 20);
  assert.match(speaking.scheduleText, /每天20句/);
  const vocabularyCategory = result.categories.find((item) => item.category === 'vocabulary');
  assert.equal(vocabularyCategory.todayTask.displayTitle, '初中词汇第2轮 · List 3');
  assert.equal(result.categories.find((item) => item.category === 'speaking').todayTask.taskId, 'unlock1workbook-1-paragraph-1-sentences-1-5');
  assert.equal(result.categories.find((item) => item.category === 'newconcept2').todayTask.taskId, 'newconcept2-2__fixed_listening_round_1');
  assert.equal(result.categories.find((item) => item.category === 'unlock1workbook').todayTask.taskId, 'unlock1workbook-5__fixed_listening_round_1');
  assert.equal(result.categories.some((item) => item.category === 'newconcept1'), false);
  assert.equal(result.categories.some((item) => item.category === 'unlock1'), false);
});

test('阶段页显示佑佑口语每天 20 句', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../../pages/level-stage/index.js'), 'utf8');
  assert.match(source, /练习册 → 课本连续循环/);
  assert.match(source, /每天\$\{Number\(item\.dailySentenceCount \|\| 20\)\}句/);
  assert.match(source, /onShow\(\)[\s\S]*ensureOverviewFresh\(\{ silent: true \}\)/);
  assert.match(source, /openFreshSpeakingTask[\s\S]*tasks\.findIndex\(\(task\) => !task\.completedToday/);
  assert.match(source, /requestedTask\.completedToday[\s\S]*reviewCompleted: true/);
  assert.match(source, /reviewCompleted=1/);
});
