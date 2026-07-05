const test = require('node:test');
const assert = require('node:assert/strict');

const requestContextEngine = require('../lib/request-context-engine');

test('prepareRequestContext 按 action 选择 catalog 并返回上下文', async () => {
  const calls = [];
  const result = await requestContextEngine.prepareRequestContext({
    action: 'getDashboard',
    payload: { view: 'record' }
  }, {
    refreshRuntimeCatalogs: async (force, categories) => {
      calls.push(['refresh', force, categories]);
    },
    ensureRequiredCollectionsReady: async () => {
      calls.push(['ensureCollections']);
    },
    getWXContext: () => ({ OPENID: 'open-1' }),
    ensureBootstrap: async (openId) => {
      calls.push(['bootstrap', openId]);
      return { user: { openId } };
    },
    getTodayString: () => '2026-04-21'
  });

  assert.deepEqual(calls, [
    ['refresh', false, []],
    ['bootstrap', 'open-1']
  ]);
  assert.deepEqual(result, {
    action: 'getDashboard',
    requestedCategory: '',
    ctx: { user: { openId: 'open-1' } },
    today: '2026-04-21'
  });
});

test('prepareRequestContext 首页优先使用轻量上下文', async () => {
  const calls = [];
  const result = await requestContextEngine.prepareRequestContext({
    action: 'getDashboard',
    payload: { view: 'home' }
  }, {
    refreshRuntimeCatalogs: async (force, categories) => {
      calls.push(['refresh', force, categories]);
    },
    getWXContext: () => ({ OPENID: 'open-1' }),
    getLightweightContext: async (openId) => {
      calls.push(['lightweight', openId]);
      return { user: { openId }, child: { childId: 'child-yoyo' } };
    },
    ensureBootstrap: async (openId) => {
      calls.push(['bootstrap', openId]);
      return { user: { openId } };
    },
    getTodayString: () => '2026-04-21'
  });

  assert.deepEqual(calls, [
    ['refresh', false, []],
    ['lightweight', 'open-1']
  ]);
  assert.deepEqual(result.ctx.child.childId, 'child-yoyo');
});

test('prepareRequestContext 会传递选中学生上下文', async () => {
  const calls = [];
  await requestContextEngine.prepareRequestContext({
    action: 'getParentDashboard',
    payload: {
      targetFamilyId: 'family-2',
      targetChildId: 'child-2'
    }
  }, {
    refreshRuntimeCatalogs: async () => {},
    getWXContext: () => ({ OPENID: 'open-1' }),
    ensureBootstrap: async (openId, target) => {
      calls.push(['bootstrap', openId, target]);
      return { user: { openId } };
    },
    getTodayString: () => '2026-04-21'
  });

  assert.deepEqual(calls, [[
    'bootstrap',
    'open-1',
    { targetFamilyId: 'family-2', targetChildId: 'child-2', forceSelf: false }
  ]]);
});

test('resolveCatalogCategories 对任务详情只刷新请求分类', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'unlock1', {}),
    ['unlock1']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'unlock2', {}),
    ['unlock2']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'bad-category', {}),
    []
  );
});

test('resolveCatalogCategories 对听力计划按级别刷新素材', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningPlanOverview', '', { levelId: 'A2' }),
    ['peppa', 'newconcept2', 'unlock2']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningPlanOverview', '', { levelId: 'B1' }),
    ['newconcept3', 'unlock3']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningMaterialDetail', 'newconcept4', {}),
    ['newconcept4']
  );
});

test('resolveCatalogCategories 阅读学习包不刷新音频目录', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getReadingStudyPack', '', {}),
    []
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('synthesizeReadingAudio', '', {}),
    []
  );
});
