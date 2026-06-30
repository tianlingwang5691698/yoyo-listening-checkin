const https = require('https');
const storageAdapter = require('./adapters/storage.adapter');
const speakingEnginePatch = require('./lib/speaking-engine');

process.env.SPEAKING_CONTENT_SCORE_MODEL = process.env.SPEAKING_CONTENT_SCORE_MODEL
  || process.env.SPEAKING_CONTENT_SCORE_MODE
  || 'doubao-seed-2-1-pro-260628';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const request = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: Object.assign({}, headers, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }),
      timeout: 22000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`score-http-${response.statusCode || 0}:${text.slice(0, 120)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('score-timeout')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function postMultipart(url, headers, fields, file) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const boundary = `----yoyo${Date.now()}${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    Object.keys(fields || {}).forEach((name) => {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${fields[name]}\r\n`));
    });
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer));
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const payload = Buffer.concat(chunks);
    const request = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: Object.assign({}, headers, {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length
      }),
      timeout: 22000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`transcribe-http-${response.statusCode || 0}:${text.slice(0, 120)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('transcribe-timeout')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function parseJsonText(text) {
  const raw = normalizeText(text);
  const matched = raw.match(/\{[\s\S]*\}/);
  if (!matched) {
    return {};
  }
  try {
    return JSON.parse(matched[0]);
  } catch (error) {
    return {};
  }
}

function extractMessageText(content) {
  if (Array.isArray(content)) {
    return content.map((item) => (
      item && typeof item === 'object'
        ? (item.text || item.transcript || item.content || item.output_text || '')
        : item
    )).join(' ');
  }
  if (content && typeof content === 'object') {
    return content.text || content.transcript || content.content || JSON.stringify(content);
  }
  return String(content || '');
}

function extractAudioResult(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message
    : {};
  const contentText = extractMessageText(message.content);
  const audioText = message.audio
    ? extractMessageText(message.audio.transcript || message.audio.content || message.audio)
    : '';
  const parsed = parseJsonText(contentText) || {};
  return {
    pronunciationFluencyScore: Math.max(0, Math.min(100, Number(parsed.pronunciationFluencyScore || parsed.pronunciationScore || 75))),
    rawText: normalizeText(contentText || audioText).slice(0, 160)
  };
}

async function scoreAudio(endpoint, authHeaders, model, audioBuffer) {
  const audioData = await postJson(endpoint, authHeaders, {
    model,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: [
          'Grade only pronunciation and fluency from this child English audio.',
          'Return JSON only: {"pronunciationFluencyScore":number}.',
          'Score 0-100. Be lenient on child accent unless it blocks understanding.'
        ].join('\n')
      }, {
        type: 'input_audio',
        input_audio: {
          data: audioBuffer.toString('base64'),
          format: 'mp3'
        }
      }]
    }]
  });
  return extractAudioResult(audioData);
}

function inferTranscribeEndpoint(endpoint) {
  const raw = String(endpoint || '').replace(/\/chat\/completions\/?$/, '/audio/transcriptions');
  return raw.trim();
}

function normalizeTranscribeEndpoint(endpoint) {
  return String(endpoint || '').trim();
}

async function transcribeAudio(endpoint, authHeaders, model, audioBuffer) {
  const data = await postMultipart(endpoint, authHeaders, {
    model,
    language: 'en',
    prompt: 'This is a child answering or repeating a short English lesson sentence.'
  }, {
    name: 'file',
    filename: 'answer.mp3',
    contentType: 'audio/mpeg',
    buffer: audioBuffer
  });
  return normalizeText(data && (data.text || data.transcript || data.output_text));
}

async function transcribeAudioByChat(endpoint, authHeaders, model, audioBuffer) {
  const data = await postJson(endpoint, authHeaders, {
    model,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: [
          'Listen to this child English audio and transcribe the student answer.',
          'Return JSON only: {"transcript":"exact English words you hear"}.',
          'If there is any understandable English, write it. Do not translate.'
        ].join('\n')
      }, {
        type: 'input_audio',
        input_audio: {
          data: audioBuffer.toString('base64'),
          format: 'mp3'
        }
      }]
    }]
  });
  const message = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message
    : {};
  const parsed = parseJsonText(extractMessageText(message.content));
  return normalizeText(parsed.transcript || extractMessageText(message.audio && message.audio.transcript));
}

