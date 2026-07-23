const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const storageAdapter = require('../adapters/storage.adapter');
const dbAdapter = require('../adapters/db.adapter');
const speakingEngine = require('../lib/speaking-engine');
const catalogService = require('./catalog.service');
const crypto = require('crypto');
const https = require('https');

const IELTS_PROMPT_AUDIO_COLLECTION = 'ieltsSpeakingPromptAudios';
const IELTS_PROMPT_AUDIO_VERSION = 'v1';
const IELTS_PROMPT_JOB_STALE_MS = 4 * 60 * 1000;

function normalizePromptText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildCuePrompt(task) {
  return [
    String(task && task.task || '').trim(),
    'You should say:',
    ...((task && task.cuePoints) || []).map((item) => `• ${String(item || '').trim()}`),
    String(task && task.closingPrompt || '').trim()
  ].filter(Boolean).join('\n');
}

function collectApprovedIeltsPrompts(item, exerciseId) {
  const prompts = [];
  (item && item.exercises || []).forEach((exercise) => {
    if (!exerciseId || String(exercise.id || '') === exerciseId) prompts.push(exercise.prompt);
  });
  (item && item.parts || []).forEach((part) => {
    (part.topics || []).forEach((topic) => {
      (topic.questions || []).forEach((question) => {
        if (!exerciseId || String(question.exerciseId || '') === exerciseId) prompts.push(question.prompt);
      });
    });
    (part.tasks || []).forEach((task) => {
      if (!exerciseId || String(task.exerciseId || '') === exerciseId) prompts.push(buildCuePrompt(task));
    });
  });
  return new Set(prompts.map(normalizePromptText).filter(Boolean));
}

function buildIeltsIntroPrompt(topicTitle) {
  const topic = String(topicTitle || '').trim();
  return topic
    ? `Now, in this first part, I'd like to ask you some questions about yourself. Let's talk about ${topic}.`
    : "Now, in this first part, I'd like to ask you some questions about yourself.";
}

function collectApprovedIeltsIntroPrompts(item) {
  const prompts = [];
  (item && item.parts || []).forEach((part) => {
    if (Number(part && part.part || 0) !== 1) return;
    (part.topics || []).forEach((topic) => prompts.push(buildIeltsIntroPrompt(topic && topic.title)));
  });
  if (!prompts.length) prompts.push(buildIeltsIntroPrompt(''));
  return new Set(prompts.map(normalizePromptText).filter(Boolean));
}

