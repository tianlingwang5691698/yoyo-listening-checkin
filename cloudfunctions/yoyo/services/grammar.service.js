const storageAdapter = require('../adapters/storage.adapter');
const dbAdapter = require('../adapters/db.adapter');
const study = require('../facades/study.facade');
const grammarClassroomRepository = require('../repositories/grammar-classroom.repository');
const narrationManifest = require('../data/grammar-narration-manifest.json');
const https = require('https');
const crypto = require('crypto');

const CONTENT_PATHS = {
  topicTypes: '_content/grammar/grammar-topic-types.json',
  byTopic: '_content/grammar/shanghai-em2-grammar-by-topic.json',
  questions: '_content/grammar/shanghai-em2-grammar-questions.json',
  topicDir: '_content/grammar/topics'
};
const EM1_CONTENT_PATHS = {
  topicTypes: '_content/grammar-em1/grammar-topic-types.json',
  byTopic: '_content/grammar-em1/shanghai-em2-grammar-by-topic.json',
  questions: '_content/grammar-em1/shanghai-em2-grammar-questions.json',
  topicDir: '_content/grammar-em1/topics'
};
const SENIOR_SPRING_CONTENT_ROOTS = [];
const SENIOR_AUTUMN_CONTENT_ROOTS = ['_content/grammar-senior-autumn/years/2009/v2'];
const WRONG_COLLECTION = 'grammarWrongQuestions';
const PROGRESS_COLLECTION = 'grammarTopicProgress';
const EXPLANATION_COLLECTION = 'grammarQuestionExplanations';
const NARRATION_AUDIO_COLLECTION = 'grammarLessonNarrationAudios';
const NARRATION_JOB_STALE_MS = 4 * 60 * 1000;
const NARRATION_HASHES = narrationManifest.hashes || {};
const CLASSROOM_RELEASE_CACHE_MS = 30 * 1000;
const CLASSROOM_CONTENT_CACHE_MS = 60 * 1000;
const CLASSROOM_CACHE_MAX_ITEMS = 200;
const classroomCache = new Map();

function normalizeClassroomTopic(value) {
  const topic = String(value || '').trim();
  if (!topic || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(topic)) {
    throw new Error(`grammar-classroom-invalid-topic:topic=${topic || 'empty'}`);
  }
  return topic;
}

function normalizeClassroomLanguage(value) {
  const language = String(value || 'zh-CN').trim().replace('_', '-').toLowerCase();
  if (language === 'zh' || language === 'zh-cn') return 'zh-CN';
  if (language === 'en' || language === 'en-us') return 'en';
  throw new Error(`grammar-classroom-invalid-language:language=${language || 'empty'}`);
}

function normalizeClassroomReleaseId(value, topic, language) {
  const releaseId = String(value || '').trim();
  if (!releaseId || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(releaseId)) {
    throw classroomReadError('release', topic, language, releaseId, 'invalid-release-id');
  }
  return releaseId;
}

function getClassroomCache(key) {
  const cached = classroomCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    classroomCache.delete(key);
    return null;
  }
  return cached.value;
}

function setClassroomCache(key, value, maxAgeMs) {
  if (classroomCache.size >= CLASSROOM_CACHE_MAX_ITEMS && !classroomCache.has(key)) {
    classroomCache.delete(classroomCache.keys().next().value);
  }
  classroomCache.set(key, { value, expiresAt: Date.now() + maxAgeMs });
  return value;
}

function classroomReadError(stage, topic, language, releaseId, error, cloudPath) {
  const cause = String(error && (error.errMsg || error.message) || error || 'unknown')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240);
  const path = cloudPath ? `;path=${cloudPath}` : '';
  return new Error(`grammar-classroom-read-failed:stage=${stage};topic=${topic};language=${language};release=${releaseId || 'unresolved'}${path};cause=${cause}`);
}

async function getLatestClassroomRelease(topic, language) {
  const cacheKey = 'release:latest';
  const cached = getClassroomCache(cacheKey);
  if (cached) return cached;
  let release;
  try {
    release = await grammarClassroomRepository.findLatestReleased();
  } catch (error) {
    throw classroomReadError('release', topic, language, '', error);
  }
  if (!release || !release.releaseId) {
    throw classroomReadError('release', topic, language, '', 'released-active-record-not-found');
  }
  return setClassroomCache(cacheKey, release, CLASSROOM_RELEASE_CACHE_MS);
}

