const storageAdapter = require('../adapters/storage.adapter');
const dbAdapter = require('../adapters/db.adapter');
const study = require('../facades/study.facade');
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
const WRONG_COLLECTION = 'grammarWrongQuestions';
const PROGRESS_COLLECTION = 'grammarTopicProgress';
const EXPLANATION_COLLECTION = 'grammarQuestionExplanations';

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
  return exam === 'em1' || exam === '一模' ? EM1_CONTENT_PATHS : CONTENT_PATHS;
}

async function getGrammarHome(event) {
  const paths = contentPathsFor(event);
  const rawTopicTypes = await safeDownloadJson(paths.topicTypes, []);
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
  const paths = contentPathsFor(event);
  const topicId = String(payload.topicId || event.topicId || '').trim();
  if (!topicId) {
    return { topic: null, questions: [], source: 'skipped-no-topic' };
  }
  const topic = await safeDownloadJson(`${paths.topicDir}/${topicFileName(topicId)}`, null);
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
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
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
  const questions = (result && result.data) || [];
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
  return {
    topicId,
    nextIndex: Math.max(0, Number((item && item.nextIndex) || 0)),
    updatedAt: (item && item.updatedAt) || ''
  };
}

async function recordGrammarProgress(event) {
  const payload = (event && event.payload) || {};
  const topicId = String(payload.topicId || '').trim();
  const nextIndex = Math.max(0, Number(payload.nextIndex || 0));
  if (!topicId) {
    return { saved: false };
  }
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'recordGrammarProgress'
  }));
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
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

function postJson(url, apiKey, body) {
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
      timeout: 60000
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

function fallbackExplanation(question, reason) {
  return {
    answer: question.answer || '',
    topic: question.topic || '语法',
    explanation: reason
      ? `这道题已有标准答案，但 GPT 讲解暂时失败。原因：${reason}`
      : '这道题已有标准答案，但 GPT 讲解接口未配置或暂时不可用。',
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
    return null;
  }
}

async function saveExplanation(question, explanation, model) {
  if (!question._id || !explanation || !explanation.explanation) {
    return;
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
  } catch (error) {
    // Explanation cache is optional.
  }
}

async function explainGrammarQuestion(event) {
  const payload = (event && event.payload) || {};
  const question = payload.question || event.question || {};
  const force = Boolean(payload.force);
  if (!question._id) {
    return { explanation: null, source: 'skipped-no-question' };
  }
  if (!force) {
    const cached = await getCachedExplanation(question._id);
    if (cached) {
      return { explanation: cached, source: 'cache' };
    }
  }
  const endpoint = process.env.GRAMMAR_EXPLAIN_ENDPOINT || process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '';
  const apiKey = process.env.GRAMMAR_EXPLAIN_API_KEY || process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '';
  const model = process.env.GRAMMAR_EXPLAIN_MODEL || 'gpt-5.5';
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
    const response = await postJson(endpoint, apiKey, {
      model,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          '你是上海中考英语老师。只返回 JSON，不要 Markdown。',
          '中文简明讲解。若有标准答案，按标准答案讲；若没有标准答案，请先判断最可能答案再讲。',
          'JSON 格式：{"answer":"A","topic":"考点","explanation":"为什么选/生成这个答案","elimination":"其他选项为什么不合适"}',
          `题干：${question.prompt || ''}`,
          `选项：${JSON.stringify(question.options || {})}`,
          `标准答案：${question.answer || '无，请模型生成'}`,
          `已有分类：${question.topic || question.subtopic || ''}`,
          force && question.explanation ? `上一版讲解：${question.explanation.explanation || ''}` : '',
          force ? '如果上一版学生看不懂，请换一种更简单、更具体的说法。' : ''
        ].join('\n')
      }]
    });
    const parsed = parseJsonText(extractMessageText(response)) || {};
    if (!parsed.explanation) {
      throw new Error(`grammar-explain-empty:${JSON.stringify(response).slice(0, 240)}`);
    }
    const explanation = {
      answer: parsed.answer || question.answer,
      topic: parsed.topic || question.topic || question.subtopic || '语法',
      explanation: parsed.explanation || '',
      elimination: parsed.elimination || '',
      source: `model:${model}`
    };
    await saveExplanation(question, explanation, model);
    return {
      explanation,
      source: `model:${model}`
    };
  } catch (error) {
    console.error('[grammar-explain] failed', error && error.message ? error.message : error);
    return { explanation: fallbackExplanation(question, error.message), source: 'fallback', error: error.message };
  }
}

module.exports = {
  getGrammarHome,
  getGrammarTopic,
  recordGrammarWrong,
  getGrammarWrongBook,
  getGrammarProgress,
  recordGrammarProgress,
  explainGrammarQuestion
};