function postTtsJson(url, apiKey, body, timeoutMs = 150000) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      reject(new Error('ielts-prompt-tts-endpoint-invalid'));
      return;
    }
    const payload = JSON.stringify(body || {});
    const request = https.request({
      method: 'POST',
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname || ''}${target.search || ''}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`ielts-prompt-tts-http-${response.statusCode}:${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch (error) {
          reject(new Error(`ielts-prompt-tts-json:${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('ielts-prompt-tts-timeout')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function decodeTtsAudio(response) {
  const raw = String(response && response.data && response.data.audio || response && response.audio || '').trim();
  if (!raw) throw new Error('ielts-prompt-tts-audio-empty');
  const buffer = /^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (buffer.length < 512) throw new Error('ielts-prompt-tts-audio-invalid');
  return buffer;
}

function isMissingDocumentError(error) {
  const message = String(error && (error.errMsg || error.message || error) || '');
  return message.includes('-502005') || /document.*not exist|not found/i.test(message);
}

async function getPromptAudioDocument(cacheKey) {
  try {
    const result = await dbAdapter.collection(IELTS_PROMPT_AUDIO_COLLECTION).doc(cacheKey).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) return null;
    throw error;
  }
}

async function resolvePromptAudio(item) {
  if (!item || item.status !== 'ready' || !item.audioFileId && !item.audioCloudPath) return null;
  const audioUrl = await storageAdapter.getTempFileURL(item.audioFileId, item.audioCloudPath);
  return audioUrl ? Object.assign({}, item, { audioUrl }) : null;
}

async function acquirePromptAudioJob(cacheKey, metadata) {
  const now = new Date().toISOString();
  return dbAdapter.db.runTransaction(async (transaction) => {
    const reference = transaction.collection(IELTS_PROMPT_AUDIO_COLLECTION).doc(cacheKey);
    let current = null;
    try {
      const result = await reference.get();
      current = result && result.data ? result.data : null;
    } catch (error) {
      if (!isMissingDocumentError(error)) throw error;
    }
    if (current && current.status === 'ready' && (current.audioFileId || current.audioCloudPath)) {
      return { state: 'ready', item: current };
    }
    const startedAt = Date.parse(current && current.generationStartedAt || '');
    if (current && current.status === 'generating' && Number.isFinite(startedAt) && Date.now() - startedAt < IELTS_PROMPT_JOB_STALE_MS) {
      return { state: 'generating' };
    }
    await reference.set({
      data: Object.assign({}, metadata, {
        cacheKey,
        status: 'generating',
        generationStartedAt: now,
        createdAt: current && current.createdAt || now,
        updatedAt: now
      })
    });
    return { state: 'acquired' };
  });
}

async function markPromptAudioFailed(cacheKey, error) {
  try {
    await dbAdapter.collection(IELTS_PROMPT_AUDIO_COLLECTION).doc(cacheKey).update({
      data: {
        status: 'failed',
        lastError: String(error && error.message || error || 'unknown').slice(0, 240),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (updateError) {}
}

async function synthesizeIeltsPromptAudio(event) {
  const payload = (event && event.payload) || {};
  const itemId = String(payload.itemId || '').trim();
  const exerciseId = String(payload.exerciseId || '').trim();
  const text = String(payload.text || '').trim().slice(0, 1200);
  const promptType = payload.promptType === 'intro' ? 'intro' : 'question';
  if (!/^ielts-academic-(?:1[0-9]|20|21)-test-\d+-speaking$/i.test(itemId) || promptType === 'question' && !exerciseId || !text) {
    throw new Error('ielts-prompt-audio-invalid');
  }
  const material = await catalogService.getMaterialItem({ payload: { moduleId: 'speaking', itemId } });
  const item = material && material.item;
  const approvedPrompts = promptType === 'intro'
    ? collectApprovedIeltsIntroPrompts(item)
    : collectApprovedIeltsPrompts(item, exerciseId);
  if (!item || !approvedPrompts.has(normalizePromptText(text))) {
    throw new Error('ielts-prompt-audio-not-approved');
  }

  const endpoint = String(process.env.SPEAKING_PROMPT_TTS_ENDPOINT || process.env.GRAMMAR_TTS_ENDPOINT || '').trim();
  const apiKey = String(process.env.SPEAKING_PROMPT_TTS_API_KEY || process.env.GRAMMAR_TTS_API_KEY || '').trim();
  const model = String(process.env.SPEAKING_PROMPT_TTS_MODEL || 'speech-2.8-turbo').trim();
  const voice = String(process.env.SPEAKING_PROMPT_TTS_VOICE || 'English_Trustworth_Man').trim();
  const speedValue = Number(process.env.SPEAKING_PROMPT_TTS_SPEED || 0.95);
  const speed = Number.isFinite(speedValue) ? Math.min(1.2, Math.max(0.75, speedValue)) : 0.95;
  if (!endpoint || !apiKey) throw new Error('ielts-prompt-tts-missing-env');

  const textHash = crypto.createHash('sha256').update(normalizePromptText(text)).digest('hex');
  const cacheKey = crypto.createHash('sha256').update([IELTS_PROMPT_AUDIO_VERSION, textHash, model, voice, speed, '32000', '64000', 'mono', 'mp3'].join('|')).digest('hex').slice(0, 40);
  const cached = await resolvePromptAudio(await getPromptAudioDocument(cacheKey));
  if (cached) return Object.assign({}, cached, { cached: true, generating: false });

  const metadata = { itemId, exerciseId, promptType, textHash, text, model, voice, speed, version: IELTS_PROMPT_AUDIO_VERSION };
  const job = await acquirePromptAudioJob(cacheKey, metadata);
  if (job.state === 'generating') {
    return { cacheKey, cached: false, generating: true, retryAfterMs: 1500, model, voice };
  }
  if (job.state === 'ready') {
    const ready = await resolvePromptAudio(job.item);
    if (ready) return Object.assign({}, ready, { cached: true, generating: false });
  }

  try {
    const response = await postTtsJson(endpoint, apiKey, {
      model,
      text,
      stream: false,
      voice_setting: { voice_id: voice, speed, vol: 1, pitch: 0, emotion: 'neutral' },
      audio_setting: { sample_rate: 32000, bitrate: 64000, format: 'mp3', channel: 1 },
      subtitle_enable: false
    });
    if (response && response.base_resp && Number(response.base_resp.status_code || 0) !== 0) {
      throw new Error(`ielts-prompt-tts-provider:${response.base_resp.status_msg || response.base_resp.status_code}`);
    }
    const audioBuffer = decodeTtsAudio(response);
    const contentHash = crypto.createHash('sha1').update(audioBuffer).digest('hex');
    const modelSlug = model.replace(/[^a-z0-9.-]+/gi, '-');
    const audioCloudPath = `_speaking_prompt_audio/${IELTS_PROMPT_AUDIO_VERSION}/${contentHash.slice(0, 20)}-${modelSlug}-32k-mono-64k.mp3`;
    const uploaded = await storageAdapter.uploadCloudFileBuffer(audioCloudPath, audioBuffer);
    const audioFileId = uploaded && uploaded.fileId || '';
    const audioUrl = await storageAdapter.getTempFileURL(audioFileId, audioCloudPath);
    if (!audioFileId || !audioUrl) throw new Error('ielts-prompt-tts-upload-failed');
    const now = new Date().toISOString();
    await dbAdapter.collection(IELTS_PROMPT_AUDIO_COLLECTION).doc(cacheKey).set({
      data: Object.assign({}, metadata, {
        cacheKey,
        status: 'ready',
        audioFileId,
        audioCloudPath,
        contentHash,
        audioSpec: 'mp3-32k-mono-64k',
        generationFinishedAt: now,
        createdAt: now,
        updatedAt: now
      })
    });
    return { audioUrl, audioFileId, audioCloudPath, cacheKey, cached: false, generating: false, model, voice };
  } catch (error) {
    await markPromptAudioFailed(cacheKey, error);
    throw error;
  }
}

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
    ieltsPart: Number(payload.ieltsPart || 0),
    questionViewKey: String(payload.questionViewKey || '').trim(),
    audioFormat: 'mp3',
    questionText: String(payload.questionText || '').trim(),
    promptText: String(payload.promptText || '').trim(),
    answerAudioFileId: String(payload.answerAudioFileId || '').trim(),
    answerCloudPath: String(payload.answerCloudPath || '').trim(),
    answerDurationMs: Number(payload.answerDurationMs || payload.recordDurationMs || 0)
  };
}

function enforceIeltsPersistenceRole(attempt, ctx) {
  if (attempt.attemptType !== 'ielts_speaking') return attempt;
  return Object.assign({}, attempt, {
    planRunType: study.isStudyWriteAllowed(ctx) ? 'normal' : 'preview'
  });
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

function normalizeTaskSnapshot(snapshot, attempt) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  const taskId = String(snapshot.taskId || '').trim();
  if (taskId && taskId !== attempt.taskId) {
    return null;
  }
  const category = String(snapshot.category || '').trim();
  if (category && category !== attempt.category) {
    return null;
  }
  return Object.assign({}, snapshot, {
    category: attempt.category || category,
    taskId: attempt.taskId || taskId
  });
}

async function createSpeakingUploadUrl(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'createSpeakingUploadUrl'
  }));
  const payload = (event && event.payload) || {};
  const attempt = enforceIeltsPersistenceRole(normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today
  })), ctx);
  if (attempt.planRunType !== 'preview' && !study.isStudyWriteAllowed(ctx)) {
    throw new Error('家长模式不上传录音');
  }
  const scope = study.getUserScope(ctx);
  const now = Date.now();
  const audioFormat = 'mp3';
  const cloudPath = [
    '_speaking',
    scope.familyId,
    scope.childId,
    attempt.date || today,
    attempt.category,
    attempt.taskId,
    `${attempt.attemptType || 'attempt'}-${attempt.attemptIndex || 0}-${attempt.sentenceIndex || 0}-${now}.${audioFormat}`
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
  const attempt = enforceIeltsPersistenceRole(normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today
  })), ctx);
  if (attempt.planRunType !== 'preview' && !study.isStudyWriteAllowed(ctx)) {
    throw new Error('家长模式不计入训练');
  }
  const scope = study.getUserScope(ctx);
  const task = normalizeTaskSnapshot(payload.taskSnapshot, attempt) || await resolveTaskForPayload(ctx, attempt, today);
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
  if (scoreResult.feedback && scoreResult.status === 'scored' && String(process.env.SPEAKING_TTS_SYNC || '').trim() === '1') {
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
    ieltsOverallBand: Number(scoreResult.ieltsOverallBand || 0),
    ieltsFluencyCoherenceBand: Number(scoreResult.ieltsFluencyCoherenceBand || 0),
    ieltsLexicalResourceBand: Number(scoreResult.ieltsLexicalResourceBand || 0),
    ieltsGrammaticalRangeAccuracyBand: Number(scoreResult.ieltsGrammaticalRangeAccuracyBand || 0),
    ieltsPronunciationBand: Number(scoreResult.ieltsPronunciationBand || 0),
    ieltsAssessmentScope: scoreResult.ieltsAssessmentScope || '',
    ieltsDescriptorVersion: scoreResult.ieltsDescriptorVersion || '',
    scoreModel: scoreResult.scoreModel || '',
    pronunciationProvider: scoreResult.pronunciationProvider || '',
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
  if (attempt.planRunType === 'preview') {
    const previewAttempt = formatAttemptForClient(Object.assign({}, record, {
      attemptId: `preview-${Date.now()}`,
      resultRole: '试做'
    }));
    return {
      attempt: previewAttempt,
      attempts: [previewAttempt],
      summary: speakingEngine.summarizeAttempts([previewAttempt])
    };
  }
  const attemptId = await attemptRepository.add(record);
  if (study.normalizeStudyRole(ctx.member) === 'student') {
    try {
      await study.upsertDailyReport(scope, record.date);
    } catch (error) {
      console.warn('[speaking-report-upsert-failed]', String(error && error.message || error || ''));
    }
  }
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

async function evaluateSpeakingPronunciation(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'evaluateSpeakingPronunciation'
  }));
  const payload = (event && event.payload) || {};
  const attempt = normalizeAttemptPayload(Object.assign({}, payload, {
    targetDate: payload.targetDate || today,
    promptText: payload.promptText || payload.refText || payload.questionText
  }));
  if (attempt.planRunType !== 'preview' && !study.isStudyWriteAllowed(ctx)) {
    throw new Error('家长模式不进行口语评分');
  }
  const result = await speakingEngine.evaluateSpeakingPronunciation(Object.assign({}, attempt, {
    refText: payload.refText || attempt.promptText || attempt.questionText
  }));
  if (attempt.planRunType === 'preview') {
    return { pronunciation: result };
  }
  const scope = study.getUserScope(ctx);
  const promptText = payload.refText || attempt.promptText || attempt.questionText;
  const now = new Date().toISOString();
  const record = Object.assign({}, attempt, {
    familyId: scope.familyId,
    childId: scope.childId,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    date: attempt.date || today,
    promptText,
    questionText: promptText,
    score: Number(result.score || 0),
    pronunciationAccuracyScore: Number(result.accuracy || 0),
    pronunciationFluencyScore: Number(result.fluency || 0),
    pronunciationCompletionScore: Number(result.completion || 0),
    contentGrammarScore: 0,
    feedback: result.feedback || '',
    scoreFormula: result.scoreFormula || '',
    providerSuggestedScore: result.providerSuggestedScore !== null
      && result.providerSuggestedScore !== ''
      && Number.isFinite(Number(result.providerSuggestedScore))
      ? Number(result.providerSuggestedScore)
      : null,
    status: 'scored',
    scoreProvider: 'tencent-soe',
    scoreRequestId: result.requestId || '',
    scoreProviderStatus: result.status || '',
    createdAt: now,
    updatedAt: now
  });
  const attemptId = await attemptRepository.add(record);
  if (study.normalizeStudyRole(ctx.member) === 'student') {
    try {
      await study.upsertDailyReport(scope, record.date);
    } catch (error) {
      console.warn('[speaking-pronunciation-report-upsert-failed]', String(error && error.message || error || ''));
    }
  }
  return {
    pronunciation: result,
    attempt: formatAttemptForClient(Object.assign({}, record, { attemptId }))
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
  const attempts = attempt.category && attempt.taskId
    ? await attemptRepository.findBestAndLatestByTask(scope, {
      date: attempt.date || today,
      category: attempt.category,
      taskId: attempt.taskId,
      attemptType: attempt.attemptType
    })
    : await attemptRepository.findByDate(scope, attempt.date || today);
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
  if (existing.planRunType !== 'preview' && !study.isStudyWriteAllowed(ctx)) {
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
    ieltsOverallBand: Number(scoreResult.ieltsOverallBand || 0),
    ieltsFluencyCoherenceBand: Number(scoreResult.ieltsFluencyCoherenceBand || 0),
    ieltsLexicalResourceBand: Number(scoreResult.ieltsLexicalResourceBand || 0),
    ieltsGrammaticalRangeAccuracyBand: Number(scoreResult.ieltsGrammaticalRangeAccuracyBand || 0),
    ieltsPronunciationBand: Number(scoreResult.ieltsPronunciationBand || 0),
    ieltsAssessmentScope: scoreResult.ieltsAssessmentScope || '',
    ieltsDescriptorVersion: scoreResult.ieltsDescriptorVersion || '',
    scoreModel: scoreResult.scoreModel || '',
    pronunciationProvider: scoreResult.pronunciationProvider || '',
    studentTranscript: scoreResult.transcript || '',
    feedback: scoreResult.feedback || '',
    status: scoreResult.status || 'saved',
    scoreError: scoreResult.error || '',
    scoreErrorType: scoreResult.errorType || '',
    updatedAt: now
  };
  await attemptRepository.update(attemptId, patch);
  try {
    await study.upsertDailyReport(scope, existing.date || today);
  } catch (error) {
    console.warn('[speaking-report-upsert-failed]', String(error && error.message || error || ''));
  }
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
  synthesizeIeltsPromptAudio,
  createSpeakingUploadUrl,
  submitSpeakingAttempt,
  evaluateSpeakingPronunciation,
  getSpeakingAttempts,
  rescoreSpeakingAttempt
};
