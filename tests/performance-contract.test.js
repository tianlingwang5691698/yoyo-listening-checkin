const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('all registered pages report pageReady performance', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const subPackages = app.subPackages || app.subpackages || [];
  const pages = [
    ...(app.pages || []),
    ...(subPackages.flatMap((sub) => (sub.pages || []).map((page) => `${sub.root}/${page}`)))
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
  const template = fs.readFileSync(path.join(root, 'pages/record/index.wxml'), 'utf8');
  assert.match(source, /async function getFreshRecordDashboard\(\)/);
  assert.match(source, /cloud\.callYoyo\('getDashboard', Object\.assign\(\{/);
  assert.match(source, /const dashboardPromise = getFreshRecordDashboard\(\)/);
  assert.doesNotMatch(source, /store\.getDashboard\(\{ view: 'record'/);
  assert.match(source, /pending && hasActivity[\s\S]*?tr\('syncingDuration'\)/);
  assert.match(source, /function buildDisplayStats\(stats, options\)/);
  assert.match(source, /RECORD_HOME_SNAPSHOT_KEY = 'recordHomeSnapshotV2'/);
  assert.match(source, /\{ heatmapData, targetPart, recordDebugLines: \[\] \}/);
  assert.match(source, /env=\$\{appConfig\.cloudEnvId\}/);
  assert.equal((template.match(/stats\.totalDurationText \|\| totalDurationText/g) || []).length, 2);
  assert.equal((template.match(/showCloudDebug && recordDebugLines\.length/g) || []).length, 2);
  const storeSource = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');
  assert.match(storeSource, /yoyoCloudReadCacheKeysV4/);
  assert.match(storeSource, /yoyoCloudReadCacheV4:/);
  const catalog = require('../utils/i18n-catalog-account').record;
  assert.equal(catalog['zh-CN'].syncingDuration, '同步中');
  assert.equal(catalog.en.syncingDuration, 'Syncing');
});

test('首页快照首显后使用唯一请求刷新当前计划', () => {
  const source = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  assert.match(source, /HOME_DASHBOARD_SNAPSHOT_KEY = 'homeDashboardSnapshotV2'/);
  assert.match(source, /getDashboard\(\{ view: 'home', forceRefresh: true, requestNonce: Date\.now\(\) \}/);
});
