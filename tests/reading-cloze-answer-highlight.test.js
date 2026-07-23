const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
const {
  canHighlightReadingAnswers,
  resolveReadingHighlightMode
} = require('../utils/reading-highlight-mode');

test('填空阅读禁止答案句模式，选择题保持原行为', () => {
  const cloze = { isClozePassage: true };
  const choice = { isClozePassage: false };

  assert.equal(resolveReadingHighlightMode(cloze, 'answer'), 'none');
  assert.equal(resolveReadingHighlightMode(cloze, 'all'), 'all');
  assert.equal(resolveReadingHighlightMode(choice, 'answer'), 'answer');
  assert.equal(canHighlightReadingAnswers(cloze), false);
  assert.equal(canHighlightReadingAnswers(choice), true);
});

test('填空阅读的原文构建和两套主题都排除答案句入口', () => {
  assert.match(source, /includeAnswerHighlight !== false && review/);
  assert.match(source, /resolveReadingHighlightMode\(submittedPassage, 'answer'\)/);
  assert.equal((template.match(/!passage\.isClozePassage \|\| item\.key !== 'answer'/g) || []).length, 2);
  assert.equal((template.match(/class="cloze-evidence"/g) || []).length, 2);
});
