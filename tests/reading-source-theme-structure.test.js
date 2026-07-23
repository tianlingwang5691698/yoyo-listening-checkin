const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const wxml = fs.readFileSync(path.join(ROOT, 'pages/reading/detail/index.wxml'), 'utf8');
const wxss = fs.readFileSync(path.join(ROOT, 'pages/reading/detail/index.wxss'), 'utf8');

test('阅读原文按说明标题副标题正文分层展示', () => {
  [
    'reading-section-heading',
    'reading-directions',
    'reading-article-title',
    'reading-article-subtitle'
  ].forEach((className) => assert.match(wxml, new RegExp(`class="${className}"`)));
  assert.match(wxss, /\.reading-article-title\s*\{[\s\S]*font-size:\s*40rpx/);
  assert.match(wxss, /\.reading-article-subtitle\s*\{[\s\S]*font-size:\s*27rpx/);
});

test('四套主题分别定义说明与填空背景', () => {
  [
    '.theme-warm.reading-detail .reading-directions',
    '.library-reading-detail .reading-directions',
    '.theme-voyage .reading-directions',
    '.theme-dragon .reading-directions',
    '.theme-warm.reading-detail .cloze-inline-input',
    '.library-reading-detail .cloze-inline-input',
    '.theme-voyage .cloze-inline-input',
    '.theme-dragon .cloze-inline-input'
  ].forEach((selector) => assert.ok(wxss.includes(selector), selector));
});
