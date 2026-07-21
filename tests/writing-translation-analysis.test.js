const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('翻译提交调用写作专用模型并逐题展示讲解', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  const cloudIndex = read('cloudfunctions/yoyo/index.js');
  const store = read('utils/store.js');
  const page = read('pages/writing/detail/index.js');
  const view = read('pages/writing/detail/index.wxml');

  assert.match(service, /async function analyzeWritingTranslation[\s\S]*?const config = getModelConfig\(\)[\s\S]*?model: config\.model/);
  assert.match(service, /status 只能是 correct、partial、incorrect/);
  assert.match(cloudIndex, /analyzeWritingTranslation: serviceAction\('writing', 'analyzeWritingTranslation'\)/);
  assert.match(store, /async function analyzeWritingTranslation[\s\S]*?callCloud\('analyzeWritingTranslation'/);
  assert.match(page, /await store\.analyzeWritingTranslation/);
  assert.match(view, /texts\.modelExplanation/);
  assert.match(view, /texts\.recommendedTranslation/);
});

test('翻译分析、家长预览和历史续批使用 180 秒等待上限', () => {
  const cloudClient = read('domain/cloud/index.js');
  assert.match(cloudClient, /analyzeWritingTranslation'[\s\S]*?submitWritingAttempt'[\s\S]*?gradeWritingAttempt'[\s\S]*?getWritingAttemptDetail'[\s\S]*?timeoutMs = 180000/);
});
