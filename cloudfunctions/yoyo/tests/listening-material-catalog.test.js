const test = require('node:test');
const assert = require('node:assert/strict');

const catalog = require('../lib/listening-material-catalog');
const catalogEngine = require('../lib/catalog-engine');
const listeningPlanService = require('../services/listening-plan.service');
const taskService = require('../services/task.service');
const study = require('../facades/study.facade');

test('公共音频目录只保留展示字段和首个分片', () => {
  const result = catalog.buildPublicTaskSummary({
    taskId: 'track-1',
    category: 'magictreehouse',
    title: 'Track 1',
    durationSec: 600,
    audioUrl: 'https://example.com/full.mp3',
    audioSegments: [
      { index: 0, audioUrl: 'https://example.com/0.mp3' },
      { index: 1, audioUrl: 'https://example.com/1.mp3' }
    ],
    transcriptTrackCandidates: ['large-track'],
    textSource: { filePath: 'large.json' }
  }, 0);

  assert.equal(result.catalogSummary, true);
  assert.equal(result.audioSegmentCount, 2);
  assert.equal(result.audioSegments.length, 1);
  assert.equal(result.audioUrl, 'https://example.com/full.mp3');
  assert.equal(result.transcriptTrackCandidates, undefined);
  assert.equal(result.textSource, undefined);
});

test('公共音频目录不读取学生上下文和计划', async (t) => {
  let preparedContext = false;
  let activePlanRead = false;
  let runtimeCatalogRefreshed = false;
  t.mock.method(study, 'prepareRequestContext', async () => {
    preparedContext = true;
    throw new Error('should not prepare student context');
  });
  t.mock.method(study, 'getActiveListeningPlan', async () => {
    activePlanRead = true;
    return null;
  });
  t.mock.method(study, 'refreshRuntimeCatalogs', async () => {
    runtimeCatalogRefreshed = true;
    return {};
  });
  t.mock.method(study, 'resolveStandaloneCategoryTasks', async () => [{
    taskId: 'little-bear-1',
    category: 'littlebear',
    title: 'Little Bear',
    audioUrl: 'https://example.com/little-bear.mp3'
  }]);
  t.mock.method(study, 'getCategoryLabel', () => 'Little Bear');
  t.mock.method(study, 'getTodayString', () => '2026-07-16');

  const result = await listeningPlanService.getListeningMaterialCatalog({
    payload: { levelId: 'Pre A1', category: 'littlebear' }
  });

  assert.equal(preparedContext, false);
  assert.equal(activePlanRead, false);
  assert.equal(runtimeCatalogRefreshed, false);
  assert.equal(result.publicResource, true);
  assert.equal(result.tasks.length, 1);
});

test('Unlock 1 公共目录复用静态正式清单，不重复刷新训练池', async (t) => {
  let runtimeCatalogRefreshed = false;
  t.mock.method(study, 'getCatalog', () => [{
    taskId: 'unlock1-1',
    category: 'unlock1',
    title: 'Unlock 1.1',
    durationSec: 85,
    audioUrl: 'https://example.com/unlock1-1.mp3'
  }]);
  t.mock.method(study, 'refreshRuntimeCatalogs', async () => {
    runtimeCatalogRefreshed = true;
    return {};
  });
  t.mock.method(study, 'resolveStandaloneCategoryTasks', async () => study.getCatalog('unlock1'));
  t.mock.method(study, 'getCategoryLabel', () => 'Unlock 1 听口 第二版');
  t.mock.method(study, 'getTodayString', () => '2026-07-22');

  const result = await listeningPlanService.getListeningMaterialCatalog({
    payload: { levelId: 'A1', category: 'unlock1' }
  });

  assert.equal(runtimeCatalogRefreshed, false);
  assert.equal(result.totalCount, 1);
  assert.equal(result.tasks[0].taskId, 'unlock1-1');
});

test('New Concept 公共目录使用线上生成的静态正式清单', () => {
  const expected = { newconcept1: 72, newconcept2: 98, newconcept3: 60, newconcept4: 48 };
  Object.entries(expected).forEach(([category, count]) => {
    const tasks = catalogEngine.getStaticCatalogMap()[category] || [];
    assert.equal(tasks.length, count, category);
    assert.equal(new Set(tasks.map((task) => task.taskId)).size, count, `${category} taskId`);
    assert.equal(new Set(tasks.map((task) => task.audioCloudPath)).size, count, `${category} audioCloudPath`);
    assert.equal(tasks.every((task) => task.audioUrl && task.durationSec > 0), true, `${category} playable`);
  });
});

test('课程页用公共摘要补齐完整长音频分片', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'parent' }, child: { childId: 'child-1' } },
    today: '2026-07-16'
  }));
  t.mock.method(study, 'resolveStandaloneCategoryTasks', async () => [{
    taskId: 'mth-1',
    category: 'magictreehouse',
    title: 'Magic Tree House 1',
    audioUrl: 'https://example.com/full.mp3',
    audioSegments: [
      { index: 0, audioUrl: 'https://example.com/0.mp3' },
      { index: 1, audioUrl: 'https://example.com/1.mp3' }
    ]
  }]);
  t.mock.method(study, 'buildEmptyProgress', () => ({}));
  t.mock.method(study, 'decorateTask', (task) => task);
  t.mock.method(study, 'isStudyWriteAllowed', () => false);

  const result = await taskService.getTaskDetail({
    payload: {
      view: 'lesson',
      source: 'catalog',
      planRunType: 'preview',
      category: 'magictreehouse',
      taskId: 'mth-1',
      taskSnapshot: {
        taskId: 'mth-1',
        category: 'magictreehouse',
        catalogSummary: true,
        audioUrl: 'https://example.com/full.mp3',
        audioSegments: [{ index: 0, audioUrl: 'https://example.com/0.mp3' }]
      }
    }
  });

  assert.equal(result.task.audioSegments.length, 2);
  assert.equal(result.categoryTasks.length, 1);
});

test('继续学习快照不在今日任务时保留音频且不向学生显示调试信息', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'student' }, child: { childId: 'child-1' } },
    today: '2026-07-16'
  }));
  t.mock.method(study, 'getDashboardData', async () => ({ dailyTasks: [], planDayIndex: 2 }));
  t.mock.method(study, 'isStudyWriteAllowed', () => true);

  const result = await taskService.getTaskDetail({
    payload: {
      view: 'lesson',
      planRunType: 'normal',
      category: 'unlock1thirdedition',
      taskId: 'unlock1thirdedition-1',
      taskSnapshot: {
        taskId: 'unlock1thirdedition-1',
        category: 'unlock1thirdedition',
        audioUrl: 'https://example.com/1.mp3',
        durationSec: 54
      }
    }
  });

  assert.equal(result.task.taskId, 'unlock1thirdedition-1');
  assert.equal(result.showCloudDebug, false);
  assert.equal(result.syncDebug, null);
});
