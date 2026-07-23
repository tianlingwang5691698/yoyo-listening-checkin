const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const storageAdapter = require('../adapters/storage.adapter');
const completion = require('./completion.service');
const crypto = require('crypto');
const https = require('https');
const { CLOUD_ASSET_BASE_URL } = require('../lib/constants');

const DEFAULT_READING_DAILY_COUNT = 3;
const MAX_READING_DAILY_COUNT = 20;
const STUDY_PACK_COLLECTION = 'readingStudyPacks';
const SENTENCE_TRANSLATION_COLLECTION = 'readingSentenceTranslations';
const READING_STUDY_MODEL_TIMEOUT_MS = 50000;
const READING_AUDIO_CACHE_COLLECTION = 'readingAudioCache';
const studyPackBuildPromises = {};
let passageListCache = null;
const PASSAGE_LIST_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const WORD_DICTIONARY_COLLECTION = 'wordDictionary';
const READING_PASSAGE_COLLECTION = 'readingPassages';
const READING_CONTENT_PATH = '_content/reading/reading-passages.json';
const READING_EM1_CONTENT_PATH = '_content/reading-em1/reading-passages.json';
const READING_SENIOR_CONTENT_PATHS = [
  '_content/reading-senior-autumn/years/2009/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2010/reading-passages.json',
  '_content/reading-senior-autumn/years/2011/reading-passages.json',
  '_content/reading-senior-autumn/years/2012/reading-passages.json',
  '_content/reading-senior-autumn/years/2014/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2015/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2016/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2017/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2017/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2018/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2018/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2019/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2019/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2020/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2020/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2021/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2021/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2022/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2022/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2023/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2023/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2024/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2024/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2025/v2/reading-passages.json',
  '_content/reading-senior-autumn/years/2025/v2/reading-passages.json',
  '_content/reading-senior-spring/years/2026/v2/reading-passages.json'
];
const READING_IELTS_CONTENT_PATHS = [
  '_content/ielts-academic/cambridge-10/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-11/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-12/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-13/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-14/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-15/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-16/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-17/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-18/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-19/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-20/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-21/reading/v2/reading-passages.json',
  '_content/ielts-academic/cambridge-21/reading/reading-passages.json'
];
const MIN_DATABASE_READING_PASSAGE_COUNT = 1103;
let samplePassageCache = null;
let passageDirectoryCache = null;
let bundledPassageDirectory = null;

function todayIndex(today) {
  const start = Date.parse('2026-06-29T00:00:00+08:00');
  const current = Date.parse(`${today}T00:00:00+08:00`);
  if (!Number.isFinite(current) || current < start) {
    return 0;
  }
  return Math.floor((current - start) / 86400000);
}

function normalizePassage(item) {
  const normalizeImage = (image) => ({
    src: image && (image.src || image.url) || (image && image.cloudPath ? `${String(CLOUD_ASSET_BASE_URL || '').replace(/\/+$/, '')}/${image.cloudPath}` : ''),
    cloudPath: image && image.cloudPath || '',
    alt: image && image.alt || ''
  });
  return {
    _id: item._id || item.id,
    title: item.title || '阅读练习',
    year: item.year || '',
    district: item.district || '',
    examType: item.examType || '',
    section: item.section || '',
    sectionLabel: item.sectionLabel || '',
    paperId: item.paperId || '',
    paperTitle: item.paperTitle || '',
    paperOrder: Number(item.paperOrder || 0),
    difficultyLevel: item.difficultyLevel || 0,
    difficultyLabel: item.difficultyLabel || '',
    sourceType: item.sourceType || '',
    contentRevision: Number(item.contentRevision || 0),
    dataFormat: item.dataFormat || '',
    directions: item.directions || '',
    sectionHeading: item.sectionHeading || '',
    articleTitle: item.articleTitle || '',
    articleSubtitle: item.articleSubtitle || '',
    passageParagraphs: Array.isArray(item.passageParagraphs) ? item.passageParagraphs.filter((paragraph) => typeof paragraph === 'string' && paragraph.trim()) : [],
    passage: item.passage || '',
    images: (Array.isArray(item.images) ? item.images : []).map(normalizeImage).filter((image) => image.src),
    translation: item.translation || item.fullTranslation || '',
    questions: (Array.isArray(item.questions) ? item.questions : []).map((question) => Object.assign({}, question, {
      sourceImages: (Array.isArray(question.sourceImages) ? question.sourceImages : []).map(normalizeImage).filter((image) => image.src),
      optionImages: Object.fromEntries(Object.entries(question.optionImages || {}).map(([key, image]) => [key, normalizeImage(image)]).filter(([, image]) => image.src))
    })),
    answerSentences: Array.isArray(item.answerSentences) ? item.answerSentences : [],
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    vocabulary: Array.isArray(item.vocabulary) ? item.vocabulary : [],
    sentencePatterns: Array.isArray(item.sentencePatterns) ? item.sentencePatterns : [],
    status: item.status || 'sample'
  };
}

function hasUsableReadingQuestions(passage) {
  return !!(passage && Array.isArray(passage.questions) && passage.questions.length > 0);
}

async function readCollection(name, limit) {
  try {
    const result = await dbAdapter.collection(name)
      .limit(limit || 100)
      .get();
    return (result && result.data) || [];
  } catch (error) {
    return [];
  }
}

function loadSamplePassages() {
  if (samplePassageCache) {
    return samplePassageCache;
  }
  try {
    samplePassageCache = require('../data/reading-passages.sample.json');
  } catch (error) {
    samplePassageCache = [];
  }
  return samplePassageCache;
}

