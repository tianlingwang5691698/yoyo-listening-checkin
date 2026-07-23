const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('雅思写作报告展示证据、卡分原因和升档动作', () => {
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  assert.match(template, /review\.criterionDetails/);
  assert.match(template, /原文证据/);
  assert.match(template, /本档依据/);
  assert.match(template, /卡分原因/);
  assert.match(template, /升到下一档/);
  assert.match(template, /review\.strengths/);
  assert.match(template, /AI 练习预估|review\.estimateLabel/);
  assert.match(template, /review\.writingTestEstimate/);
  assert.match(template, /review\.feedbackNotice/);
  assert.match(template, /Task 1.*Task 2/);
});

test('高 1 与高 2 Band 范文按需生成并覆盖四主题对比色', () => {
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const style = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxss'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  assert.match(template, /data-delta="1"/);
  assert.match(template, /data-delta="2"/);
  assert.match(template, /bindtap="generateBandSample"/);
  assert.match(template, /review\.bandSamples/);
  assert.match(page, /store\.generateWritingBandSample/);
  assert.match(style, /\.writing-library-page \.band-sample-button/);
  assert.match(style, /\.theme-voyage \.band-sample-button/);
  assert.match(style, /\.theme-dragon \.band-sample-button/);
  assert.match(style, /\.band-sample-button\.is-strong/);
});

test('升档范文云端动作完整接线', () => {
  const store = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/index.js'), 'utf8');
  const cloudClient = fs.readFileSync(path.join(root, 'domain/cloud/index.js'), 'utf8');
  const requestContext = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/lib/request-context-engine.js'), 'utf8');
  assert.match(store, /generateWritingBandSample/);
  assert.match(cloud, /generateWritingBandSample: serviceAction\('writing', 'generateWritingBandSample'\)/);
  assert.match(cloudClient, /gradeWritingAttempt'.*generateWritingBandSample'.*getWritingAttemptDetail/);
  assert.match(requestContext, /generateWritingBandSample/);
});

test('写作批改失败展示完整调用链路而不是通用提示', () => {
  const page = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  assert.match(page, /DEBUG: pages\/writing\/detail\.submitEssay/);
  assert.match(page, /cloudError\.message=/);
  assert.match(page, /syncDebug\.reason=/);
  assert.match(page, /syncDebug\.envId=/);
  assert.match(page, /targetChildId=/);
});
