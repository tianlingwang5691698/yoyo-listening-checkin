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
    ['ensureCollections'],
    ['bootstrap', 'open-1']
  ]);
  assert.deepEqual(result, {
    action: 'getDashboard',
    requestedCategory: '',
    ctx: { user: { openId: 'open-1' } },
    today: '2026-04-21'
  });
});

test('resolveCatalogCategories 对任务详情只刷新请求分类', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'unlock1', {}),
    ['unlock1']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'bad-category', {}),
    []
  );
});