function fallbackSpeakingScore(payload, error) {
  const isQuestion = String(payload && payload.attemptType || '') === 'nce_question_answer';
  const promptText = normalizeText(payload && (payload.promptText || payload.questionText));
  return {
    score: 0,
    pronunciationFluencyScore: 0,
    contentGrammarScore: 0,
    transcript: '',
    feedback: isQuestion
      ? `录音已保存，但模型评分暂时失败。请稍后重新提交评分：${promptText || '请根据原文信息回答。'}`
      : '录音已保存，但模型评分暂时失败。请稍后重新提交评分。',
    status: 'score-pending',
    error: String(error && error.message || error || 'model-fallback'),
    errorType: 'model-fallback'
  };
}

async function scoreSpeakingAttemptLegacy(payload) {
  const endpoint = String(process.env.SPEAKING_SCORE_ENDPOINT || '').trim();
  const transcribeEndpoint = normalizeTranscribeEndpoint(process.env.SPEAKING_TRANSCRIBE_ENDPOINT || inferTranscribeEndpoint(endpoint));
  const apiKey = String(process.env.SPEAKING_SCORE_API_KEY || '').trim();
  const audioModel = String(process.env.SPEAKING_AUDIO_TRANSCRIBE_MODEL || '').trim();
  const audioModels = [...new Set([audioModel].filter(Boolean))];
  const transcribeModel = String(process.env.SPEAKING_TRANSCRIBE_MODEL || 'gpt-4o-transcribe').trim();
  const contentModel = String(process.env.SPEAKING_CONTENT_SCORE_MODEL || 'doubao-seed-2-1-pro-260628').trim();
  if (!endpoint || !transcribeEndpoint) {
    return fallbackSpeakingScore(payload, 'missing-endpoint');
  }
  try {
    const audioBuffer = await storageAdapter.downloadCloudFileBuffer(payload.answerAudioFileId, payload.answerCloudPath);
    const authHeaders = { authorization: apiKey ? `Bearer ${apiKey}` : '' };
    let transcript = '';
    try {
      transcript = await transcribeAudio(transcribeEndpoint, authHeaders, transcribeModel, audioBuffer);
    } catch (error) {
      let fallbackError = error;
      for (const model of audioModels) {
        try {
          transcript = await transcribeAudioByChat(endpoint, authHeaders, model, audioBuffer);
          if (transcript) break;
        } catch (modelError) {
          fallbackError = modelError;
        }
      }
      if (!transcript) {
        return {
          score: 0,
          pronunciationFluencyScore: 0,
          contentGrammarScore: 0,
          transcript: '',
          feedback: '录音已保存，但这次语音转文字没有成功，请稍后重试或重新录音。',
          status: 'score-pending',
          error: String(fallbackError && fallbackError.message || 'transcribe-failed'),
          errorType: 'audio-transcript'
        };
      }
    }
    let pronunciationFluencyScore = 75;
    for (const model of audioModels) {
      try {
        const audioResult = await scoreAudio(endpoint, authHeaders, model, audioBuffer);
        pronunciationFluencyScore = audioResult.pronunciationFluencyScore;
        break;
      } catch (error) {
        pronunciationFluencyScore = 75;
      }
    }
    if (!transcript) {
      return {
        score: 0,
        pronunciationFluencyScore: 0,
        contentGrammarScore: 0,
        transcript: '',
        feedback: '这次录音没有识别到清晰英文回答，请重新录音后再提交评分。',
        status: 'score-pending',
        error: 'empty-transcript',
        errorType: 'audio-transcript'
      };
    }

    const isRepeat = String(payload.attemptType || '') === 'unlock_sentence_repeat';
    const contentPrompt = isRepeat ? [
      'You are grading a child English sentence repeat. Use a warm, encouraging Chinese tone.',
      'Return JSON only: {"contentScore":number,"feedback":"short encouraging Chinese feedback","suggestedAnswer":"the target sentence"}.',
      'Compare Target sentence and Student transcript.',
      'contentScore 0-100. Rubric: word accuracy 45, word order 25, completeness 20, naturalness 10.',
      'If the student repeats the target sentence correctly or with only tiny pronunciation/transcription differences, score 85-100.',
      'Feedback rule: first say what was repeated correctly, then mention at most one specific missed/wrong word if any.',
      `Target sentence: ${payload.promptText || ''}`,
      `Student transcript: ${transcript}`
    ] : [
      'You are grading a child English answer. Use a warm, encouraging Chinese tone.',
      'Return JSON only: {"contentScore":number,"feedback":"short encouraging Chinese feedback","suggestedAnswer":"one natural English answer"}.',
      'contentScore 0-100. If the student answers the question correctly with acceptable grammar, score 85-100.',
      "For \"Whose handbag is it?\", answers like \"It is the woman's handbag.\" and \"It is her handbag.\" are correct.",
      'Feedback rule: first say what is correct, then give at most one small improvement. Do not say the meaning is only basically correct when the answer is correct.',
      'Suggested answer must be a direct declarative answer, not a question.',
      'Never suggest starters like "Excuse me" or "Is this" for Whose/Who/What answers.',
      `Source lesson text:\n${payload.sourceText || ''}`,
      `Question: ${payload.promptText || payload.questionText || ''}`,
      `Student transcript: ${transcript}`
    ];

    const contentData = await postJson(endpoint, authHeaders, {
      model: contentModel,
      temperature: 0,
      messages: [{
        role: 'user',
        content: contentPrompt.join('\n')
      }]
    });
    const content = contentData && contentData.choices && contentData.choices[0] && contentData.choices[0].message
      ? contentData.choices[0].message.content
      : '';
    const contentParsed = parseJsonText(extractMessageText(content));
    const contentGrammarScore = Math.max(0, Math.min(100, Number(contentParsed.contentScore || 80)));
    const suggestedAnswer = normalizeText(contentParsed.suggestedAnswer);
    const feedback = normalizeText([
      transcript ? `学生回答：${transcript}` : '',
      contentParsed.feedback,
      suggestedAnswer && !/[?？]\s*$/.test(suggestedAnswer) ? `建议回答：${suggestedAnswer}` : ''
    ].filter(Boolean).join(' '));
    return {
      score: Math.round((contentGrammarScore * 0.8) + (pronunciationFluencyScore * 0.2)),
      pronunciationFluencyScore: Math.round(pronunciationFluencyScore),
      contentGrammarScore: Math.round(contentGrammarScore),
      transcript,
      feedback: feedback || fallbackSpeakingScore(payload).feedback,
      status: 'scored'
    };
  } catch (error) {
    return fallbackSpeakingScore(payload, error);
  }
}

