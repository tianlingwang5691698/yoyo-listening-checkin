const test = require('node:test');
const assert = require('node:assert/strict');

const catalogEngine = require('../lib/catalog-engine');
const listeningPlanEngine = require('../lib/listening-plan-engine');
const taskPresenter = require('../lib/task-presenter');
const labels = require('../../../utils/labels');
const { TRANSCRIPT_BUNDLE_PATHS } = require('../lib/constants');

test('Peppa 时长按云端 128kbps MP3 文件大小还原', () => {
  assert.equal(catalogEngine.inferPeppaDurationFromFileSize(4976408), 311);
  assert.equal(catalogEngine.inferPeppaDurationFromFileSize(10145727), 634);
  assert.equal(catalogEngine.inferPeppaDurationFromFileSize(4879441), 305);
  assert.equal(catalogEngine.inferPeppaDurationFromFileSize(0), 0);
});

test('Peppa 三季使用完整静态 manifest 并保留真实时长', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['peppa']);
  const elapsedMs = Date.now() - startedAt;
  const tasks = catalogEngine.getCatalog('peppa');
  const seasonCounts = tasks.reduce((counts, task) => {
    const season = Number((String(task.title).match(/^S(\d)/) || [])[1] || 0);
    counts[season] = (counts[season] || 0) + 1;
    return counts;
  }, {});

  assert.equal(tasks.length, 157);
  assert.deepEqual(seasonCounts, { 1: 52, 2: 53, 3: 52 });
  assert.equal(tasks.find((task) => task.title.startsWith('S213 ')).durationSec, 634);
  assert.equal(tasks.find((task) => task.title.startsWith('S301 ')).durationSec, 305);
  assert.ok(new Set(tasks.map((task) => task.durationSec)).size >= 9);
  assert.equal(tasks.filter((task) => task.durationSec === 300).length, 0);
  assert.ok(elapsedMs < 100, `Peppa manifest 加载耗时 ${elapsedMs}ms`);
});

test('Unlock 练习册听力排序将 mid term 放在 unit4 和 unit5 之间，end term 放最后', () => {
  ['unlock3', 'unlock4workbook'].forEach((category) => {
    const files = [
      { cloudPath: 'B1/Unlock3/Class Audio/UL2v2_L3_TST_LS_END_END_1.mp3' },
      { cloudPath: 'B1/Unlock3/Class Audio/UL2v2_L3_TST_LS_U05_Audio_5.1.mp3' },
      { cloudPath: 'B1/Unlock3/Class Audio/UL2v2_L3_TST_LS_MID_MID_1.mp3' },
      { cloudPath: 'B1/Unlock3/Class Audio/UL2v2_L3_TST_LS_U04_Audio_4.1.mp3' }
    ];

    const sorted = files
      .slice()
      .sort((left, right) => catalogEngine.sortFilesByPath(left, right, category))
      .map((item) => catalogEngine.getBaseName(item.cloudPath));

    assert.deepEqual(sorted, [
      'UL2v2_L3_TST_LS_U04_Audio_4.1',
      'UL2v2_L3_TST_LS_MID_MID_1',
      'UL2v2_L3_TST_LS_U05_Audio_5.1',
      'UL2v2_L3_TST_LS_END_END_1'
    ]);
  });
});

test('Unlock 课本分类不启用 mid/end 特殊排序', () => {
  ['unlock1', 'unlock1thirdedition', 'unlock2', 'unlock3textbook', 'unlock3thirdedition', 'unlock4'].forEach((category) => {
    const files = [
      { cloudPath: 'A1/Unlock1/Class Audio/UL2v2_L1_TST_LS_END_END_1.mp3' },
      { cloudPath: 'A1/Unlock1/Class Audio/UL2v2_L1_TST_LS_U05_Audio_5.1.mp3' },
      { cloudPath: 'A1/Unlock1/Class Audio/UL2v2_L1_TST_LS_MID_MID_1.mp3' },
      { cloudPath: 'A1/Unlock1/Class Audio/UL2v2_L1_TST_LS_U04_Audio_4.1.mp3' }
    ];

    const sorted = files
      .slice()
      .sort((left, right) => catalogEngine.sortFilesByPath(left, right, category))
      .map((item) => catalogEngine.getBaseName(item.cloudPath));

    assert.deepEqual(sorted, [
      'UL2v2_L1_TST_LS_U04_Audio_4.1',
      'UL2v2_L1_TST_LS_U05_Audio_5.1',
      'UL2v2_L1_TST_LS_END_END_1',
      'UL2v2_L1_TST_LS_MID_MID_1'
    ]);
  });
});

