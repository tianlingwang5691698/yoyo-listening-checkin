const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  tokenizeScopedText,
  toggleScopedTokenMark,
  toggleScopedSentenceMark,
  buildManualMarks
} = require('../utils/scoped-manual-marks');
const { sanitizeManualMarks } = require('../cloudfunctions/yoyo/lib/manual-mark-engine');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('跨模块标记保持词、短语、整句三种轻量结果', () => {
  const tokens = tokenizeScopedText('Mark this phrase.', 'lesson-line-1');
  assert.deepEqual(tokens.filter((item) => item.word).map((item) => item.markKey), [
    'lesson-line-1:0',
    'lesson-line-1:1',
    'lesson-line-1:2'
  ]);
  let tokenMarks = toggleScopedTokenMark({}, 'lesson-line-1', 0);
  tokenMarks = toggleScopedTokenMark(tokenMarks, 'lesson-line-1', 1);
  const sentenceMarks = toggleScopedSentenceMark({}, 'lesson-line-1');
  assert.deepEqual(buildManualMarks({ 'lesson-line-1': 'Mark this phrase.' }, tokenMarks, sentenceMarks).items, [
    { type: 'sentence', text: 'Mark this phrase.' },
    { type: 'phrase', text: 'Mark this' }
  ]);
});

test('云端只接受有限且可展示的最终标记', () => {
  const marks = sanitizeManualMarks({
    tokenMarks: { 'lesson-line-1:0': 'word', 'bad key:0': 'phrase', 'lesson-line-1:1': 'invalid' },
    sentenceMarks: { 'lesson-line-1': true, 'bad key': true },
    items: [{ type: 'word', text: 'Mark' }, { type: 'unknown', text: 'fallback' }, { type: 'phrase', text: '' }]
  });
  assert.deepEqual(marks.tokenMarks, { 'lesson-line-1:0': 'word' });
  assert.deepEqual(marks.sentenceMarks, { 'lesson-line-1': true });
  assert.deepEqual(marks.items, [{ type: 'word', text: 'Mark' }, { type: 'word', text: 'fallback' }]);
});

test('听力完成时保存最终标记并沿用现有记录集合', () => {
  const page = read('pages/lesson/index.js');
  const template = read('pages/lesson/index.wxml');
  const service = read('cloudfunctions/yoyo/services/task.service.js');
  const presenter = read('cloudfunctions/yoyo/lib/task-presenter.js');
  assert.match(page, /markCurrentTaskListened[\s\S]*manualMarks: buildManualMarks/);
  assert.doesNotMatch(page, /handleListeningMarkToken[\s\S]*vibrateShort[\s\S]*handleListeningSentenceMark/);
  assert.match(template, /handleListeningMarkToken/);
  assert.match(template, /handleListeningSentenceMark/);
  assert.match(service, /if \(record\.completedToday\) \{[\s\S]*record\.manualMarks = sanitizeManualMarks/);
  assert.match(service, /type: 'listening'/);
  assert.match(presenter, /manualMarks: progress\.manualMarks \|\| null/);
  assert.doesNotMatch(service, /collection\(['"]manualMarks/);
});

test('语法只在全部答完时附带最终标记', () => {
  const source = read('data/grammar-classroom/page-source/index.js');
  const runtime = read('pages/grammar/index.js');
  const template = read('pages/grammar/index.wxml');
  assert.match(source, /const isFinal = answeredCount >=/);
  assert.match(source, /manualMarks: isFinal \? buildManualMarks/);
  assert.match(source, /handleGrammarTokenTap/);
  assert.match(runtime, /manualMarks/);
  assert.match(template, /handleGrammarSentenceMark/);
});

test('写作提交和翻译分析均保存最终标记', () => {
  const page = read('pages/writing/detail/index.js');
  const template = read('pages/writing/detail/index.wxml');
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  assert.match(page, /submitEssay[\s\S]*manualMarks: buildManualMarks/);
  assert.match(page, /submitTranslation[\s\S]*manualMarks: buildManualMarks/);
  assert.match(service, /async function analyzeWritingTranslation[\s\S]*manualMarks: sanitizeManualMarks\(payload\.manualMarks\)/);
  assert.match(service, /async function submitWritingAttempt[\s\S]*manualMarks: sanitizeManualMarks\(payload\.manualMarks\)/);
  assert.match(template, /handleWritingSentenceMark/);
});

test('学生记录和家长日报都展示最终标记', () => {
  assert.match(read('pages/practice-history/index.wxml'), /history-manual-marks/);
  assert.match(read('pages/parent/detail/index.wxml'), /manual-mark-sheet/);
  assert.match(read('cloudfunctions/yoyo/services/completion.service.js'), /sanitizeManualMarks/);
});