async function getClassroomReleaseContent(topic, language, releaseId) {
  const cloudPath = `_content/grammar-classroom/releases/${releaseId}/topics/${topic}.json`;
  const cacheKey = `content:${releaseId}:${topic}`;
  const cached = getClassroomCache(cacheKey);
  try {
    const content = cached || await storageAdapter.downloadCloudJson(cloudPath);
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('invalid-json-object');
    }
    if (String(content.topicId || '').trim() !== topic) {
      throw new Error(`topic-mismatch:${content.topicId || 'empty'}`);
    }
    if (String(content.releaseId || '').trim() !== releaseId) {
      throw new Error(`release-mismatch:${content.releaseId || 'empty'}`);
    }
    if (!content.bundles || typeof content.bundles !== 'object' || !content.bundles[language]) {
      throw new Error(`bundle-not-found:${language}`);
    }
    if (!cached) setClassroomCache(cacheKey, content, CLASSROOM_CONTENT_CACHE_MS);
    return { content, cloudPath, cached: Boolean(cached) };
  } catch (error) {
    throw classroomReadError('content', topic, language, releaseId, error, cloudPath);
  }
}

async function getGrammarClassroomCourse(event) {
  const payload = (event && event.payload) || {};
  const topic = normalizeClassroomTopic(payload.topic || payload.topicId || event.topic || event.topicId);
  const language = normalizeClassroomLanguage(payload.language || event.language);
  const knownReleaseId = String(payload.knownReleaseId || '').trim();
  const knownContentVersion = String(payload.knownContentVersion || '').trim();
  const release = await getLatestClassroomRelease(topic, language);
  const releaseId = normalizeClassroomReleaseId(release.releaseId, topic, language);
  const downloaded = await getClassroomReleaseContent(topic, language, releaseId);
  const content = downloaded.content;
  const contentVersion = String(content.contentVersion || '').trim();
  const contentVersionMatches = Boolean(
    knownContentVersion && contentVersion && knownContentVersion === contentVersion
  );
  if (contentVersionMatches) {
    return {
      topic,
      language,
      releaseId,
      contentVersion,
      releasedAt: release.releasedAt || release.publishedAt || '',
      notModified: true,
      source: 'grammar-classroom-release'
    };
  }
  return {
    topic,
    language,
    releaseId,
    contentVersion,
    releasedAt: release.releasedAt || release.publishedAt || '',
    notModified: false,
    course: content.bundles[language],
    source: 'grammar-classroom-release',
    cacheHit: downloaded.cached
  };
}

function topicFileName(topicId) {
  return `${crypto.createHash('sha1').update(String(topicId || '')).digest('hex')}.json`;
}

async function safeDownloadJson(path, fallback) {
  try {
    const data = await storageAdapter.downloadCloudJson(path);
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      return data.items || data.data || data;
    }
    return fallback;
  } catch (error) {
    return fallback;
  }
}

function contentPathsFor(event) {
  const payload = (event && event.payload) || {};
  const exam = String(payload.examId || payload.examType || event.examId || event.examType || '').trim();
  const roots = exam === 'spring' || exam === '春考'
    ? SENIOR_SPRING_CONTENT_ROOTS
    : (exam === 'autumn' || exam === '秋考' ? SENIOR_AUTUMN_CONTENT_ROOTS : null);
  if (roots) {
    return roots.map((root) => ({
      topicTypes: `${root}/grammar-topic-types.json`,
      byTopic: `${root}/shanghai-senior-grammar-by-topic.json`,
      questions: `${root}/shanghai-senior-grammar-questions.json`,
      topicDir: `${root}/topics`
    }));
  }
  return [exam === 'em1' || exam === '一模' ? EM1_CONTENT_PATHS : CONTENT_PATHS];
}

function mergeTopicTypes(lists) {
  const categories = new Map();
  (lists || []).flat().forEach((topic) => {
    if (!topic || !topic.topicId) return;
    const current = categories.get(topic.topicId) || { topicId: topic.topicId, topic: topic.topic, count: 0, children: [], childMap: new Map() };
    current.count += Number(topic.count || 0);
    (topic.children || []).forEach((child) => {
      const childCurrent = current.childMap.get(child.topicId) || { topicId: child.topicId, topic: child.topic, count: 0 };
      childCurrent.count += Number(child.count || 0);
      current.childMap.set(child.topicId, childCurrent);
    });
    categories.set(topic.topicId, current);
  });
  return Array.from(categories.values()).map((topic) => ({
    topicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: Array.from(topic.childMap.values())
  }));
}

