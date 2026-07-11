const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('all registered pages report pageReady performance', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const pages = [
    ...(app.pages || []),
    ...((app.subpackages || []).flatMap((sub) => (sub.pages || []).map((page) => `${sub.root}/${page}`)))
  ];
  const missing = pages.filter((pagePath) => {
    const source = fs.readFileSync(path.join(root, `${pagePath}.js`), 'utf8');
    return !source.includes('startPagePerf(') || !/\.ready\(['"]pageReady['"]/.test(source);
  });
  assert.deepEqual(missing, [], `missing pageReady performance: ${missing.join(', ')}`);
});

test('pageReady uses the 200ms cache and 800ms cold hard limits', () => {
  const source = fs.readFileSync(path.join(root, 'utils/page.js'), 'utf8');
  assert.match(source, /readyMeta\.preferredMs = readyMeta\.cacheHit \? 200 : 600/);
  assert.match(source, /readyMeta\.targetMs = readyMeta\.cacheHit \? 200 : 800/);
  assert.doesNotMatch(source, /300 : 1200/);
});

test('成长页后台统计强制读取云端权威值，避免旧缓存覆盖累计时长', () => {
  const source = fs.readFileSync(path.join(root, 'pages/record/index.js'), 'utf8');
  assert.match(source, /store\.getDashboard\(\{ view: 'record', debug: true, forceRefresh: true \}/);
  assert.match(source, /pending && hasActivity[\s\S]*?tr\('syncingDuration'\)/);
  const catalog = require('../utils/i18n-catalog-account').record;
  assert.equal(catalog['zh-CN'].syncingDuration, '同步中');
  assert.equal(catalog.en.syncingDuration, 'Syncing');
});
