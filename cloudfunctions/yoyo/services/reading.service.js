const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const samplePassages = require('../data/reading-passages.sample.json');
const speakingEngine = require('../lib/speaking-engine');
const crypto = require('crypto');
const https = require('https');

const DEFAULT_READING_DAILY_COUNT = 3;
const MAX_READING_DAILY_COUNT = 20;
const STUDY_PACK_COLLECTION = 'readingStudyPacks';

function todayIndex(today) {
  const start = Date.parse('2026-06-29T00:00:00+08:00');
  const current = Date.parse(`${today}T00:00:00+08:00`);
  if (!Number.isFinite(current) || current < start) {
    return 0;
  }
  return Math.floor((current - start) / 86400000);
}

function normalizePassage(item) {
  return {
    _id: item._id || item.id,
    title: item.title || '阅读练习',
    year: item.year || '',
    district: item.district || '',
    examType: item.examType || '',
    section: item.section || '',
    sourceType: item.sourceType || '',
    passage: item.passage || '',
    translation: item.translation || item.fullTranslation || '',
    questions: Array.isArray(item.questions) ? item.questions : [],
    answerSentences: Array.isArray(item.answerSentences) ? item.answerSentences : [],
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    vocabulary: Array.isArray(item.vocabulary) ? item.vocabulary : [],
    sentencePatterns: Array.isArray(item.sentencePatterns) ? item.sentencePatterns : [],
    status: item.status || 'sample'
  };
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

async function loadPassages() {
  const cloudPassages = await readCollection('readingPassages', 200);
  const list = cloudPassages.length ? cloudPassages : samplePassages;
  return list.map(normalizePassage).filter((item) => item._id && item.passage);
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
  return {
    _id: passage._id,
    title: passage.title,
    meta: [passage.year, passage.district, passage.examType, passage.section].filter(Boolean).join(' · '),
    questionCount: passage.questions.length,
    status: passage.status
  };
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
  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function normalizeExamType(value) {
  if (value === '一模' || value === '二模' || value === '真题') {
    return value;
  }
  return value && String(value).includes('真题') ? '真题' : String(value || '二模');
}

function buildCategoryTree(passages, latestByPassageId) {
  const examTypes = ['一模', '二模', '真题'];
  const groups = examTypes.map((examType) => {
    const districtMap = {};
    passages.forEach((passage) => {
      if (normalizeExamType(passage.examType) !== examType) {
        return;
      }
      const district = passage.district || '未分区';
      if (!districtMap[district]) {
        districtMap[district] = {
          count: 0,
          passages: []
        };
      }
      const latestAttempt = latestByPassageId && latestByPassageId[passage._id] ? latestByPassageId[passage._id] : null;
      districtMap[district].count += 1;
      districtMap[district].passages.push(Object.assign(createPassageSummary(passage), {
        completed: !!(latestAttempt && latestAttempt.status === 'completed'),
        latestAttempt
      }));
    });
    return {
      key: examType,
      label: examType === '真题' ? '真题卷' : examType,
      count: Object.values(districtMap).reduce((sum, item) => sum + item.count, 0),
      districts: Object.keys(districtMap).sort().map((district) => ({
        key: district,
        label: district,
        count: districtMap[district].count,
        completedCount: districtMap[district].passages.filter((item) => item.completed).length,
        passages: districtMap[district].passages
      }))
    };
  });
  return [{
    key: 'middle-school-reading',
    label: '中考阅读',
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
    example: item.example || pattern
  };
}

function buildFallbackStudyPack(passage) {
  return {
    fullTranslation: passage.translation || '',
    vocabularyCards: (passage.vocabulary || []).map(formatVocabularyCard).filter(Boolean),
    phraseCards: (passage.phrases || []).map(formatPhraseItem).filter(Boolean),
    sentencePatternCards: buildSentencePatterns(passage).map(formatSentencePattern).filter(Boolean),
    source: 'fallback'
  };
}

function normalizeStudyPack(pack, passage) {
  const fallback = buildFallbackStudyPack(passage);
  const source = pack && pack.source ? pack.source : fallback.source;
  return {
    fullTranslation: normalizeText((pack && pack.fullTranslation) || fallback.fullTranslation),
    vocabularyCards: ((pack && pack.vocabularyCards) || fallback.vocabularyCards || []).map(formatVocabularyCard).filter(Boolean).slice(0, 20),
    phraseCards: ((pack && pack.phraseCards) || fallback.phraseCards || []).map(formatPhraseItem).filter(Boolean).slice(0, 20),
    sentencePatternCards: ((pack && pack.sentencePatternCards) || fallback.sentencePatternCards || []).map(formatSentencePattern).filter(Boolean).slice(0, 12),
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
  if (!studyPack.questionAnalyses || studyPack.questionAnalyses.length < questions.length) {
    throw new Error('reading-study-pack-missing-question-analyses');
  }
  const analysisByNumber = studyPack.questionAnalyses.reduce((map, item) => {
    map[String(item.number)] = item;
    return map;
  }, {});
  questions.forEach((question) => {
    const analysis = analysisByNumber[String(question.number)];
    if (!analysis || !analysis.answerSentence || !analysis.analysis) {
      throw new Error(`reading-study-pack-missing-question-${question.number}`);
    }
  });
  if (!studyPack.sentencePatternCards || !studyPack.sentencePatternCards.length) {
    throw new Error('reading-study-pack-missing-sentence-patterns');
  }
  if (studyPack.sentencePatternCards.some((item) => !item.pattern || !item.meaning)) {
    throw new Error('reading-study-pack-missing-sentence-pattern-translation');
  }
}

function getReadingStudyModelConfig() {
  return {
    endpoint: process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '',
    apiKey: process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '',
    model: process.env.READING_STUDY_MODEL || 'gpt-5.5',
    fallbackModel: process.env.READING_STUDY_FALLBACK_MODEL || 'claude-opus-4-8'
  };
}

async function buildStudyPackWithModel(passage) {
  const config = getReadingStudyModelConfig();
  if (!config.endpoint || !config.apiKey) {
    throw new Error('reading-study-model-not-configured');
  }
  const prompt = [
    '你是中考英语阅读老师。请只返回 JSON，不要 Markdown。',
    '从文章中提取学习包：全文中文翻译、生词卡、短语卡、句型卡、逐题答案句和解析。',
    '生词优先选择中考常见但学生可能不熟的词，例句必须来自原文或贴近原文。',
    '句型卡 meaning 必须是中文解释，example 必须是原文或贴近原文例句。',
    '逐题解析必须按真实题号返回，answerSentence 必须是原文中的直接依据，analysis 用中文说明为什么选该答案。',
    'JSON 格式：{"fullTranslation":"","vocabularyCards":[{"word":"","phonetic":"","meaning":"","example":"","exampleMeaning":""}],"phraseCards":[{"text":"","meaning":"","example":""}],"sentencePatternCards":[{"pattern":"","meaning":"","example":""}],"questionAnalyses":[{"number":69,"answer":"A","answerSentence":"","answerSentenceTranslation":"","analysis":""}]}',
    `标题：${passage.title}`,
    `题目：${JSON.stringify((passage.questions || []).map((item) => ({ number: item.number, prompt: item.prompt, options: item.options, answer: item.answer })))} `,
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
    }, 45000);
    const parsed = parseJsonText(extractMessageText(response));
    const studyPack = normalizeStudyPack(Object.assign({}, parsed || {}, {
      source: `model:${model}`
    }), passage);
    validateModelStudyPack(studyPack, passage);
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

async function getCachedStudyPack(passageId) {
  try {
    const result = await dbAdapter.collection(STUDY_PACK_COLLECTION)
      .where({ passageId })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const row = result && result.data && result.data[0] ? result.data[0] : null;
    return row && row.studyPack ? row.studyPack : null;
  } catch (error) {
    return null;
  }
}

async function saveStudyPack(passage, studyPack) {
  if (!passage || !passage._id || !studyPack) {
    return;
  }
  validateModelStudyPack(studyPack, passage);
  try {
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
  } catch (error) {
    // Missing collection should not block reading attempts.
  }
}

async function getOrCreateStudyPack(passage) {
  const cached = await getCachedStudyPack(passage._id);
  if (cached && isModelStudyPack(cached)) {
    const cachedPack = normalizeStudyPack(cached, passage);
    validateModelStudyPack(cachedPack, passage);
    return cachedPack;
  }
  const studyPack = await buildStudyPackWithModel(passage);
  await saveStudyPack(passage, studyPack);
  return studyPack;
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
  const questionResults = passage.questions.map((question) => {
    const selected = String(answerMap[question.number] || '').trim().toUpperCase();
    const answer = String(question.answer || '').trim().toUpperCase();
    const keyed = !!answer;
    if (keyed) {
      keyedCount += 1;
      if (selected === answer) {
        correctCount += 1;
      }
    }
    return {
      number: question.number,
      prompt: question.prompt,
      selected,
      answer,
      correct: keyed ? selected === answer : null,
      analysis: question.analysis || '请结合原文定位答案句。'
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
      answer: item.answer,
      selected: item.selected,
      correct: item.correct,
      answerSentence: answerSentences.find((sentence) => String(sentence.number) === String(item.number)) || null,
      text: (modelAnalysesByNumber[String(item.number)] && modelAnalysesByNumber[String(item.number)].analysis) || item.analysis
    }))
  };
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

async function getLatestAttempt(ctx, passageId, today) {
  try {
    const result = await dbAdapter.collection('readingAttempts')
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        date: today,
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

async function getReadingHome(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingHome'
  }));
  const passages = await loadPassages();
  const requestedCount = Math.min(
    Math.max(Number(payload.dailyCount || DEFAULT_READING_DAILY_COUNT), 1),
    MAX_READING_DAILY_COUNT
  );
  const plannedPassages = await pickPlannedPassages(ctx, passages, today, requestedCount);
  const passageIds = plannedPassages.map((item) => item._id);
  const latestByPassageId = await getLatestAttemptsByPassageIds(ctx, passageIds, today);
  const latestByAllPassageId = await getLatestAttemptsByPassageIds(ctx, passages.map((item) => item._id), today);
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
    passage: createPassageSummary(passage),
    passages: summaries,
    categoryTree: buildCategoryTree(passages, latestByAllPassageId),
    memoryPlan: buildMemoryPlan(plannedPassages),
    completedCount,
    totalCount: summaries.length,
    completedToday: !!(latestAttempt && latestAttempt.status === 'completed'),
    latestAttempt
  };
}

async function getReadingPassage(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingPassage'
  }));
  const passages = await loadPassages();
  const passage = payload.passageId
    ? passages.find((item) => item._id === String(payload.passageId || '')) || pickDailyPassage(passages, today)
    : await pickPlannedPassage(ctx, passages, today);
  const latestAttempt = passage ? await getLatestAttempt(ctx, passage._id, today) : null;
  return {
    today,
    passage,
    latestAttempt
  };
}