async function findReadingAudioCache(hash) {
  try {
    const result = await dbAdapter.collection(READING_AUDIO_CACHE_COLLECTION)
      .where({ hash })
      .limit(1)
      .get();
    return result && result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function loadPassages() {
  if (passageListCache && Date.now() - passageListCache.savedAt < PASSAGE_LIST_CACHE_MAX_AGE_MS) {
    return passageListCache.passages;
  }
  const cloudStoragePassages = [];
  try {
    const cloudContents = await Promise.all(
      [READING_EM1_CONTENT_PATH, READING_CONTENT_PATH].concat(READING_IELTS_CONTENT_PATHS, READING_SENIOR_CONTENT_PATHS).map(async (path) => {
        try {
          return await storageAdapter.downloadCloudJson(path);
        } catch (error) {
          // One missing cloud file should not hide the other exam type.
          return null;
        }
      })
    );
    cloudContents.forEach((content) => {
      if (content) {
        const list = Array.isArray(content) ? content : (content.passages || content.items || []);
        cloudStoragePassages.push(...list);
      }
    });
    if (cloudStoragePassages.length) {
      const seen = new Set();
      const passages = cloudStoragePassages.map(normalizePassage).filter((item) => {
        if (!item._id || seen.has(item._id) || !(item.passage || item.images.length) || !hasUsableReadingQuestions(item)) return false;
        seen.add(item._id);
        return true;
      });
      passageListCache = { savedAt: Date.now(), passages };
      return passages;
    }
  } catch (error) {
    // Fallback to database/sample content below.
  }
  const cloudPassages = await readCollection('readingPassages', 200);
  const list = cloudPassages.length ? cloudPassages : loadSamplePassages();
  const passages = list.map(normalizePassage).filter((item) => item._id && (item.passage || item.images.length) && hasUsableReadingQuestions(item));
  passageListCache = { savedAt: Date.now(), passages };
  return passages;
}

function normalizePassageDirectoryItem(item) {
  const passage = item || {};
  return {
    _id: String(passage._id || ''),
    title: String(passage.title || ''),
    year: passage.year || '',
    district: String(passage.district || ''),
    examType: String(passage.examType || ''),
    section: String(passage.section || ''),
    sectionLabel: String(passage.sectionLabel || ''),
    paperId: String(passage.paperId || ''),
    paperTitle: String(passage.paperTitle || ''),
    paperOrder: Number(passage.paperOrder || 0),
    difficultyLevel: Number(passage.difficultyLevel || 0),
    difficultyLabel: String(passage.difficultyLabel || ''),
    questionCount: Number(passage.questionCount || (passage.questions || []).length || 0),
    status: String(passage.status || 'sample')
  };
}

function loadBundledPassageDirectory() {
  if (bundledPassageDirectory) return bundledPassageDirectory;
  try {
    const raw = require('../data/reading-directory.json');
    const passages = (Array.isArray(raw) ? raw : [])
      .map(normalizePassageDirectoryItem)
      .filter((item) => item._id && item.title && item.questionCount > 0);
    bundledPassageDirectory = passages.length >= MIN_DATABASE_READING_PASSAGE_COUNT ? passages : [];
  } catch (error) {
    bundledPassageDirectory = [];
  }
  return bundledPassageDirectory;
}

async function loadPassageDirectory() {
  if (passageDirectoryCache && Date.now() - passageDirectoryCache.savedAt < PASSAGE_LIST_CACHE_MAX_AGE_MS) {
    return passageDirectoryCache.passages;
  }
  const bundled = loadBundledPassageDirectory();
  if (bundled.length >= MIN_DATABASE_READING_PASSAGE_COUNT) {
    passageDirectoryCache = { savedAt: Date.now(), passages: bundled };
    return bundled;
  }
  try {
    const result = await dbAdapter.collection(READING_PASSAGE_COLLECTION)
      .field({
        _id: true,
        title: true,
        year: true,
        district: true,
        examType: true,
        section: true,
        sectionLabel: true,
        paperId: true,
        paperTitle: true,
        paperOrder: true,
        difficultyLevel: true,
        difficultyLabel: true,
        questionCount: true,
        status: true
      })
      .limit(1000)
      .get();
    const passages = ((result && result.data) || [])
      .map(normalizePassageDirectoryItem)
      .filter((item) => item._id && item.title && item.questionCount > 0);
    if (passages.length >= MIN_DATABASE_READING_PASSAGE_COUNT) {
      passageDirectoryCache = { savedAt: Date.now(), passages };
      return passages;
    }
  } catch (error) {
    // Keep the old cloud-storage content available until the collection is fully imported.
  }
  const passages = (await loadPassages()).map(normalizePassageDirectoryItem);
  passageDirectoryCache = { savedAt: Date.now(), passages };
  return passages;
}

async function getDatabasePassageById(passageId) {
  if (!passageId) return null;
  try {
    const result = await dbAdapter.collection(READING_PASSAGE_COLLECTION).doc(passageId).get();
    const raw = result && result.data;
    const row = Array.isArray(raw) ? raw[0] : raw;
    const passage = row ? normalizePassage(row) : null;
    return passage && passage._id && (passage.passage || passage.images.length) && hasUsableReadingQuestions(passage) ? passage : null;
  } catch (error) {
    return null;
  }
}

async function getDailyPlan(ctx, today) {
  try {
    const result = await dbAdapter.collection('readingDailyPlans')
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        date: today
      })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    return result && result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function saveDailyPlan(ctx, today, passages) {
  const plannedPassages = Array.isArray(passages) ? passages.filter(Boolean) : [];
  if (!plannedPassages.length) {
    return;
  }
  const passageIds = plannedPassages.map((passage) => passage._id);
  try {
    await dbAdapter.collection('readingDailyPlans').add({
      data: {
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        date: today,
        passageId: passageIds[0],
        passageIds,
        dailyCount: passageIds.length,
        source: plannedPassages.some((passage) => passage.status !== 'sample') ? 'cloud' : 'sample',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    // Collection may not exist during the pilot; deterministic daily fallback still works.
  }
}

function pickDailyPassage(passages, today) {
  if (!passages.length) {
    return null;
  }
  return passages[todayIndex(today) % passages.length];
}

function pickDailyPassages(passages, today, count) {
  if (!passages.length) {
    return [];
  }
  const total = Math.min(Math.max(Number(count) || DEFAULT_READING_DAILY_COUNT, 1), MAX_READING_DAILY_COUNT, passages.length);
  const start = todayIndex(today) % passages.length;
  return Array.from({ length: total }, (_, index) => passages[(start + index) % passages.length]);
}

async function pickPlannedPassages(ctx, passages, today, count) {
  const plan = await getDailyPlan(ctx, today);
  const plannedIds = plan && Array.isArray(plan.passageIds)
    ? plan.passageIds
    : (plan && plan.passageId ? [plan.passageId] : []);
  const plannedPassages = plannedIds
    .map((passageId) => passages.find((item) => item._id === passageId))
    .filter(Boolean);
  if (plannedPassages.length >= count) {
    return plannedPassages.slice(0, count);
  }
  const nextPassages = pickDailyPassages(passages, today, count);
  await saveDailyPlan(ctx, today, nextPassages);
  return nextPassages;
}

async function pickPlannedPassage(ctx, passages, today) {
  const plannedPassages = await pickPlannedPassages(ctx, passages, today, 1);
  return plannedPassages[0] || null;
}

async function findPassageById(passageId, today) {
  if (/^ielts-academic-(?:1[0-9]|20|21)-/i.test(String(passageId || ''))) {
    const cloudPassage = (await loadPassages()).find((item) => item._id === passageId);
    if (cloudPassage) return cloudPassage;
  }
  const databasePassage = await getDatabasePassageById(passageId);
  if (databasePassage) {
    return databasePassage;
  }
  const passages = await loadPassages();
  if (passageId) {
    const matched = passages.find((item) => item._id === passageId);
    if (matched) {
      return matched;
    }
  }
  return pickDailyPassage(passages, today);
}

function createPassageSummary(passage) {
  if (!passage) {
    return null;
  }
  const meta = [passage.year, passage.district, passage.examType, passage.sectionLabel || passage.section, passage.difficultyLabel]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
  return {
    _id: passage._id,
    title: passage.title,
    meta,
    questionCount: Number(passage.questionCount || (passage.questions || []).length || 0),
    status: passage.status,
    paperOrder: Number(passage.paperOrder || 0)
  };
}

function attachAttemptSummary(summary, latestAttempt) {
  if (!summary || !latestAttempt) {
    return summary;
  }
  return Object.assign({}, summary, {
    latestAttempt: {
      _id: latestAttempt._id || '',
      score: latestAttempt.score,
      totalScore: latestAttempt.totalScore,
      correctCount: latestAttempt.correctCount,
      totalCount: latestAttempt.totalCount,
      status: latestAttempt.status || ''
    }
  });
}

function textValue(item, fields) {
  if (!item) {
    return '';
  }
  if (typeof item === 'string') {
    return item;
  }
  const keys = fields || ['text', 'sentence', 'phrase', 'word', 'pattern'];
  for (let index = 0; index < keys.length; index += 1) {
    if (item[keys[index]]) {
      return String(item[keys[index]]);
    }
  }
  return '';
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function fetchAudioBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`audio-http-${response.statusCode || 0}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 800) {
          reject(new Error('audio-too-small'));
          return;
        }
        resolve(buffer);
      });
    }).on('error', reject);
    request.setTimeout(5000, () => {
      request.destroy(new Error('audio-timeout'));
    });
  });
}

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`json-http-${response.statusCode || 0}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
    request.setTimeout(timeoutMs || 5000, () => {
      request.destroy(new Error('json-timeout'));
    });
  });
}

function isSingleWord(text) {
  return /^[A-Za-z][A-Za-z'-]{0,40}$/.test(String(text || '').trim());
}

function canUseDictionaryVoice(text) {
  const value = normalizeText(text);
  if (isSingleWord(value)) return true;
  if (value.length > 60 || /[.!?;:]/.test(value)) return false;
  const words = value.split(' ').filter(Boolean);
  return words.length >= 2
    && words.length <= 6
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

async function synthesizeWordAudioFast(text, cloudPath) {
  if (!canUseDictionaryVoice(text)) {
    return null;
  }
  const encoded = encodeURIComponent(text);
  const urls = [
    `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`,
    `https://dict.youdao.com/dictvoice?audio=${encoded}&type=1`
  ];
  for (let index = 0; index < urls.length; index += 1) {
    try {
      const buffer = await fetchAudioBuffer(urls[index]);
      return storageAdapter.uploadCloudFileBuffer(cloudPath, buffer);
    } catch (error) {
      // Try the next dictionary voice.
    }
  }
  return null;
}

function getMerriamWebsterAudioUrl(audioName) {
  const name = String(audioName || '').trim();
  if (!name) {
    return '';
  }
  let subdir = name.charAt(0).toLowerCase();
  if (name.startsWith('bix')) {
    subdir = 'bix';
  } else if (name.startsWith('gg')) {
    subdir = 'gg';
  } else if (!/^[a-z]$/.test(subdir)) {
    subdir = 'number';
  }
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${name}.mp3`;
}

function findMerriamWebsterAudioName(items) {
  const list = Array.isArray(items) ? items : [];
  for (let itemIndex = 0; itemIndex < list.length; itemIndex += 1) {
    const pronunciations = (((list[itemIndex] || {}).hwi || {}).prs || []);
    for (let index = 0; index < pronunciations.length; index += 1) {
      const audio = (((pronunciations[index] || {}).sound || {}).audio || '').trim();
      if (audio) {
        return audio;
      }
    }
  }
  return '';
}

async function synthesizeMerriamWebsterAudio(text, cloudPath) {
  if (!isSingleWord(text)) {
    return null;
  }
  const apiKey = process.env.MERRIAM_WEBSTER_API_KEY || process.env.MW_DICTIONARY_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const word = normalizeLookupWord(text);
  if (!word) {
    return null;
  }
  const apiUrl = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(apiKey)}`;
  const entries = await fetchJson(apiUrl, 7000);
  const audioName = findMerriamWebsterAudioName(entries);
  const audioUrl = getMerriamWebsterAudioUrl(audioName);
  if (!audioUrl) {
    return null;
  }
  const buffer = await fetchAudioBuffer(audioUrl);
  return storageAdapter.uploadCloudFileBuffer(cloudPath, buffer);
}

function normalizeLookupWord(value) {
  return String(value || '').trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase();
}

function parseYoudaoWord(data, word) {
  const item = data && data.ec && data.ec.word && data.ec.word[0] ? data.ec.word[0] : {};
  const definitions = [];
  (item.trs || []).forEach((row) => {
    const lines = row && row.tr && row.tr[0] && row.tr[0].l && row.tr[0].l.i;
    (Array.isArray(lines) ? lines : []).forEach((line) => {
      const text = normalizeText(line);
      if (text && definitions.indexOf(text) < 0) {
        definitions.push(text);
      }
    });
  });
  if (!definitions.length && data && data.web_trans && data.web_trans['web-translation']) {
    (data.web_trans['web-translation'] || []).slice(0, 3).forEach((row) => {
      ((row && row.trans) || []).slice(0, 2).forEach((entry) => {
        const text = normalizeText(entry && entry.value);
        if (text && definitions.indexOf(text) < 0) {
          definitions.push(text);
        }
      });
    });
  }
  return {
    word,
    wordLower: word.toLowerCase(),
    phonetic: item.usphone || item.ukphone || '',
    definitions: definitions.slice(0, 6),
    source: 'youdao'
  };
}

async function findDictionaryEntry(wordLower) {
  try {
    const result = await dbAdapter.collection(WORD_DICTIONARY_COLLECTION)
      .where({ wordLower })
      .limit(1)
      .get();
    return result && result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function ensureDictionaryAudio(wordLower, cached) {
  const hash = crypto.createHash('sha1').update(wordLower).digest('hex').slice(0, 20);
  const audioCloudPath = (cached && cached.audioCloudPath) || `_dictionary_audio/words/${hash}.mp3`;
  const debug = {
    source: 'youdao',
    cloudPath: audioCloudPath,
    uploaded: false,
    hasUrl: false,
    error: ''
  };
  try {
    const audioFile = await synthesizeWordAudioFast(wordLower, audioCloudPath);
    const audioFileId = audioFile && audioFile.fileId ? audioFile.fileId : '';
    const audioUrl = audioFileId ? await storageAdapter.getTempFileURL(audioFileId, audioCloudPath) : '';
    debug.uploaded = !!audioFileId;
    debug.hasUrl = !!audioUrl;
    return {
      audioFileId,
      audioCloudPath,
      audioUrl,
      audioDebug: debug
    };
  } catch (error) {
    debug.error = error && error.message ? error.message : String(error || '');
    return {
      audioFileId: '',
      audioCloudPath,
      audioUrl: '',
      audioDebug: debug
    };
  }
}

function postJson(url, apiKey, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(new Error('reading-study-endpoint-invalid'));
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
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`reading-study-http-${response.statusCode}:${raw.slice(0, 200)}`));
          return;
        }
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (error) {
          reject(new Error(`reading-study-json:${error.message}`));
        }
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('reading-study-timeout'));
    });
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

function extractMessageText(response) {
  if (!response) {
    return '';
  }
  if (Array.isArray(response.choices) && response.choices[0]) {
    const message = response.choices[0].message || {};
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content.map((part) => part.text || part.content || '').join('\n');
    }
  }
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }
  return '';
}

