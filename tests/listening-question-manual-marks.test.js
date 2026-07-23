const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('听力题干使用统一标记手势且不震动', () => {
  const page = read('pages/material/detail/index.js');
  const template = read('pages/material/detail/index.wxml');
  const styles = read('pages/material/detail/index.wxss');
  assert.match(page, /promptTokens: tokenizeScopedText/);
  assert.match(page, /handleQuestionMarkToken/);
  assert.match(page, /handleQuestionSentenceMark/);
  assert.doesNotMatch(page, /handleQuestionMarkToken[\s\S]*vibrateShort[\s\S]*handleQuestionSentenceMark/);
  assert.match(template, /question-mark-toolbar/);
  assert.match(template, /catchtap="handleQuestionMarkToken"/);
  assert.match(template, /bindlongpress="handleQuestionSentenceMark"/);
  assert.match(styles, /\.manual-mark-word/);
  assert.match(styles, /\.manual-mark-phrase/);
  assert.match(styles, /\.manual-mark-sentence/);
});

test('听力答案提交时才保存最终标记和逐题结果', () => {
  const page = read('pages/material/detail/index.js');
  const submitSource = page.slice(page.indexOf('  async submit() {'), page.indexOf('  completeStudy() {'));
  assert.match(submitSource, /manualMarks = buildManualMarks/);
  assert.match(submitSource, /store\.recordStudyCompletion\(\{/);
  assert.match(submitSource, /type: 'listening'/);
  assert.match(submitSource, /section: 'questions'/);
  assert.match(submitSource, /latestAttempt/);
  assert.match(submitSource, /syncMode === 'cloud-error'/);
});
