const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

test('龙珠语法与阅读入口使用独立训练卡视觉', () => {
  const grammar = fs.readFileSync(path.join(root, 'pages/grammar/index.wxss'), 'utf8');
  const reading = fs.readFileSync(path.join(root, 'pages/reading/index.wxss'), 'utf8');
  assert.match(grammar, /\.theme-dragon\.grammar-page/);
  assert.match(grammar, /\.theme-dragon \.grammar-hero\s*\{[^}]*border:\s*4rpx solid #12356b/);
  assert.match(grammar, /\.theme-dragon \.grammar-card\s*\{[^}]*background:\s*#fff9df/);
  assert.match(reading, /\.theme-dragon\.reading-page/);
  assert.match(reading, /\.theme-dragon \.reading-hero\s*\{[^}]*border:\s*4rpx solid #12356b/);
  assert.match(reading, /\.theme-dragon \.reading-card\s*\{[^}]*backdrop-filter:\s*none/);
});

test('龙珠语法、听力、阅读与写作答题区完整使用训练卡视觉', () => {
  const grammar = fs.readFileSync(path.join(root, 'pages/grammar/index.wxss'), 'utf8');
  const listening = fs.readFileSync(path.join(root, 'pages/material/detail/index.wxss'), 'utf8');
  const reading = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  const writing = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxss'), 'utf8');
  assert.match(grammar, /\.theme-dragon \.question-row/);
  assert.match(grammar, /\.theme-dragon \.option-item/);
  assert.match(listening, /\.theme-dragon \.question-card/);
  assert.match(listening, /\.theme-dragon \.option-row/);
  assert.match(reading, /\.theme-dragon \.question-card/);
  assert.match(reading, /\.theme-dragon \.option-row/);
  assert.match(reading, /\.theme-dragon \.submit-button/);
  assert.match(writing, /\.theme-dragon \.prompt-card/);
  assert.match(writing, /\.theme-dragon \.letter-editor/);
  assert.match(writing, /\.theme-dragon \.submit-button/);
});
