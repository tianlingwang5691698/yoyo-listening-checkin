const dbAdapter = require('../adapters/db.adapter');
const study = require('../facades/study.facade');
const https = require('https');
const crypto = require('crypto');

const STUDY_PACK_COLLECTION = 'listeningStudyPacks';
const STUDY_PACK_JOB_STALE_MS = 4 * 60 * 1000;

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

function normalizeStudyPack(pack) {
  return {
    vocabularyCards: normalizeCardList(pack && pack.vocabularyCards, 'word').slice(0, 20),
    phraseCards: normalizeCardList(pack && pack.phraseCards, 'text').slice(0, 16),
    sentencePatternCards: normalizeCardList(pack && pack.sentencePatternCards, 'pattern').slice(0, 10),
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
    model: process.env.READING_STUDY_MODEL || 'gpt-5.5',
    fallbackModel: process.env.READING_STUDY_FALLBACK_MODEL || 'deepseek-v4-pro'
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

async function getListeningStudyPack(event) {
  const payload = (event && event.payload) || {};
  const item = payload.item || {};
  const listeningId = normalizeText(payload.listeningId || item._id || item.id);
  const transcript = normalizeText(payload.transcript || item.transcript);
  if (!listeningId) throw new Error('listening-id-empty');
  await study.prepareRequestContext(Object.assign({}, event, { action: 'getListeningStudyPack' }));
  const cached = await getCachedStudyPack(listeningId);
  if (cached) {
    const studyPack = normalizeStudyPack(cached.studyPack);
    return {
      listeningId,
      studyPack,
      cached: true,
      generating: false,
      modelCallCount: Number(cached.modelCallCount || 0),
      modelUsage: cached.modelUsage || null
    };
  }
  if (payload.cacheOnly) {
    return {
      listeningId,
      studyPack: null
    };
  }
  if (!transcript) throw new Error('listening-transcript-empty');
  const cacheKey = getStudyPackCacheKey(listeningId);
  const title = item.title || payload.title || '';
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
    console.log('[listening-study] generated', JSON.stringify({
      listeningId,
      attemptedModels: generated.attemptedModels,
      modelCallCount: generated.modelCallCount,
      modelUsage: generated.modelUsage
    }));
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

module.exports = {
  getListeningStudyPack
};
