const test = require('node:test');
const assert = require('node:assert/strict');

const speakingService = require('../services/speaking.service');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const speakingEngine = require('../lib/speaking-engine');

function mockContext(t, role) {
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: {
      member: { memberId: 'member-1', studyRole: role },
      child: { childId: 'child-1' }
    },
    today: '2026-07-22'
  }));
  t.mock.method(study, 'isStudyWriteAllowed', () => role === 'student');
  t.mock.method(study, 'normalizeStudyRole', () => role);
  t.mock.method(study, 'getUserScope', () => ({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'openid-1',
    memberId: 'member-1'
  }));
  t.mock.method(speakingEngine, 'scoreSpeakingAttempt', async () => ({
    score: 88,
    pronunciationFluencyScore: 86,
    contentGrammarScore: 89,
    transcript: 'I enjoy living in my city because it is convenient.',
    feedback: '回答切题，继续补充细节。',
    status: 'scored'
  }));
}

function payload(planRunType) {
  return {
    payload: {
      category: 'ielts-speaking',
      taskId: 'ielts-academic-21-test-1-speaking-part-1-1',
      attemptType: 'ielts_speaking',
      planRunType,
      promptText: 'Do you like the city where you live?',
      answerAudioFileId: 'cloud://test/answer.mp3',
      answerCloudPath: '_speaking/answer.mp3',
      answerDurationMs: 12000,
      taskSnapshot: {
        taskId: 'ielts-academic-21-test-1-speaking-part-1-1',
        category: 'ielts-speaking',
        title: 'IELTS Speaking Part 1'
      }
    }
  };
}

test('IELTS 学生提交即使传 preview 仍写记录并刷新日报', async (t) => {
  mockContext(t, 'student');
  const records = [];
  let reportDate = '';
  t.mock.method(attemptRepository, 'add', async (record) => {
    records.push(record);
    return 'attempt-ielts-1';
  });
  t.mock.method(attemptRepository, 'findBestAndLatestByTask', async () => records);
  t.mock.method(study, 'upsertDailyReport', async (_scope, date) => {
    reportDate = date;
    return {};
  });

  const result = await speakingService.submitSpeakingAttempt(payload('preview'));

  assert.equal(records.length, 1);
  assert.equal(records[0].planRunType, 'normal');
  assert.equal(records[0].attemptType, 'ielts_speaking');
  assert.equal(reportDate, '2026-07-22');
  assert.equal(result.attempt.attemptId, 'attempt-ielts-1');
});

test('IELTS 家长提交即使传 normal 仍只评分不落库', async (t) => {
  mockContext(t, 'parent');
  let addCount = 0;
  let reportCount = 0;
  t.mock.method(attemptRepository, 'add', async () => {
    addCount += 1;
    return 'unexpected';
  });
  t.mock.method(study, 'upsertDailyReport', async () => {
    reportCount += 1;
    return {};
  });

  const result = await speakingService.submitSpeakingAttempt(payload('normal'));

  assert.equal(addCount, 0);
  assert.equal(reportCount, 0);
  assert.equal(result.attempt.planRunType, 'preview');
  assert.equal(result.attempt.resultRole, '试做');
});
