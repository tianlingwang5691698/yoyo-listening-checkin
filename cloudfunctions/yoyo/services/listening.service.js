const dbAdapter = require('../adapters/db.adapter');
const study = require('../facades/study.facade');
const flashcards = require('./flashcard.service');
const https = require('https');

const STUDY_PACK_COLLECTION = 'listeningStudyPacks';

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
    model: 'gpt-5.5',
    fallbackModel: 'deepseek-v4-pro'
  };
}

async function getCachedStudyPack(listeningId) {
  try {
    const result = await dbAdapter.collection(STUDY_PACK_COLLECTION)
      .where({ listeningId })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const row = result && result.data && result.data[0];
    return row && row.studyPack ? row.studyPack : null;
  } catch (error) {
    return null;
  }
}

async function saveStudyPack(listeningId, title, studyPack) {
  try {
    await dbAdapter.collection(STUDY_PACK_COLLECTION).add({
      data: {
        listeningId,
        title,
        studyPack,
        source: studyPack.source || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    // Missing cache collection should not block the learner.
  }
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
  async function requestModel(model) {
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
    return studyPack;
  }
  try {
    return await requestModel(config.model);
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        return await requestModel(config.fallbackModel);
      } catch (fallbackError) {
        throw new Error(`listening-study-model-failed:${error.message || String(error)};fallback:${fallbackError.message || String(fallbackError)}`);
      }
    }
    throw new Error(`listening-study-model-failed:${error.message || String(error)}`);
  }
}

async function getListeningStudyPack(event) {
  const payload = (event && event.payload) || {};
  const item = payload.item || {};
  const listeningId = normalizeText(payload.listeningId || item._id || item.id);
  const transcript = normalizeText(payload.transcript || item.transcript);
  if (!listeningId) throw new Error('listening-id-empty');
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getListeningStudyPack' }));
  async function syncFlashcards(studyPack) {
    try {
      await flashcards.upsertStudyPackFlashcards(ctx, today, {
        sourceType: 'listening',
        sourceId: listeningId,
        title: item.title || payload.title || ''
      }, studyPack);
    } catch (error) {
      // Vocabulary sync should not block the lesson.
    }
  }
  const cached = await getCachedStudyPack(listeningId);
  if (cached) {
    const studyPack = normalizeStudyPack(cached);
    await syncFlashcards(studyPack);
    return {
      listeningId,
      studyPack
    };
  }
  if (payload.cacheOnly) {
    return {
      listeningId,
      studyPack: null
    };
  }
  if (!transcript) throw new Error('listening-transcript-empty');
  const studyPack = await buildStudyPackWithModel(Object.assign({}, item, { transcript }));
  await saveStudyPack(listeningId, item.title || payload.title || '', studyPack);
  await syncFlashcards(studyPack);
  return {
    listeningId,
    studyPack
  };
}

module.exports = {
  getListeningStudyPack
};