async function getGrammarHome(event) {
  const pathSets = contentPathsFor(event);
  const rawTopicTypes = mergeTopicTypes(await Promise.all(pathSets.map((paths) => safeDownloadJson(paths.topicTypes, []))));
  const topicTypes = rawTopicTypes.map((topic) => ({
    topicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: topic.children || []
  }));
  return {
    topicTypes,
    byTopic: [],
    questions: [],
    source: topicTypes.length ? 'cloud-storage' : 'empty'
  };
}

async function getGrammarTopic(event) {
  const payload = (event && event.payload) || {};
  const pathSets = contentPathsFor(event);
  const topicId = String(payload.topicId || event.topicId || '').trim();
  if (!topicId) {
    return { topic: null, questions: [], source: 'skipped-no-topic' };
  }
  const topics = (await Promise.all(pathSets.map((paths) => safeDownloadJson(`${paths.topicDir}/${topicFileName(topicId)}`, null)))).filter(Boolean);
  const topic = topics.length ? {
    topicId,
    topic: topics.find((item) => item.topic)?.topic || '',
    questions: topics.flatMap((item) => item.questions || [])
  } : null;
  return {
    topic,
    questions: topic ? (topic.questions || []) : [],
    source: topic ? 'cloud-storage-topic-file' : 'empty'
  };
}

function compactQuestion(question) {
  return {
    _id: question._id || '',
    year: question.year || '',
    district: question.district || '',
    number: question.number || '',
    prompt: question.prompt || '',
    options: question.options || {},
    answer: question.answer || '',
    categoryId: question.categoryId || '',
    category: question.category || '',
    subtopicId: question.subtopicId || '',
    subtopic: question.subtopic || '',
    topicId: question.topicId || '',
    topic: question.topic || ''
  };
}

async function recordGrammarWrong(event) {
  const payload = (event && event.payload) || {};
  const question = compactQuestion(payload.question || {});
  const selectedAnswer = String(payload.selectedAnswer || '').trim().toUpperCase();
  if (!question._id || !selectedAnswer || selectedAnswer === String(question.answer || '').toUpperCase()) {
    return { saved: false };
  }
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'recordGrammarWrong'
  }));
  if (!study.isStudyWriteAllowed(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const now = new Date().toISOString();
  const scope = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    questionId: question._id
  };
  const existed = await dbAdapter.collection(WRONG_COLLECTION).where(scope).limit(1).get();
  const current = existed && existed.data && existed.data[0];
  const data = Object.assign({}, scope, question, {
    selectedAnswer,
    wrongCount: Number((current && current.wrongCount) || 0) + 1,
    mastered: false,
    wrongAt: now,
    updatedAt: now
  });
  if (current && current._id) {
    await dbAdapter.collection(WRONG_COLLECTION).doc(current._id).update({ data });
    return { saved: true, updated: true };
  }
  await dbAdapter.collection(WRONG_COLLECTION).add({
    data: Object.assign({}, data, { createdAt: now })
  });
  return { saved: true, updated: false };
}

async function addPracticeWrongQuestion(event) {
  const payload = (event && event.payload) || {};
  const sourceType = String(payload.type || '').trim();
  const sourceQuestion = payload.question || {};
  const questionId = String(payload.questionId || sourceQuestion._id || '').trim();
  if (!['reading', 'grammar'].includes(sourceType) || !questionId || !sourceQuestion.prompt) {
    return { saved: false, reason: 'missing-wrong-question' };
  }
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'addPracticeWrongQuestion'
  }));
  if (!study.isStudyWriteAllowed(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const now = new Date().toISOString();
  const baseScope = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    questionId
  };
  const existed = await dbAdapter.collection(WRONG_COLLECTION).where(baseScope).limit(10).get();
  const current = ((existed && existed.data) || []).find((item) => (
    sourceType === 'grammar'
      ? !item.sourceType || item.sourceType === 'grammar'
      : item.sourceType === sourceType
  ));
  const question = {
    _id: questionId,
    number: sourceQuestion.number || '',
    prompt: sourceQuestion.prompt || '',
    options: sourceQuestion.options || {},
    answer: sourceQuestion.answer || '',
    selectedAnswer: sourceQuestion.selectedAnswer || '',
    analysis: sourceQuestion.analysis || '',
    correct: sourceQuestion.correct === true
  };
  const data = Object.assign({}, baseScope, {
    userId: ctx.user.userId,
    sourceType,
    sourceTargetId: String(payload.targetId || ''),
    sourceTitle: String(payload.title || ''),
    sourceMeta: String(payload.meta || ''),
    sourcePassage: sourceType === 'reading' ? String(payload.passage || '') : '',
    question,
    selectedAnswer: question.selectedAnswer,
    answer: question.answer,
    mastered: false,
    addedAt: now,
    wrongAt: now,
    updatedAt: now
  });
  if (current && current._id) {
    await dbAdapter.collection(WRONG_COLLECTION).doc(current._id).update({ data });
    return { saved: true, updated: true, item: Object.assign({}, current, data) };
  }
  const created = await dbAdapter.collection(WRONG_COLLECTION).add({
    data: Object.assign({}, data, { createdAt: now })
  });
  return {
    saved: true,
    updated: false,
    item: Object.assign({}, data, { _id: created && created._id ? created._id : '' })
  };
}