function parseJsonText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }
  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) candidates.push(fenced[1].trim());
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(raw.slice(objectStart, objectEnd + 1));
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(raw.slice(arrayStart, arrayEnd + 1));
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      return JSON.parse(candidates[index]);
    } catch (error) {}
  }
  return null;
}

function normalizeExamType(value) {
  if (value === '一模' || value === '二模' || value === '真题' || value === '春考' || value === '秋考' || value === 'IELTS Academic') {
    return value;
  }
  if (/^Cambridge IELTS (?:1[0-9]|20|21)$/.test(String(value || ''))) return String(value);
  return value && String(value).includes('真题') ? '真题' : String(value || '二模');
}

function isIeltsExamType(value) {
  return value === 'IELTS Academic' || /^Cambridge IELTS (?:1[0-9]|20|21)$/.test(String(value || ''));
}

function ieltsBookNumber(value) {
  if (value === 'IELTS Academic') return 21;
  const match = String(value || '').match(/(\d+)$/);
  return Number(match && match[1] || 0);
}

function buildCategoryTree(passages, latestByPassageId) {
  const completionReady = !!latestByPassageId;
  const ieltsExamTypes = Array.from(new Set(passages.map((item) => normalizeExamType(item.examType)).filter(isIeltsExamType)))
    .sort((left, right) => ieltsBookNumber(right) - ieltsBookNumber(left));
  const examTypes = ['一模', '二模', '春考', '秋考'].concat(ieltsExamTypes);
  const groups = examTypes.map((examType) => {
    const districtMap = {};
    passages.forEach((passage) => {
      if (normalizeExamType(passage.examType) !== examType) {
        return;
      }
      const isSeniorPaper = examType === '春考' || examType === '秋考';
      const isIeltsPaper = isIeltsExamType(examType);
      const district = passage.district || '未分区';
      const nodeKey = (isSeniorPaper || isIeltsPaper) ? (passage.paperId || `${examType}-${passage.year}`) : district;
      const nodeLabel = isIeltsPaper
        ? (passage.paperTitle || district)
        : (isSeniorPaper ? (passage.paperTitle || `${passage.year} 上海高考${examType}英语真题`) : district);
      if (!districtMap[nodeKey]) {
        districtMap[nodeKey] = {
          label: nodeLabel,
          count: 0,
          passages: []
        };
      }
      const latestAttempt = completionReady && latestByPassageId[passage._id] ? latestByPassageId[passage._id] : null;
      districtMap[nodeKey].count += 1;
      districtMap[nodeKey].passages.push(Object.assign(createPassageSummary(passage), {
        completionReady,
        completed: !!(latestAttempt && latestAttempt.status === 'completed'),
        latestAttempt
      }));
    });
    return {
      key: examType,
      label: examType,
      count: Object.values(districtMap).reduce((sum, item) => sum + item.count, 0),
      nodeUnit: examType === '春考' || examType === '秋考' || isIeltsExamType(examType) ? '份卷' : '',
      districts: Object.keys(districtMap).sort((left, right) => String(districtMap[right].label).localeCompare(String(districtMap[left].label), 'zh-CN')).map((district) => ({
        key: district,
        label: districtMap[district].label,
        count: districtMap[district].count,
        completionReady,
        completedCount: districtMap[district].passages.filter((item) => item.completed).length,
        passages: districtMap[district].passages.sort((left, right) => Number(left.paperOrder || 0) - Number(right.paperOrder || 0) || String(left._id).localeCompare(String(right._id)))
      }))
    };
  });
  return [{
    key: 'exam-reading',
    label: '英语真题阅读',
    count: passages.length,
    groups
  }];
}

function buildSentencePatterns(passage) {
  if (passage.sentencePatterns && passage.sentencePatterns.length) {
    return passage.sentencePatterns;
  }
  return (passage.answerSentences || [])
    .slice(0, 3)
    .map((item) => ({
      pattern: textValue(item, ['text', 'sentence']),
      meaning: item && item.translation ? item.translation : '',
      example: textValue(item, ['text', 'sentence'])
    }))
    .filter(Boolean);
}

function formatPhraseItem(item) {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    return { text: item, meaning: '', example: '' };
  }
  const text = textValue(item, ['phrase', 'text']);
  if (!text) {
    return null;
  }
  return {
    text,
    meaning: item.meaning || item.translation || '',
    example: item.example || ''
  };
}

function includesNormalizedText(source, needle) {
  const sourceText = normalizeText(source).toLowerCase();
  const needleText = normalizeText(needle).toLowerCase();
  return !!needleText && sourceText.indexOf(needleText) >= 0;
}

function isPhraseLocatable(passage, item) {
  return includesNormalizedText(passage && passage.passage, item && item.text)
    || includesNormalizedText(passage && passage.passage, item && item.example);
}

function formatVocabularyCard(item) {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    return {
      word: item,
      phonetic: '',
      meaning: '',
      example: '',
      exampleMeaning: '',
      audioUrl: ''
    };
  }
  const word = textValue(item, ['word', 'text']);
  if (!word) {
    return null;
  }
  return {
    word,
    phonetic: item.phonetic || item.pronunciation || '',
    meaning: item.meaning || item.translation || '',
    example: item.example || '',
    exampleMeaning: item.exampleMeaning || item.exampleTranslation || '',
    audioUrl: item.audioUrl || ''
  };
}

function formatSentencePattern(item) {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    return { pattern: item, meaning: '', example: item };
  }
  const pattern = textValue(item, ['pattern', 'text', 'sentence']);
  if (!pattern) {
    return null;
  }
  return {
    pattern,
    meaning: item.meaning || item.translation || '',
    example: item.example || pattern,
    exampleMeaning: item.exampleMeaning || item.exampleTranslation || ''
  };
}

function withGroupIndexes(items) {
  return (items || []).map((item, index) => Object.assign({}, item, {
    groupIndex: index + 1
  }));
}

function buildFallbackStudyPack(passage) {
  return {
    fullTranslation: passage.translation || '',
    vocabularyCards: withGroupIndexes((passage.vocabulary || []).map(formatVocabularyCard).filter(Boolean)),
    phraseCards: withGroupIndexes((passage.phrases || []).map(formatPhraseItem).filter(Boolean)),
    sentencePatternCards: withGroupIndexes(buildSentencePatterns(passage).map(formatSentencePattern).filter(Boolean)),
    source: 'fallback'
  };
}