async function getReadingStudyPack(event) {
  const payload = (event && event.payload) || {};
  const { today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingStudyPack'
  }));
  const passage = await findPassageById(String(payload.passageId || ''), today);
  if (!passage) {
    throw new Error('reading-passage-not-found');
  }
  const studyPack = await getOrCreateStudyPack(passage);
  return {
    passageId: passage._id,
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
  const studyPack = await getOrCreateStudyPack(passage);
  const review = buildReview(passage, grade, studyPack);
  const attempt = {
    passageId: passage._id,
    title: passage.title,
    date: today,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    answers: payload.answers || {},
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
  try {
    const created = await dbAdapter.collection('readingAttempts').add({
      data: attempt
    });
    attempt._id = created && created._id ? created._id : '';
  } catch (error) {
    attempt.saveWarning = 'readingAttempts 集合暂未写入，结果仅本次显示。';
  }
  return {
    passage,
    attempt,
    review
  };
}

async function synthesizeReadingAudio(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'synthesizeReadingAudio'
  }));
  const text = normalizeText(payload.text).slice(0, 500);
  if (!text) {
    throw new Error('reading-audio-text-empty');
  }
  const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 20);
  const cloudPath = [
    '_reading_tts',
    ctx.family.familyId,
    ctx.child.childId,
    today,
    `${hash}.mp3`
  ].join('/');
  const fileId = await speakingEngine.synthesizeFeedbackAudio(text, cloudPath);
  if (!fileId) {
    throw new Error('reading-audio-tts-unavailable');
  }
  return {
    text,
    fileId
  };
}

module.exports = {
  getReadingHome,
  getReadingPassage,
  getReadingStudyPack,
  synthesizeReadingAudio,
  submitReadingAttempt
};
