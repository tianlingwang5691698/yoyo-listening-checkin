const dbAdapter = require('../adapters/db.adapter');
const storageAdapter = require('../adapters/storage.adapter');
const study = require('../facades/study.facade');
const catalog = require('./catalog.service');
const https = require('https');
const crypto = require('crypto');
const { buildListeningReportPdf } = require('../lib/listening-report-pdf');

const STUDY_PACK_COLLECTION = 'listeningStudyPacks';
const STUDY_PACK_JOB_STALE_MS = 4 * 60 * 1000;
const REPORT_ANALYSIS_JOB_STALE_MS = 4 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function postJson(url, apiKey, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(new Error('listening-study-endpoint-invalid'));
      return;
    }
    const data = JSON.stringify(body || {});
    const request = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname || ''}${parsed.search || ''}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeoutMs || 30000
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`listening-study-http-${response.statusCode}:${raw.slice(0, 200)}`));
          return;
        }
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (error) {
          reject(new Error(`listening-study-json:${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('listening-study-timeout')));
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

function extractMessageText(response) {
  if (!response) return '';
  if (Array.isArray(response.choices) && response.choices[0]) {
    const message = response.choices[0].message || {};
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => part.text || part.content || '').join('\n');
    }
  }
  return typeof response.output_text === 'string' ? response.output_text : '';
}

function parseJsonText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    const matched = raw.match(/\{[\s\S]*\}/);
    if (!matched) return null;
    try {
      return JSON.parse(matched[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function normalizeCardList(list, key) {
  return (Array.isArray(list) ? list : [])
    .map((item) => (item && typeof item === 'object' ? item : { [key]: item }))
    .filter((item) => normalizeText(item[key] || item.text || item.word || item.pattern));
}

function normalizeQuestionAnalyses(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => ({
      number: item && item.number,
      answer: normalizeText(item && item.answer),
      evidence: normalizeText(item && (item.evidence || item.answerSentence)),
      evidenceTranslation: normalizeText(item && (item.evidenceTranslation || item.answerSentenceTranslation)),
      analysis: normalizeText(item && (item.analysis || item.text))
    }))
    .filter((item) => item.number !== undefined && item.number !== null);
}

function normalizeStudyPack(pack) {
  return {
    vocabularyCards: normalizeCardList(pack && pack.vocabularyCards, 'word').slice(0, 20),
    phraseCards: normalizeCardList(pack && pack.phraseCards, 'text').slice(0, 16),
    sentencePatternCards: normalizeCardList(pack && pack.sentencePatternCards, 'pattern').slice(0, 10),
    questionAnalyses: normalizeQuestionAnalyses(pack && pack.questionAnalyses),
    source: normalizeText(pack && pack.source)
  };
}

function validateStudyPack(studyPack) {
  if (!studyPack || String(studyPack.source || '').indexOf('model:') !== 0) {
    throw new Error('listening-study-pack-not-model');
  }
  if (!studyPack.vocabularyCards.length) throw new Error('listening-study-pack-missing-vocabulary');
  if (!studyPack.phraseCards.length) throw new Error('listening-study-pack-missing-phrases');
  if (!studyPack.sentencePatternCards.length) throw new Error('listening-study-pack-missing-patterns');
}

function getStudyModelConfig() {
  return {
    endpoint: process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '',
    apiKey: process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '',
    model: process.env.READING_STUDY_MODEL || 'gpt-5.6-terra',
    fallbackModel: process.env.READING_STUDY_FALLBACK_MODEL || 'gpt-5.6-terra'
  };
}

function getStudyPackCacheKey(listeningId) {
  return crypto.createHash('sha256').update(String(listeningId || '')).digest('hex').slice(0, 40);
}

function isMissingDocumentError(error) {
  const message = String(error && (error.errMsg || error.message || error) || '');
  return message.includes('-502005') || /document.*not exist|not found/i.test(message);
}

function normalizeModelUsage(response) {
  const usage = response && response.usage || {};
  const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
  const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage.total_tokens || inputTokens + outputTokens || 0)
  };
}

async function getStudyPackDocument(cacheKey) {
  try {
    const result = await dbAdapter.collection(STUDY_PACK_COLLECTION).doc(cacheKey).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) return null;
    throw error;
  }
}

async function getCachedStudyPack(listeningId) {
  try {
    const direct = await getStudyPackDocument(getStudyPackCacheKey(listeningId));
    if (direct && direct.studyPack) return direct;
    const result = await dbAdapter.collection(STUDY_PACK_COLLECTION)
      .where({ listeningId })
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();
    return (result && result.data || []).find((row) => row && row.studyPack) || null;
  } catch (error) {
    return null;
  }
}

async function acquireStudyPackJob(cacheKey, listeningId, title) {
  const now = new Date().toISOString();
  return dbAdapter.db.runTransaction(async (transaction) => {
    const reference = transaction.collection(STUDY_PACK_COLLECTION).doc(cacheKey);
    let current = null;
    try {
      const result = await reference.get();
      current = result && result.data ? result.data : null;
    } catch (error) {
      if (!isMissingDocumentError(error)) throw error;
    }
    if (current && current.studyPack) return { state: 'ready', item: current };
    const startedAt = Date.parse(current && current.generationStartedAt || '');
    if (current && current.status === 'generating' && Number.isFinite(startedAt) && Date.now() - startedAt < STUDY_PACK_JOB_STALE_MS) {
      return { state: 'generating' };
    }
    await reference.set({
      data: {
        listeningId,
        title,
        status: 'generating',
        generationStartedAt: now,
        createdAt: current && current.createdAt || now,
        updatedAt: now
      }
    });
    return { state: 'acquired' };
  });
}

async function saveStudyPack(cacheKey, listeningId, title, generated) {
  try {
    const now = new Date().toISOString();
    await dbAdapter.collection(STUDY_PACK_COLLECTION).doc(cacheKey).set({
      data: {
        listeningId,
        title,
        studyPack: generated.studyPack,
        source: generated.studyPack.source || '',
        status: 'ready',
        attemptedModels: generated.attemptedModels,
        modelCallCount: generated.modelCallCount,
        modelUsage: generated.modelUsage,
        generationFinishedAt: now,
        createdAt: generated.createdAt || now,
        updatedAt: now
      }
    });
  } catch (error) {
    // Missing cache collection should not block the learner.
  }
}

async function markStudyPackJobFailed(cacheKey, error) {
  try {
    await dbAdapter.collection(STUDY_PACK_COLLECTION).doc(cacheKey).update({
      data: {
        status: 'failed',
        lastError: String(error && error.message || error || 'unknown').slice(0, 500),
        modelCallCount: Number(error && error.modelCallCount || 0),
        attemptedModels: Array.isArray(error && error.attemptedModels) ? error.attemptedModels : [],
        updatedAt: new Date().toISOString()
      }
    });
  } catch (updateError) {}
}

function getReportQuestions(item) {
  return (Array.isArray(item && item.questions) ? item.questions : [])
    .filter((question) => question && question.number !== undefined && question.number !== null);
}

function hasCompleteQuestionAnalyses(studyPack, item) {
  const questions = getReportQuestions(item);
  const analyses = normalizeQuestionAnalyses(studyPack && studyPack.questionAnalyses);
  return questions.length > 0 && questions.every((question) => {
    const analysis = analyses.find((entry) => String(entry.number) === String(question.number));
    return analysis
      && normalizeText(analysis.analysis)
      && normalizeText(analysis.evidence)
      && normalizeText(analysis.evidenceTranslation);
  });
}

async function acquireReportAnalysisJob(cacheKey, listeningId, title) {
  const now = new Date().toISOString();
  return dbAdapter.db.runTransaction(async (transaction) => {
    const reference = transaction.collection(STUDY_PACK_COLLECTION).doc(cacheKey);
    let current = null;
    try {
      const result = await reference.get();
      current = result && result.data ? result.data : null;
    } catch (error) {
      if (!isMissingDocumentError(error)) throw error;
    }
    const startedAt = Date.parse(current && current.reportAnalysisStartedAt || '');
    if (current && current.reportAnalysisStatus === 'generating'
      && Number.isFinite(startedAt)
      && Date.now() - startedAt < REPORT_ANALYSIS_JOB_STALE_MS) {
      return { state: 'generating' };
    }
    await reference.set({
      data: Object.assign({}, current || {}, {
        listeningId,
        title,
        reportAnalysisStatus: 'generating',
        reportAnalysisStartedAt: now,
        createdAt: current && current.createdAt || now,
        updatedAt: now
      })
    });
    return { state: 'acquired' };
  });
}

async function saveReportAnalysis(cacheKey, item, analyses, source) {
  const current = await getStudyPackDocument(cacheKey);
  const now = new Date().toISOString();
  const studyPack = normalizeStudyPack(Object.assign({}, current && current.studyPack || {}, {
    questionAnalyses: analyses,
    source: normalizeText(current && current.studyPack && current.studyPack.source)
      || normalizeText(current && current.source)
      || source
  }));
  await dbAdapter.collection(STUDY_PACK_COLLECTION).doc(cacheKey).set({
    data: Object.assign({}, current || {}, {
      listeningId: item._id || item.id,
      title: item.title || '',
      studyPack,
      reportAnalysisStatus: 'ready',
      reportAnalysisFinishedAt: now,
      updatedAt: now
    })
  });
  return studyPack;
}

async function markReportAnalysisFailed(cacheKey, error) {
  try {
    await dbAdapter.collection(STUDY_PACK_COLLECTION).doc(cacheKey).update({
      data: {
        reportAnalysisStatus: 'failed',
        reportAnalysisError: String(error && error.message || error || 'unknown').slice(0, 500),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (updateError) {}
}

async function buildStudyPackWithModel(item) {
  const config = getStudyModelConfig();
  if (!config.endpoint || !config.apiKey) {
    throw new Error('listening-study-model-not-configured');
  }
  const prompt = [
    '你是中考英语听力老师。请只返回 JSON，不要 Markdown。',
    '根据听力文本生成复习卡，只生成生词卡、短语卡、句型卡。',
    '生词选择初中阶段重要、学生可能不熟、且在听力场景里值得掌握的词。',
    '短语选择原文中值得掌握的固定搭配或听力高频表达。',
    '句型卡 meaning 必须是中文解释，example 必须来自原文或贴近原文，exampleMeaning 必须是中文翻译。',
    '学生可见内容不得提及 AI、模型、系统、接口、生成过程、内部来源或返回状态，不重复标题、原文或同一解释。',
    'JSON 格式：{"vocabularyCards":[{"word":"","phonetic":"","meaning":"","example":"","exampleMeaning":""}],"phraseCards":[{"text":"","meaning":"","example":""}],"sentencePatternCards":[{"pattern":"","meaning":"","example":"","exampleMeaning":""}]}',
    `标题：${item.title || ''}`,
    `听力文本：${item.transcript}`
  ].join('\n');
  const attemptedModels = [];
  async function requestModel(model) {
    attemptedModels.push(model);
    const response = await postJson(config.endpoint, config.apiKey, {
      model,
      messages: [
        { role: 'system', content: 'You extract structured English listening study material for Chinese middle-school students.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    }, 150000);
    const studyPack = normalizeStudyPack(Object.assign({}, parseJsonText(extractMessageText(response)) || {}, {
      source: `model:${model}`
    }));
    validateStudyPack(studyPack);
    return { studyPack, modelUsage: normalizeModelUsage(response) };
  }
  try {
    const generated = await requestModel(config.model);
    return Object.assign({}, generated, {
      attemptedModels: attemptedModels.slice(),
      modelCallCount: attemptedModels.length
    });
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        const generated = await requestModel(config.fallbackModel);
        return Object.assign({}, generated, {
          attemptedModels: attemptedModels.slice(),
          modelCallCount: attemptedModels.length
        });
      } catch (fallbackError) {
        const combined = new Error(`listening-study-model-failed:${error.message || String(error)};fallback:${fallbackError.message || String(fallbackError)}`);
        combined.attemptedModels = attemptedModels.slice();
        combined.modelCallCount = attemptedModels.length;
        throw combined;
      }
    }
    const failed = new Error(`listening-study-model-failed:${error.message || String(error)}`);
    failed.attemptedModels = attemptedModels.slice();
    failed.modelCallCount = attemptedModels.length;
    throw failed;
  }
}

async function buildQuestionAnalysesWithModel(item) {
  const config = getStudyModelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('listening-study-model-not-configured');
  const questions = getReportQuestions(item);
  if (!questions.length) throw new Error('listening-report-questions-empty');
  const prompt = [
    '你是英语听力教师。只返回 JSON，不要 Markdown。',
    '逐题提供解析、听力原文依据、依据中文翻译。不得改变题号或标准答案。',
    'evidence 必须引用听力原文中能支持答案的完整英文句子；analysis 用中文说明如何从依据得到答案。',
    'analysis 最多两句，不重复标准答案、题目、evidence 或 evidenceTranslation。',
    '学生可见内容不得提及 AI、模型、系统、接口、生成过程、内部来源或返回状态。',
    'JSON 格式：{"questionAnalyses":[{"number":1,"answer":"","evidence":"","evidenceTranslation":"","analysis":""}]}',
    `标题：${item.title || ''}`,
    `听力原文：${item.transcript || ''}`,
    `题目：${JSON.stringify(questions.map((question) => ({
      number: question.number,
      prompt: question.prompt || '',
      options: question.options || {},
      answer: question.answer || ''
    })))}`
  ].join('\n');
  const attemptedModels = [];
  async function requestModel(model) {
    attemptedModels.push(model);
    const response = await postJson(config.endpoint, config.apiKey, {
      model,
      messages: [
        { role: 'system', content: 'You produce complete structured listening question analysis for Chinese students.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, 150000);
    const parsed = parseJsonText(extractMessageText(response)) || {};
    const rawAnalyses = Array.isArray(parsed) ? parsed : parsed.questionAnalyses;
    const normalized = normalizeQuestionAnalyses(rawAnalyses).map((analysis) => {
      const question = questions.find((entry) => String(entry.number) === String(analysis.number)) || {};
      return Object.assign({}, analysis, { answer: normalizeText(question.answer) });
    });
    const studyPack = { questionAnalyses: normalized };
    if (!hasCompleteQuestionAnalyses(studyPack, item)) throw new Error('listening-report-analysis-incomplete');
    return {
      questionAnalyses: normalized,
      source: `model:${model}`,
      modelUsage: normalizeModelUsage(response)
    };
  }
  try {
    return await requestModel(config.model);
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        return await requestModel(config.fallbackModel);
      } catch (fallbackError) {
        throw new Error(`listening-report-analysis-failed:${error.message};fallback:${fallbackError.message}`);
      }
    }
    throw error;
  }
}

async function getOrCreateListeningStudyPack(listeningId, item, cacheOnly) {
  const transcript = normalizeText(item && item.transcript);
  const cached = await getCachedStudyPack(listeningId);
  if (cached) {
    return {
      listeningId,
      studyPack: normalizeStudyPack(Object.assign({
        source: cached.source || ''
      }, cached.studyPack)),
      cached: true,
      generating: false,
      modelCallCount: Number(cached.modelCallCount || 0),
      modelUsage: cached.modelUsage || null
    };
  }
  if (cacheOnly) return { listeningId, studyPack: null };
  if (!transcript) throw new Error('listening-transcript-empty');
  const cacheKey = getStudyPackCacheKey(listeningId);
  const title = item.title || '';
  const job = await acquireStudyPackJob(cacheKey, listeningId, title);
  if (job.state === 'generating') {
    return { listeningId, studyPack: null, cached: false, generating: true, retryAfterMs: 3000 };
  }
  if (job.state === 'ready' && job.item && job.item.studyPack) {
    return {
      listeningId,
      studyPack: normalizeStudyPack(job.item.studyPack),
      cached: true,
      generating: false,
      modelCallCount: Number(job.item.modelCallCount || 0),
      modelUsage: job.item.modelUsage || null
    };
  }
  try {
    const generated = await buildStudyPackWithModel(Object.assign({}, item, { transcript }));
    await saveStudyPack(cacheKey, listeningId, title, generated);
    return {
      listeningId,
      studyPack: generated.studyPack,
      cached: false,
      generating: false,
      modelCallCount: generated.modelCallCount,
      modelUsage: generated.modelUsage
    };
  } catch (error) {
    await markStudyPackJobFailed(cacheKey, error);
    throw error;
  }
}

async function getListeningStudyPack(event) {
  const payload = (event && event.payload) || {};
  const item = payload.item || {};
  const listeningId = normalizeText(payload.listeningId || item._id || item.id);
  const transcript = normalizeText(payload.transcript || item.transcript);
  if (!listeningId) throw new Error('listening-id-empty');
  await study.prepareRequestContext(Object.assign({}, event, { action: 'getListeningStudyPack' }));
  if (payload.includeQuestionAnalyses) {
    const materialResult = await catalog.getMaterialItem({
      payload: { moduleId: 'listening', itemId: listeningId }
    });
    const officialItem = materialResult && materialResult.item;
    if (!officialItem) throw new Error('listening-report-material-not-found');
    const studyPack = await ensureListeningReportStudyPack(officialItem);
    return {
      listeningId,
      studyPack,
      cached: true,
      generating: false
    };
  }
  return getOrCreateListeningStudyPack(listeningId, Object.assign({}, item, { transcript }), !!payload.cacheOnly);
}

function listeningReportImageKey(image) {
  return String(image && (image.cloudPath || image.fileId || image.fileID || image.src || image.url) || '');
}

function collectListeningReportImages(item) {
  const images = [];
  const seen = new Set();
  const add = (image) => {
    const key = listeningReportImageKey(image);
    if (!key || seen.has(key)) return;
    seen.add(key);
    images.push(image);
  };
  (item && item.questions || []).forEach((question) => {
    (question && question.sourceImages || []).forEach(add);
    Object.values(question && question.optionImages || {}).forEach(add);
  });
  return images;
}

function downloadListeningReportUrlBuffer(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)
        && response.headers.location
        && redirects > 0) {
        response.resume();
        resolve(downloadListeningReportUrlBuffer(new URL(response.headers.location, url).toString(), redirects - 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`listening-report-image-http-${response.statusCode || 0}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.setTimeout(15000, () => request.destroy(new Error('listening-report-image-timeout')));
    request.on('error', reject);
  });
}