function normalizeStudyPack(pack, passage) {
  const fallback = buildFallbackStudyPack(passage);
  const source = pack && pack.source ? pack.source : fallback.source;
  const useFallback = !pack || !isModelStudyPack(pack);
  return {
    fullTranslation: normalizeText((pack && pack.fullTranslation) || (useFallback ? fallback.fullTranslation : '')),
    vocabularyCards: withGroupIndexes(((pack && pack.vocabularyCards) || (useFallback ? fallback.vocabularyCards : []) || []).map(formatVocabularyCard).filter(Boolean).slice(0, 20)),
    phraseCards: withGroupIndexes(((pack && pack.phraseCards) || (useFallback ? fallback.phraseCards : []) || []).map(formatPhraseItem).filter(Boolean).slice(0, 20)),
    sentencePatternCards: withGroupIndexes(((pack && pack.sentencePatternCards) || (useFallback ? fallback.sentencePatternCards : []) || []).map(formatSentencePattern).filter(Boolean).slice(0, 12)),
    questionAnalyses: Array.isArray(pack && pack.questionAnalyses) ? pack.questionAnalyses.map((item) => ({
      number: item.number,
      answer: item.answer || '',
      answerSentence: item.answerSentence || '',
      answerSentenceTranslation: item.answerSentenceTranslation || '',
      analysis: item.analysis || ''
    })).filter((item) => item.number !== undefined && item.number !== null).slice(0, 30) : [],
    source
  };
}

function isModelStudyPack(studyPack) {
  return !!(studyPack && studyPack.source && String(studyPack.source).indexOf('model:') === 0);
}

function validateModelStudyPack(studyPack, passage) {
  const questions = (passage.questions || []).filter((question) => question.answer);
  if (!isModelStudyPack(studyPack)) {
    throw new Error('reading-study-pack-not-model');
  }
  if (!studyPack.fullTranslation) {
    throw new Error('reading-study-pack-missing-translation');
  }
  if (!studyPack.vocabularyCards || !studyPack.vocabularyCards.length) {
    throw new Error('reading-study-pack-missing-vocabulary');
  }
  if (studyPack.vocabularyCards.some((item) => !item.word || !item.meaning)) {
    throw new Error('reading-study-pack-missing-vocabulary-meaning');
  }
  if (!studyPack.phraseCards || !studyPack.phraseCards.length) {
    throw new Error('reading-study-pack-missing-phrases');
  }
  if (studyPack.phraseCards.some((item) => !item.text || !item.meaning)) {
    throw new Error('reading-study-pack-missing-phrase-meaning');
  }
  if (!Array.isArray(studyPack.questionAnalyses)) {
    throw new Error('reading-study-pack-missing-question-analyses');
  }
  const analysisByNumber = studyPack.questionAnalyses.reduce((map, item) => {
    map[String(item.number)] = item;
    return map;
  }, {});
  questions.forEach((question) => {
    const analysis = analysisByNumber[String(question.number)];
    if (!isCompleteQuestionAnalysis(analysis, question)) {
      throw new Error(`reading-study-pack-missing-question-${question.number}`);
    }
  });
  if (!studyPack.sentencePatternCards || !studyPack.sentencePatternCards.length) {
    throw new Error('reading-study-pack-missing-sentence-patterns');
  }
  if (studyPack.sentencePatternCards.some((item) => !item.pattern || !item.meaning || !item.example || !item.exampleMeaning)) {
    throw new Error('reading-study-pack-missing-sentence-pattern-translation');
  }
}

function validateQuestionStudyPack(studyPack, passage) {
  const questions = (passage.questions || []).filter((question) => question.answer);
  if (!isModelStudyPack(studyPack)) {
    throw new Error('reading-study-pack-not-model');
  }
  if (!Array.isArray(studyPack.questionAnalyses)) {
    throw new Error('reading-study-pack-missing-question-analyses');
  }
  const analysisByNumber = studyPack.questionAnalyses.reduce((map, item) => {
    map[String(item.number)] = item;
    return map;
  }, {});
  questions.forEach((question) => {
    const analysis = analysisByNumber[String(question.number)];
    if (!isCompleteQuestionAnalysis(analysis, question)) {
      throw new Error(`reading-study-pack-missing-question-${question.number}`);
    }
  });
}

function isValidQuestionStudyPack(studyPack, passage) {
  try {
    validateQuestionStudyPack(studyPack, passage);
    return true;
  } catch (error) {
    return false;
  }
}

function questionRequiresAnswerSentence(question) {
  if (!question) return false;
  const isDirectBlank = question.questionType === 'blank'
    && (/^Blank\s+\d+$/i.test(normalizeText(question.prompt)) || (question.acceptedAnswers || []).length);
  return !isDirectBlank;
}

function isCompleteQuestionAnalysis(item, question) {
  if (!item || !normalizeText(item.analysis)) return false;
  return !questionRequiresAnswerSentence(question) || !!normalizeText(item.answerSentence);
}

function modelField(item, names) {
  for (let index = 0; index < names.length; index += 1) {
    const value = item && item[names[index]];
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') {
      const nested = textValue(value, ['text', 'sentence', 'quote', 'explanation', 'translation']);
      if (nested) return nested;
      continue;
    }
    if (String(value).trim()) return value;
  }
  return '';
}

function extractModelQuestionAnalyses(payload, expectedQuestions) {
  const expected = expectedQuestions || [];
  let items = [];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && typeof payload === 'object') {
    const collection = payload.questionAnalyses
      || payload.question_analyses
      || payload.questions
      || payload.analyses
      || payload.items;
    if (Array.isArray(collection)) {
      items = collection;
    } else {
      const single = payload.questionAnalysis || payload.question_analysis;
      if (single && typeof single === 'object') {
        items = [single];
      } else if (
        payload.number !== undefined
        || payload.questionNumber !== undefined
        || payload.question_number !== undefined
        || payload.answer !== undefined
        || payload.answerSentence
        || payload.answer_sentence
        || payload.evidence
        || payload.explanation
        || payload.rationale
      ) {
        items = [payload];
      }
    }
  }
  if (expected.length === 1 && items.length) {
    items = [items[0]];
  }
  return items.map((item) => {
    const rawNumber = expected.length === 1
      ? expected[0].number
      : modelField(item, ['number', 'questionNumber', 'question_number', 'questionNo', 'question_no', 'id']);
    const numberMatch = String(rawNumber || '').match(/\d+/);
    return {
      number: numberMatch ? Number(numberMatch[0]) : rawNumber,
      answer: modelField(item, ['answer', 'correctAnswer', 'correct_answer']),
      answerSentence: modelField(item, ['answerSentence', 'answer_sentence', 'evidenceSentence', 'evidence_sentence', 'sourceSentence', 'source_sentence', 'evidence', 'quote']),
      answerSentenceTranslation: modelField(item, ['answerSentenceTranslation', 'answer_sentence_translation', 'evidenceTranslation', 'evidence_translation', 'translation']),
      analysis: modelField(item, ['analysis', 'explanation', 'reasoning', 'rationale'])
    };
  });
}

function mergeQuestionAnalyses(passage, current, repairs) {
  const questions = passage.questions || [];
  const questionByNumber = questions.reduce((map, question) => {
    map[String(question.number)] = question;
    return map;
  }, {});
  const analysisByNumber = {};
  [...(current || []), ...(repairs || [])].forEach((item) => {
    const numberKey = String(item && item.number);
    const question = questionByNumber[numberKey];
    if (!question || !isCompleteQuestionAnalysis(item, question)) return;
    analysisByNumber[numberKey] = Object.assign({}, item, {
      number: question.number,
      answer: question.answer || item.answer || ''
    });
  });
  return questions.map((question) => analysisByNumber[String(question.number)]).filter(Boolean);
}

function getMissingAnalysisQuestions(studyPack, passage) {
  const analysisByNumber = (studyPack.questionAnalyses || []).reduce((map, item) => {
    map[String(item.number)] = item;
    return map;
  }, {});
  return (passage.questions || []).filter((question) => (
    question.answer && !isCompleteQuestionAnalysis(analysisByNumber[String(question.number)], question)
  ));
}

function buildQuestionAnalysisPrompt(passage, questions, repair) {
  return [
    '你是英语阅读老师，覆盖中高考和 IELTS Academic。请只返回 JSON，不要 Markdown。',
    repair ? '这是漏题补全请求，只返回下面列出的真实题号，不要返回其他题目。' : '只做逐题解析：必须按真实题号返回每题答案、原文直接答案句、答案句中文翻译、中文解析。',
    '题目自带 answer 时按标准答案讲，不得修改标准答案；answer 为空时，请根据文章和题干生成最可能答案。',
    '选择题的 answerSentence 必须是原文中的直接依据，不要改写。',
    '填空题只有在原文存在可直接引用的完整依据句时才返回 answerSentence；无法可靠定位时返回空字符串，禁止编造或拼接答案句，analysis 仍需讲清答案依据。',
    '若答案为 NOT GIVEN，answerSentence 返回与题干最相关的原文句子，并在 analysis 明确说明原文没有给出判断所需信息。',
    'analysis 用中文说明为什么选该答案，并点出排除干扰项的关键。',
    'JSON 格式：{"questionAnalyses":[{"number":69,"answer":"A","answerSentence":"","answerSentenceTranslation":"","analysis":""}]}',
    `标题：${passage.title}`,
    `题目：${JSON.stringify((questions || []).map((item) => ({ number: item.number, prompt: item.prompt, options: item.options, answer: item.answer })))}`,
    `文章：${passage.passage}`
  ].join('\n');
}