const dashboardService = require('./services/dashboard.service');
const levelService = require('./services/level.service');
const taskService = require('./services/task.service');
const familyService = require('./services/family.service');
const reportService = require('./services/report.service');
const identityService = require('./services/identity.service');
const catalogService = require('./services/catalog.service');
const speakingService = require('./services/speaking.service');
const readingService = require('./services/reading.service');
const grammarService = require('./services/grammar.service');
const completionService = require('./services/completion.service');
const writingService = require('./services/writing.service');
const monitor = require('./lib/monitor');

if (!taskService.__autoCheckinAfterListeningPatch) {
  const originalMarkTaskListened = taskService.markTaskListened;
  taskService.markTaskListened = async function patchedMarkTaskListened(event, context) {
    const detail = await originalMarkTaskListened(event, context);
    const payload = (event && event.payload) || {};
    if (!detail || detail.syncMode === 'cloud-error' || !detail.checkinReady || String(payload.planRunType || 'normal') !== 'normal') {
      return detail;
    }
    try {
      const checkinData = await taskService.completeTodayCheckin(event, context);
      return Object.assign({}, detail, {
        child: checkinData.child || detail.child,
        stats: checkinData.stats || detail.stats,
        todayRecord: checkinData.todayRecord || detail.todayRecord,
        activeTaskCount: checkinData.activeTaskCount,
        completedTaskCountToday: checkinData.completedTaskCountToday,
        allDailyDone: checkinData.allDailyDone,
        checkinReady: false
      });
    } catch (error) {
      return detail;
    }
  };
  taskService.__autoCheckinAfterListeningPatch = true;
}