test('Unlock3 静态目录同样按教材顺序输出', () => {
  const titles = catalogEngine.getStaticCatalogMap().unlock3.map((item) => item.title);
  const unit4Index = titles.findIndex((title) => title.includes('_U04_'));
  const midIndex = titles.findIndex((title) => title.includes('_MID_'));
  const unit5Index = titles.findIndex((title) => title.includes('_U05_'));
  const endIndex = titles.findIndex((title) => title.includes('_END_'));

  assert.equal(unit4Index > -1, true);
  assert.equal(midIndex > unit4Index, true);
  assert.equal(unit5Index > midIndex, true);
  assert.equal(endIndex, titles.length - 2);
});

test('Unlock4 练习册静态目录同样按教材顺序输出', () => {
  const titles = catalogEngine.getStaticCatalogMap().unlock4workbook.map((item) => item.title);
  const unit4Index = titles.findIndex((title) => title.includes('_U04_'));
  const midIndex = titles.findIndex((title) => title.includes('_MID_'));
  const unit5Index = titles.findIndex((title) => title.includes('_U05_'));
  const endIndex = titles.findIndex((title) => title.includes('_END_'));

  assert.equal(titles.length, 15);
  assert.equal(unit4Index > -1, true);
  assert.equal(midIndex > unit4Index, true);
  assert.equal(unit5Index > midIndex, true);
  assert.equal(endIndex, titles.length - 2);
});

test('New Concept 2-4 摘要有兜底数量', () => {
  assert.deepEqual(catalogEngine.getCatalogSummary('newconcept2'), {
    totalCount: 96,
    enabled: true
  });
  assert.deepEqual(catalogEngine.getCatalogSummary('newconcept3'), {
    totalCount: 60,
    enabled: true
  });
  assert.deepEqual(catalogEngine.getCatalogSummary('newconcept4'), {
    totalCount: 48,
    enabled: true
  });
});

test('静态目录映射在同一云函数实例内复用', () => {
  assert.equal(catalogEngine.getCatalog('unlock1thirdedition'), catalogEngine.getCatalog('unlock1thirdedition'));
  assert.equal(catalogEngine.getCatalog('peppa'), catalogEngine.getCatalog('peppa'));
});

test('New Concept 1-4 在所有计划阶段保留回答评分', () => {
  const categories = ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'];
  const phases = ['round-1', 'round-2', 'custom', 'level'];
  categories.forEach((category) => {
    phases.forEach((planPhase) => {
      const task = taskPresenter.decorateTask({
        taskId: `${category}-${planPhase}`,
        category,
        title: `${category} lesson`,
        repeatTarget: 3,
        planPhase,
        transcriptTrackId: `track-${category}`
      }, {
        playCount: 0,
        playMoments: [],
        completedToday: false
      }, category, {
        songPlaceholder: {},
        getMediaDisplayName: () => ''
      });

      assert.equal(task.speakingMode, 'nce-question-answer');
      assert.equal(task.speakingRequired, true);
      assert.equal(task.questionAnswerRequired, true);
    });
  });
});

test('Pre A1 Songs 与其他 Level 使用同一静态目录加载', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['song']);
  const songs = catalogEngine.getStaticCatalogMap().song;
  const materials = listeningPlanEngine.buildMaterialEntries('Pre A1', {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const material = materials.find((item) => item.category === 'song');

  assert.equal(songs.length, 103);
  assert.equal(songs.filter((item) => item.transcriptStatus === 'ready').length, 101);
  assert.deepEqual(material, {
    levelId: 'Pre A1',
    category: 'song',
    title: 'Songs',
    totalCount: 103,
    enabled: true
  });
  assert.equal(Object.prototype.hasOwnProperty.call(material, 'tasks'), false);
  assert.ok(Date.now() - startedAt < 100, 'Songs 静态目录不应触发云存储扫描');
});