async function buildQuestionStudyPackWithRequester(passage, model, requestJson) {
  const parsed = await requestJson(model, buildQuestionAnalysisPrompt(passage, passage.questions || [], false));
  const studyPack = normalizeStudyPack({
    questionAnalyses: extractModelQuestionAnalyses(parsed, passage.questions || []),
    source: `model:${model}`
  }, passage);
  studyPack.questionAnalyses = mergeQuestionAnalyses(passage, studyPack.questionAnalyses, []);
  const missingQuestions = getMissingAnalysisQuestions(studyPack, passage);
  if (missingQuestions.length) {
    const repairGroups = [];
    for (let index = 0; index < missingQuestions.length; index += 4) {
      repairGroups.push(missingQuestions.slice(index, index + 4));
    }
    const repairResults = await Promise.all(repairGroups.map(async (questions) => {
      const repaired = await requestJson(model, buildQuestionAnalysisPrompt(passage, questions, true));
      return extractModelQuestionAnalyses(repaired, questions);
    }));
    studyPack.questionAnalyses = mergeQuestionAnalyses(passage, studyPack.questionAnalyses, repairResults.flat());
  }
  const individuallyMissing = getMissingAnalysisQuestions(studyPack, passage);
  if (individuallyMissing.length) {
    const individualResults = await Promise.all(individuallyMissing.map(async (question) => {
      const repaired = await requestJson(model, buildQuestionAnalysisPrompt(passage, [question], true));
      return extractModelQuestionAnalyses(repaired, [question]);
    }));
    studyPack.questionAnalyses = mergeQuestionAnalyses(passage, studyPack.questionAnalyses, individualResults.flat());
  }
  validateQuestionStudyPack(studyPack, passage);
  return studyPack;
}

function validateLearningStudyPack(studyPack, section, passage) {
  if (!isModelStudyPack(studyPack)) {
    throw new Error('reading-study-pack-not-model');
  }
  if ((section === 'vocabulary' || section === 'cards') && (!(studyPack.vocabularyCards || []).length || studyPack.vocabularyCards.some((item) => !item.word || !item.meaning))) {
    throw new Error('reading-study-pack-missing-vocabulary');
  }
  if ((section === 'phrases' || section === 'cards') && (!(studyPack.phraseCards || []).length || studyPack.phraseCards.some((item) => !item.text || !item.meaning || !isPhraseLocatable(passage, item)))) {
    throw new Error('reading-study-pack-missing-phrases');
  }
  if ((section === 'patterns' || section === 'cards') && (!(studyPack.sentencePatternCards || []).length || studyPack.sentencePatternCards.some((item) => !item.pattern || !item.meaning || !item.example || !item.exampleMeaning))) {
    throw new Error('reading-study-pack-missing-patterns');
  }
}

function hasStudyPackSection(studyPack, section, passage) {
  const pack = normalizeStudyPack(studyPack, passage);
  if (section === 'vocabulary') {
    return !!pack.vocabularyCards.length;
  }
  if (section === 'phrases') {
    return !!pack.phraseCards.length;
  }
  if (section === 'patterns') {
    return !!pack.sentencePatternCards.length;
  }
  if (section === 'cards') {
    return !!pack.vocabularyCards.length && !!pack.phraseCards.length && !!pack.sentencePatternCards.length;
  }
  return false;
}

function mergeStudyPacks(cached, next, passage) {
  const empty = {
    fullTranslation: '',
    vocabularyCards: [],
    phraseCards: [],
    sentencePatternCards: [],
    questionAnalyses: [],
    source: ''
  };
  const base = cached ? normalizeStudyPack(cached, passage) : empty;
  const incoming = next ? normalizeStudyPack(next, passage) : empty;
  return {
    fullTranslation: incoming.fullTranslation || base.fullTranslation || '',
    vocabularyCards: incoming.vocabularyCards.length ? incoming.vocabularyCards : base.vocabularyCards,
    phraseCards: incoming.phraseCards.length ? incoming.phraseCards : base.phraseCards,
    sentencePatternCards: incoming.sentencePatternCards.length ? incoming.sentencePatternCards : base.sentencePatternCards,
    questionAnalyses: incoming.questionAnalyses.length ? incoming.questionAnalyses : base.questionAnalyses,
    source: incoming.source || base.source || ''
  };
}

function getReadingStudyModelConfig() {
  return {
    endpoint: process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '',
    apiKey: process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '',
    model: process.env.READING_STUDY_MODEL || 'gpt-5.6-terra',
    fallbackModel: process.env.READING_STUDY_FALLBACK_MODEL || 'gpt-5.6-terra'
  };
}

async function buildStudyPackWithModel(passage) {
  const config = getReadingStudyModelConfig();
  if (!config.endpoint || !config.apiKey) {
    throw new Error('reading-study-model-not-configured');
  }
  async function requestJson(model, prompt) {
    const response = await postJson(config.endpoint, config.apiKey, {
      model,
      messages: [
        { role: 'system', content: 'You extract structured English reading study material for Chinese middle-school students.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    }, READING_STUDY_MODEL_TIMEOUT_MS);
    return parseJsonText(extractMessageText(response)) || {};
  }
  async function requestModel(model) {
    return buildQuestionStudyPackWithRequester(passage, model, requestJson);
  }
  try {
    return await requestModel(config.model);
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        return await requestModel(config.fallbackModel);
      } catch (fallbackError) {
        throw new Error(`reading-study-model-failed:${error.message || String(error)};fallback:${fallbackError.message || String(fallbackError)}`);
      }
    }
    throw new Error(`reading-study-model-failed:${error.message || String(error)}`);
  }
}

async function buildLearningPackWithModel(passage, section) {
  const config = getReadingStudyModelConfig();
  const target = ['vocabulary', 'phrases', 'patterns', 'cards'].includes(section) ? section : 'cards';
  if (!config.endpoint || !config.apiKey) {
    throw new Error('reading-study-model-not-configured');
  }
  const sectionRules = {
    vocabulary: [
      '只生成生词卡。',
      '生词必须选择初高中阶段重要、学生可能不熟、且在本文中有学习价值的词；例句必须来自原文或贴近原文。',
      'JSON 格式：{"vocabularyCards":[{"word":"","phonetic":"","meaning":"","example":"","exampleMeaning":""}]}'
    ],
    phrases: [
      '只生成短语卡。',
      '短语 text 必须逐字摘自原文，不能改写成泛化表达；example 必须包含该 text。',
      'JSON 格式：{"phraseCards":[{"text":"","meaning":"","example":""}]}'
    ],
    patterns: [
      '只生成句型卡。',
      '句型卡 meaning 必须是中文解释，example 必须是原文或贴近原文例句，exampleMeaning 必须是例句中文翻译。',
      'JSON 格式：{"sentencePatternCards":[{"pattern":"","meaning":"","example":"","exampleMeaning":""}]}'
    ],
    cards: [
      '只生成生词卡、短语卡、句型卡，不生成全文翻译。',
      '生词必须选择初高中阶段重要、学生可能不熟、且在本文中有学习价值的词；例句必须来自原文或贴近原文。',
      '短语 text 必须逐字摘自原文，不能改写成泛化表达；example 必须包含该 text。',
      '句型卡 meaning 必须是中文解释，example 必须是原文或贴近原文例句，exampleMeaning 必须是例句中文翻译。',
      'JSON 格式：{"vocabularyCards":[{"word":"","phonetic":"","meaning":"","example":"","exampleMeaning":""}],"phraseCards":[{"text":"","meaning":"","example":""}],"sentencePatternCards":[{"pattern":"","meaning":"","example":"","exampleMeaning":""}]}'
    ]
  };
  const prompt = [
    '你是中考英语阅读老师。请只返回 JSON，不要 Markdown。',
    ...sectionRules[target],
    `标题：${passage.title}`,
    `文章：${passage.passage}`
  ].join('\n');
  async function requestModel(model) {
    const response = await postJson(config.endpoint, config.apiKey, {
      model,
      messages: [
        { role: 'system', content: 'You extract structured English reading study material for Chinese middle-school students.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    }, 110000);
    const studyPack = normalizeStudyPack(Object.assign({}, parseJsonText(extractMessageText(response)) || {}, {
      source: `model:${model}`
    }), passage);
    validateLearningStudyPack(studyPack, target, passage);
    return studyPack;
  }
  try {
    return await requestModel(config.model);
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        return await requestModel(config.fallbackModel);
      } catch (fallbackError) {
        throw new Error(`reading-study-model-failed:${error.message || String(error)};fallback:${fallbackError.message || String(fallbackError)}`);
      }
    }
    throw new Error(`reading-study-model-failed:${error.message || String(error)}`);
  }
}

async function translateReadingSentenceWithModel(text) {
  const config = getReadingStudyModelConfig();
  const sentence = normalizeText(text).slice(0, 800);
  if (!sentence) {
    throw new Error('reading-sentence-empty');
  }
  if (!config.endpoint || !config.apiKey) {
    throw new Error('reading-study-model-not-configured');
  }
  async function requestModel(model) {
    const response = await postJson(config.endpoint, config.apiKey, {
      model,
      messages: [
        { role: 'system', content: 'You translate English reading sentences into concise Chinese for middle-school students.' },
        { role: 'user', content: `只返回 JSON，不要 Markdown。翻译这个英文句子，保留原意，中文自然简洁。JSON 格式：{"translation":""}\n句子：${sentence}` }
      ],
      temperature: 0.1
    }, 30000);
    const parsed = parseJsonText(extractMessageText(response)) || {};
    if (!parsed.translation) {
      throw new Error('reading-sentence-translation-empty');
    }
    return {
      sentence,
      translation: parsed.translation,
      source: `model:${model}`
    };
  }
  try {
    return await requestModel(config.model);
  } catch (error) {
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      try {
        return await requestModel(config.fallbackModel);
      } catch (fallbackError) {
        throw new Error(`reading-sentence-translation-failed:${error.message || String(error)};fallback:${fallbackError.message || String(fallbackError)}`);
      }
    }
    throw new Error(`reading-sentence-translation-failed:${error.message || String(error)}`);
  }
}

function sentenceTranslationHash(passageId, sentence) {
  return crypto.createHash('sha1').update(`${passageId || ''}\n${sentence || ''}`).digest('hex');
}

async function getCachedSentenceTranslation(ctx, passageId, sentence) {
  const sentenceHash = sentenceTranslationHash(passageId, sentence);
  try {
    const result = await dbAdapter.collection(SENTENCE_TRANSLATION_COLLECTION).where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      passageId,
      sentenceHash
    }).limit(1).get();
    const item = result && result.data && result.data[0];
    return item && item.translation ? item : null;
  } catch (error) {
    throw new Error(`reading-sentence-cache-read-failed:${error && error.message ? error.message : error}`);
  }
}

async function saveSentenceTranslation(ctx, passageId, sentenceTranslation) {
  if (!sentenceTranslation || !sentenceTranslation.sentence || !sentenceTranslation.translation) {
    return false;
  }
  const sentenceHash = sentenceTranslationHash(passageId, sentenceTranslation.sentence);
  const now = new Date().toISOString();
  const data = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    passageId,
    sentenceHash,
    sentence: sentenceTranslation.sentence,
    translation: sentenceTranslation.translation,
    source: sentenceTranslation.source || '',
    updatedAt: now
  };
  try {
    const result = await dbAdapter.collection(SENTENCE_TRANSLATION_COLLECTION).where({
      familyId: data.familyId,
      childId: data.childId,
      passageId,
      sentenceHash
    }).limit(1).get();
    const current = result && result.data && result.data[0];
    if (current && current._id) {
      await dbAdapter.collection(SENTENCE_TRANSLATION_COLLECTION).doc(current._id).update({ data });
      return true;
    }
    await dbAdapter.collection(SENTENCE_TRANSLATION_COLLECTION).add({ data: Object.assign({}, data, { createdAt: now }) });
    return true;
  } catch (error) {
    console.error('[reading-sentence] save failed', passageId, error && error.message ? error.message : error);
    return false;
  }
}

