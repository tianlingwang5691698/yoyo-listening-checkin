const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { performance } = require('node:perf_hooks');

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

test('首页快照首显后强制刷新并回写可复用缓存', () => {
  const source = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  assert.match(source, /HOME_DASHBOARD_SNAPSHOT_KEY = 'homeDashboardSnapshotV2'/);
  assert.match(source, /getDashboard\(Object\.assign\(\{ view: 'home', forceRefresh: true \}, target\)/);
  assert.match(source, /targetFamilyId: String\(currentChild\.familyId/);
  assert.doesNotMatch(source, /requestNonce/);
});

test('首页次级预取等待 dashboard 云刷新完成后再错峰执行', () => {
  const source = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const onShowSource = source.slice(source.indexOf('async onShow()'), source.indexOf('showNextEntryPosterPage()'));
  assert.match(onShowSource, /const homeRefreshPromise = this\.startHomeDashboardRefresh/);
  assert.match(onShowSource, /this\.scheduleHomePrefetches\(homeRefreshPromise\)/);
  assert.doesNotMatch(onShowSource, /setTimeout\(\(\) => \{\s*this\.prefetchReadingHome/);
  assert.match(source, /Promise\.resolve\(refreshPromise\)[\s\S]*?prefetchRecordHome/);
  assert.match(source, /onHide\(\) \{\s*this\.clearHomePrefetchTimers\(\)/);
});

test('首页只允许最新 dashboard 请求更新加载和不可用状态', () => {
  const source = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const refreshSource = source.slice(source.indexOf('  startHomeDashboardRefresh(options = {}) {'), source.indexOf('  prefetchListeningMaterialHome() {'));
  const identitySource = source.slice(source.indexOf('  async confirmStudyIdentity(event) {'), source.indexOf('  beginHomeDashboardRefresh() {'));
  assert.match(source, /const homeRefreshPromise = this\.startHomeDashboardRefresh\(\{ skipCache: true, perf: homePerf \}\)/);
  assert.match(refreshSource, /const refreshId = this\.beginHomeDashboardRefresh\(\)/);
  assert.match(refreshSource, /if \(this\.isHomeDashboardRefreshCurrent\(refreshId\)\) \{\s*this\.setData\(\{ homeLoading: false \}\)/);
  assert.match(refreshSource, /if \(!this\.isHomeDashboardRefreshCurrent\(refreshId\)\) return;/);
  assert.match(refreshSource, /if \(!this\.isHomeDashboardRefreshCurrent\(refreshId\)\) \{\s*return this\.data\.groupedDailyTasks \|\| \[\]/);
  assert.doesNotMatch(identitySource, /identitySelectedInSession: true,\s*homeLoading: false/);
  assert.match(identitySource, /const fastPainted = this\.applyFastDashboardSnapshot\(nextRole\);\s*if \(!fastPainted\) \{\s*this\.setData\(\{ homeLoading: true, homeDataReady: false \}\)/);
  assert.match(source, /onHide\(\) \{\s*this\.clearHomePrefetchTimers\(\);\s*this\.invalidateHomeDashboardRefresh\(\)/);
});

test('家庭身份切换先更新本机状态并与首页刷新并行', () => {
  const familySource = fs.readFileSync(path.join(root, 'pages/family/index.js'), 'utf8');
  const homeSource = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const storeSource = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');
  const toggleSource = familySource.slice(familySource.indexOf('  async toggleStudyRole() {'), familySource.indexOf('  async undoLastListened() {'));
  const onShowSource = homeSource.slice(homeSource.indexOf('  async onShow() {'), homeSource.indexOf('  onUnload() {'));
  assert.match(toggleSource, /preparedSwitch = store\.prepareStudyRoleSwitch\(nextRole\)/);
  assert.match(toggleSource, /const roleRequest = store\.setStudyRole\(nextRole, \{ preparedSwitch \}\)/);
  assert.ok(toggleSource.indexOf("wx.switchTab({\n      url: '/pages/home/index'") < toggleSource.indexOf('const data = await roleRequest'));
  assert.match(toggleSource, /wx\.navigateTo\(\{\s*url: '\/pages\/family\/index'/);
  assert.match(onShowSource, /const deviceStudyRole = store\.getDeviceStudyRole/);
  assert.match(onShowSource, /this\.buildStudyModePresentation\(\{ studyRole: deviceStudyRole \}\)/);
  assert.match(storeSource, /function prepareStudyRoleSwitch\(studyRole\)/);
  assert.match(storeSource, /setSelectedStudentTarget\(lastParentTarget\)/);
  assert.match(storeSource, /preserveReadCache: true/);
});

test('小程序上传包排除非运行时工程目录', () => {
  const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  const ignoredFolders = new Set((projectConfig.packOptions.ignore || [])
    .filter((item) => item.type === 'folder')
    .map((item) => item.value));
  ['web', '.playwright-cli', '.vscode', 'assets/brand'].forEach((folder) => {
    assert.ok(ignoredFolders.has(folder), `上传包必须排除 ${folder}`);
  });
});

test('口语页使用普通分包，避免主包超过 2MB', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const speakingPackage = (app.subPackages || []).find((item) => item.root === 'pages/speaking');
  assert.ok(speakingPackage, '口语页必须注册在普通分包');
  assert.notEqual(speakingPackage.independent, true, '口语页依赖主包公共模块，不能设为独立分包');
  assert.deepEqual(speakingPackage.pages, ['index']);
  assert.equal((app.pages || []).includes('pages/speaking/index'), false);
});

test('阅读专用大体积词汇数据必须留在阅读分包', () => {
  const readingShared = path.join(root, 'pages/reading/shared');
  [
    'ielts-phonetics-v2.js',
    'vocabulary-distractor-audit-data.js',
    'vocabulary-phonetics.js',
    'vocabulary-recognition.js'
  ].forEach((file) => {
    assert.ok(fs.existsSync(path.join(readingShared, file)), `${file} 必须位于阅读分包`);
    assert.equal(fs.existsSync(path.join(root, 'utils', file)), false, `${file} 不得回到主包`);
  });
});

test('阶段详情只加载轻量语法目录', () => {
  const catalogPath = path.join(root, 'cloudfunctions/yoyo/data/grammar-plan-catalog.json');
  const raw = fs.readFileSync(catalogPath, 'utf8');
  assert.ok(Buffer.byteLength(raw) < 60 * 1024, '语法计划目录必须小于 60KB');
  const samples = [];
  let catalog = null;
  for (let index = 0; index < 50; index += 1) {
    const startedAt = performance.now();
    catalog = JSON.parse(raw);
    samples.push(performance.now() - startedAt);
  }
  assert.equal(catalog.length, 168);
  assert.ok(Math.max(...samples) < 10, '语法计划目录解析必须小于 10ms');
  assert.equal(catalog.some((item) => item.examples || item.questions || item.narration), false);
});

test('音频系列列表使用公共轻量缓存和并发预取', () => {
  const materialSource = fs.readFileSync(path.join(root, 'pages/listening-material/index.js'), 'utf8');
  const levelSource = fs.readFileSync(path.join(root, 'pages/level/index.js'), 'utf8');
  const levelTemplate = fs.readFileSync(path.join(root, 'pages/level/index.wxml'), 'utf8');
  const storeSource = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');

  assert.match(materialSource, /listeningMaterialCatalogSnapshotV3/);
  assert.match(materialSource, /store\.getListeningMaterialCatalog\(detailRequest/);
  assert.doesNotMatch(materialSource, /getTargetSnapshotPart/);
  assert.doesNotMatch(materialSource, /await planSelectionPromise/);
  assert.match(levelSource, /Promise\.all\(\[worker\(\), worker\(\)\]\)/);
  assert.equal((levelTemplate.match(/bindtouchstart="prefetchMaterial"/g) || []).length, 3);
  assert.match(storeSource, /PUBLIC_READ_ACTIONS = \{\s*getListeningMaterialCatalog: true/);
  assert.match(storeSource, /immutablePrefix = 'yoyoCloudReadCacheV4:getListeningMaterialCatalog:'/);
});

test('音频课程快照首屏不等待完整详情补齐', () => {
  const source = fs.readFileSync(path.join(root, 'pages/lesson/index.js'), 'utf8');
  const onShowSource = source.slice(source.indexOf('  async onShow() {'), source.indexOf('  onHide() {'));
  assert.match(onShowSource, /const hasSnapshotTask = !!this\.data\.task/);
  assert.match(onShowSource, /const refreshPromise = this\.refreshPage\(\)/);
  assert.match(onShowSource, /if \(hasSnapshotTask\) \{[\s\S]*?refreshPromise[\s\S]*?return;/);
  assert.match(source, /finishLessonShowRefresh\(detail\)/);
});

test('口语首页与分层选择按需加载，选音频后才读取 transcript', () => {
  const source = fs.readFileSync(path.join(root, 'pages/speaking/index.js'), 'utf8');
  const onLoadSource = source.slice(source.indexOf('  onLoad() {'), source.indexOf('  onShow() {'));
  const repeatSource = source.slice(source.indexOf('  async loadRepeatSeriesCatalog(series) {'), source.indexOf('  async selectRepeatAudio(event) {'));
  const audioSource = source.slice(source.indexOf('  async selectRepeatAudio(event) {'), source.indexOf('  openRepeatAudioPicker() {'));
  const ieltsIndexSource = source.slice(source.indexOf('  async openIeltsSpeaking() {'), source.indexOf('  async selectIeltsTest(event) {'));
  const ieltsItemSource = source.slice(source.indexOf('  async selectIeltsTest(event) {'), source.indexOf('  queueIeltsIntroAutoPlay() {'));
  const template = fs.readFileSync(path.join(root, 'pages/speaking/index.wxml'), 'utf8');

  assert.doesNotMatch(onLoadSource, /getMaterialIndex|getMaterialItem|getListeningMaterialCatalog|getTaskTranscript|synthesizeIeltsPromptAudio/);
  assert.match(repeatSource, /store\.getListeningMaterialCatalog/);
  assert.match(source, /loadRepeatCatalog\(levelId, series\)/);
  assert.doesNotMatch(repeatSource, /loadRepeatTranscript/);
  assert.match(audioSource, /await this\.loadRepeatTranscript\(selectedAudio, this\.repeatRequestToken\)/);
  assert.match(ieltsIndexSource, /store\.getMaterialIndex\(\{ moduleId: 'speaking' \}\)/);
  assert.match(source, /loadIeltsItem\(itemId\)/);
  assert.match(source, /store\.getMaterialItem\(\{ moduleId: 'speaking', itemId: key \}\)/);
  assert.equal((template.match(/bindtouchstart="prefetchIeltsTest"/g) || []).length, 2);
  assert.equal((template.match(/bindtouchstart="prefetchRepeatEntry"/g) || []).length, 0);
  assert.equal((template.match(/bindtouchstart="prefetchRepeatSeries"/g) || []).length, 0);
  assert.equal((template.match(/class="repeat-paragraph-row/g) || []).length, 0);
});
