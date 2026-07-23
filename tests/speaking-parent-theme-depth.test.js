const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const speakingTemplate = read('pages/speaking/index.wxml');
const speakingStyles = read('pages/speaking/index.wxss');
const parentTemplate = read('pages/parent/index.wxml');
const parentStyles = read('pages/parent/index.wxss');
const parentDetailStyles = read('pages/parent/detail/index.wxss');
const recordStyles = read('pages/record/index.wxss');

test('口语首页四套主题都有独立场景标识', () => {
  assert.match(speakingTemplate, /warm-speaking-stage/);
  assert.match(speakingTemplate, /voyage-speaking-stage/);
  assert.match(speakingTemplate, /dragon-speaking-stage/);
  assert.match(speakingTemplate, /wx:if="\{\{theme === 'library'\}\}"/);
  assert.match(speakingStyles, /\.warm-speaking-stage \{/);
  assert.match(speakingStyles, /\.voyage-speaking-stage \{/);
  assert.match(speakingStyles, /\.dragon-speaking-stage \{/);
});

test('伟大航路和龙珠口语入口使用各自训练编号', () => {
  assert.match(speakingTemplate, /voyage-mode-route[\s\S]*?ROUTE 01/);
  assert.match(speakingTemplate, /dragon-mode-rank[\s\S]*?训练 01/);
  assert.match(speakingStyles, /\.voyage-mode-route \{[\s\S]*?background: #176a99/);
  assert.match(speakingStyles, /\.dragon-mode-rank \{[\s\S]*?background: #f45a16/);
});

test('龙珠日报总览不再沿用雾蓝玻璃卡', () => {
  assert.match(parentTemplate, /dragon-report-crest/);
  assert.match(parentTemplate, /dragon-report-meter/);
  assert.match(parentStyles, /\.theme-dragon\.parent-page \{/);
  assert.match(parentStyles, /\.theme-dragon \.parent-hero,[\s\S]*?border: 4rpx solid #102e62/);
  assert.match(parentStyles, /\.theme-dragon \.insight-card \{[\s\S]*?background: #fff7d4/);
  assert.match(parentStyles, /\.theme-dragon \.today-archive \{[\s\S]*?background: #102e62/);
});

test('日报详情和成长页继续保留四主题深度分支', () => {
  assert.match(parentDetailStyles, /\.theme-library\.parent-detail-page \{/);
  assert.match(parentDetailStyles, /\.theme-voyage\.parent-detail-page \{/);
  assert.match(parentDetailStyles, /\.theme-dragon\.parent-detail-page/);
  assert.match(recordStyles, /\.theme-library\.record-page \{/);
  assert.match(recordStyles, /\.theme-voyage\.record-page \{/);
  assert.match(recordStyles, /\.theme-dragon\.record-page \{/);
});
