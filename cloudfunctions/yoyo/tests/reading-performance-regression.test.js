const test = require('node:test');
const assert = require('node:assert/strict');

const requestContextEngine = require('../lib/request-context-engine');

const READING_ACTIONS = [
  'getReadingHome',
  'getReadingPassage',
  'getReadingStudyPack',
  'submitReadingAttempt',
  'synthesizeReadingAudio',
  'lookupWord'
];

test('阅读 action 不触发听力素材目录刷新', async () => {
  for (const action of READING_ACTIONS) {
    const refreshCalls = [];
    const result = await requestContextEngine.prepareRequestContext({
      action,
      payload: { passageId: 'reading-1' }
    }, {
      refreshRuntimeCatalogs: async (...args) => refreshCalls.push(args),
      getWXContext: () => ({ OPENID: 'open-1' }),
      ensureBootstrap: async (openId) => ({ user: { openId } }),
      getTodayString: () => '2026-07-11'
    });

    assert.deepEqual(refreshCalls, [], `${action} 不应扫描听力素材目录`);
    assert.equal(result.action, action);
  }
});