const actionMap = {
  bootstrap: identityService.bootstrap,
  getMaterialIndex: catalogService.getMaterialIndex,
  getDashboard: dashboardService.getDashboard,
  getLevelOverview: levelService.getLevelOverview,
  getTaskDetail: taskService.getTaskDetail,
  getTaskTranscript: taskService.getTaskTranscript,
  markTaskListened: taskService.markTaskListened,
  createSpeakingUploadUrl: speakingService.createSpeakingUploadUrl,
  submitSpeakingAttempt: speakingService.submitSpeakingAttempt,
  rescoreSpeakingAttempt: speakingService.rescoreSpeakingAttempt,
  getSpeakingAttempts: speakingService.getSpeakingAttempts,
  completeTodayCheckin: taskService.completeTodayCheckin,
  getProfileData: familyService.getProfileData,
  getFamilyPage: familyService.getFamilyPage,
  refreshInviteCode: familyService.refreshInviteCode,
  joinFamily: familyService.joinFamily,
  joinFamilyByChildCode: familyService.joinFamilyByChildCode,
  leaveFamily: familyService.leaveFamily,
  updateChildProfile: familyService.updateChildProfile,
  setStudyRole: identityService.setStudyRole,
  undoLastListened: identityService.undoLastListened,
  updateSubscription: familyService.updateSubscription,
  getHeatmap: reportService.getHeatmap,
  getMonthHeatmap: reportService.getMonthHeatmap,
  getDailyReportByDate: reportService.getDailyReportByDate,
  getParentDashboard: reportService.getParentDashboard,
  getReadingHome: readingService.getReadingHome,
  getReadingPassage: readingService.getReadingPassage,
  getReadingStudyPack: readingService.getReadingStudyPack,
  synthesizeReadingAudio: readingService.synthesizeReadingAudio,
  lookupWord: readingService.lookupWord,
  submitReadingAttempt: readingService.submitReadingAttempt,
  getGrammarHome: grammarService.getGrammarHome,
  getGrammarTopic: grammarService.getGrammarTopic,
  recordGrammarWrong: grammarService.recordGrammarWrong,
  getGrammarWrongBook: grammarService.getGrammarWrongBook,
  getGrammarProgress: grammarService.getGrammarProgress,
  recordGrammarProgress: grammarService.recordGrammarProgress,
  explainGrammarQuestion: grammarService.explainGrammarQuestion,
  submitWritingAttempt: writingService.submitWritingAttempt,
  getWritingAttempts: writingService.getWritingAttempts,
  recordStudyCompletion: completionService.recordStudyCompletion,
  getStudyCompletions: completionService.getStudyCompletions
};

const MONITORED_ACTIONS = new Set([
  'getDashboard',
  'getMaterialIndex',
  'getTaskDetail',
  'getTaskTranscript',
  'markTaskListened',
  'createSpeakingUploadUrl',
  'submitSpeakingAttempt',
  'rescoreSpeakingAttempt',
  'getSpeakingAttempts',
  'completeTodayCheckin',
  'getProfileData',
  'getFamilyPage',
  'joinFamilyByChildCode',
  'leaveFamily',
  'setStudyRole',
  'getMonthHeatmap',
  'getDailyReportByDate',
  'getParentDashboard',
  'getReadingHome',
  'getReadingPassage',
  'getReadingStudyPack',
  'synthesizeReadingAudio',
  'lookupWord',
  'submitReadingAttempt',
  'getGrammarHome',
  'getGrammarTopic',
  'recordGrammarWrong',
  'getGrammarWrongBook',
  'getGrammarProgress',
  'recordGrammarProgress',
  'explainGrammarQuestion',
  'submitWritingAttempt',
  'getWritingAttempts',
  'recordStudyCompletion',
  'getStudyCompletions'
]);

exports.main = async (event, context) => {
  const action = String((event && event.action) || '').trim();
  const handler = actionMap[action];
  if (!handler) {
    throw new Error(`unsupported action: ${action}`);
  }

  const startedAt = Date.now();
  let result;
  try {
    result = await handler(event || {}, context || {});
  } catch (error) {
    monitor.logError('cloudfn', action, error, {
      duration: `${Date.now() - startedAt}ms`
    });
    throw error;
  }
  const durationMs = Date.now() - startedAt;

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    if (MONITORED_ACTIONS.has(action)) {
      monitor.logPerf('cloudfn', action, durationMs, { shape: 'primitive' });
    }
    return result;
  }

  const finalResult = Object.assign({}, result, {
    resourceDebug: result.resourceDebug || catalogService.getResourceDebugSnapshot()
  });
  if (MONITORED_ACTIONS.has(action)) {
    const payloadSize = Buffer.byteLength(JSON.stringify(finalResult), 'utf8');
    monitor.logPerf('cloudfn', action, durationMs, { payload: `${payloadSize}B` });
  }
  return finalResult;
};
