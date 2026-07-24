const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('雅思写作报告展示证据、卡分原因和升档动作', () => {
  const pageTemplate = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'templates/writing-report.wxml'), 'utf8');
  assert.match(pageTemplate, /import src="\.\.\/\.\.\/\.\.\/templates\/writing-report\.wxml"/);
  assert.equal((pageTemplate.match(/template is="writing-report"/g) || []).length, 2);
  assert.match(template, /review\.criterionDetails/);
  assert.match(template, /texts\.evidenceLabel/);
  assert.match(template, /texts\.descriptorLabel/);
  assert.match(template, /texts\.limitersLabel/);
  assert.match(template, /texts\.nextBandLabel/);
  assert.match(template, /review\.strengths/);
  assert.doesNotMatch(template, /AI 练习预估|review\.estimateLabel/);
  assert.doesNotMatch(template, /review\.writingTestEstimate/);
  assert.doesNotMatch(template, /review\.feedbackNotice/);
  assert.doesNotMatch(template, /review\.weightingNote|review\.rubricVersion/);
});

test('高 1 与高 2 Band 范文按需生成并覆盖四主题对比色', () => {
  const template = fs.readFileSync(path.join(root, 'templates/writing-report.wxml'), 'utf8');
  const style = fs.readFileSync(path.join(root, 'styles/writing-report.wxss'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  assert.match(template, /data-delta="1"/);
  assert.match(template, /data-delta="2"/);
  assert.match(template, /bindtap="generateBandSample"/);
  assert.match(template, /review\.bandSamples/);
  assert.match(page, /store\.generateWritingBandSample/);
  assert.match(style, /\.shared-writing-band-buttons button/);
  assert.match(style, /\.theme-voyage \.shared-writing-download/);
  assert.match(style, /\.theme-dragon \.shared-writing-report-score/);
  assert.match(style, /\.shared-writing-band-buttons button\.is-strong/);
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
  assert.match(requestContext, /generateWritingReportPdf/);
});

test('写作批改失败展示完整调用链路而不是通用提示', () => {
  const page = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  assert.match(page, /DEBUG: pages\/writing\/detail\.submitEssay/);
  assert.match(page, /cloudError\.message=/);
  assert.match(page, /syncDebug\.reason=/);
  assert.match(page, /syncDebug\.envId=/);
  assert.match(page, /targetChildId=/);
});

test('写作评分固定温度并按题目与作文复用评分', () => {
  const service = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/writing.service.js'), 'utf8');
  const gradeWriting = service.match(/async function gradeWriting[\s\S]*?\n}\n\nasync function generateBandSample/);
  assert.ok(gradeWriting);
  assert.doesNotMatch(gradeWriting[0], /temperature:\s*0\.[12]/);
  assert.equal((gradeWriting[0].match(/temperature:\s*0/g) || []).length, 2);
  assert.match(service, /buildWritingScoreFingerprint/);
  assert.match(service, /findCachedWritingReview/);
  assert.match(service, /scoreSource:\s*'identical-cache'/);
  assert.match(service, /task1FactCheck/);
});
