const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'reading.service.js'), 'utf8');
const homeSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'reading-home.service.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

test('阅读目录只查询轻量字段且详情按 id 读取单篇', () => {
  assert.match(homeSource, /require\('\.\.\/data\/reading-directory\.json'\)/);
  assert.match(indexSource, /getReadingHome: serviceAction\('readingHome', 'getReadingHome'\)/);
  assert.match(indexSource, /skipResourceDebug = \[/);
  assert.match(indexSource, /'getReadingHome'/);
  assert.match(indexSource, /'getReadingPassage'/);
  assert.match(indexSource, /'getReadingStudyPack'/);
  assert.doesNotMatch(source, /require\('\.\.\/lib\/speaking-engine'\)/);
  assert.match(source, /require\('\.\.\/data\/reading-directory\.json'\)/);
  assert.match(source, /bundled\.length >= MIN_DATABASE_READING_PASSAGE_COUNT/);
  assert.match(source, /loadPassageDirectory[\s\S]*?\.field\(\{[\s\S]*?questionCount: true[\s\S]*?\.limit\(1000\)/);
  assert.match(source, /getDatabasePassageById[\s\S]*?\.doc\(passageId\)\.get\(\)/);
  assert.match(source, /const passagePromise = passageId \? findPassageById/);
});

test('阅读数据库未完整导入时保留云存储兼容回退', () => {
  assert.match(source, /MIN_DATABASE_READING_PASSAGE_COUNT = 785/);
  assert.match(source, /passages\.length >= MIN_DATABASE_READING_PASSAGE_COUNT/);
  assert.match(source, /const passages = \(await loadPassages\(\)\)\.map/);
});

test('阅读题目解析只命中完整模型缓存，总请求时间不超过云函数上限', () => {
  const readingService = require('../services/reading.service');
  const passage = {
    questions: [{ number: 1, answer: 'A' }]
  };
  assert.equal(readingService._test.isValidQuestionStudyPack({
    source: 'submit',
    questionAnalyses: [{ number: 1, analysis: '生成解析中', answerSentence: '' }]
  }, passage), false);
  assert.equal(readingService._test.isValidQuestionStudyPack({
    source: 'model:gpt-5.5',
    questionAnalyses: [{ number: 1, analysis: '完整解析', answerSentence: 'Evidence.' }]
  }, passage), true);
  assert.ok(readingService._test.READING_STUDY_MODEL_TIMEOUT_MS * 2 < 180000);
});