async function getPracticeWrongQuestions(event) {
  const payload = (event && event.payload) || {};
  const sourceType = String(payload.type || '').trim();
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getPracticeWrongQuestions'
  }));
  const result = await dbAdapter.collection(WRONG_COLLECTION)
    .where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      mastered: false
    })
    .limit(500)
    .get();
  const items = ((result && result.data) || []).filter((item) => (
    sourceType === 'grammar'
      ? !item.sourceType || item.sourceType === 'grammar'
      : item.sourceType === sourceType
  )).sort((left, right) => String(right.addedAt || right.wrongAt || '').localeCompare(String(left.addedAt || left.wrongAt || '')));
  return { type: sourceType, items };
}

async function getGrammarWrongBook(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getGrammarWrongBook'
  }));
  const result = await dbAdapter.collection(WRONG_COLLECTION)
    .where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      mastered: false
    })
    .orderBy('wrongAt', 'desc')
    .limit(500)
    .get();
  const questions = ((result && result.data) || []).filter((item) => item.sourceType !== 'reading');
  const groups = {};
  questions.forEach((item) => {
    const categoryId = item.categoryId || 'unknown';
    if (!groups[categoryId]) {
      groups[categoryId] = {
        topicId: categoryId,
        topic: item.category || '未分类',
        count: 0,
        children: {}
      };
    }
    const subtopicId = item.subtopicId || `${categoryId}:unknown`;
    if (!groups[categoryId].children[subtopicId]) {
      groups[categoryId].children[subtopicId] = {
        topicId: subtopicId,
        topic: item.subtopic || item.topic || '未分类',
        count: 0,
        questions: []
      };
    }
    groups[categoryId].count += 1;
    groups[categoryId].children[subtopicId].count += 1;
    groups[categoryId].children[subtopicId].questions.push(item);
  });
  return {
    topicTypes: Object.values(groups).map((group) => Object.assign({}, group, {
      children: Object.values(group.children).map((child) => ({
        topicId: child.topicId,
        topic: child.topic,
        count: child.count,
        questions: child.questions
      }))
    })),
    questions,
    source: 'cloud-db'
  };
}

function normalizeProgressQuestion(question) {
  const source = question || {};
  const explanation = source.explanation && typeof source.explanation === 'object'
    ? {
      answer: source.explanation.answer || '',
      topic: source.explanation.topic || '',
      explanation: source.explanation.explanation || '',
      elimination: source.explanation.elimination || '',
      source: source.explanation.source || ''
    }
    : null;
  return {
    _id: String(source._id || ''),
    number: source.number || 0,
    selectedAnswer: String(source.selectedAnswer || '').trim().toUpperCase(),
    answer: String(source.answer || '').trim().toUpperCase(),
    isCorrect: source.isCorrect === true,
    explanation
  };
}

function mergeProgressQuestions(base, incoming) {
  const map = {};
  (base || []).concat(incoming || []).forEach((question) => {
    const normalized = normalizeProgressQuestion(question);
    if (normalized._id) map[normalized._id] = normalized;
  });
  return Object.values(map).slice(0, 500);
}

