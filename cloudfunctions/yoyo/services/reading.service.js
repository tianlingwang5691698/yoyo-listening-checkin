const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const samplePassages = require('../data/reading-passages.sample.json');

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
    questions: Array.isArray(item.questions) ? item.questions : [],
    answerSentences: Array.isArray(item.answerSentences) ? item.answerSentences : [],
    phrases: Array.isArray(item.phrases) ? item.phrases : [],
    vocabulary: Array.isArray(item.vocabulary) ? item.vocabulary : [],
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
      .limit(1)
      .get();
    return result && result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

async function saveDailyPlan(ctx, today, passage) {
  if (!passage) {
    return;
  }
  try {
    await dbAdapter.collection('readingDailyPlans').add({
      data: {
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        date: today,
        passageId: passage._id,
        dailyCount: 1,
        source: passage.status === 'sample' ? 'sample' : 'cloud',
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

async function pickPlannedPassage(ctx, passages, today) {
  const plan = await getDailyPlan(ctx, today);
  const plannedPassage = plan && plan.passageId
    ? passages.find((item) => item._id === plan.passageId)
    : null;
  if (plannedPassage) {
    return plannedPassage;
  }
  const passage = pickDailyPassage(passages, today);
  await saveDailyPlan(ctx, today, passage);
  return passage;
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

function gradeAnswers(passage, answers) {
  const answerMap = answers || {};
  let keyedCount = 0;
  let correctCount = 0;
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
  return {
    score: keyedCount ? Math.round((correctCount / keyedCount) * 100) : null,
    correctCount,
    totalCount: keyedCount,
    questionResults
  };
}

function buildReview(passage, grade) {
  return {
    answerSentences: passage.answerSentences || [],
    phrases: passage.phrases || [],
    vocabulary: passage.vocabulary || [],
    analysis: grade.questionResults.map((item) => ({
      number: item.number,
      answer: item.answer,
      selected: item.selected,
      correct: item.correct,
      text: item.analysis
    }))
  };
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
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getReadingHome'
  }));
  const passages = await loadPassages();
  const passage = await pickPlannedPassage(ctx, passages, today);
  const latestAttempt = passage ? await getLatestAttempt(ctx, passage._id, today) : null;
  return {
    today,
    dailyCount: 1,
    passage: createPassageSummary(passage),
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
  const review = buildReview(passage, grade);
  const attempt = {
    passageId: passage._id,
    title: passage.title,
    date: today,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    answers: payload.answers || {},
    score: grade.score,
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

module.exports = {
  getReadingHome,
  getReadingPassage,
  submitReadingAttempt
};
