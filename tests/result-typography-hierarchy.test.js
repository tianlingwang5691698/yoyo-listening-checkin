const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('四主题写作阅读语法共用批改解析字体层级', () => {
  const themes = [
    read('styles/themes/warm.wxss'),
    read('styles/themes/library.wxss'),
    read('styles/themes/voyage.wxss'),
    read('styles/themes/dragon.wxss')
  ];
  const writing = read('pages/writing/detail/index.wxss');
  const reading = read('pages/reading/detail/index.wxss');
  const grammar = read('pages/grammar/index.wxss');

  themes.forEach((theme) => {
    assert.match(theme, /--result-score-size: 48rpx/);
    assert.match(theme, /--result-title-size: 32rpx/);
    assert.match(theme, /--result-section-size: 28rpx/);
    assert.match(theme, /--result-body-size: 26rpx/);
    assert.match(theme, /--result-support-size: 23rpx/);
    assert.match(theme, /--result-meta-size: 21rpx/);
    assert.match(theme, /--result-line-body: 1\.72/);
    assert.match(theme, /--result-line-support: 1\.58/);
  });
  assert.match(writing, /\.theme-warm\.writing-page \.review-list/);
  assert.match(writing, /\.writing-library-page \.library-review-section/);
  assert.match(writing, /\.theme-voyage\.writing-page \.review-list/);
  assert.match(writing, /\.theme-dragon\.writing-page \.review-list/);
  assert.match(reading, /\.theme-warm\.reading-detail \.inline-analysis/);
  assert.match(reading, /\.library-reading-detail \.inline-analysis/);
  assert.match(reading, /\.theme-voyage\.reading-detail \.inline-analysis/);
  assert.match(reading, /\.theme-dragon\.reading-detail \.inline-analysis/);
  assert.match(grammar, /\.theme-warm\.grammar-page \.analysis-text\.is-support/);
  assert.match(grammar, /\.library-analysis-text\.is-support/);
  assert.match(grammar, /\.theme-voyage\.grammar-page \.analysis-text\.is-support/);
  assert.match(grammar, /\.theme-dragon\.grammar-page \.analysis-text\.is-support/);
  assert.match(grammar, /\.library-analysis-head[\s\S]*?font-family: var\(--font-title-family\)/);
  assert.match(grammar, /\.theme-voyage\.grammar-page \.analysis-head[\s\S]*?font-family: var\(--font-title-family\)/);
  assert.match(grammar, /\.theme-warm\.grammar-page \.analysis-state[\s\S]*?font-family: var\(--font-number-family\)/);
  assert.match(grammar, /\.theme-voyage\.grammar-page \.analysis-state,\n\.theme-dragon\.grammar-page \.analysis-state \{[\s\S]*?font-family: var\(--font-number-family\)/);
});

test('四主题结果区使用分隔和留白而不是卡片嵌套', () => {
  const reading = read('pages/reading/detail/index.wxss');
  const grammar = read('pages/grammar/index.wxss');

  assert.match(reading, /\.theme-warm\.reading-detail \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(reading, /\.library-reading-detail \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(reading, /\.theme-voyage\.reading-detail \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(reading, /\.theme-dragon\.reading-detail \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(grammar, /\.theme-warm\.grammar-page \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(grammar, /\.library-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(grammar, /\.theme-voyage\.grammar-page \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
  assert.match(grammar, /\.theme-dragon\.grammar-page \.inline-analysis[\s\S]*?border-radius: 0[\s\S]*?background: transparent/);
});

test('写作阅读口语使用统一字体角色', () => {
  const writing = read('pages/writing/detail/index.wxss');
  const reading = read('pages/reading/detail/index.wxss');
  const speaking = read('pages/speaking/index.wxss');

  assert.match(writing, /\.writing-page \.essay-input,[\s\S]*?font-family: var\(--font-english-serif-family\)/);
  assert.match(writing, /\.review-block,[\s\S]*?font-family: var\(--font-body-family\)/);
  assert.match(writing, /\.score,[\s\S]*?font-family: var\(--font-number-family\)/);
  assert.match(reading, /\.reading-detail \.passage-text,[\s\S]*?font-family: var\(--font-english-serif-family\)/);
  assert.match(reading, /\.reading-detail \.question-title,[\s\S]*?font-family: var\(--font-body-family\)/);
  assert.match(reading, /\.reading-detail \.review-score,[\s\S]*?font-family: var\(--font-number-family\)/);
  assert.match(speaking, /\.page-shell \.prompt-text,[\s\S]*?font-family: var\(--font-english-sans-family\)/);
  assert.match(speaking, /\.ielts-band-feedback,[\s\S]*?font-family: var\(--font-body-family\)/);
  assert.match(speaking, /\.score-value,[\s\S]*?font-family: var\(--font-number-family\)/);
});