async function recoverGrammarProgressQuestions(ctx, topicId) {
  try {
    const plainTopicId = String(topicId || '').replace(/^(em1|em2):/, '');
    const result = await dbAdapter.collection('studyCompletedItems')
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId
      })
      .limit(300)
      .get();
    const records = ((result && result.data) || []).filter((item) => (
      item.type === 'grammar'
      && [topicId, plainTopicId].includes(String(item.topicId || item.targetId || ''))
    )).sort((left, right) => String(left.updatedAt || left.date || '').localeCompare(String(right.updatedAt || right.date || '')));
    return records.reduce((answers, item) => (
      mergeProgressQuestions(answers, item.latestAttempt && item.latestAttempt.questions)
    ), []);
  } catch (error) {
    return [];
  }
}

async function getGrammarProgress(event) {
  const payload = (event && event.payload) || {};
  const topicId = String(payload.topicId || '').trim();
  if (!topicId) {
    return { topicId: '', nextIndex: 0 };
  }
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getGrammarProgress'
  }));
  const result = await dbAdapter.collection(PROGRESS_COLLECTION)
    .where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      topicId
    })
    .limit(1)
    .get();
  const item = result && result.data && result.data[0];
  let answeredQuestions = mergeProgressQuestions([], (item && item.answeredQuestions) || []);
  const nextIndex = Math.max(0, Number((item && item.nextIndex) || 0));
  if (answeredQuestions.length < nextIndex) {
    answeredQuestions = mergeProgressQuestions(
      await recoverGrammarProgressQuestions(ctx, topicId),
      answeredQuestions
    );
  }
  return {
    topicId,
    nextIndex,
    answeredQuestions,
    updatedAt: (item && item.updatedAt) || ''
  };
}

async function recordGrammarProgress(event) {
  const payload = (event && event.payload) || {};
  const topicId = String(payload.topicId || '').trim();
  const nextIndex = Math.max(0, Number(payload.nextIndex || 0));
  const answeredQuestions = Array.isArray(payload.answeredQuestions)
    ? payload.answeredQuestions.map(normalizeProgressQuestion).filter((question) => question._id)
    : [];
  if (!topicId) {
    return { saved: false };
  }
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'recordGrammarProgress'
  }));
  if (!study.isStudyWriteAllowed(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const now = new Date().toISOString();
  const scope = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    topicId
  };
  const result = await dbAdapter.collection(PROGRESS_COLLECTION).where(scope).limit(1).get();
  const current = result && result.data && result.data[0];
  const data = Object.assign({}, scope, {
    userId: ctx.user.userId,
    nextIndex: Math.max(nextIndex, Number((current && current.nextIndex) || 0)),
    answeredQuestions: mergeProgressQuestions((current && current.answeredQuestions) || [], answeredQuestions),
    updatedAt: now
  });
  if (current && current._id) {
    await dbAdapter.collection(PROGRESS_COLLECTION).doc(current._id).update({ data });
    return { saved: true, updated: true };
  }
  await dbAdapter.collection(PROGRESS_COLLECTION).add({
    data: Object.assign({}, data, { createdAt: now })
  });
  return { saved: true, updated: false };
}

function extractMessageText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text;
  if (Array.isArray(response.choices) && response.choices[0]) {
    const content = (response.choices[0].message || {}).content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((item) => item.text || item.content || '').join('\n');
  }
  return '';
}

