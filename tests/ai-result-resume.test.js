const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('写作提交在同一云调用内完成批改并持久化', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  assert.match(service, /async function submitWritingAttempt[\s\S]*?await gradeWritingAttempt\(Object\.assign\(\{\}, event/);
  assert.match(service, /async function gradeWritingAttempt[\s\S]*?review: command\.set\(review\)[\s\S]*?saveWritingCompletion/);
  assert.match(service, /const shouldResume = \['grading-pending', 'grading-failed'\][\s\S]*?gradingAgeMs > 170000/);
});

test('阅读提交先保存解析，记录页缺失时自动续接', () => {
  const service = read('cloudfunctions/yoyo/services/reading.service.js');
  const history = read('pages/practice-history/index.js');
  const parent = read('pages/parent/detail/index.js');
  assert.match(service, /async function submitReadingAttempt[\s\S]*?await getOrCreateStudyPack\(passage, cached, false\)[\s\S]*?review: command\.set\(review\)/);
  assert.match(history, /section: 'questions',[\s\S]*?cacheOnly: false,[\s\S]*?attemptId/);
  assert.match(parent, /getReadingStudyPack\(\{ passageId: item\.passageId, section: 'questions', cacheOnly: false, attemptId/);
});

test('语法和写作完成记录会自动补齐云端结果', () => {
  const history = read('pages/practice-history/index.js');
  const parent = read('pages/parent/detail/index.js');
  assert.match(history, /resumeGrammarAnalyses\(record\.id, detailQuestions\)/);
  assert.match(history, /store\.explainGrammarQuestion\([\s\S]*?\{ cacheOnly: false \}\)/);
  assert.match(history, /writingResumeTimers[\s\S]*?this\.loadWritingDetail/);
  assert.match(parent, /store\.explainGrammarQuestion\(question, \{ cacheOnly: false \}\)/);
  assert.match(parent, /needsReview \? await store\.getWritingAttemptDetail\(attemptId\)/);
});
