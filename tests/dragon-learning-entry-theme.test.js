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
