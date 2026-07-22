const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('雅思口语客户端等待覆盖 240 秒模型评分', () => {
  const cloudSource = fs.readFileSync(path.join(root, 'domain/cloud/index.js'), 'utf8');
  assert.match(cloudSource, /action === 'submitSpeakingAttempt'[\s\S]*?timeoutMs = 320000/);
  assert.match(cloudSource, /action === 'evaluateSpeakingPronunciation'[\s\S]*?timeoutMs = 240000/);
});