async function getCachedStudyPack(passageOrId) {
  const passage = passageOrId && typeof passageOrId === 'object' ? passageOrId : null;
  const passageId = passage ? passage._id : passageOrId;
  try {
    const result = await dbAdapter.collection(STUDY_PACK_COLLECTION)
      .where({ passageId })
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();
    const rows = result && Array.isArray(result.data) ? result.data.filter((row) => row && row.studyPack) : [];
    if (!rows.length) {
      return null;
    }
    if (!passage) {
      return rows[0].studyPack;
    }
    return rows.reverse().reduce((merged, row) => mergeStudyPacks(merged, row.studyPack, passage), null);
  } catch (error) {
    throw new Error(`reading-study-pack-cache-read-failed:${error && error.message ? error.message : error}`);
  }
}

async function saveStudyPack(passage, studyPack, options) {
  if (!passage || !passage._id || !studyPack) {
    return false;
  }
  try {
    if (options && options.validateQuestions && (studyPack.questionAnalyses || []).length) {
      validateQuestionStudyPack(studyPack, passage);
    }
    await dbAdapter.collection(STUDY_PACK_COLLECTION).add({
      data: {
        passageId: passage._id,
        title: passage.title,
        studyPack,
        source: studyPack.source || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error('[reading-study-pack] save failed', passage._id, error && error.message ? error.message : error);
    return false;
  }
}

async function getOrCreateStudyPack(passage, existingCached, force) {
  const cached = existingCached || await getCachedStudyPack(passage);
  const cachedPack = cached ? normalizeStudyPack(cached, passage) : null;
  if (!force && cachedPack && isValidQuestionStudyPack(cachedPack, passage)) {
    return { studyPack: cachedPack, cached: true };
  }
  const promiseKey = String(passage && passage._id || '');
  if (!force && promiseKey && studyPackBuildPromises[promiseKey]) {
    return studyPackBuildPromises[promiseKey];
  }
  const request = (async () => {
    const studyPack = await buildStudyPackWithModel(passage);
    const saved = await saveStudyPack(passage, studyPack, { validateQuestions: true });
    if (!saved) throw new Error('reading-study-pack-save-failed');
    return { studyPack, cached: false };
  })();
  if (promiseKey) studyPackBuildPromises[promiseKey] = request;
  try {
    return await request;
  } finally {
    if (promiseKey && studyPackBuildPromises[promiseKey] === request) {
      delete studyPackBuildPromises[promiseKey];
    }
  }
}

function buildMemoryPlan(passages) {
  const vocabularyCount = passages.reduce((sum, passage) => sum + (passage.vocabulary || []).length, 0);
  const phraseCount = passages.reduce((sum, passage) => sum + (passage.phrases || []).length, 0);
  const sentencePatternCount = passages.reduce((sum, passage) => sum + buildSentencePatterns(passage).length, 0);
  return {
    vocabularyCount,
    phraseCount,
    sentencePatternCount,
    checks: ['单词拼写', '词组英译', '句型仿写']
  };
}

function gradeAnswers(passage, answers) {
  const answerMap = answers || {};
  let keyedCount = 0;
  let correctCount = 0;
  const pointPerQuestion = 2;
  const normalizeAnalysisText = (text) => {
    const value = String(text || '').trim();
    if (!value || value === '结合原文判断。' || value === '结合原文判断' || value === '解析生成中，请稍等。') {
      return '生成解析中';
    }
    return value;
  };
  const questionResults = passage.questions.map((question) => {
    const isChoice = !!(question.options && Object.keys(question.options).length);
    const selectedRaw = String(answerMap[question.number] || '').trim();
    const answerRaw = String(question.answer || '').trim();
    const selected = isChoice ? selectedRaw.toUpperCase() : selectedRaw;
    const answer = isChoice ? answerRaw.toUpperCase() : answerRaw;
    const keyed = !!answer;
    if (keyed) {
      keyedCount += 1;
      if (isChoice ? selected === answer : normalizeText(selected).toLowerCase() === normalizeText(answer).toLowerCase()) {
        correctCount += 1;
      }
    }
    return {
      number: question.number,
      prompt: question.prompt,
      selected,
      answer,
      correct: keyed ? (isChoice ? selected === answer : normalizeText(selected).toLowerCase() === normalizeText(answer).toLowerCase()) : null,
      analysis: normalizeAnalysisText(question.analysis)
    };
  });
  const totalScore = keyedCount * pointPerQuestion;
  const score = correctCount * pointPerQuestion;
  return {
    score: keyedCount ? score : null,
    totalScore,
    pointPerQuestion,
    correctCount,
    totalCount: keyedCount,
    questionResults
  };
}

function normalizeAnswerSentenceForQuestion(item, question, index) {
  const text = textValue(item, ['text', 'sentence']);
  if (!text) {
    return null;
  }
  const source = typeof item === 'string' ? {} : (item || {});
  const number = source.questionNumber || source.number || source.question || (question && question.number) || index + 1;
  return {
    number,
    label: `第${number}题`,
    text,
    translation: source.translation || source.meaning || source.cn || ''
  };
}

function buildReview(passage, grade, studyPack) {
  const normalizedPack = normalizeStudyPack(studyPack, passage);
  const modelAnalysesByNumber = (normalizedPack.questionAnalyses || []).reduce((map, item) => {
    map[String(item.number)] = item;
    return map;
  }, {});
  const fallbackAnswerSentences = (passage.answerSentences || [])
    .map((item, index) => normalizeAnswerSentenceForQuestion(item, passage.questions[index], index))
    .filter(Boolean);
  const answerSentences = grade.questionResults.map((item) => {
    const modelAnalysis = modelAnalysesByNumber[String(item.number)] || {};
    const fallback = fallbackAnswerSentences.find((sentence) => String(sentence.number) === String(item.number)) || null;
    const text = modelAnalysis.answerSentence || (fallback && fallback.text) || '';
    if (!text) {
      return null;
    }
    return {
      number: item.number,
      label: `第${item.number}题`,
      text,
      translation: modelAnalysis.answerSentenceTranslation || (fallback && fallback.translation) || ''
    };
  }).filter(Boolean);
  return {
    answerSentences,
    phrases: (passage.phrases || []).map((item) => textValue(item, ['phrase', 'text'])).filter(Boolean),
    vocabulary: (passage.vocabulary || []).map((item) => textValue(item, ['word', 'text'])).filter(Boolean),
    sentencePatterns: buildSentencePatterns(passage).map(formatSentencePattern).filter(Boolean),
    fullTranslation: normalizedPack.fullTranslation,
    vocabularyCards: normalizedPack.vocabularyCards,
    phraseCards: normalizedPack.phraseCards,
    sentencePatternCards: normalizedPack.sentencePatternCards,
    studyPackSource: normalizedPack.source,
    memoryChecks: {
      vocabulary: normalizedPack.vocabularyCards.slice(0, 8).map((item) => item.word).filter(Boolean),
      phrases: normalizedPack.phraseCards.slice(0, 6).map((item) => item.text).filter(Boolean),
      sentencePatterns: normalizedPack.sentencePatternCards.slice(0, 3).map((item) => item.pattern).filter(Boolean)
    },
    analysis: grade.questionResults.map((item) => ({
      number: item.number,
      answer: item.answer || (modelAnalysesByNumber[String(item.number)] && modelAnalysesByNumber[String(item.number)].answer) || '',
      selected: item.selected,
      correct: item.correct,
      answerSentence: answerSentences.find((sentence) => String(sentence.number) === String(item.number)) || null,
      text: (modelAnalysesByNumber[String(item.number)] && modelAnalysesByNumber[String(item.number)].analysis) || item.analysis
    }))
  };
}

function keepQuestionReviewOnly(review) {
  return Object.assign({}, review, {
    phrases: [],
    vocabulary: [],
    sentencePatterns: [],
    fullTranslation: '',
    vocabularyCards: [],
    phraseCards: [],
    sentencePatternCards: [],
    memoryChecks: {
      vocabulary: [],
      phrases: [],
      sentencePatterns: []
    }
  });
}

async function getLatestAttemptsByPassageIds(ctx, passageIds, today) {
  if (!passageIds.length) {
    return {};
  }
  try {
    const result = await dbAdapter.collection('readingAttempts')
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        date: today
      })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const latestByPassageId = {};
    ((result && result.data) || []).forEach((attempt) => {
      if (passageIds.includes(attempt.passageId) && !latestByPassageId[attempt.passageId]) {
        latestByPassageId[attempt.passageId] = attempt;
      }
    });
    return latestByPassageId;
  } catch (error) {
    return {};
  }
}

async function getLatestAttempt(ctx, passageId) {
  try {
    const result = await dbAdapter.collection('readingAttempts')
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        passageId
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    return result && result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function getAttemptById(ctx, passageId, attemptId) {
  if (!attemptId) return null;
  try {
    const result = await dbAdapter.collection('readingAttempts').doc(attemptId).get();
    const attempt = result && result.data ? result.data : null;
    if (!attempt
      || attempt.familyId !== ctx.family.familyId
      || attempt.childId !== ctx.child.childId
      || attempt.passageId !== passageId) {
      return null;
    }
    return attempt;
  } catch (error) {
    return null;
  }
}

async function getReadingHome(event) {
  const payload = (event && event.payload) || {};
  if (payload.directoryOnly) {
    const passages = await loadPassageDirectory();
    return {
      today: study.getTodayString(),
      dailyCount: 0,
      passage: null,
      passages: [],
      categoryTree: buildCategoryTree(passages, null),
      memoryPlan: null,
      completedCount: 0,
      totalCount: 0,
      completedToday: false,
      latestAttempt: null
    };
  }
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingHome'
  }));
  const passages = await loadPassages();
  const includeDirectory = !!payload.includeDirectory || !!payload.directoryOnly;
  const requestedCount = Math.min(
    Math.max(Number(payload.dailyCount || DEFAULT_READING_DAILY_COUNT), 1),
    MAX_READING_DAILY_COUNT
  );
  const plannedPassages = await pickPlannedPassages(ctx, passages, today, requestedCount);
  const passageIds = plannedPassages.map((item) => item._id);
  const latestByPassageId = await getLatestAttemptsByPassageIds(ctx, passageIds, today);
  const latestByAllPassageId = includeDirectory
    ? await getLatestAttemptsByPassageIds(ctx, passages.map((item) => item._id), today)
    : {};
  const summaries = plannedPassages.map((item, index) => {
    const latestAttempt = latestByPassageId[item._id] || null;
    return Object.assign(createPassageSummary(item), {
      index: index + 1,
      completed: !!(latestAttempt && latestAttempt.status === 'completed'),
      latestAttempt
    });
  });
  const completedCount = summaries.filter((item) => item.completed).length;
  const passage = plannedPassages[0] || null;
  const latestAttempt = passage ? latestByPassageId[passage._id] || null : null;
  return {
    today,
    dailyCount: summaries.length,
    passage: attachAttemptSummary(createPassageSummary(passage), latestAttempt),
    passages: summaries,
    categoryTree: includeDirectory ? buildCategoryTree(passages, latestByAllPassageId) : [],
    memoryPlan: buildMemoryPlan(plannedPassages),
    completedCount,
    totalCount: summaries.length,
    completedToday: !!(latestAttempt && latestAttempt.status === 'completed'),
    latestAttempt
  };
}