async function downloadListeningReportImages(item) {
  const imageBuffers = {};
  for (const image of collectListeningReportImages(item)) {
    const key = listeningReportImageKey(image);
    try {
      const buffer = image && (image.fileId || image.fileID || image.cloudPath)
        ? await storageAdapter.downloadCloudFileBuffer(image.fileId || image.fileID, image.cloudPath)
        : await downloadListeningReportUrlBuffer(String(image && (image.src || image.url) || ''));
      if (!buffer || !buffer.length) throw new Error('listening-report-source-image-empty');
      imageBuffers[key] = buffer;
    } catch (error) {
      throw new Error('listening-report-source-image-unavailable');
    }
  }
  return imageBuffers;
}

async function loadListeningReportCompletion(ctx, completionId) {
  if (!completionId) return null;
  const result = await dbAdapter.collection('studyCompletedItems').where({
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    recordId: completionId,
    type: 'listening',
    section: 'questions'
  }).orderBy('updatedAt', 'desc').limit(1).get();
  return result && result.data && result.data[0] ? result.data[0] : null;
}

async function ensureListeningReportStudyPack(item) {
  const listeningId = normalizeText(item && (item._id || item.id));
  const packResult = await getOrCreateListeningStudyPack(listeningId, item, false);
  if (packResult.generating || !packResult.studyPack) throw new Error('listening-report-study-pack-generating');
  let studyPack = normalizeStudyPack(packResult.studyPack);
  try {
    validateStudyPack(studyPack);
  } catch (error) {
    const generated = await buildStudyPackWithModel(item);
    generated.studyPack = normalizeStudyPack(Object.assign({}, generated.studyPack, {
      questionAnalyses: studyPack.questionAnalyses
    }));
    await saveStudyPack(getStudyPackCacheKey(listeningId), listeningId, item.title || '', generated);
    studyPack = generated.studyPack;
    validateStudyPack(studyPack);
  }
  if (!hasCompleteQuestionAnalyses(studyPack, item)) {
    const cacheKey = getStudyPackCacheKey(listeningId);
    const job = await acquireReportAnalysisJob(cacheKey, listeningId, item.title || '');
    if (job.state === 'generating') throw new Error('listening-report-analysis-generating');
    try {
      const generated = await buildQuestionAnalysesWithModel(item);
      studyPack = await saveReportAnalysis(cacheKey, item, generated.questionAnalyses, generated.source);
    } catch (error) {
      await markReportAnalysisFailed(cacheKey, error);
      throw error;
    }
  }
  if (!hasCompleteQuestionAnalyses(studyPack, item)) throw new Error('listening-report-analysis-incomplete');
  return studyPack;
}

