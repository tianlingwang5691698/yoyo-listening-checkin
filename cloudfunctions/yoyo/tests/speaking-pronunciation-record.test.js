const test = require('node:test');
const assert = require('node:assert/strict');

const speakingService = require('../services/speaking.service');
const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const speakingEngine = require('../lib/speaking-engine');

test('SOE 跟读总分由三个可见分项统一计算', () => {
  assert.equal(speakingEngine.calculatePronunciationScore(95, 96, 100), 96);
  const result = speakingEngine.extractTencentSoeScores([{
    SuggestedScore: 66,
    PronAccuracy: 95,
    PronFluency: 0.96,
    PronCompletion: 1
  }]);
  assert.equal(result.score, 96);
  assert.equal(result.providerSuggestedScore, 66);
  assert.equal(result.scoreFormula, 'accuracy*0.55+fluency*0.25+completion*0.20');
  assert.ok(result.feedback);
  assert.match(speakingEngine.buildPronunciationFeedback(95, 96, 100), /重音和语调/);
  assert.match(speakingEngine.buildPronunciationFeedback(72, 90, 100), /发音和单词重音/);
  assert.match(speakingEngine.buildPronunciationFeedback(92, 70, 100), /意群朗读/);
  assert.match(speakingEngine.buildPronunciationFeedback(92, 90, 68), /漏词或未读完整/);
});

test('学生 SOE 跟读评分写入记录并刷新日报', async (t) => {
  const records = [];
  let reportDate = '';
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: {
      member: { memberId: 'member-1', studyRole: 'student' },
      child: { childId: 'child-1' }
    },
    today: '2026-07-22'
  }));
  t.mock.method(study, 'isStudyWriteAllowed', () => true);
  t.mock.method(study, 'normalizeStudyRole', () => 'student');
  t.mock.method(study, 'getUserScope', () => ({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'openid-1',
    memberId: 'member-1'
  }));
  t.mock.method(speakingEngine, 'evaluateSpeakingPronunciation', async () => ({
    score: 94,
    accuracy: 95,
    fluency: 91,
    completion: 100,
    feedback: '发音准确、节奏流畅、内容完整。',
    scoreFormula: 'accuracy*0.55+fluency*0.25+completion*0.20',
    providerSuggestedScore: 66,
    requestId: 'soe-request-1',
    status: 'Finished'
  }));
  t.mock.method(attemptRepository, 'add', async (record) => {
    records.push(record);
    return 'attempt-1';
  });
  t.mock.method(study, 'upsertDailyReport', async (_scope, date) => {
    reportDate = date;
    return {};
  });

  const result = await speakingService.evaluateSpeakingPronunciation({
    payload: {
      category: 'speaking',
      taskId: 'sentence-1',
      attemptType: 'standalone_sentence_repeat',
      planRunType: 'normal',
      answerAudioFileId: 'cloud://test/repeat.mp3',
      answerCloudPath: '_speaking/repeat.mp3',
      answerDurationMs: 1800,
      refText: 'Read this sentence.'
    }
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].questionText, 'Read this sentence.');
  assert.equal(records[0].score, 94);
  assert.equal(records[0].pronunciationAccuracyScore, 95);
  assert.equal(records[0].pronunciationFluencyScore, 91);
  assert.equal(records[0].pronunciationCompletionScore, 100);
  assert.equal(records[0].feedback, '发音准确、节奏流畅、内容完整。');
  assert.equal(records[0].scoreFormula, 'accuracy*0.55+fluency*0.25+completion*0.20');
  assert.equal(records[0].providerSuggestedScore, 66);
  assert.equal(records[0].scoreProvider, 'tencent-soe');
  assert.equal(reportDate, '2026-07-22');
  assert.equal(result.attempt.attemptId, 'attempt-1');
});

test('家长预览 SOE 跟读评分不写学生记录', async (t) => {
  let addCount = 0;
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'parent' }, child: { childId: 'child-1' } },
    today: '2026-07-22'
  }));
  t.mock.method(study, 'isStudyWriteAllowed', () => false);
  t.mock.method(speakingEngine, 'evaluateSpeakingPronunciation', async () => ({ score: 90, accuracy: 90, fluency: 90, completion: 100 }));
  t.mock.method(attemptRepository, 'add', async () => {
    addCount += 1;
    return 'unexpected';
  });

  const result = await speakingService.evaluateSpeakingPronunciation({
    payload: {
      category: 'speaking',
      taskId: 'sentence-1',
      attemptType: 'standalone_sentence_repeat',
      planRunType: 'preview',
      answerAudioFileId: 'cloud://test/repeat.mp3',
      refText: 'Read this sentence.'
    }
  });

  assert.equal(addCount, 0);
  assert.equal(result.pronunciation.score, 90);
  assert.equal(result.attempt, undefined);
});
