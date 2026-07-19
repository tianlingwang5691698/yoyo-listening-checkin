const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const homeSource = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
const stageSource = fs.readFileSync(path.join(root, 'pages/level-stage/index.js'), 'utf8');
const flashcardTemplate = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.wxml'), 'utf8');

test('初中词汇任务进入今日计划快照并直达循环 List', () => {
  assert.match(homeSource, /buildStageSnapshotTaskGroups\(this\.data\.groupedDailyTasks\)\.concat\(vocabularyTaskGroup \? \[vocabularyTaskGroup\] : \[\]\)/);
  assert.match(stageSource, /category === 'vocabulary'[\s\S]*?dailyPlan=junior-list/);
});

test('循环 List 完成页显示激励语并提供单词练习入口', () => {
  assert.match(flashcardTemplate, /completionEncouragement/);
  assert.match(flashcardTemplate, /bindtap="openCompletedPractice"/);
});