async function getReadingPassage(event) {
  const payload = (event && event.payload) || {};
  const passageId = String(payload.passageId || '');
  const attemptId = String(payload.attemptId || '');
  const contextPromise = study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingPassage'
  }));
  const passagePromise = passageId ? findPassageById(passageId, study.getTodayString()) : null;
  const { ctx, today } = await contextPromise;
  const passages = passageId ? null : await loadPassages();
  const passage = passageId
    ? await passagePromise
    : await pickPlannedPassage(ctx, passages, today);
  const latestAttempt = passage
    ? (await getAttemptById(ctx, passage._id, attemptId) || await getLatestAttempt(ctx, passage._id))
    : null;
  return {
    today,
    passage,
    latestAttempt
  };
}

async function savePersonalQuestionStudyPack(ctx, today, passage, studyPack, attemptId) {
  if (!attemptId || !study.isStudyWriteAllowed(ctx)) {
    throw new Error('reading-personal-analysis-attempt-required');
  }
  const result = await dbAdapter.collection('readingAttempts').doc(attemptId).get();
  const attempt = result && result.data ? result.data : null;
  if (!attempt
    || attempt.familyId !== ctx.family.familyId
    || attempt.childId !== ctx.child.childId
    || attempt.passageId !== passage._id) {
    throw new Error('reading-personal-analysis-attempt-not-found');
  }
  const review = keepQuestionReviewOnly(buildReview(passage, {
    questionResults: Array.isArray(attempt.questionResults) ? attempt.questionResults : []
  }, studyPack));
  const now = new Date().toISOString();
  const command = dbAdapter.getCommand();
  await dbAdapter.collection('readingAttempts').doc(attemptId).update({
    data: {
      review: command.set(review),
      updatedAt: now
    }
  });
  const personalAttempt = Object.assign({}, attempt, {
    _id: attemptId,
    review,
    updatedAt: now
  });
  await completion.upsertStudyCompletion(ctx, attempt.date || today, {
    type: 'reading',
    targetId: passage._id,
    passageId: passage._id,
    title: passage.title || '阅读练习',
    meta: passage.year ? `${passage.year} · ${passage.district || ''}` : '阅读',
    progressText: `${Number(attempt.score || 0)}/${Number(attempt.totalScore || 0)} 分`,
    latestAttempt: personalAttempt
  });
  return { review, attempt: personalAttempt };
}

async function getReadingStudyPack(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingStudyPack'
  }));
  const passage = await findPassageById(String(payload.passageId || ''), today);
  if (!passage) {
    throw new Error('reading-passage-not-found');
  }
  if (String(payload.section || '') === 'sentenceTranslation') {
    const sentence = normalizeText(payload.text || '').slice(0, 800);
    const cached = await getCachedSentenceTranslation(ctx, passage._id, sentence);
    const sentenceTranslation = cached
      ? {
        sentence: cached.sentence,
        translation: cached.translation,
        source: cached.source || 'cache'
      }
      : await translateReadingSentenceWithModel(sentence);
    if (!cached) {
      const saved = await saveSentenceTranslation(ctx, passage._id, sentenceTranslation);
      if (!saved) throw new Error('reading-sentence-save-failed');
    }
    return {
      passageId: passage._id,
      section: 'sentenceTranslation',
      sentenceTranslation
    };
  }
  const section = String(payload.section || 'cards');
  const cacheOnly = !!payload.cacheOnly;
  const force = !!payload.force;
  const personalOnly = !!payload.personalOnly;
  const cached = await getCachedStudyPack(passage);
  if (section === 'questions') {
    const cachedPack = cached ? normalizeStudyPack(cached, passage) : null;
    if (!force && cachedPack && isValidQuestionStudyPack(cachedPack, passage)) {
      return {
        passageId: passage._id,
        section,
        studyPack: cachedPack,
        cached: true
      };
    }
    if (cacheOnly) {
      return {
        passageId: passage._id,
        section,
        studyPack: null,
        cached: false,
        cacheMiss: true
      };
    }
    if (force && personalOnly) {
      const studyPack = await buildStudyPackWithModel(passage);
      const personal = await savePersonalQuestionStudyPack(
        ctx,
        today,
        passage,
        studyPack,
        String(payload.attemptId || '')
      );
      return {
        passageId: passage._id,
        section,
        studyPack,
        review: personal.review,
        attempt: personal.attempt,
        cached: false,
        persisted: true,
        personalOnly: true
      };
    }
    const result = await getOrCreateStudyPack(passage, cached, force);
    return {
      passageId: passage._id,
      section,
      studyPack: result.studyPack,
      cached: result.cached
    };
  }
  if (cached && hasStudyPackSection(cached, section, passage)) {
    const studyPack = normalizeStudyPack(cached, passage);
    return {
      passageId: passage._id,
      section,
      studyPack
    };
  }
  if (cacheOnly) {
    return {
      passageId: passage._id,
      section,
      studyPack: null,
      cached: false,
      cacheMiss: true
    };
  }
  const generatedPack = await buildLearningPackWithModel(passage, section);
  const studyPack = mergeStudyPacks(cached, generatedPack, passage);
  const saved = await saveStudyPack(passage, studyPack);
  if (!saved) throw new Error('reading-study-pack-save-failed');
  return {
    passageId: passage._id,
    section,
    studyPack
  };
}

