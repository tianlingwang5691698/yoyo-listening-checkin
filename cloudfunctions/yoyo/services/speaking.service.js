const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const storageAdapter = require('../adapters/storage.adapter');
const speakingEngine = require('../lib/speaking-engine');

function normalizeAttemptPayload(payload) {
  return {
    category: String(payload.category || '').trim(),
    taskId: String(payload.taskId || '').trim(),
    date: String(payload.targetDate || payload.date || '').slice(0, 10),
    planRunType: String(payload.planRunType || 'normal').trim(),
    planDayIndex: Number(payload.planDayIndex || 0),
    attemptType: String(payload.attemptType || '').trim(),
    attemptIndex: Number(payload.attemptIndex || 0),
    sentenceIndex: Number(payload.sentenceIndex || 0),
    questionText: String(payload.questionText || '').trim(),
    promptText: String(payload.promptText || '').trim(),
    answerAudioFileId: String(payload.answerAudioFileId || '').trim(),
    answerCloudPath: String(payload.answerCloudPath || '').trim(),
    answerDurationMs: Number(payload.answerDurationMs || payload.recordDurationMs || 0)
  };
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}秒` : '';
}

function formatAttemptForClient(record) {
  const answerDurationMs = Number(record && (record.answerDurationMs || record.recordDurationMs || 0));
  return Object.assign({}, record, {
    attemptId: (record && (record.attemptId || record._id)) || '',
    answerDurationMs,
    answerDurationText: formatDuration(answerDurationMs)
  });
}

async function resolveTaskForPayload(ctx, attempt, today) {
  const progressRecords = await study.getChildProgressRecords(study.getUserScope(ctx));
  const checkins = await study.getCheckins(study.getUserScope(ctx));
  const planDayIndex = attempt.planDayIndex || study.getPlanDayIndexForDate(checkins, attempt.date || today);
  const plan = study.buildPlanForDay(planDayIndex);
  const tasks = study.decoratePlannedTasks(progressRecords, ctx.child.childId, attempt.category, attempt.date || today, plan.byCategory[attempt.category] || [], {
    planRunType: attempt.planRunType,
    targetDate: attempt.date || today,
    planDayIndex
  });
  return tasks.find((item) => item.taskId === attempt.taskId) || tasks[0] || null;
}

async function createSpeakingUploadUrl(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'createSpeakingUploadUrl'
  }));
  const payload = (event && event.payload) || {};
  const attempt = normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today
  }));
  if (attempt.planRunType !== 'preview' && study.normalizeStudyRole(ctx.member) !== 'student') {
    throw new Error('家长模式不上传录音');
  }
  const scope = study.getUserScope(ctx);
  const now = Date.now();
  const cloudPath = [
    '_speaking',
    scope.familyId,
    scope.childId,
    attempt.date || today,
    attempt.category,
    attempt.taskId,
    `${attempt.attemptType || 'attempt'}-${attempt.attemptIndex || 0}-${attempt.sentenceIndex || 0}-${now}.mp3`
  ].join('/');
  return {
    cloudPath,
    fileId: storageAdapter.buildCloudFileId(cloudPath)
  };
}

async function submitSpeakingAttempt(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'submitSpeakingAttempt'
  }));
  const payload = (event && event.payload) || {};
  const attempt = normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today
  }));
  if (attempt.planRunType !== 'preview' && study.normalizeStudyRole(ctx.member) !== 'student') {
    throw new Error('家长模式不计入训练');
  }
  const scope = study.getUserScope(ctx);
  const task = await resolveTaskForPayload(ctx, attempt, today);
  let questionMeta = null;
  let sourceText = '';
  if (attempt.attemptType === 'nce_question_answer') {
    const transcriptBundle = await study.getTranscriptBundle(task || {
      category: attempt.category,
      taskId: attempt.taskId
    });
    questionMeta = speakingEngine.findQuestionFromTranscript(transcriptBundle.transcriptTrack);
    sourceText = speakingEngine.buildSourceTextFromTranscript(transcriptBundle.transcriptTrack);
  }
  const promptText = attempt.promptText || attempt.questionText || (questionMeta && questionMeta.questionText) || '';
  const scoreResult = await speakingEngine.scoreSpeakingAttempt(Object.assign({}, attempt, {
    promptText,
    sourceText,
    taskTitle: task ? task.title : ''
  }));
  const now = new Date().toISOString();
  let feedbackAudio = null;
  if (scoreResult.feedback && scoreResult.status === 'scored') {
    try {
      feedbackAudio = await speakingEngine.synthesizeFeedbackAudio(scoreResult.feedback, [
        '_speaking_feedback',
        scope.familyId,
        scope.childId,
        attempt.date || today,
        attempt.category,
        attempt.taskId,
        `${attempt.attemptType || 'attempt'}-${attempt.attemptIndex || 0}-${attempt.sentenceIndex || 0}-${Date.now()}.mp3`
      ].join('/'));
    } catch (error) {
      feedbackAudio = {
        error: String(error && error.message || error || '')
      };
    }
  }
  const record = Object.assign({}, attempt, questionMeta || {}, {
    promptText,
    questionText: attempt.questionText || (questionMeta && questionMeta.questionText) || '',
    familyId: scope.familyId,
    childId: scope.childId,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    date: attempt.date || today,
    score: Number(scoreResult.score || 0),
    pronunciationFluencyScore: Number(scoreResult.pronunciationFluencyScore || 0),
    contentGrammarScore: Number(scoreResult.contentGrammarScore || 0),
    studentTranscript: scoreResult.transcript || '',
    feedback: scoreResult.feedback || '',
    feedbackAudioFileId: feedbackAudio && feedbackAudio.fileId ? feedbackAudio.fileId : '',
    feedbackAudioCloudPath: feedbackAudio && feedbackAudio.cloudPath ? feedbackAudio.cloudPath : '',
    status: scoreResult.status || 'saved',
    scoreError: scoreResult.error || '',
    scoreErrorType: scoreResult.errorType || '',
    feedbackAudioError: feedbackAudio && feedbackAudio.error ? feedbackAudio.error : '',
    answerDurationMs: Number(attempt.answerDurationMs || attempt.recordDurationMs || 0),
    createdAt: now,
    updatedAt: now
  });
  const attemptId = await attemptRepository.add(record);
  const attempts = await attemptRepository.findBestAndLatestByTask(scope, {
    date: record.date,
    category: record.category,
    taskId: record.taskId,
    attemptType: record.attemptType
  });
  return {
    attempt: formatAttemptForClient(Object.assign({}, record, { attemptId })),
    attempts: attempts.map(formatAttemptForClient),
    summary: speakingEngine.summarizeAttempts(attempts)
  };
}

async function getSpeakingAttempts(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getSpeakingAttempts'
  }));
  const payload = (event && event.payload) || {};
  const attempt = normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today
  }));
  const scope = study.getUserScope(ctx);
  const attempts = await attemptRepository.findBestAndLatestByTask(scope, {
    date: attempt.date || today,
    category: attempt.category,
    taskId: attempt.taskId,
    attemptType: attempt.attemptType
  });
  return {
    attempts: attempts.map(formatAttemptForClient),
    summary: speakingEngine.summarizeAttempts(attempts)
  };
}

async function rescoreSpeakingAttempt(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'rescoreSpeakingAttempt'
  }));
  const payload = (event && event.payload) || {};
  const attemptId = String(payload.attemptId || '').trim();
  const existing = await attemptRepository.findById(attemptId);
  const scope = study.getUserScope(ctx);
  if (!existing || existing.familyId !== scope.familyId || existing.childId !== scope.childId) {
    throw new Error('录音记录不存在');
  }
  if (existing.planRunType !== 'preview' && study.normalizeStudyRole(ctx.member) !== 'student') {
    throw new Error('家长模式不计入训练');
  }
  const attempt = normalizeAttemptPayload(Object.assign({}, existing, {
    targetDate: existing.date || today
  }));
  const task = await resolveTaskForPayload(ctx, attempt, today);
  let questionMeta = null;
  let sourceText = '';
  if (attempt.attemptType === 'nce_question_answer') {
    const transcriptBundle = await study.getTranscriptBundle(task || {
      category: attempt.category,
      taskId: attempt.taskId
    });
    questionMeta = speakingEngine.findQuestionFromTranscript(transcriptBundle.transcriptTrack);
    sourceText = speakingEngine.buildSourceTextFromTranscript(transcriptBundle.transcriptTrack);
  }
  const promptText = attempt.promptText || attempt.questionText || (questionMeta && questionMeta.questionText) || '';
  const scoreResult = await speakingEngine.scoreSpeakingAttempt(Object.assign({}, existing, attempt, {
    promptText,
    sourceText,
    taskTitle: task ? task.title : ''
  }));
  const now = new Date().toISOString();
  const patch = {
    promptText,
    questionText: existing.questionText || (questionMeta && questionMeta.questionText) || '',
    score: Number(scoreResult.score || 0),
    pronunciationFluencyScore: Number(scoreResult.pronunciationFluencyScore || 0),
    contentGrammarScore: Number(scoreResult.contentGrammarScore || 0),
    studentTranscript: scoreResult.transcript || '',
    feedback: scoreResult.feedback || '',
    status: scoreResult.status || 'saved',
    scoreError: scoreResult.error || '',
    scoreErrorType: scoreResult.errorType || '',
    updatedAt: now
  };
  await attemptRepository.update(attemptId, patch);
  const attempts = await attemptRepository.findBestAndLatestByTask(scope, {
    date: existing.date || today,
    category: existing.category,
    taskId: existing.taskId,
    attemptType: existing.attemptType
  });
  return {
    attempt: formatAttemptForClient(Object.assign({}, existing, patch, { _id: attemptId })),
    attempts: attempts.map(formatAttemptForClient),
    summary: speakingEngine.summarizeAttempts(attempts)
  };
}

module.exports = {
  createSpeakingUploadUrl,
  submitSpeakingAttempt,
  getSpeakingAttempts,
  rescoreSpeakingAttempt
};