async function generateListeningReportPdf(event) {
  const payload = (event && event.payload) || {};
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'generateListeningReportPdf'
  }));
  const completionId = normalizeText(payload.completionId);
  const completion = await loadListeningReportCompletion(ctx, completionId);
  if (!completion || !completion.latestAttempt) throw new Error('listening-report-completion-not-found');
  const targetId = normalizeText(completion.targetId || payload.listeningId);
  const materialResult = await catalog.getMaterialItem({
    payload: { moduleId: 'listening', itemId: targetId }
  });
  const item = materialResult && materialResult.item;
  const questions = getReportQuestions(item);
  if (!item || !normalizeText(item.transcript) || !questions.length) throw new Error('listening-report-material-incomplete');
  const attempt = Object.assign({}, completion.latestAttempt, {
    date: completion.date || '',
    title: completion.title || item.title || ''
  });
  if (!Array.isArray(attempt.questions) || !attempt.questions.length) throw new Error('listening-report-attempt-incomplete');
  const studyPack = await ensureListeningReportStudyPack(item);
  const imageBuffers = await downloadListeningReportImages(item);
  const pdfBuffer = await buildListeningReportPdf({ item, attempt, studyPack, imageBuffers });
  const safeId = completionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  const cloudPath = [
    '_exports',
    'listening-reports',
    ctx.family.familyId,
    ctx.child.childId,
    `${safeId}-r${Number(item.contentRevision || 0)}-study-v3.pdf`
  ].join('/');
  const uploaded = await storageAdapter.uploadCloudFileBuffer(cloudPath, pdfBuffer);
  const tempUrl = await storageAdapter.getTempFileURL(uploaded.fileId, uploaded.cloudPath);
  return {
    fileId: uploaded.fileId,
    cloudPath: uploaded.cloudPath,
    tempUrl,
    fileName: `${String(item.title || 'listening-report').replace(/[\\/:*?"<>|]/g, ' ')}.pdf`
  };
}

module.exports = {
  getListeningStudyPack,
  generateListeningReportPdf,
  _test: {
    normalizeQuestionAnalyses,
    normalizeStudyPack,
    hasCompleteQuestionAnalyses,
    collectListeningReportImages,
    listeningReportImageKey
  }
};
