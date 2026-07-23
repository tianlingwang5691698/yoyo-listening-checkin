const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { splitScopedSentences } = require('../utils/scoped-manual-marks');

const root = path.resolve(__dirname, '..');

test('Summary Writing 长正文按真实句子拆成长按范围', () => {
  const source = 'Life is full of choices, some inconsequential, some really significant．But sometimes it can be hard to make the correct one. Dr. Alice Boyes explains why.';
  assert.deepEqual(splitScopedSentences(source), [
    'Life is full of choices, some inconsequential, some really significant．',
    'But sometimes it can be hard to make the correct one.',
    'Dr. Alice Boyes explains why.'
  ]);
});

test('写作详情使用拆分后的独立句子作用域', () => {
  const script = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxss'), 'utf8');
  assert.match(script, /splitScopedSentences\(item\.text\)\.forEach/);
  assert.match(script, /section\.articleTitle[\s\S]*?scope: '',[\s\S]*?isArticleTitle: true/);
  assert.equal((template.match(/wx:for="\{\{writingPromptSections\}\}"/g) || []).length, 2);
  assert.equal((template.match(/wx:for="\{\{section\.lines\}\}"/g) || []).length, 2);
  assert.match(styles, /\.writing-prompt-lines\s*\{[\s\S]*?display:\s*grid;/);
});