async function submitReadingAttempt(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'submitReadingAttempt'
  }));
  const passage = await findPassageById(String(payload.passageId || ''), today);
  if (!passage) {
    throw new Error('reading-passage-not-found');
  }
  const grade = gradeAnswers(passage, payload.answers || {});
  const rawManualMarks = payload.manualMarks || {};
  const manualMarks = {
    tokenMarks: Object.keys(rawManualMarks.tokenMarks || {}).slice(0, 600).reduce((map, key) => {
      const tone = rawManualMarks.tokenMarks[key];
      if (/^\d+:\d+$/.test(key) && (tone === 'word' || tone === 'phrase')) map[key] = tone;
      return map;
    }, {}),
    sentenceMarks: Object.keys(rawManualMarks.sentenceMarks || {}).slice(0, 120).reduce((map, key) => {
      if (/^\d+$/.test(key) && rawManualMarks.sentenceMarks[key]) map[key] = true;
      return map;
    }, {}),
    items: (Array.isArray(rawManualMarks.items) ? rawManualMarks.items : []).slice(0, 120).map((item) => ({
      type: ['word', 'phrase', 'sentence'].includes(item && item.type) ? item.type : 'word',
      text: normalizeText(item && item.text).slice(0, 500)
    })).filter((item) => item.text)
  };
  let review = keepQuestionReviewOnly(buildReview(passage, grade, null));
  const attempt = {
    passageId: passage._id,
    title: passage.title,
    date: today,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    answers: payload.answers || {},
    manualMarks,
    score: grade.score,
    totalScore: grade.totalScore,
    pointPerQuestion: grade.pointPerQuestion,
    correctCount: grade.correctCount,
    totalCount: grade.totalCount,
    questionResults: grade.questionResults,
    review,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (study.isStudyWriteAllowed(ctx)) {
    try {
      const created = await dbAdapter.collection('readingAttempts').add({
        data: attempt
      });
      attempt._id = created && created._id ? created._id : '';
    } catch (error) {
      attempt.saveWarning = 'readingAttempts 集合暂未写入，结果仅本次显示。';
    }
    try {
      await completion.upsertStudyCompletion(ctx, today, {
        type: 'reading',
        targetId: passage._id,
        passageId: passage._id,
        title: passage.title || '阅读练习',
        meta: passage.year ? `${passage.year} · ${passage.district || ''}` : '阅读',
        progressText: `${grade.score}/${grade.totalScore} 分`,
        latestAttempt: attempt
      });
    } catch (error) {
      attempt.completionWarning = '完成记录暂未同步，稍后会在记录页刷新。';
    }
    try {
      const cached = await getCachedStudyPack(passage);
      const generated = await getOrCreateStudyPack(passage, cached, false);
      review = keepQuestionReviewOnly(buildReview(passage, grade, generated.studyPack));
      attempt.review = review;
      attempt.analysisStatus = 'ready';
      attempt.updatedAt = new Date().toISOString();
      if (attempt._id) {
        const command = dbAdapter.getCommand();
        await dbAdapter.collection('readingAttempts').doc(attempt._id).update({
          data: {
            review: command.set(review),
            analysisStatus: 'ready',
            updatedAt: attempt.updatedAt
          }
        });
      }
      await completion.upsertStudyCompletion(ctx, today, {
        type: 'reading',
        targetId: passage._id,
        passageId: passage._id,
        title: passage.title || '阅读练习',
        meta: passage.year ? `${passage.year} · ${passage.district || ''}` : '阅读',
        progressText: `${grade.score}/${grade.totalScore} 分`,
        latestAttempt: attempt
      });
    } catch (error) {
      attempt.analysisStatus = 'pending';
      attempt.analysisError = String(error && error.message || error || '');
    }
  } else {
    attempt.status = 'preview';
    attempt.saveWarning = '家长模式，不计入记录。';
  }
  return {
    passage,
    attempt,
    review,
    studyWriteAllowed: study.isStudyWriteAllowed(ctx)
  };
}

async function synthesizeReadingAudio(event) {
  const payload = (event && event.payload) || {};
  await study.prepareRequestContext(Object.assign({}, event, {
    action: 'synthesizeReadingAudio'
  }));
  const text = normalizeText(payload.text).slice(0, 500);
  if (!text) {
    throw new Error('reading-audio-text-empty');
  }
  const cacheKey = text.toLowerCase();
  const hash = crypto.createHash('sha1').update(cacheKey).digest('hex').slice(0, 20);
  const cached = await findReadingAudioCache(hash);
  if (cached && (cached.fileId || cached.cloudPath)) {
    const audioUrl = await storageAdapter.getTempFileURL(cached.fileId, cached.cloudPath);
    if (audioUrl) {
      return {
        text,
        fileId: cached.fileId || '',
        cloudPath: cached.cloudPath || '',
        audioUrl,
        cached: true
      };
    }
  }
  const cloudPath = [
    '_reading_dictionary_audio',
    'words',
    `${hash}.mp3`
  ].join('/');
  let audioFile = null;
  try {
    if (!payload.skipYoudao) {
      audioFile = await synthesizeWordAudioFast(text, cloudPath);
    }
    if (!audioFile) {
      audioFile = await synthesizeMerriamWebsterAudio(text, cloudPath);
    }
  } catch (error) {
    throw new Error(`reading-audio-dictionary-failed:${error.message || String(error)}`);
  }
  const fileId = audioFile && audioFile.fileId ? audioFile.fileId : '';
  if (!fileId) {
    throw new Error('reading-audio-dictionary-unavailable');
  }
  const audioUrl = await storageAdapter.getTempFileURL(fileId, cloudPath);
  try {
    await dbAdapter.collection(READING_AUDIO_CACHE_COLLECTION).add({
      data: {
        hash,
        text,
        fileId,
        cloudPath,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    // Audio can still play even if cache metadata is not saved.
  }
  return {
    text,
    fileId,
    cloudPath,
    audioUrl,
    cached: false
  };
}

async function lookupWord(event) {
  const payload = (event && event.payload) || {};
  await study.prepareRequestContext(Object.assign({}, event, {
    action: 'lookupWord'
  }));
  const wordLower = normalizeLookupWord(payload.word);
  if (!wordLower || !isSingleWord(wordLower)) {
    throw new Error('dictionary-word-invalid');
  }
  const cached = await findDictionaryEntry(wordLower);
  if (cached) {
    let audioUrl = cached.audioUrl || '';
    if (!audioUrl && (cached.audioFileId || cached.audioCloudPath)) {
      audioUrl = await storageAdapter.getTempFileURL(cached.audioFileId, cached.audioCloudPath);
    }
    let audioPatch = null;
    if (!audioUrl) {
      audioPatch = await ensureDictionaryAudio(wordLower, cached);
      audioUrl = audioPatch.audioUrl || '';
      if (cached._id && audioPatch.audioFileId) {
        try {
          await dbAdapter.collection(WORD_DICTIONARY_COLLECTION).doc(cached._id).update({
            data: {
              audioFileId: audioPatch.audioFileId,
              audioCloudPath: audioPatch.audioCloudPath,
              updatedAt: new Date().toISOString()
            }
          });
        } catch (error) {
          // Lookup result can still be used even if cache update fails.
        }
      }
    }
    return Object.assign({}, cached, audioPatch ? {
      audioFileId: audioPatch.audioFileId || cached.audioFileId || '',
      audioCloudPath: audioPatch.audioCloudPath || cached.audioCloudPath || '',
      audioDebug: audioPatch.audioDebug
    } : {}, {
      word: cached.word || wordLower,
      wordLower,
      definitions: Array.isArray(cached.definitions) ? cached.definitions : [],
      audioUrl,
      cached: true
    });
  }

  const data = await fetchJson(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(wordLower)}`, 5000);
  const entry = parseYoudaoWord(data, wordLower);
  const audioPatch = await ensureDictionaryAudio(wordLower);
  const audioFileId = audioPatch.audioFileId || '';
  const audioCloudPath = audioPatch.audioCloudPath || '';
  const audioUrl = audioPatch.audioUrl || '';
  const saved = Object.assign({}, entry, {
    audioFileId,
    audioCloudPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  try {
    await dbAdapter.collection(WORD_DICTIONARY_COLLECTION).add({ data: saved });
  } catch (error) {
    // Lookup result can still be used even if cache save fails.
  }
  return Object.assign({}, saved, {
    audioUrl,
    audioDebug: audioPatch.audioDebug,
    cached: false
  });
}

module.exports = {
  getReadingHome,
  getReadingPassage,
  getReadingStudyPack,
  synthesizeReadingAudio,
  submitReadingAttempt,
  lookupWord,
  _test: {
    isValidQuestionStudyPack,
    buildQuestionStudyPackWithRequester,
    extractModelQuestionAnalyses,
    parseJsonText,
    READING_STUDY_MODEL_TIMEOUT_MS
  }
};
