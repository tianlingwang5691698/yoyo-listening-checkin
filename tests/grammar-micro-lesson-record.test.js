const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('词法微课完成后先写学习记录再生成日报', async () => {
  const study = require('../cloudfunctions/yoyo/facades/study.facade');
  const completion = require('../cloudfunctions/yoyo/services/completion.service');
  const taskService = require('../cloudfunctions/yoyo/services/task.service');
  const originals = {};
  const calls = [];
  const methods = {
    prepareRequestContext: async () => ({
      today: '2026-07-16',
      ctx: {
        user: { userId: 'user-1' },
        member: { memberId: 'member-1', role: 'student' },
        family: { familyId: 'family-1' },
        child: { childId: 'child-1' }
      }
    }),
    normalizeStudyRole: () => 'student',
    isYoyoChild: () => true,
    getUserScope: () => ({ familyId: 'family-1', childId: 'child-1' }),
    getCheckins: async () => [],
    getChildProgressRecords: async () => [],
    buildFixedPlanBySlots: () => ({
      dayIndex: 86,
      byCategory: {
        grammar: [{
          category: 'grammar',
          taskId: 'grammar-noun-1',
          topic: 'noun',
          topicLabel: '名词',
          lessonNumber: 1,
          title: '认识名词',
          planSlotIndex: 1,
          planSlotCount: 3
        }]
      }
    }),
    saveProgressRecord: async () => { calls.push('progress'); },
    syncFixedPlanProgressSummary: async () => { calls.push('summary'); },
    upsertDailyReport: async () => { calls.push('report'); },
    maybeCreateCheckin: async () => null
  };
  Object.keys(methods).forEach((key) => {
    originals[key] = study[key];
    study[key] = methods[key];
  });
  const originalCompletion = completion.upsertStudyCompletion;
  let completionPayload;
  completion.upsertStudyCompletion = async (_ctx, _date, payload) => {
    calls.push('completion');
    completionPayload = payload;
  };
  try {
    await taskService.completeGrammarPlanTask({
      payload: {
        taskId: 'grammar-noun-1',
        narrationDuration: 100,
        narrationListenedSec: 96,
        correctQuestionCount: 3,
        totalQuestionCount: 3,
        questions: [{
          _id: 'grammar-noun-1:1',
          number: 1,
          prompt: '哪个词是名词？',
          options: { A: 'book', B: 'quickly' },
          selectedAnswer: 'A',
          firstAnswer: 'B',
          attempts: ['B', 'A'],
          answer: 'A',
          isCorrect: true,
          analysis: 'book 给事物命名。'
        }]
      }
    });
    assert.ok(calls.indexOf('completion') < calls.indexOf('report'));
    assert.equal(completionPayload.section, 'micro-lesson');
    assert.equal(completionPayload.progressText, '完成 1 节微课 · 答对 3/3 题 · 讲解收听完成');
    assert.equal(completionPayload.latestAttempt.status, 'completed');
    assert.equal(completionPayload.latestAttempt.questions.length, 1);
    assert.equal(completionPayload.latestAttempt.questions[0].firstAnswer, 'B');
    assert.deepEqual(completionPayload.latestAttempt.questions[0].attempts, ['B', 'A']);
  } finally {
    Object.keys(methods).forEach((key) => { study[key] = originals[key]; });
    completion.upsertStudyCompletion = originalCompletion;
  }
});

test('固定计划和统一日报详情按课程口径展示词法微课', () => {
  const dashboard = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/lib/dashboard-engine.js'), 'utf8');
  const levelStage = fs.readFileSync(path.join(root, 'pages/level-stage/index.js'), 'utf8');
  const record = fs.readFileSync(path.join(root, 'pages/record/index.js'), 'utf8');
  const classroom = fs.readFileSync(path.join(root, 'grammar-package/pages/classroom/index.js'), 'utf8');
  const classroomTemplate = fs.readFileSync(path.join(root, 'grammar-package/pages/classroom/index.wxml'), 'utf8');
  const practiceHistory = fs.readFileSync(path.join(root, 'pages/practice-history/index.js'), 'utf8');
  const practiceTemplate = fs.readFileSync(path.join(root, 'pages/practice-history/index.wxml'), 'utf8');
  const parentDetail = fs.readFileSync(path.join(root, 'pages/parent/detail/index.js'), 'utf8');
  const parentTemplate = fs.readFileSync(path.join(root, 'pages/parent/detail/index.wxml'), 'utf8');
  assert.match(dashboard, /task\.category === 'grammar'[\s\S]*?return '课程'/);
  assert.match(dashboard, /task\.category === 'grammar'[\s\S]*?`\$\{task\.playCount \|\| 0\}\/1 节`/);
  assert.match(levelStage, /task\.category === 'grammar'[\s\S]*?return t\('course'\)/);
  assert.match(record, /dailyReportRoute\.buildDailyReportDetailUrl\(date\)/);
  assert.match(classroom, /store\.getStudyCompletionDetail\(this\.reviewRecordId\)/);
  assert.match(classroom, /questions: this\.buildCompletedQuestionResults\(\)/);
  assert.match(classroom, /this\.reviewMode \|\| this\.previewMode/);
  assert.match(classroomTemplate, /wx:for="\{\{reviewQuestions\}\}"/);
  assert.match(practiceHistory, /detailReady: questions\.length > 0/);
  assert.match(practiceTemplate, /item\.detailQuestions && item\.detailQuestions\.length/);
  assert.match(parentDetail, /isGrammarMicroLesson[\s\S]*?grammarMicroLessonTaskIds/);
  assert.match(parentDetail, /current && current\.isGrammarMicroLesson[\s\S]*?buildGrammarClassroomUrl\(current, \{ review: true \}\)/);
  assert.equal((parentTemplate.match(/!item\.isVocabulary/g) || []).length, 2);
});
