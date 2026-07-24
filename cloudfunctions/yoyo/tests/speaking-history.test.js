const test = require('node:test');
const assert = require('node:assert/strict');

const speakingService = require('../services/speaking.service');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');

test('口语记录查询按当前家庭和学生读取最近记录', async (t) => {
  const expectedScope = {
    familyId: 'family-1',
    childId: 'child-1'
  };
  let receivedScope = null;
  let receivedLimit = 0;
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'parent' }, child: { childId: 'child-1' } },
    today: '2026-07-24'
  }));
  t.mock.method(study, 'getUserScope', () => expectedScope);
  t.mock.method(attemptRepository, 'findSpeakingHistory', async (scope, limit) => {
    receivedScope = scope;
    receivedLimit = limit;
    return [{
      _id: 'attempt-1',
      category: 'speaking',
      questionText: 'Read this sentence.',
      score: 93,
      answerDurationMs: 1800
    }];
  });

  const result = await speakingService.getSpeakingAttempts({
    payload: { historyMode: 'recent', limit: 60 }
  });

  assert.deepEqual(receivedScope, expectedScope);
  assert.equal(receivedLimit, 60);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].attemptId, 'attempt-1');
  assert.equal(result.attempts[0].answerDurationText, '2秒');
});
