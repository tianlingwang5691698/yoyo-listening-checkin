const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.wxss'), 'utf8');
const practiceTemplate = fs.readFileSync(path.join(root, 'pages/reading/flashcards/practice/index.wxml'), 'utf8');
const practiceStyles = fs.readFileSync(path.join(root, 'pages/reading/flashcards/practice/index.wxss'), 'utf8');

test('词汇书架保留四套主题入口', () => {
  assert.match(template, /theme-\{\{theme\}\} language-\{\{language\}\} page-shell flashcard-page/);
  assert.match(template, /wx:if="\{\{theme === 'library'\}\}"/);
  assert.match(styles, /\.flashcard-page \{[\s\S]*?linear-gradient\(180deg, #f6fbfd/);
  assert.match(styles, /\.theme-library\.library-vocab-page \{/);
  assert.match(styles, /\.theme-voyage\.flashcard-page \{/);
  assert.match(styles, /\.theme-dragon\.flashcard-page \{/);
});

test('伟大航路词汇书架使用独立货舱与航海册视觉', () => {
  assert.match(styles, /\.theme-voyage \.bookshelf-head \{[\s\S]*?border: 5rpx solid #8c562b/);
  assert.match(styles, /\.theme-voyage \.shelf-board \{[\s\S]*?repeating-linear-gradient\(90deg, #7c4a28/);
  assert.match(styles, /\.theme-voyage \.book-library \.book-cover \{ background: #2f7d70; \}/);
  assert.match(styles, /\.theme-voyage \.book-unlock \.book-cover \{ background: #173f57; \}/);
  assert.match(styles, /\.theme-voyage \.book-action \{[\s\S]*?background: #a83b31/);
});

test('伟大航路词汇一级入口使用航线任务牌与独立训练图标', () => {
  assert.match(styles, /\.theme-voyage \.vocab-practice-head \{[\s\S]*?border: 5rpx solid #8c562b/);
  assert.match(styles, /\.theme-voyage \.vocab-practice-head::before \{[\s\S]*?conic-gradient/);
  assert.match(styles, /\.theme-voyage \.vocab-practice-card::before \{[\s\S]*?background: #1d6381/);
  assert.match(styles, /\.theme-voyage \.word-practice-hub::before \{[\s\S]*?background: #a83b31/);
  assert.match(styles, /\.theme-voyage \.folder-symbol \{[\s\S]*?#684020/);
  assert.match(styles, /\.theme-voyage \.practice-hub-symbol text:nth-child\(2\) \{[\s\S]*?#a83b31/);
});

test('单词练习模式页保留四套主题视觉分支', () => {
  assert.match(practiceTemplate, /theme-\{\{theme\}\} language-\{\{language\}\} word-practice-page/);
  assert.match(practiceStyles, /\.word-practice-page \{[\s\S]*?linear-gradient\(180deg, #f6fbfd/);
  assert.match(practiceStyles, /\.theme-library\.word-practice-page \{/);
  assert.match(practiceStyles, /\.theme-voyage\.word-practice-page \{/);
  assert.match(practiceStyles, /\.theme-dragon\.word-practice-page \{/);
});

test('伟大航路单词练习使用三座独立航线训练站', () => {
  assert.match(practiceTemplate, /word-practice-card word-route-card/);
  assert.match(practiceTemplate, /word-practice-card audio-route-card/);
  assert.match(practiceTemplate, /word-practice-card spell-route-card/);
  assert.match(practiceTemplate, /ROUTE 01/);
  assert.match(practiceStyles, /\.theme-voyage \.word-practice-list::before \{[\s\S]*?repeating-linear-gradient/);
  assert.match(practiceStyles, /\.theme-voyage \.audio-route-card \{[\s\S]*?#bf4938/);
  assert.match(practiceStyles, /\.theme-voyage \.spell-route-card \{[\s\S]*?#318d7b/);
  assert.match(practiceStyles, /\.theme-voyage \.word-practice-arrow \{[\s\S]*?background: #bf4938/);
});
