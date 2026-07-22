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
    polishedVersion: 'model answer'
  }, prompt);

  assert.equal(review.score, 6.5);
  assert.equal(review.totalScore, 9);
  assert.equal(review.level, 'IELTS Band 6.5');
  assert.equal(review.contentLabel, 'Task Achievement · 6.0');
  assert.equal(review.polishedTitle, '原题参考范文');
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