test('Peppa 只归入 A1 且首屏保持轻量', () => {
  const startedAt = performance.now();
  const build = (levelId) => listeningPlanEngine.buildMaterialEntries(levelId, {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const preA1 = build('Pre A1');
  const a1 = build('A1');
  const a2 = build('A2');
  const elapsedMs = performance.now() - startedAt;

  assert.deepEqual(preA1.map((item) => item.category), ['song', 'littlebear']);
  assert.equal(preA1.find((item) => item.category === 'littlebear').totalCount, 17);
  assert.equal(a1.find((item) => item.category === 'peppa').totalCount, 157);
  assert.equal(a1.filter((item) => item.category === 'peppa').length, 1);
  assert.equal(a2.some((item) => item.category === 'peppa'), false);
  assert.equal(JSON.stringify(a1).includes('audioUrl'), false);
  assert.ok(elapsedMs < 10, `三级摘要构建耗时 ${elapsedMs}ms`);
});

test('Unlock 1 听口 第三版使用静态 manifest 快速目录', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['unlock1thirdedition']);
  const elapsedMs = Date.now() - startedAt;
  const tasks = catalogEngine.getCatalog('unlock1thirdedition');

  assert.equal(tasks.length, 66);
  assert.equal(tasks[0].category, 'unlock1thirdedition');
  assert.match(tasks[0].audioCloudPath, /^A1\/unlock1 第三版\/Audio\//);
  assert.equal(tasks[0].transcriptTrackId, 'track-unlock1-3e-u01-t01');
  assert.deepEqual(
    tasks.filter((task) => task.transcriptTrackId.includes('-u02-')).map((task) => task.transcriptTrackId),
    Array.from({ length: 9 }, (_, index) => `track-unlock1-3e-u02-t${String(index + 1).padStart(2, '0')}`)
  );
  assert.equal(elapsedMs < 300, true);
});

test('A1 听力首屏只返回第三版数量摘要', () => {
  const materials = listeningPlanEngine.buildMaterialEntries('A1', {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const material = materials.find((item) => item.category === 'unlock1thirdedition');

  assert.deepEqual(material, {
    levelId: 'A1',
    category: 'unlock1thirdedition',
    title: 'Unlock 1 听口 第三版',
    totalCount: 66,
    enabled: true
  });
  assert.equal(Object.prototype.hasOwnProperty.call(material, 'tasks'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
});

test('Unlock 2 听口第三版使用静态 manifest 快速目录', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['unlock2thirdedition']);
  const elapsedMs = Date.now() - startedAt;
  const tasks = catalogEngine.getCatalog('unlock2thirdedition');

  assert.equal(tasks.length, 63);
  assert.equal(tasks[0].category, 'unlock2thirdedition');
  assert.match(tasks[0].audioCloudPath, /^A2\/unlock2 第三版\/Audio\//);
  assert.match(tasks[0].transcriptTrackId, /^track-unlock2-third-/);
  assert.equal(elapsedMs < 300, true);
});

test('A2 听力首屏只返回 Unlock 2 听口第三版数量摘要', () => {
  const materials = listeningPlanEngine.buildMaterialEntries('A2', {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const material = materials.find((item) => item.category === 'unlock2thirdedition');

  assert.deepEqual(material, {
    levelId: 'A2',
    category: 'unlock2thirdedition',
    title: 'Unlock 2 听口 第三版',
    totalCount: 63,
    enabled: true
  });
  assert.equal(Object.prototype.hasOwnProperty.call(material, 'tasks'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
});

test('Unlock3 听口 第三版使用静态 manifest 快速目录', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['unlock3thirdedition']);
  const elapsedMs = Date.now() - startedAt;
  const tasks = catalogEngine.getCatalog('unlock3thirdedition');

  assert.equal(tasks.length, 68);
  assert.equal(tasks[0].category, 'unlock3thirdedition');
  assert.match(tasks[0].audioCloudPath, /^B1\/unlock3 第三版\/Audio\//);
  assert.match(tasks[0].transcriptTrackId, /^track-unlock3-3e-/);
  assert.equal(elapsedMs < 300, true);
});

test('B1 听力首屏只返回 Unlock3 第三版数量摘要', () => {
  const materials = listeningPlanEngine.buildMaterialEntries('B1', {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const material = materials.find((item) => item.category === 'unlock3thirdedition');

  assert.deepEqual(material, {
    levelId: 'B1',
    category: 'unlock3thirdedition',
    title: 'Unlock3 听口 第三版',
    totalCount: 68,
    enabled: true
  });
  assert.equal(Object.prototype.hasOwnProperty.call(material, 'tasks'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
});

test('Unlock 4 听口 第三版使用静态 manifest 快速目录', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['unlock4thirdedition']);
  const elapsedMs = Date.now() - startedAt;
  const tasks = catalogEngine.getCatalog('unlock4thirdedition');

  assert.equal(tasks.length, 49);
  assert.equal(tasks[0].category, 'unlock4thirdedition');
  assert.match(tasks[0].audioCloudPath, /^B2\/unlock4 第三版\/Audio\//);
  assert.equal(tasks[0].transcriptTrackId, 'track-unlock4-3e-u01-t01');
  assert.equal(elapsedMs < 300, true);
});

test('Unlock 1-4 听口练习册第三版使用独立静态目录', () => {
  const expected = {
    unlock1workbookthirdedition: 12,
    unlock2workbookthirdedition: 16,
    unlock3workbookthirdedition: 13,
    unlock4workbookthirdedition: 15
  };
  const catalogs = catalogEngine.getStaticCatalogMap();
  Object.entries(expected).forEach(([category, count]) => {
    assert.equal(catalogs[category].length, count);
    assert.equal(new Set(catalogs[category].map((item) => item.audioCloudPath)).size, count);
  });
  assert.deepEqual(TRANSCRIPT_BUNDLE_PATHS.unlock1workbookthirdedition, [
    '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v2.json',
    '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v1.json'
  ]);
});

test('B2 听力首屏只返回 Unlock 4 第三版数量摘要', () => {
  const materials = listeningPlanEngine.buildMaterialEntries('B2', {
    getCatalogSummary: catalogEngine.getCatalogSummary
  });
  const material = materials.find((item) => item.category === 'unlock4thirdedition');

  assert.deepEqual(material, {
    levelId: 'B2',
    category: 'unlock4thirdedition',
    title: 'Unlock 4 听口 第三版',
    totalCount: 49,
    enabled: true
  });
  assert.equal(Object.prototype.hasOwnProperty.call(material, 'tasks'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
});

test('Unlock 分类标签区分课本和练习册', () => {
  const catalogLabels = catalogEngine.CATEGORY_LABELS;
  const planTitles = Object.fromEntries(listeningPlanEngine.MATERIALS
    .filter((item) => item.category.startsWith('unlock'))
    .map((item) => [item.category, item.title]));

  assert.equal(catalogLabels.unlock1, 'Unlock 1 听口 第二版');
  assert.equal(catalogLabels.unlock1thirdedition, 'Unlock 1 听口 第三版');
  assert.equal(catalogLabels.unlock1workbook, 'Unlock 1 听口 练习册 第二版');
  assert.equal(catalogLabels.unlock1workbookthirdedition, 'Unlock 1 听口练习册 第三版');
  assert.equal(catalogLabels.unlock2, 'Unlock 2 课本');
  assert.equal(catalogLabels.unlock2thirdedition, 'Unlock 2 听口 第三版');
  assert.equal(catalogLabels.unlock2workbook, 'Unlock 2 练习册');
  assert.equal(catalogLabels.unlock2workbookthirdedition, 'Unlock 2 听口练习册 第三版');
  assert.equal(catalogLabels.unlock3textbook, 'Unlock3 听口 第二版');
  assert.equal(catalogLabels.unlock3thirdedition, 'Unlock3 听口 第三版');
  assert.equal(catalogLabels.unlock3, 'Unlock3 听口练习册 第二版');
  assert.equal(catalogLabels.unlock3workbookthirdedition, 'Unlock3 听口练习册 第三版');
  assert.equal(catalogLabels.unlock4, 'Unlock 4 课本');
  assert.equal(catalogLabels.unlock4thirdedition, 'Unlock 4 听口 第三版');
  assert.equal(catalogLabels.unlock4workbook, 'Unlock 4 练习册');
  assert.equal(catalogLabels.unlock4workbookthirdedition, 'Unlock 4 听口练习册 第三版');
  assert.deepEqual(planTitles, {
    unlock1: 'Unlock 1 听口 第二版',
    unlock1thirdedition: 'Unlock 1 听口 第三版',
    unlock1workbookthirdedition: 'Unlock 1 听口练习册 第三版',
    unlock1workbook: 'Unlock 1 听口 练习册 第二版',
    unlock2: 'Unlock 2 课本',
    unlock2thirdedition: 'Unlock 2 听口 第三版',
    unlock2workbookthirdedition: 'Unlock 2 听口练习册 第三版',
    unlock2workbook: 'Unlock 2 练习册',
    unlock3textbook: 'Unlock3 听口 第二版',
    unlock3thirdedition: 'Unlock3 听口 第三版',
    unlock3workbookthirdedition: 'Unlock3 听口练习册 第三版',
    unlock3: 'Unlock3 听口练习册 第二版',
    unlock4: 'Unlock 4 课本',
    unlock4thirdedition: 'Unlock 4 听口 第三版',
    unlock4workbookthirdedition: 'Unlock 4 听口练习册 第三版',
    unlock4workbook: 'Unlock 4 练习册'
  });
  assert.deepEqual(
    listeningPlanEngine.MATERIALS.filter((item) => item.levelIds.includes('A1') && item.category.startsWith('unlock')).map((item) => item.category),
    ['unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook']
  );
  assert.equal(taskPresenter.getCategoryLabel('unlock1thirdedition'), 'Unlock 1 听口 第三版');
  assert.deepEqual(taskPresenter.getTaskPresentation({
    category: 'unlock1thirdedition',
    title: 'UNL3_PP_IN_LS1_U02_l01_p044_X02_t03'
  }), {
    displayTitle: '2.3',
    displaySubtitle: 'A1 听口 第三版听力',
    coverVariant: 'unlock',
    coverBadge: 'Unlock 1 听口 第三版'
  });
  assert.equal(taskPresenter.getCategoryLabel('unlock1workbook'), 'Unlock 1 听口 练习册 第二版');
  assert.equal(taskPresenter.getCategoryLabel('unlock1workbookthirdedition'), 'Unlock 1 听口练习册 第三版');
  assert.equal(taskPresenter.getCategoryLabel('unlock2workbook'), 'Unlock 2 练习册');
  assert.equal(taskPresenter.getCategoryLabel('unlock2workbookthirdedition'), 'Unlock 2 听口练习册 第三版');
  assert.equal(taskPresenter.getCategoryLabel('unlock2thirdedition'), 'Unlock 2 听口 第三版');
  assert.equal(taskPresenter.getCategoryLabel('unlock3textbook'), 'Unlock3 听口 第二版');
  assert.equal(taskPresenter.getCategoryLabel('unlock3thirdedition'), 'Unlock3 听口 第三版');
  assert.equal(taskPresenter.getCategoryLabel('unlock3'), 'Unlock3 听口练习册 第二版');
  assert.equal(taskPresenter.getCategoryLabel('unlock3workbookthirdedition'), 'Unlock3 听口练习册 第三版');
  assert.deepEqual(taskPresenter.getTaskPresentation({
    category: 'unlock3thirdedition',
    title: 'UNL3_PP_IN_LS3_U07_p158_X05_t06'
  }), {
    displayTitle: '7.6',
    displaySubtitle: 'B1 听口 第三版听力',
    coverVariant: 'unlock',
    coverBadge: 'Unlock 3 听口 第三版'
  });
  assert.equal(taskPresenter.getCategoryLabel('unlock4workbook'), 'Unlock 4 练习册');
  assert.equal(taskPresenter.getCategoryLabel('unlock4workbookthirdedition'), 'Unlock 4 听口练习册 第三版');
  assert.equal(taskPresenter.getCategoryLabel('unlock4thirdedition'), 'Unlock 4 听口 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock4'), 'Unlock 4 课本');
  assert.equal(labels.getCategoryDisplayLabel('unlock4workbook'), 'Unlock 4 练习册');
  assert.equal(labels.getCategoryDisplayLabel('unlock4workbookthirdedition'), 'Unlock 4 听口练习册 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock4thirdedition'), 'Unlock 4 听口 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock1thirdedition'), 'Unlock 1 听口 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock2thirdedition'), 'Unlock 2 听口 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock3textbook'), 'Unlock3 听口 第二版');
  assert.equal(labels.getCategoryDisplayLabel('unlock3thirdedition'), 'Unlock3 听口 第三版');
  assert.equal(labels.getCategoryDisplayLabel('unlock3'), 'Unlock3 听口练习册 第二版');
  assert.deepEqual(
    listeningPlanEngine.MATERIALS.filter((item) => item.levelIds.includes('B1') && item.category.startsWith('unlock')).map((item) => item.category),
    ['unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3']
  );
  assert.deepEqual(
    listeningPlanEngine.MATERIALS.filter((item) => item.levelIds.includes('B2') && item.category.startsWith('unlock')).map((item) => item.category),
    ['unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook']
  );
});
