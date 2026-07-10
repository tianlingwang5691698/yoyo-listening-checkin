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

test('prepareRequestContext 听力素材首屏使用轻量上下文', async () => {
  const calls = [];
  const result = await requestContextEngine.prepareRequestContext({
    action: 'getListeningPlanOverview',
    payload: { levelId: 'A1' }
  }, {
    refreshRuntimeCatalogs: async (force, categories) => calls.push(['refresh', force, categories]),
    getWXContext: () => ({ OPENID: 'open-1' }),
    getLightweightContext: async (openId) => {
      calls.push(['lightweight', openId]);
      return { user: { openId }, child: { childId: 'child-yoyo' } };
    },
    ensureBootstrap: async () => {
      calls.push(['bootstrap']);
      return {};
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

test('prepareRequestContext 会把设备身份应用到上下文', async () => {
  const calls = [];
  const result = await requestContextEngine.prepareRequestContext({
    action: 'getTaskDetail',
    payload: {
      category: 'peppa',
      deviceId: 'dev-1',
      deviceStudyRole: 'student'
    }
  }, {
    refreshRuntimeCatalogs: async () => {},
    getWXContext: () => ({ OPENID: 'open-1' }),
    ensureBootstrap: async (openId) => ({
      user: { openId },
      member: { memberId: 'member-1', studyRole: 'parent' },
      family: { familyId: 'family-1' },
      child: { childId: 'child-1' }
    }),
    applyDeviceStudyRole: async (ctx, payload, action) => {
      calls.push(['deviceRole', payload.deviceId, payload.deviceStudyRole, action]);
      return Object.assign({}, ctx, {
        member: Object.assign({}, ctx.member, { studyRole: 'student' })
      });
    },
    getTodayString: () => '2026-04-21'
  });

  assert.deepEqual(calls, [['deviceRole', 'dev-1', 'student', 'getTaskDetail']]);
  assert.equal(result.ctx.member.studyRole, 'student');
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

test('resolveCatalogCategories 课程详情有快照时不刷新素材目录', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'newconcept1', {
      view: 'lesson',
      taskSnapshot: {
        category: 'newconcept1',
        taskId: 'newconcept1-73',
        audioCloudPath: 'A1/NewConcept1-US/L073.mp3'
      }
    }),
    []
  );
});

test('resolveCatalogCategories 课程详情缺音频快照时刷新当前分类', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getTaskDetail', 'newconcept1', {
      view: 'lesson',
      taskSnapshot: { category: 'newconcept1', taskId: 'newconcept1-73' }
    }),
    ['newconcept1']
  );
});

test('resolveCatalogCategories 阶段页不刷新素材目录', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getLevelOverview', '', { phase: 'round-2' }),
    []
  );
});

test('resolveCatalogCategories 听力计划首屏不刷新素材目录', () => {
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningPlanOverview', '', { levelId: 'A2' }),
    []
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningPlanOverview', '', { levelId: 'B1' }),
    []
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningMaterialDetail', 'newconcept4', {}),
    ['newconcept4']
  );
  assert.deepEqual(
    requestContextEngine.resolveCatalogCategories('getListeningMaterialDetail', 'unlock4workbook', {}),
    ['unlock4workbook']
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
