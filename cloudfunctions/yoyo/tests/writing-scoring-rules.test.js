const assert = require('node:assert/strict');
const test = require('node:test');

const writing = require('../services/writing.service')._test;

test('雅思 Task 1 和 Task 2 按9分制与四项标准评分', () => {
  const task1 = {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 1',
    examType: 'IELTS Academic',
    contentType: 'ielts-writing-task-1',
    prompt: 'The graph below gives information about jobs.',
    requirements: ['Summarise the main features.'],
    visualData: { type: 'line graph', labels: ['1960', '2020'] },
    minWords: 150,
    score: 9
  };
  const task2 = Object.assign({}, task1, {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 2',
    contentType: 'ielts-writing-task-2',
    minWords: 250
  });

  assert.equal(writing.getWritingTaskType(task1), 'ielts-task-1');
  assert.equal(writing.getWritingTaskType(task2), 'ielts-task-2');
  assert.equal(writing.resolveTotalScore(task1), 9);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /Task Achievement/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /visualData/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /原题参考范文/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /public Writing band descriptors · May 2023/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /criterionFeedback/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /原文证据/);
  assert.match(writing.buildGradingPrompt(task2, 'Essay'), /Task Response/);
  assert.doesNotMatch(writing.buildGradingPrompt(task1, 'Essay'), /"totalScore":20/);
});

test('雅思总分由四项平均并归入半分档', () => {
  const prompt = { contentType: 'ielts-writing-task-1', score: 9 };
  const review = writing.normalizeReview({
    score: 9,
    totalScore: 20,
    dimensionScores: {
      taskAchievement: 6,
      coherenceCohesion: 6.5,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 6.5
    },
    content: 'content',
    structure: 'structure',
    language: 'language',
    spelling: 'grammar',
    criterionFeedback: {
      taskAchievement: {
        evidence: ['The overview identifies the main trend.'],
        descriptorMatch: '主要特征已覆盖，但比较不够充分。',
        limiters: ['遗漏一个关键转折点。'],
        nextBandActions: ['补充关键阶段之间的直接比较。']
      },
      coherenceCohesion: {},
      lexicalResource: {},
      grammaticalRangeAccuracy: {}
    },
    polishedVersion: 'model answer'
  }, prompt);

  assert.equal(review.score, 6.5);
  assert.equal(review.totalScore, 9);
  assert.equal(review.level, 'IELTS Band 6.5');
  assert.equal(review.contentLabel, 'Task Achievement · 6.0');
  assert.equal(review.polishedTitle, '原题参考范文');
  assert.equal(review.isIelts, true);
  assert.match(review.weightingNote, /Task 2 权重为 Task 1 的两倍/);
  assert.equal(review.criterionDetails.length, 4);
  assert.deepEqual(review.criterionDetails[0].evidence, ['The overview identifies the main trend.']);
  assert.deepEqual(review.criterionDetails[0].nextBandActions, ['补充关键阶段之间的直接比较。']);
  assert.equal(writing.hasCompleteIeltsCriterionDetails(review), false);
  const normalizedAgain = writing.normalizeReview(review, prompt);
  assert.deepEqual(normalizedAgain.criterionDetails[0].evidence, review.criterionDetails[0].evidence);
});

test('雅思证据化评分必须四项字段完整', () => {
  const complete = {
    criterionDetails: ['task', 'coherence', 'lexical', 'grammar'].map((key) => ({
      key,
      comment: '具体评语',
      evidence: ['学生原文证据'],
      descriptorMatch: '符合当前档描述',
      limiters: ['限制更高分的原因'],
      nextBandActions: ['下一档动作']
    }))
  };
  assert.equal(writing.hasCompleteIeltsCriterionDetails(complete), true);
  complete.criterionDetails[2].evidence = [];
  assert.equal(writing.hasCompleteIeltsCriterionDetails(complete), false);
});

test('雅思按需生成高 1 与高 2 Band 教学范文协议', () => {
  const prompt = {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 2',
    examType: 'IELTS Academic',
    contentType: 'ielts-writing-task-2',
    prompt: 'Discuss both views and give your opinion.',
    minWords: 250
  };
  const review = { score: 6, dimensionScores: { task: 6 } };
  const plusOne = writing.buildBandSamplePrompt(prompt, 'Student essay.', review, 1);
  const plusTwo = writing.buildBandSamplePrompt(prompt, 'Student essay.', review, 2);
  assert.match(plusOne, /目标 Band 7\.0/);
  assert.match(plusOne, /保留学生原有观点/);
  assert.match(plusTwo, /目标 Band 8\.0/);
  assert.match(plusTwo, /重组论证/);

  const sample = writing.normalizeBandSample({
    delta: 1,
    targetBand: 7,
    essay: 'This is a short model answer.',
    upgradeNotes: ['Ideas are developed more clearly.'],
    criterionTargets: [{ label: 'Task Response', changes: ['Support each claim.'] }]
  }, 1, 6);
  assert.equal(sample.delta, 1);
  assert.equal(sample.targetBand, 7);
  assert.equal(sample.wordCount, 6);
  assert.equal(sample.criterionTargets[0].label, 'Task Response');
});

test('整套 Writing 按 Task 1 一份、Task 2 两份计算', () => {
  assert.equal(writing.calculateIeltsWritingTestEstimate(6, 7), 6.5);
  assert.equal(writing.calculateIeltsWritingTestEstimate(6.5, 7.5), 7);
  assert.deepEqual(writing.getIeltsWritingPair('ielts-academic-21-test-3-writing-task-2'), {
    paperId: 'ielts-academic-21-test-3',
    taskNumber: 2,
    task1PromptId: 'ielts-academic-21-test-3-writing-task-1',
    task2PromptId: 'ielts-academic-21-test-3-writing-task-2'
  });
});

test('上海高中概要和指导性写作使用独立规则', () => {
  const summary = { contentType: 'summary-writing', stage: '高中', score: 10, maxWords: 60 };
  const guided = { contentType: 'guided-writing', stage: '高中', score: 25, requirements: ['明确态度', '说明理由'] };

  assert.equal(writing.getWritingTaskType(summary), 'senior-summary');
  assert.equal(writing.getWritingTaskType(guided), 'senior-guided');
  assert.equal(writing.resolveTotalScore(summary), 10);
  assert.equal(writing.resolveTotalScore(guided), 25);
  assert.match(writing.buildGradingPrompt(summary, 'Summary'), /不超过规定字数/);
  assert.match(writing.buildGradingPrompt(guided, 'Essay'), /内容和任务完成10分/);
});

test('中考作文保留 8+8+4 和字数限分规则', () => {
  const prompt = { contentType: '', stage: '初中', score: 20, minWords: 60 };
  const gradingPrompt = writing.buildGradingPrompt(prompt, 'Essay');
  assert.equal(writing.getWritingTaskType(prompt), 'junior-essay');
  assert.match(gradingPrompt, /内容8分、语言8分、组织结构4分/);
  assert.match(gradingPrompt, /不足30词时总分最高9分/);
});
