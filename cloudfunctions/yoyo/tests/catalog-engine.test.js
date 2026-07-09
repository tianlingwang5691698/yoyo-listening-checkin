const test = require('node:test');
const assert = require('node:assert/strict');

const catalogEngine = require('../lib/catalog-engine');
const listeningPlanEngine = require('../lib/listening-plan-engine');
const taskPresenter = require('../lib/task-presenter');
const labels = require('../../../utils/labels');

test('Unlock3 练习册听力排序将 mid term 放在 unit4 和 unit5 之间，end term 放最后', () => {
  ['unlock3'].forEach((category) => {
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
  ['unlock1', 'unlock2', 'unlock4'].forEach((category) => {
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

test('Unlock 分类标签区分课本和练习册', () => {
  const catalogLabels = catalogEngine.CATEGORY_LABELS;
  const planTitles = Object.fromEntries(listeningPlanEngine.MATERIALS
    .filter((item) => item.category.startsWith('unlock'))
    .map((item) => [item.category, item.title]));

  assert.equal(catalogLabels.unlock1, 'Unlock 1 课本');
  assert.equal(catalogLabels.unlock1workbook, 'Unlock 1 练习册');
  assert.equal(catalogLabels.unlock2, 'Unlock 2 课本');
  assert.equal(catalogLabels.unlock3textbook, 'Unlock 3 课本');
  assert.equal(catalogLabels.unlock3, 'Unlock 3 练习册');
  assert.equal(catalogLabels.unlock4, 'Unlock 4 课本');
  assert.deepEqual(planTitles, {
    unlock1: 'Unlock 1 课本',
    unlock1workbook: 'Unlock 1 练习册',
    unlock2: 'Unlock 2 课本',
    unlock3textbook: 'Unlock 3 课本',
    unlock3: 'Unlock 3 练习册',
    unlock4: 'Unlock 4 课本'
  });
  assert.equal(taskPresenter.getCategoryLabel('unlock1workbook'), 'Unlock 1 练习册');
  assert.equal(taskPresenter.getCategoryLabel('unlock3'), 'Unlock 3 练习册');
  assert.equal(labels.getCategoryDisplayLabel('unlock4'), 'Unlock 4 课本');
});