function parseJsonText(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function postJson(url, apiKey, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      reject(new Error('grammar-explain-endpoint-invalid'));
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
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
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
          reject(new Error(`grammar-explain-http-${response.statusCode}:${text.slice(0, 240)}`));
          return;
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch (error) {
          reject(new Error(`grammar-explain-json:${error.message}:${text.slice(0, 160)}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('grammar-explain-timeout')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function narrationHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function decodeNarrationAudio(response) {
  const raw = String(response && response.data && response.data.audio || response && response.audio || '').trim();
  if (!raw) throw new Error('grammar-narration-audio-empty');
  const buffer = /^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (buffer.length < 512) throw new Error('grammar-narration-audio-invalid');
  return buffer;
}

function isMissingDocumentError(error) {
  const message = String(error && (error.errMsg || error.message || error) || '');
  return message.includes('-502005') || /document.*not exist|not found/i.test(message);
}

async function getNarrationDocument(cacheKey) {
  try {
    const result = await dbAdapter.collection(NARRATION_AUDIO_COLLECTION).doc(cacheKey).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) return null;
    throw error;
  }
}

async function resolveNarrationAudio(item) {
  if (!item || !item.active || !item.audioFileId && !item.audioCloudPath) return null;
  const audioUrl = await storageAdapter.getTempFileURL(item.audioFileId, item.audioCloudPath);
  return audioUrl ? Object.assign({}, item, { audioUrl }) : null;
}

async function getCachedNarrationAudio(cacheKey) {
  const direct = await resolveNarrationAudio(await getNarrationDocument(cacheKey));
  if (direct) return direct;
  const result = await dbAdapter.collection(NARRATION_AUDIO_COLLECTION)
    .where({ cacheKey, active: true })
    .limit(5)
    .get();
  const items = ((result && result.data) || []).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const resolved = await resolveNarrationAudio(item);
    if (resolved) return resolved;
  }
  return null;
}

async function acquireNarrationJob(cacheKey, metadata) {
  const now = new Date().toISOString();
  return dbAdapter.db.runTransaction(async (transaction) => {
    const reference = transaction.collection(NARRATION_AUDIO_COLLECTION).doc(cacheKey);
    let current = null;
    try {
      const result = await reference.get();
      current = result && result.data ? result.data : null;
    } catch (error) {
      if (!isMissingDocumentError(error)) throw error;
    }
    if (current && current.active && (current.audioFileId || current.audioCloudPath)) {
      return { state: 'ready', item: current };
    }
    const startedAt = Date.parse(current && current.generationStartedAt || '');
    if (current && current.status === 'generating' && Number.isFinite(startedAt) && Date.now() - startedAt < NARRATION_JOB_STALE_MS) {
      return { state: 'generating' };
    }
    await reference.set({
      data: Object.assign({}, metadata, {
        cacheKey,
        status: 'generating',
        active: false,
        generationStartedAt: now,
        createdAt: current && current.createdAt || now,
        updatedAt: now
      })
    });
    return { state: 'acquired' };
  });
}

async function markNarrationJobFailed(cacheKey, error) {
  try {
    await dbAdapter.collection(NARRATION_AUDIO_COLLECTION).doc(cacheKey).update({
      data: {
        status: 'failed',
        active: false,
        lastError: String(error && error.message || error || 'unknown').slice(0, 240),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (updateError) {}
}

async function getGrammarNarrationAudio(event) {
  const payload = (event && event.payload) || {};
  const narrationId = String(payload.narrationId || '').trim();
  const version = String(payload.version || '').trim();
  const requestedLanguage = String(payload.language || '') === 'en' ? 'en' : 'zh-CN';
  const text = String(payload.text || '').trim();
  const textHash = narrationHash(text);
  const sharedApprovalKey = `${narrationId}:${version}:zh-CN`;
  const requestedApprovalKey = `${narrationId}:${version}:${requestedLanguage}`;
  const approvalKey = NARRATION_HASHES[sharedApprovalKey] === textHash ? sharedApprovalKey : requestedApprovalKey;
  if (!narrationId || !version || !text || NARRATION_HASHES[approvalKey] !== textHash) {
    throw new Error('grammar-narration-not-approved');
  }
  const language = approvalKey.endsWith(':en') ? 'en' : 'zh-CN';

  const endpoint = String(process.env.GRAMMAR_TTS_ENDPOINT || '').trim();
  const apiKey = String(process.env.GRAMMAR_TTS_API_KEY || '').trim();
  const model = String(process.env.GRAMMAR_TTS_MODEL || 'speech-2.8-turbo').trim();
  const voice = String(process.env.GRAMMAR_TTS_VOICE || 'male-qn-jingying').trim();
  const emotion = String(process.env.GRAMMAR_TTS_EMOTION || 'fluent').trim();
  const speedValue = Number(process.env.GRAMMAR_TTS_SPEED || 0.95);
  const speed = Number.isFinite(speedValue) ? Math.min(2, Math.max(0.5, speedValue)) : 0.95;
  if (!endpoint || !apiKey) throw new Error('grammar-narration-missing-env');

  const cacheKey = narrationHash([approvalKey, textHash, model, voice, speed, emotion, 'mp3'].join('|')).slice(0, 40);
  const cached = await getCachedNarrationAudio(cacheKey);
  if (cached) {
    return {
      audioUrl: cached.audioUrl,
      audioFileId: cached.audioFileId || '',
      audioCloudPath: cached.audioCloudPath || '',
      cacheKey,
      cached: true,
      model,
      voice
    };
  }

  const metadata = { narrationId, version, language, textHash, model, voice, emotion, speed };
  const job = await acquireNarrationJob(cacheKey, metadata);
  if (job.state === 'generating') {
    return { audioUrl: '', cacheKey, cached: false, generating: true, retryAfterMs: 3000, model, voice };
  }
  if (job.state === 'ready') {
    const ready = await resolveNarrationAudio(job.item);
    if (ready) {
      return { audioUrl: ready.audioUrl, audioFileId: ready.audioFileId || '', audioCloudPath: ready.audioCloudPath || '', cacheKey, cached: true, generating: false, model, voice };
    }
  }

  try {
    const response = await postJson(endpoint, apiKey, {
    model,
    text,
    stream: false,
    voice_setting: {
      voice_id: voice,
      speed,
      vol: 1,
      pitch: 0,
      emotion
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
      channel: 1
    },
      subtitle_enable: false
    }, 150000);
    if (response && response.base_resp && Number(response.base_resp.status_code || 0) !== 0) {
      throw new Error(`grammar-narration-provider:${response.base_resp.status_msg || response.base_resp.status_code}`);
    }
    const audioBuffer = decodeNarrationAudio(response);
    const safeNarrationId = narrationId.replace(/[^a-z0-9-]+/gi, '-');
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const audioCloudPath = `_grammar_audio/${safeNarrationId}/${version}/${cacheKey}-${uniqueSuffix}.mp3`;
    const uploaded = await storageAdapter.uploadCloudFileBuffer(audioCloudPath, audioBuffer);
    const audioFileId = uploaded && uploaded.fileId ? uploaded.fileId : '';
    const audioUrl = await storageAdapter.getTempFileURL(audioFileId, audioCloudPath);
    if (!audioFileId || !audioUrl) throw new Error('grammar-narration-upload-failed');

    const now = new Date().toISOString();
    await dbAdapter.collection(NARRATION_AUDIO_COLLECTION).doc(cacheKey).set({
      data: Object.assign({}, metadata, {
        cacheKey,
        status: 'ready',
        audioFileId,
        audioCloudPath,
        active: true,
        generationFinishedAt: now,
        createdAt: now,
        updatedAt: now
      })
    });
    return { audioUrl, audioFileId, audioCloudPath, cacheKey, cached: false, generating: false, model, voice };
  } catch (error) {
    await markNarrationJobFailed(cacheKey, error);
    throw error;
  }
}

function fallbackExplanation(question, reason) {
  if (reason) {
    console.warn('[grammar] explain fallback', reason);
  }
  return {
    answer: question.answer || '',
    topic: question.topic || '语法',
    explanation: '这道题已有标准答案，详细讲解暂时不可用。可以先看标准答案，稍后再点“重新讲”。',
    elimination: '',
    source: 'fallback'
  };
}

async function getCachedExplanation(questionId) {
  if (!questionId) {
    return null;
  }
  try {
    const result = await dbAdapter.collection(EXPLANATION_COLLECTION)
      .where({ questionId, active: true })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const item = result && result.data && result.data[0];
    return item ? {
      answer: item.answer || '',
      topic: item.topic || '语法',
      explanation: item.explanation || '',
      elimination: item.elimination || '',
      source: item.source || 'cache'
    } : null;
  } catch (error) {
    throw new Error(`grammar-explain-cache-read-failed:${error && error.message ? error.message : error}`);
  }
}

async function saveExplanation(question, explanation, model) {
  if (!question._id || !explanation || !explanation.explanation) {
    return false;
  }
  const now = new Date().toISOString();
  const data = {
    questionId: question._id,
    answer: explanation.answer || question.answer || '',
    topic: explanation.topic || question.topic || question.subtopic || '语法',
    explanation: explanation.explanation || '',
    elimination: explanation.elimination || '',
    model: model || '',
    source: explanation.source || `model:${model || ''}`,
    active: true,
    updatedAt: now
  };
  try {
    const result = await dbAdapter.collection(EXPLANATION_COLLECTION).where({ questionId: question._id, active: true }).limit(1).get();
    const current = result && result.data && result.data[0];
    if (current && current._id) {
      await dbAdapter.collection(EXPLANATION_COLLECTION).doc(current._id).update({ data });
    } else {
      await dbAdapter.collection(EXPLANATION_COLLECTION).add({ data: Object.assign({}, data, { createdAt: now }) });
    }
    return true;
  } catch (error) {
    console.error('[grammar-explain] save failed', question._id, error && error.message ? error.message : error);
    return false;
  }
}

async function explainGrammarQuestion(event) {
  const payload = (event && event.payload) || {};
  const question = payload.question || event.question || {};
  const force = Boolean(payload.force);
  const cacheOnly = Boolean(payload.cacheOnly);
  const personalOnly = Boolean(payload.personalOnly);
  if (!question._id) {
    return { explanation: null, source: 'skipped-no-question' };
  }
  if (!force) {
    const cached = await getCachedExplanation(question._id);
    if (cached) {
      return { explanation: cached, source: 'cache', cached: true };
    }
  }
  if (cacheOnly) {
    return { explanation: null, source: 'cache-miss', cached: false, cacheMiss: true };
  }
  const endpoint = process.env.GRAMMAR_EXPLAIN_ENDPOINT || process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '';
  const apiKey = process.env.GRAMMAR_EXPLAIN_API_KEY || process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '';
  const model = process.env.GRAMMAR_EXPLAIN_MODEL || process.env.READING_STUDY_MODEL || 'gpt-5.6-sol';
  const fallbackModel = process.env.GRAMMAR_EXPLAIN_FALLBACK_MODEL || process.env.READING_STUDY_FALLBACK_MODEL || 'gpt-5.5';
  if (!endpoint || !apiKey) {
    return { explanation: fallbackExplanation(question, 'missing-env'), source: 'fallback', error: 'missing-env' };
  }
  try {
    console.log('[grammar-explain] request', JSON.stringify({
      model,
      endpointHost: (() => { try { return new URL(endpoint).hostname; } catch (error) { return 'invalid-url'; } })(),
      questionId: question._id,
      force
    }));
    const content = [
      '你是上海中考英语老师。只返回 JSON，不要 Markdown。',
      '中文简明讲解。若有标准答案，按标准答案讲；若没有标准答案，请先判断最可能答案再讲。',
      'JSON 格式：{"answer":"A","topic":"考点","explanation":"为什么选/生成这个答案","elimination":"其他选项为什么不合适"}',
      `题干：${question.prompt || ''}`,
      `选项：${JSON.stringify(question.options || {})}`,
      `标准答案：${question.answer || '无，请模型生成'}`,
      `已有分类：${question.topic || question.subtopic || ''}`,
      force && question.explanation ? `上一版讲解：${question.explanation.explanation || ''}` : '',
      force ? '如果上一版学生看不懂，请换一种更简单、更具体的说法。' : ''
    ].join('\n');
    async function requestModel(targetModel) {
      const response = await postJson(endpoint, apiKey, {
        model: targetModel,
        temperature: 0.2,
        messages: [{ role: 'user', content }]
      });
      const parsed = parseJsonText(extractMessageText(response)) || {};
      if (!parsed.explanation) {
        throw new Error(`grammar-explain-empty:${JSON.stringify(response).slice(0, 240)}`);
      }
      return {
        answer: parsed.answer || question.answer,
        topic: parsed.topic || question.topic || question.subtopic || '语法',
        explanation: parsed.explanation || '',
        elimination: parsed.elimination || '',
        source: `model:${targetModel}`
      };
    }
    let selectedModel = model;
    let explanation;
    try {
      explanation = await requestModel(model);
    } catch (primaryError) {
      if (!fallbackModel || fallbackModel === model) throw primaryError;
      selectedModel = fallbackModel;
      try {
        explanation = await requestModel(fallbackModel);
      } catch (fallbackError) {
        throw new Error(`grammar-explain-model-failed:${primaryError.message || String(primaryError)};fallback:${fallbackError.message || String(fallbackError)}`);
      }
    }
    const saved = personalOnly ? false : await saveExplanation(question, explanation, selectedModel);
    if (!personalOnly && !saved) throw new Error('grammar-explain-save-failed');
    return {
      explanation,
      source: `model:${selectedModel}`,
      cached: false,
      persisted: !personalOnly,
      personalOnly
    };
  } catch (error) {
    console.error('[grammar-explain] failed', error && error.message ? error.message : error);
    if (String(error && error.message || '').includes('grammar-explain-save-failed')) {
      throw error;
    }
    return { explanation: fallbackExplanation(question, error.message), source: 'fallback', error: error.message };
  }
}

module.exports = {
  getGrammarHome,
  getGrammarTopic,
  getGrammarClassroomCourse,
  recordGrammarWrong,
  addPracticeWrongQuestion,
  getPracticeWrongQuestions,
  getGrammarWrongBook,
  getGrammarProgress,
  recordGrammarProgress,
  getGrammarNarrationAudio,
  explainGrammarQuestion
};
