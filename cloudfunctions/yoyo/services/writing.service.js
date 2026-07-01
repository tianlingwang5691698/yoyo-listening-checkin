const https = require('https');
const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const completion = require('./completion.service');

const COLLECTION = 'writingAttempts';

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
      timeout: 90000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`writing-http-${response.statusCode || 0}:${text.slice(0, 160)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('writing-timeout')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function parseJsonText(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const matched = raw.match(/\{[\s\S]*\}/);
  if (!matched) return {};
  try {
    return JSON.parse(matched[0]);
  } catch (error) {
    return {};
  }
}

function extractMessageText(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message
    : {};
  const content = message.content || data.output_text || '';
  if (Array.isArray(content)) {
    return content.map((item) => (item && typeof item === 'object' ? (item.text || item.content || '') : item)).join(' ');
  }
  if (content && typeof content === 'object') {
    return content.text || content.content || JSON.stringify(content);
  }
  return String(content || '');
}

function getModelConfig() {
  return {
    endpoint: process.env.WRITING_SCORE_ENDPOINT || process.env.READING_STUDY_ENDPOINT || process.env.SPEAKING_SCORE_ENDPOINT || '',
    apiKey: process.env.WRITING_SCORE_API_KEY || process.env.READING_STUDY_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '',
    model: process.env.WRITING_SCORE_MODEL || process.env.READING_STUDY_MODEL || process.env.SPEAKING_CONTENT_SCORE_MODEL || 'gpt-5.5'
  };
}

function normalizeReview(data, prompt) {
  const totalScore = Number(data.totalScore || prompt.score || 20) || 20;
  const score = Math.max(0, Math.min(totalScore, Number(data.score || 0)));
  const dimensions = data.dimensions && typeof data.dimensions === 'object' ? data.dimensions : {};
  return {
    score,
    totalScore,
    level: normalizeText(data.level || (score >= totalScore * 0.8 ? '良好' : '继续练习')),
    summary: normalizeText(data.summary || data.feedback || '已完成批改。'),
    content: normalizeText(data.content || dimensions.content || ''),
    structure: normalizeText(data.structure || dimensions.structure || ''),
    language: normalizeText(data.language || dimensions.language || ''),
    spelling: normalizeText(data.spelling || dimensions.spelling || ''),
    strengths: Array.isArray(data.strengths) ? data.strengths.map(normalizeText).filter(Boolean).slice(0, 3) : [],
    problems: Array.isArray(data.problems) ? data.problems.map(normalizeText).filter(Boolean).slice(0, 6) : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.map(normalizeText).filter(Boolean).slice(0, 6) : [],
    grammarCorrections: Array.isArray(data.grammarCorrections)
      ? data.grammarCorrections.map((item) => ({
        original: normalizeText(item && item.original),
        corrected: normalizeText(item && item.corrected),
        reason: normalizeText(item && item.reason)
      })).filter((item) => item.original || item.corrected).slice(0, 12)
      : [],
    polishedVersion: normalizeText(data.polishedVersion || data.polished || '').slice(0, 1200)
  };
}

function buildCompletionPayload(prompt, attempt, progressText) {
  const safePrompt = prompt || {};
  const safeAttempt = attempt || {};
  return {
    type: 'writing',
    targetId: safeAttempt.promptId || safePrompt._id || '',
    topicId: safeAttempt.promptId || safePrompt._id || '',
    title: safeAttempt.title || safePrompt.title || '写作',
    meta: [
      safePrompt.year || (safeAttempt.promptMeta && safeAttempt.promptMeta.year),
      safePrompt.district || (safeAttempt.promptMeta && safeAttempt.promptMeta.district),
      safePrompt.examType || (safeAttempt.promptMeta && safeAttempt.promptMeta.examType)
    ].filter(Boolean).join(' · '),
    progressText,
    latestAttempt: safeAttempt,
    prompt: safePrompt
  };
}

async function saveWritingCompletion(ctx, date, prompt, attempt, progressText) {
  try {
    await completion.upsertStudyCompletion(ctx, date, buildCompletionPayload(prompt, attempt, progressText));
  } catch (error) {}
}

async function gradeWriting(prompt, essay) {
  const config = getModelConfig();
  if (!config.endpoint || !config.apiKey) {
    throw new Error('writing-model-not-configured');
  }
  const data = await postJson(config.endpoint, {
    authorization: `Bearer ${config.apiKey}`
  }, {
    model: config.model,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: [
        '你是上海中考英语作文阅卷老师。请按20分制详细批改学生作文。',
        '只返回JSON，不要Markdown。',
        '必须结合题目要求判断内容是否切题、要点是否覆盖。',
        '语法错误要逐个指出，不要只笼统说有语法问题。',
        '格式：{"score":number,"totalScore":20,"level":"string","summary":"总体评价","content":"内容切题度和要点覆盖","structure":"结构、段落、逻辑连接","language":"词汇、句型、表达地道性","spelling":"拼写、标点、大小写","strengths":["优点"],"problems":["主要问题"],"suggestions":["改进建议"],"grammarCorrections":[{"original":"原句","corrected":"修改后","reason":"原因"}],"polishedVersion":"一版更好的英文作文"}',
        `题目：${prompt.prompt || prompt.title || ''}`,
        `最低词数：${prompt.minWords || 60}`,
        `学生作文：${essay}`
      ].join('\n')
    }]
  });
  return normalizeReview(parseJsonText(extractMessageText(data)), prompt);
}

async function submitWritingAttempt(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'submitWritingAttempt'
  }));
  const prompt = payload.prompt || {};
  const promptId = String(payload.promptId || prompt._id || '').trim();
  const essay = String(payload.essay || '').trim();
  if (!promptId || !essay) {
    throw new Error('missing-writing-payload');
  }
  const now = new Date().toISOString();
  const attempt = {
    promptId,
    title: prompt.title || '',
    prompt: prompt.prompt || '',
    promptMeta: {
      year: prompt.year || '',
      district: prompt.district || '',
      examType: prompt.examType || '',
      minWords: prompt.minWords || 60,
      score: prompt.score || 20
    },
    date: today,
    essay,
    wordCount: (essay.match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) || []).length,
    score: 0,
    totalScore: Number(prompt.score || 20) || 20,
    review: null,
    status: 'grading-pending',
    createdAt: now,
    updatedAt: now
  };
  let attemptId = '';
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
    const review = await gradeWriting(prompt, essay);
    return {
      prompt: {
        _id: promptId,
        title: prompt.title || '',
        prompt: prompt.prompt || ''
      },
      attempt: Object.assign({}, attempt, {
        score: review.score,
        totalScore: review.totalScore,
        review,
        status: 'preview'
      }),
      review,
      pending: false
    };
  }
  const created = await dbAdapter.collection(COLLECTION).add({
    data: Object.assign({}, attempt, {
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      userId: ctx.user.userId,
      memberId: ctx.member.memberId
    })
  });
  attemptId = created && created._id ? created._id : '';
  const savedAttempt = Object.assign({}, attempt, { attemptId, _id: attemptId });
  await saveWritingCompletion(
    ctx,
    today,
    Object.assign({}, prompt, { _id: promptId }),
    savedAttempt,
    '批改中'
  );
  return {
    prompt: {
      _id: promptId,
      title: prompt.title || '',
      prompt: prompt.prompt || ''
    },
    attempt: savedAttempt,
    review: null,
    pending: true
  };
}

async function gradeWritingAttempt(event) {
  const payload = (event && event.payload) || {};
  const attemptId = String(payload.attemptId || '').trim();
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'gradeWritingAttempt'
  }));
  if (!attemptId) {
    throw new Error('missing-writing-attempt-id');
  }
  const result = await dbAdapter.collection(COLLECTION).doc(attemptId).get();
  const attempt = result && result.data ? result.data : null;
  if (!attempt || attempt.familyId !== ctx.family.familyId || attempt.childId !== ctx.child.childId) {
    throw new Error('writing-attempt-not-found');
  }
  const prompt = {
    _id: attempt.promptId || '',
    title: attempt.title || '',
    prompt: attempt.prompt || '',
    minWords: attempt.promptMeta && attempt.promptMeta.minWords,
    score: attempt.totalScore || (attempt.promptMeta && attempt.promptMeta.score) || 20
  };
  if (attempt.status === 'graded' && attempt.review) {
    const formatted = formatAttempt(Object.assign({}, attempt, { _id: attemptId }));
    await saveWritingCompletion(ctx, attempt.date || today, prompt, formatted, `${formatted.score}/${formatted.totalScore} 分`);
    return { attempt: formatted, review: attempt.review, pending: false };
  }
  const now = new Date().toISOString();
  try {
    await dbAdapter.collection(COLLECTION).doc(attemptId).update({
      data: {
        status: 'grading',
        updatedAt: now
      }
    });
    const review = await gradeWriting(prompt, attempt.essay || '');
    const patch = {
      score: review.score,
      totalScore: review.totalScore,
      review,
      status: 'graded',
      gradedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbAdapter.collection(COLLECTION).doc(attemptId).update({ data: patch });
    const formatted = formatAttempt(Object.assign({}, attempt, patch, { _id: attemptId }));
    await saveWritingCompletion(ctx, attempt.date || today, prompt, formatted, `${review.score}/${review.totalScore} 分`);
    return {
      attempt: formatted,
      review,
      pending: false
    };
  } catch (error) {
    const failedAttempt = formatAttempt(Object.assign({}, attempt, {
      _id: attemptId,
      status: 'grading-failed',
      gradeError: String(error && error.message || error || '')
    }));
    await dbAdapter.collection(COLLECTION).doc(attemptId).update({
      data: {
        status: 'grading-failed',
        gradeError: String(error && error.message || error || ''),
        updatedAt: new Date().toISOString()
      }
    });
    await saveWritingCompletion(ctx, attempt.date || today, prompt, failedAttempt, '批改失败');
    throw error;
  }
}

function formatAttempt(record) {
  const item = record || {};
  const review = item.review || {};
  return {
    attemptId: item._id || '',
    promptId: item.promptId || '',
    title: item.title || '写作',
    date: item.date || '',
    essay: item.essay || '',
    wordCount: Number(item.wordCount || 0),
    score: Number(item.score || review.score || 0),
    totalScore: Number(item.totalScore || review.totalScore || 20),
    review,
    status: item.status || (review && review.summary ? 'graded' : ''),
    gradeError: item.gradeError || '',
    createdAt: item.createdAt || ''
  };
}

async function getWritingAttempts(event) {
  const payload = (event && event.payload) || {};
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getWritingAttempts'
  }));
  const limit = Math.max(1, Math.min(50, Number(payload.limit || 20)));
  const where = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId
  };
  const promptId = String(payload.promptId || '').trim();
  if (promptId) {
    where.promptId = promptId;
  }
  const res = await dbAdapter.collection(COLLECTION)
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return {
    attempts: (res.data || []).map(formatAttempt)
  };
}

module.exports = {
  submitWritingAttempt,
  gradeWritingAttempt,
  getWritingAttempts
};
