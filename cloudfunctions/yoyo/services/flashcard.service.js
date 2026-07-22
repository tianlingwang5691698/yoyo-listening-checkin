const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const storageAdapter = require('../adapters/storage.adapter');
const completionService = require('./completion.service');

const COLLECTION = 'studyFlashcards';
const SETTINGS_COLLECTION = 'studyFlashcardSettings';
const LOG_COLLECTION = 'studyFlashcardReviewLogs';
const DICTATION_COLLECTION = 'vocabularyDictationAttempts';
const JUNIOR_LIST_PLAN_ID = 'yoyo-junior-list-plan';
const JUNIOR_LIST_COUNT = 32;
const JUNIOR_LIST_SOURCE_IDS = Array.from({ length: JUNIOR_LIST_COUNT }, (_, index) => `dictionary-book-junior-list-${index + 1}`);
const DICTIONARY_BOOKS = [
  { level: 'junior', title: '新东方 初中英语词汇词根+联想记忆法：乱序版', cloudPath: 'dictionary_books/word-dictionary-junior.json' },
  { level: 'senior', title: '高中英语词汇 乱序', cloudPath: 'dictionary_books/word-dictionary-senior.json' },
  ...[['junior', 32, '新东方 初中英语词汇词根+联想记忆法：乱序版'], ['senior', 40, '高中英语词汇 乱序'], ['cet4', 35, '新东方 四级词汇词根+联想记忆法：乱序版'], ['ielts', 48, '雅思词汇词根+联想记忆法：乱序版']].flatMap(([stage, count, title]) => Array.from({ length: count }, (_, index) => ({
    level: `${stage}-list-${index + 1}`,
    title: `${title} List ${index + 1}`,
    cloudPath: `dictionary_books/${stage === 'cet4' ? 'cet4-v1' : (stage === 'ielts' ? 'word-lists-examples-v1' : 'word-lists-examples-v2')}/${stage}/list-${index + 1}.json`
  }))),
  ...[2, 3].flatMap((edition) => [1, 2, 3, 4].flatMap((unlockLevel) => [1, 2, 3, 4, 5, 6, 7, 8].flatMap((unit) => ['ls', 'rw'].map((section) => ({
    level: edition === 3 ? `unlock-v3-${unlockLevel}-u${unit}-${section}` : `unlock-${unlockLevel}-u${unit}-${section}`,
    title: `Unlock ${unlockLevel} ${edition === 3 ? '第三版' : '第二版'} Unit ${unit} ${section.toUpperCase()} 词汇表`,
    cloudPath: `dictionary_books/unlock-v${edition}/level-${unlockLevel}/unit-${unit}/${section}.json`
  })))))
];
const REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];
const DEFAULT_SETTINGS = { newLimit: 10, reviewLimit: 20 };
const LIMIT_MIN = 5;
const LIMIT_MAX = 500;
const LIMIT_STEP = 5;
const DICTIONARY_SOURCE_IDS = DICTIONARY_BOOKS.map((book) => `dictionary-book-${book.level}`);
const CLIENT_CARD_FIELDS = {
  flashcardKey: true,
  sourceType: true,
  sourceId: true,
  sourceTitle: true,
  type: true,
  text: true,
  word: true,
  phrase: true,
  pattern: true,
  phonetic: true,
  meaning: true,
  example: true,
  exampleMeaning: true,
  status: true,
  familiarLevel: true,
  reviewStep: true,
  nextReviewDate: true,
  firstLearnedDate: true,
  lastReviewDate: true,
  lastUnfamiliarDate: true,
  unfamiliarCount: true,
  audioUrl: true,
  audioFileId: true,
  audioCloudPath: true
};
const DICTATION_CARD_FIELDS = {
  sourceId: true,
  word: true,
  phonetic: true,
  meaning: true,
  status: true,
  audioUrl: true,
  audioFileId: true,
  audioCloudPath: true
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeType(type) {
  const raw = String(type || '').trim();
  return ['word', 'phrase', 'pattern'].includes(raw) ? raw : 'word';
}

function flashcardKey(sourceType, type, text) {
  return [sourceType || 'study', normalizeType(type), normalizeText(text).toLowerCase()].join(':');
}

function isPreviewWrite(ctx) {
  return !study.isStudyWriteAllowed(ctx);
}

function cardText(card, type) {
  if (type === 'word') return normalizeText(card.word || card.text);
  if (type === 'pattern') return normalizeText(card.pattern || card.text);
  return normalizeText(card.text || card.phrase);
}

function makeSchedule(today) {
  return REVIEW_DAYS.map((days, index) => ({
    step: index,
    date: study.addDays(today, days),
    done: false
  }));
}

function getStepDate(schedule, step, today) {
  const slot = (schedule || []).find((item) => Number(item.step) === Number(step));
  return slot && slot.date ? slot.date : study.addDays(today, REVIEW_DAYS[Math.max(0, Math.min(REVIEW_DAYS.length - 1, step))] || 1);
}

function buildRememberedScheduleData(current, schedule, today) {
  const currentStep = Number(current.reviewStep || 0);
  const unfamiliarCount = Number(current.unfamiliarCount || 0);
  if (unfamiliarCount >= 4) {
    return {
      status: 'reviewing',
      familiarLevel: 'reviewing',
      reviewStep: 0,
      nextReviewDate: study.addDays(today, 1),
      unfamiliarCount: 0
    };
  }
  if (unfamiliarCount >= 2) {
    return {
      status: 'reviewing',
      familiarLevel: 'reviewing',
      reviewStep: Math.max(0, currentStep - 1),
      nextReviewDate: study.addDays(today, 1),
      unfamiliarCount: 0
    };
  }
  const nextSlot = schedule.find((slot) => Number(slot.step) > currentStep);
  if (!nextSlot) {
    return {
      status: 'mastered',
      familiarLevel: 'mastered',
      nextReviewDate: '',
      unfamiliarCount: 0
    };
  }
  return {
    status: 'reviewing',
    familiarLevel: 'reviewing',
    reviewStep: Number(nextSlot.step),
    nextReviewDate: getStepDate(schedule, Number(nextSlot.step), today),
    unfamiliarCount: 0
  };
}

function normalizeLimit(value, fallback) {
  const numericValue = Number(value == null ? fallback : value);
  const steppedValue = Math.round(numericValue / LIMIT_STEP) * LIMIT_STEP;
  return Math.max(LIMIT_MIN, Math.min(steppedValue || fallback, LIMIT_MAX));
}

function normalizeSettings(settings) {
  return {
    newLimit: normalizeLimit(settings && settings.newLimit, DEFAULT_SETTINGS.newLimit),
    reviewLimit: normalizeLimit(settings && settings.reviewLimit, DEFAULT_SETTINGS.reviewLimit)
  };
}

function normalizeJuniorListPlanState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    active: source.active !== false,
    round: Math.max(1, Number(source.round || 1)),
    currentList: Math.max(1, Math.min(JUNIOR_LIST_COUNT, Number(source.currentList || 1))),
    lastCompletedDate: normalizeText(source.lastCompletedDate),
    lastCompletedRound: Math.max(0, Number(source.lastCompletedRound || 0)),
    lastCompletedList: Math.max(0, Math.min(JUNIOR_LIST_COUNT, Number(source.lastCompletedList || 0))),
    lastMainWords: Math.max(0, Number(source.lastMainWords || 0)),
    lastReviewWords: Math.max(0, Number(source.lastReviewWords || 0)),
    lastReviewLists: (Array.isArray(source.lastReviewLists) ? source.lastReviewLists : []).map(Number).filter(Boolean),
    lastEncouragement: normalizeText(source.lastEncouragement)
  };
}

function getJuniorListPlanDescriptor(state, today) {
  const normalized = normalizeJuniorListPlanState(state);
  const completedToday = normalized.lastCompletedDate === today;
  const round = completedToday && normalized.lastCompletedRound ? normalized.lastCompletedRound : normalized.round;
  const currentList = completedToday && normalized.lastCompletedList ? normalized.lastCompletedList : normalized.currentList;
  return {
    planId: JUNIOR_LIST_PLAN_ID,
    active: normalized.active,
    round,
    currentList,
    completedToday,
    currentSourceId: `dictionary-book-junior-list-${currentList}`,
    practiceLevel: `junior-list-${currentList}`,
    title: `初中词汇第${round}轮 · List ${currentList}`,
    summary: `${round === 1 ? '新学' : '重背'} List ${currentList} · 复习不熟词`
  };
}

function advanceJuniorListPlanState(state, today) {
  const normalized = normalizeJuniorListPlanState(state);
  const completedRound = normalized.round;
  const completedList = normalized.currentList;
  return Object.assign({}, normalized, {
    round: completedList >= JUNIOR_LIST_COUNT ? completedRound + 1 : completedRound,
    currentList: completedList >= JUNIOR_LIST_COUNT ? 1 : completedList + 1,
    lastCompletedDate: today,
    lastCompletedRound: completedRound,
    lastCompletedList: completedList
  });
}

function selectJuniorCurrentCards(currentRows, round, today) {
  if (Number(round || 1) === 1) {
    return (currentRows || []).filter((item) => item.status === 'new');
  }
  return (currentRows || []).filter((item) => item.lastReviewDate !== today);
}

function isJuniorCurrentListComplete(currentRows, sourceCount, round, today) {
  const rows = currentRows || [];
  if (!sourceCount || rows.length !== sourceCount) return false;
  if (Number(round || 1) === 1) {
    return rows.every((item) => item.status !== 'new' && !!item.firstLearnedDate);
  }
  return rows.every((item) => item.lastReviewDate === today);
}

function isJuniorUnfamiliarPending(item) {
  if (!item || item.status === 'new' || !item.lastUnfamiliarDate) return false;
  return !item.lastReviewDate || String(item.lastReviewDate) <= String(item.lastUnfamiliarDate);
}

function isJuniorUnfamiliarReviewDue(item, today) {
  return isJuniorUnfamiliarPending(item)
    && String(item.lastUnfamiliarDate) < String(today)
    && item.lastReviewDate !== today;
}

function makeFlashcard(ctx, today, source, type, card) {
  const text = cardText(card, type);
  const schedule = makeSchedule(today);
  return {
    flashcardKey: flashcardKey(source.sourceType, type, text),
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    memberId: ctx.member.memberId,
    sourceType: source.sourceType || 'study',
    sourceId: source.sourceId || '',
    sourceTitle: source.title || '',
    type,
    text,
    word: type === 'word' ? text : '',
    phrase: type === 'phrase' ? text : '',
    pattern: type === 'pattern' ? text : '',
    phonetic: normalizeText(card.phonetic),
    meaning: normalizeText(card.meaning || card.translation),
    example: normalizeText(card.example),
    exampleMeaning: normalizeText(card.exampleMeaning),
    status: 'new',
    familiarLevel: 'new',
    reviewStep: 0,
    reviewSchedule: schedule,
    nextReviewDate: today,
    createdDate: today,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function cardsFromStudyPack(studyPack) {
  const pack = studyPack || {};
  return []
    .concat((pack.vocabularyCards || []).map((card) => ({ type: 'word', card })))
    .concat((pack.phraseCards || []).map((card) => ({ type: 'phrase', card })))
    .concat((pack.sentencePatternCards || []).map((card) => ({ type: 'pattern', card })))
    .filter((item) => cardText(item.card, item.type));
}

async function upsertStudyPackFlashcards(ctx, today, source, studyPack) {
  if (!ctx || !study.isStudyWriteAllowed(ctx)) {
    return { saved: false, reason: 'preview-role', count: 0 };
  }
  const items = cardsFromStudyPack(studyPack);
  let count = 0;
  for (const item of items) {
    const record = makeFlashcard(ctx, today, source || {}, item.type, item.card);
    const currentResult = await dbAdapter.collection(COLLECTION)
      .where({ familyId: record.familyId, childId: record.childId, flashcardKey: record.flashcardKey })
      .limit(1)
      .get();
    const current = currentResult && currentResult.data && currentResult.data[0];
    if (current && current._id) {
      await dbAdapter.collection(COLLECTION).doc(current._id).update({
        data: {
          sourceTitle: record.sourceTitle || current.sourceTitle || '',
          meaning: record.meaning || current.meaning || '',
          example: record.example || current.example || '',
          exampleMeaning: record.exampleMeaning || current.exampleMeaning || '',
          updatedAt: record.updatedAt
        }
      });
    } else {
      await dbAdapter.collection(COLLECTION).add({ data: record });
    }
    count += 1;
  }
  return { saved: true, count };
}

async function getSettings(ctx) {
  try {
    const result = await dbAdapter.collection(SETTINGS_COLLECTION)
      .where({ familyId: ctx.family.familyId, childId: ctx.child.childId })
      .limit(1)
      .get();
    const row = result && result.data && result.data[0];
    return Object.assign({}, row || {}, normalizeSettings(row || DEFAULT_SETTINGS));
  } catch (error) {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

async function saveJuniorListPlanState(ctx, state) {
  const now = new Date().toISOString();
  const result = await dbAdapter.collection(SETTINGS_COLLECTION)
    .where({ familyId: ctx.family.familyId, childId: ctx.child.childId })
    .limit(1)
    .get();
  const current = result && result.data && result.data[0];
  if (current && current._id) {
    await dbAdapter.collection(SETTINGS_COLLECTION).doc(current._id).update({
      data: { juniorListPlan: state, updatedAt: now }
    });
    return;
  }
  await dbAdapter.collection(SETTINGS_COLLECTION).add({
    data: {
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      newLimit: DEFAULT_SETTINGS.newLimit,
      reviewLimit: DEFAULT_SETTINGS.reviewLimit,
      juniorListPlan: state,
      createdAt: now,
      updatedAt: now
    }
  });
}

function getJuniorBook(level) {
  return DICTIONARY_BOOKS.find((item) => item.level === level) || null;
}

function mergePlanBookRows(ctx, today, book, rows, progressRows, planRole, listNumber) {
  const progressByKey = new Map((progressRows || []).map((item) => [item.flashcardKey, item]));
  return (rows || []).map((entry) => {
    const word = normalizeText(entry.word || entry.wordLower).toLowerCase();
    const base = makeFlashcard(ctx, today, {
      sourceType: `dictionaryBook:${book.level}`,
      sourceId: `dictionary-book-${book.level}`,
      title: book.title
    }, 'word', {
      word,
      phonetic: entry.phonetic || '',
      meaning: Array.isArray(entry.definitions) ? entry.definitions.join('；') : (entry.meaning || ''),
      example: entry.example || '',
      exampleMeaning: entry.exampleMeaning || entry.exampleTranslation || ''
    });
    return Object.assign({}, base, progressByKey.get(base.flashcardKey) || {}, {
      planRole,
      planList: listNumber
    });
  }).filter((item) => item.word);
}

async function getJuniorListPlanSummary(ctx, today) {
  if (!study.isYoyoChild(ctx.child)) return null;
  const settings = await getSettings(ctx);
  const state = normalizeJuniorListPlanState(settings.juniorListPlan);
  return Object.assign(getJuniorListPlanDescriptor(state, today), {
    lastMainWords: state.lastMainWords,
    lastReviewWords: state.lastReviewWords,
    lastReviewLists: state.lastReviewLists,
    lastEncouragement: state.lastEncouragement
  });
}

async function getJuniorVocabularyPlan(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getJuniorVocabularyPlan' }));
  const descriptor = await getJuniorListPlanSummary(ctx, today);
  if (!descriptor || !descriptor.active) {
    return { active: false, cards: [], library: [] };
  }
  if (descriptor.completedToday) {
    return Object.assign({}, descriptor, {
      today,
      cards: [],
      library: [],
      settings: { newLimit: 0, reviewLimit: 0 },
      newDueCount: Number(descriptor.lastMainWords || 0),
      reviewDueCount: Number(descriptor.lastReviewWords || 0),
      mainWords: Number(descriptor.lastMainWords || 0),
      reviewWords: Number(descriptor.lastReviewWords || 0),
      reviewLists: descriptor.lastReviewLists || [],
      encouragement: descriptor.lastEncouragement
        || `今天完成了第${descriptor.round}轮 List ${descriptor.currentList}，坚持得很好。`
    });
  }
  const command = dbAdapter.getCommand();
  const progressRows = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    const progressResult = await dbAdapter.collection(COLLECTION)
      .where({
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        sourceId: command.in(JUNIOR_LIST_SOURCE_IDS)
      })
      .field(CLIENT_CARD_FIELDS)
      .skip(skip)
      .limit(100)
      .get();
    const batch = resultRows(progressResult);
    progressRows.push(...batch);
    if (batch.length < 100) break;
  }
  const currentBook = getJuniorBook(`junior-list-${descriptor.currentList}`);
  const currentBookRows = await storageAdapter.downloadCloudJson(currentBook.cloudPath);
  const currentRows = mergePlanBookRows(ctx, today, currentBook, currentBookRows, progressRows, 'current', descriptor.currentList);
  const currentCards = selectJuniorCurrentCards(currentRows, descriptor.round, today);
  const reviewCards = progressRows.filter((item) => (
    item.sourceId !== descriptor.currentSourceId
      && isJuniorUnfamiliarReviewDue(item, today)
  )).map((item) => Object.assign({}, item, {
    planRole: 'review',
    planList: Number(String(item.sourceId || '').match(/junior-list-(\d+)$/)?.[1] || 0)
  })).sort((left, right) => (
    String(left.nextReviewDate || '').localeCompare(String(right.nextReviewDate || ''))
      || Number(left.planList || 0) - Number(right.planList || 0)
      || String(left.word || left.text || '').localeCompare(String(right.word || right.text || ''))
  ));
  const reviewLists = Array.from(new Set(reviewCards.map((item) => item.planList).filter(Boolean))).sort((a, b) => a - b);
  const cards = reviewCards.concat(currentCards);
  const library = reviewCards.concat(currentRows);
  return Object.assign({}, descriptor, {
    today,
    cards,
    library,
    reviewLists,
    settings: { newLimit: currentRows.length, reviewLimit: reviewCards.length },
    dueCount: cards.length,
    newDueCount: currentCards.length,
    reviewDueCount: reviewCards.length,
    progress: {
      total: library.length,
      mastered: library.filter((item) => item.status === 'mastered').length,
      reviewing: library.filter((item) => item.status === 'reviewing').length,
      fresh: library.filter((item) => item.status === 'new').length
    },
    logs: [],
    encouragement: reviewLists.length
      ? `今天完成 List ${descriptor.currentList}，并复习 ${reviewCards.length} 个不熟词，坚持得很好。`
      : `今天完成 List ${descriptor.currentList}，开局很扎实。`
  });
}

function resultRows(result) {
  return result && Array.isArray(result.data) ? result.data : [];
}

async function completeJuniorVocabularyPlan(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'completeJuniorVocabularyPlan' }));
  if (!study.isStudyWriteAllowed(ctx)) return { saved: false, reason: 'preview-role' };
  const settings = await getSettings(ctx);
  const state = normalizeJuniorListPlanState(settings.juniorListPlan);
  const descriptor = getJuniorListPlanDescriptor(state, today);
  if (!study.isYoyoChild(ctx.child) || descriptor.completedToday) {
    return Object.assign({ saved: !!descriptor.completedToday }, descriptor);
  }
  const command = dbAdapter.getCommand();
  const rows = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    const result = await dbAdapter.collection(COLLECTION).where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      sourceId: command.in(JUNIOR_LIST_SOURCE_IDS)
    }).field(CLIENT_CARD_FIELDS).skip(skip).limit(100).get();
    const batch = resultRows(result);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  const currentRows = rows.filter((item) => item.sourceId === descriptor.currentSourceId);
  const currentBook = getJuniorBook(`junior-list-${descriptor.currentList}`);
  const currentBookRows = await storageAdapter.downloadCloudJson(currentBook.cloudPath);
  const currentComplete = isJuniorCurrentListComplete(currentRows, currentBookRows.length, descriptor.round, today);
  const remainingDue = rows.filter((item) => (
    item.sourceId !== descriptor.currentSourceId
      && isJuniorUnfamiliarReviewDue(item, today)
  ));
  if (!currentComplete || remainingDue.length) {
    return Object.assign({ saved: false, reason: 'plan-incomplete' }, descriptor);
  }
  const newLearned = descriptor.round === 1
    ? currentRows.filter((item) => item.firstLearnedDate === today).length
    : 0;
  const reviewedRows = rows.filter((item) => item.lastReviewDate === today && item.firstLearnedDate !== today);
  const reviewedCurrent = descriptor.round > 1 ? currentRows.filter((item) => item.lastReviewDate === today).length : 0;
  const reviewedDueRows = reviewedRows.filter((item) => item.sourceId !== descriptor.currentSourceId);
  const unfamiliar = rows.filter((item) => item.lastUnfamiliarDate === today).length;
  const reviewed = newLearned + reviewedRows.length;
  const reviewLists = Array.from(new Set(reviewedDueRows.map((item) => Number(String(item.sourceId || '').match(/junior-list-(\d+)$/)?.[1] || 0)).filter(Boolean))).sort((a, b) => a - b);
  await completionService.upsertStudyCompletion(ctx, today, {
    type: 'vocabulary',
    targetId: JUNIOR_LIST_PLAN_ID,
    category: 'vocabulary',
    taskId: JUNIOR_LIST_PLAN_ID,
    title: descriptor.title,
    meta: descriptor.summary,
    progressText: `完成 ${reviewed} 词 · 不熟 ${unfamiliar} 词`,
    latestAttempt: {
      reviewed,
      newLearned,
      mainWords: descriptor.round === 1 ? newLearned : reviewedCurrent,
      reviewWords: reviewedDueRows.length,
      unfamiliar,
      round: descriptor.round,
      currentList: descriptor.currentList,
      reviewLists,
      sourceId: descriptor.currentSourceId,
      sourceTitle: descriptor.title,
      date: today
    }
  });
  const encouragement = reviewLists.length
    ? `今天完成 List ${descriptor.currentList}，并复习 ${reviewedDueRows.length} 个不熟词，坚持得很好。`
    : `今天完成 List ${descriptor.currentList}，开局很扎实。`;
  const nextState = Object.assign(advanceJuniorListPlanState(state, today), {
    lastMainWords: descriptor.round === 1 ? newLearned : reviewedCurrent,
    lastReviewWords: reviewedDueRows.length,
    lastReviewLists: reviewLists,
    lastEncouragement: encouragement
  });
  await saveJuniorListPlanState(ctx, nextState);
  return Object.assign({
    saved: true,
    reviewed,
    newLearned,
    mainWords: descriptor.round === 1 ? newLearned : reviewedCurrent,
    reviewWords: reviewedDueRows.length,
    unfamiliar,
    reviewLists,
    encouragement,
    nextRound: nextState.round,
    nextList: nextState.currentList
  }, descriptor, { completedToday: true });
}

async function saveSettings(event) {
  const payload = (event && event.payload) || {};
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'saveFlashcardSettings' }));
  if (isPreviewWrite(ctx)) {
    return { settings: normalizeSettings(payload), persisted: false, reason: 'preview-role' };
  }
  const settings = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    newLimit: normalizeLimit(payload.newLimit, DEFAULT_SETTINGS.newLimit),
    reviewLimit: normalizeLimit(payload.reviewLimit, DEFAULT_SETTINGS.reviewLimit),
    updatedAt: new Date().toISOString()
  };
  try {
    const result = await dbAdapter.collection(SETTINGS_COLLECTION)
      .where({ familyId: settings.familyId, childId: settings.childId })
      .limit(1)
      .get();
    const current = result && result.data && result.data[0];
    if (current && current._id) {
      await dbAdapter.collection(SETTINGS_COLLECTION).doc(current._id).update({ data: settings });
    } else {
      await dbAdapter.collection(SETTINGS_COLLECTION).add({ data: Object.assign({}, settings, { createdAt: settings.updatedAt }) });
    }
    return { settings, persisted: true };
  } catch (error) {
    return { settings, persisted: false };
  }
}

function isDue(item, today) {
  return item && item.status !== 'mastered' && (!item.nextReviewDate || item.nextReviewDate <= today);
}

function summarizeFlashcards(cards, logs, today, settings) {
  const all = cards || [];
  const due = all.filter((item) => isDue(item, today));
  const newUsed = all.filter((item) => item.firstLearnedDate === today).length;
  const reviewUsed = all.filter((item) => item.lastReviewDate === today && item.firstLearnedDate !== today).length;
  const newRemaining = Math.max(0, Number(settings.newLimit || 0) - newUsed);
  const reviewRemaining = Math.max(0, Number(settings.reviewLimit || 0) - reviewUsed);
  const reviewCards = due.filter((item) => item.status !== 'new' && item.lastReviewDate !== today).slice(0, reviewRemaining);
  const newCards = due.filter((item) => item.status === 'new').slice(0, newRemaining);
  const reviewDays = Object.keys((logs || []).reduce((days, item) => {
    if (item && item.date) {
      days[item.date] = true;
    }
    return days;
  }, {})).length;
  return {
    cards: reviewCards.concat(newCards),
    dueCount: due.length,
    newDueCount: due.filter((item) => item.status === 'new').length,
    reviewDueCount: due.filter((item) => item.status !== 'new').length,
    progress: {
      total: all.length,
      mastered: all.filter((item) => item.status === 'mastered').length,
      reviewing: all.filter((item) => item.status === 'reviewing').length,
      fresh: all.filter((item) => item.status === 'new').length,
      reviewDays
    },
    dictionaryBooks: DICTIONARY_BOOKS.map((book) => ({
      level: book.level,
      title: book.title,
      imported: all.filter((item) => item.sourceId === `dictionary-book-${book.level}`).length
    }))
  };
}

function buildFlashcardWhere(ctx, payload, command) {
  const where = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId
  };
  if (normalizeText(payload && payload.sourceId)) {
    where.sourceId = normalizeText(payload.sourceId);
  } else if (payload && payload.scope === 'personal') {
    where.sourceId = command.nin(DICTIONARY_SOURCE_IDS);
  }
  return where;
}

async function getFlashcardReview(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getFlashcardReview' }));
  const settings = await getSettings(ctx);
  const command = dbAdapter.getCommand();
  const where = buildFlashcardWhere(ctx, payload, command);
  const all = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    const result = await dbAdapter.collection(COLLECTION)
      .where(where)
      .field(CLIENT_CARD_FIELDS)
      .orderBy('nextReviewDate', 'asc')
      .skip(skip)
      .limit(100)
      .get();
    const rows = result && result.data ? result.data : [];
    all.push.apply(all, rows);
    if (rows.length < 100) break;
  }
  const logsResult = await dbAdapter.collection(LOG_COLLECTION)
    .where({ familyId: ctx.family.familyId, childId: ctx.child.childId })
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get();
  const logs = logsResult && logsResult.data ? logsResult.data : [];
  const summary = summarizeFlashcards(all, logs, today, settings);
  return {
    today,
    settings,
    library: all,
    cards: summary.cards,
    dueCount: summary.dueCount,
    newDueCount: summary.newDueCount,
    reviewDueCount: summary.reviewDueCount,
    progress: summary.progress,
    dictionaryBooks: summary.dictionaryBooks,
    logs: logs.slice(0, 10)
  };
}

async function getFlashcardDue(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getFlashcardDue' }));
  const settings = await getSettings(ctx);
  const command = dbAdapter.getCommand();
  const dueResult = await dbAdapter.collection(COLLECTION)
    .where({
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      status: command.neq('mastered'),
      nextReviewDate: command.lte(today)
    })
    .orderBy('nextReviewDate', 'asc')
    .limit(120)
    .get();
  const dueRows = ((dueResult && dueResult.data) || []).filter((item) => isDue(item, today));
  const logsResult = await dbAdapter.collection(LOG_COLLECTION)
    .where({ familyId: ctx.family.familyId, childId: ctx.child.childId })
    .orderBy('createdAt', 'desc')
    .limit(120)
    .get();
  const logs = logsResult && logsResult.data ? logsResult.data : [];
  const summary = summarizeFlashcards(dueRows, logs, today, settings);
  return {
    today,
    settings,
    library: dueRows,
    cards: summary.cards,
    dueCount: summary.dueCount,
    newDueCount: summary.newDueCount,
    reviewDueCount: summary.reviewDueCount,
    progress: summary.progress,
    dictionaryBooks: DICTIONARY_BOOKS.map((book) => ({
      level: book.level,
      title: book.title,
      imported: 0
    })),
    logs: logs.slice(0, 10),
    partial: true
  };
}

async function addDictionaryBook(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'addDictionaryBook' }));
  if (isPreviewWrite(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const level = normalizeText(payload.level).toLowerCase();
  const book = DICTIONARY_BOOKS.find((item) => item.level === level);
  if (!book) throw new Error('dictionary-book-invalid');
  const entries = await storageAdapter.downloadCloudJson(book.cloudPath);
  const rows = Array.isArray(entries) ? entries : [];
  const offset = Math.max(0, Number(payload.offset || 0));
  const limit = Math.max(1, Math.min(100, Number(payload.limit || 80)));
  const batch = rows.slice(offset, offset + limit);
  let inserted = 0;
  let updated = 0;
  for (const entry of batch) {
    const word = normalizeText(entry.word || entry.wordLower).toLowerCase();
    if (!word) continue;
    const record = makeFlashcard(ctx, today, {
      sourceType: `dictionaryBook:${level}`,
      sourceId: `dictionary-book-${level}`,
      title: book.title
    }, 'word', {
      word,
      phonetic: entry.phonetic || '',
      meaning: Array.isArray(entry.definitions) ? entry.definitions.join('；') : '',
      example: entry.example || ''
    });
    const currentResult = await dbAdapter.collection(COLLECTION)
      .where({ familyId: record.familyId, childId: record.childId, flashcardKey: record.flashcardKey })
      .limit(1)
      .get();
    const current = currentResult && currentResult.data && currentResult.data[0];
    if (current && current._id) {
      await dbAdapter.collection(COLLECTION).doc(current._id).update({
        data: {
          sourceTitle: record.sourceTitle,
          sourceId: record.sourceId,
          phonetic: record.phonetic || current.phonetic || '',
          meaning: record.meaning || current.meaning || '',
          example: record.example || current.example || '',
          updatedAt: record.updatedAt
        }
      });
      updated += 1;
    } else {
      await dbAdapter.collection(COLLECTION).add({ data: record });
      inserted += 1;
    }
  }
  return {
    saved: true,
    level,
    title: book.title,
    total: rows.length,
    offset,
    nextOffset: offset + batch.length,
    done: offset + batch.length >= rows.length,
    inserted,
    updated
  };
}

async function getDictionaryBook(event) {
  const payload = (event && event.payload) || {};
  const level = normalizeText(payload.level).toLowerCase();
  const book = DICTIONARY_BOOKS.find((item) => item.level === level);
  if (!book) throw new Error('dictionary-book-invalid');
  const entries = await storageAdapter.downloadCloudJson(book.cloudPath);
  const rows = Array.isArray(entries) ? entries : [];
  return {
    level,
    title: book.title,
    cloudPath: book.cloudPath,
    total: rows.length,
    rows
  };
}

async function updateFlashcardReview(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'updateFlashcardReview' }));
  if (isPreviewWrite(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const key = normalizeText(payload.flashcardKey);
  let result = await dbAdapter.collection(COLLECTION)
    .where({ familyId: ctx.family.familyId, childId: ctx.child.childId, flashcardKey: key })
    .limit(1)
    .get();
  let current = result && result.data && result.data[0];
  if (!current || !current._id) {
    const card = payload.card || {};
    const type = normalizeType(card.type);
    const text = cardText(card, type);
    if (!key || !text) return { saved: false };
    const record = Object.assign(makeFlashcard(ctx, today, {
      sourceType: normalizeText(card.sourceType) || 'study',
      sourceId: normalizeText(card.sourceId),
      title: normalizeText(card.sourceTitle)
    }, type, card), {
      flashcardKey: key
    });
    await dbAdapter.collection(COLLECTION).add({ data: record });
    result = await dbAdapter.collection(COLLECTION)
      .where({ familyId: ctx.family.familyId, childId: ctx.child.childId, flashcardKey: key })
      .limit(1)
      .get();
    current = result && result.data && result.data[0];
    if (!current || !current._id) return { saved: false };
  }
  const remembered = payload.result !== 'unfamiliar';
  const reviewDates = {
    firstLearnedDate: current.firstLearnedDate || (current.status === 'new' ? today : ''),
    lastReviewDate: today
  };
  const schedule = Array.isArray(current.reviewSchedule) && current.reviewSchedule.length
    ? current.reviewSchedule
    : makeSchedule(today);
  if (payload.result === 'easy') {
    await dbAdapter.collection(COLLECTION).doc(current._id).update({
      data: Object.assign({}, reviewDates, {
        status: 'mastered',
        familiarLevel: 'easy',
        nextReviewDate: '',
        updatedAt: new Date().toISOString()
      })
    });
    await dbAdapter.collection(LOG_COLLECTION).add({
      data: {
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        flashcardKey: key,
        text: current.text || current.word || current.phrase || current.pattern || '',
        type: current.type || 'word',
        result: 'easy',
        date: today,
        createdAt: new Date().toISOString()
      }
    });
    return { saved: true };
  }
  if (!remembered) {
    const command = dbAdapter.getCommand();
    await dbAdapter.collection(COLLECTION).doc(current._id).update({
      data: Object.assign({}, reviewDates, {
        status: 'reviewing',
        familiarLevel: 'unfamiliar',
        nextReviewDate: today,
        unfamiliarCount: command.inc(1),
        lastUnfamiliarDate: today,
        updatedAt: new Date().toISOString()
      })
    });
    await dbAdapter.collection(LOG_COLLECTION).add({
      data: {
        familyId: ctx.family.familyId,
        childId: ctx.child.childId,
        flashcardKey: key,
        text: current.text || current.word || current.phrase || current.pattern || '',
        type: current.type || 'word',
        result: 'unfamiliar',
        date: today,
        createdAt: new Date().toISOString()
      }
    });
    return { saved: true };
  }
  const nextData = buildRememberedScheduleData(current, schedule, today);
  await dbAdapter.collection(COLLECTION).doc(current._id).update({
    data: Object.assign({}, nextData, reviewDates, { updatedAt: new Date().toISOString() })
  });
  await dbAdapter.collection(LOG_COLLECTION).add({
    data: {
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      flashcardKey: key,
      text: current.text || current.word || current.phrase || current.pattern || '',
      type: current.type || 'word',
      result: 'remembered',
      date: today,
      createdAt: new Date().toISOString()
    }
  });
  return { saved: true };
}

async function saveFlashcardAudio(event) {
  const payload = (event && event.payload) || {};
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'saveFlashcardAudio' }));
  const key = normalizeText(payload.flashcardKey);
  const audioFileId = normalizeText(payload.audioFileId || payload.fileId);
  const audioCloudPath = normalizeText(payload.audioCloudPath || payload.cloudPath);
  if (!key || (!audioFileId && !audioCloudPath)) {
    return { saved: false };
  }
  const result = await dbAdapter.collection(COLLECTION)
    .where({ familyId: ctx.family.familyId, childId: ctx.child.childId, flashcardKey: key })
    .limit(1)
    .get();
  const current = result && result.data && result.data[0];
  if (!current || !current._id) return { saved: false };
  await dbAdapter.collection(COLLECTION).doc(current._id).update({
    data: {
      audioFileId,
      audioCloudPath,
      updatedAt: new Date().toISOString()
    }
  });
  return { saved: true };
}

async function addDictionaryWord(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'addDictionaryWord' }));
  if (isPreviewWrite(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const type = normalizeType(payload.type || (payload.pattern ? 'pattern' : (payload.phrase ? 'phrase' : 'word')));
  const text = cardText(payload, type);
  if (!text) return { saved: false };
  const definitions = Array.isArray(payload.definitions) ? payload.definitions : [];
  const sourceType = normalizeText(payload.sourceType) || 'dictionary';
  const record = makeFlashcard(ctx, today, {
    sourceType,
    sourceId: normalizeText(payload.sourceId) || (sourceType === 'dictionary' ? text.toLowerCase() : ''),
    title: normalizeText(payload.sourceTitle || payload.title) || (sourceType === 'dictionary' ? '项目词典' : '')
  }, type, {
    word: type === 'word' ? text : '',
    phrase: type === 'phrase' ? text : '',
    text,
    pattern: type === 'pattern' ? text : '',
    phonetic: payload.phonetic || '',
    meaning: payload.meaning || definitions.join('；'),
    example: payload.example || '',
    exampleMeaning: payload.exampleMeaning || ''
  });
  const audioFileId = normalizeText(payload.audioFileId || payload.fileId);
  const audioCloudPath = normalizeText(payload.audioCloudPath || payload.cloudPath);
  const currentResult = await dbAdapter.collection(COLLECTION)
    .where({ familyId: record.familyId, childId: record.childId, flashcardKey: record.flashcardKey })
    .limit(1)
    .get();
  const current = currentResult && currentResult.data && currentResult.data[0];
  const data = Object.assign({}, record, {
    audioFileId,
    audioCloudPath,
    updatedAt: new Date().toISOString()
  });
  if (current && current._id) {
    await dbAdapter.collection(COLLECTION).doc(current._id).update({
      data: {
        sourceTitle: data.sourceTitle || current.sourceTitle || '',
        sourceId: data.sourceId || current.sourceId || '',
        phonetic: data.phonetic || current.phonetic || '',
        meaning: data.meaning || current.meaning || '',
        example: data.example || current.example || '',
        exampleMeaning: data.exampleMeaning || current.exampleMeaning || '',
        audioFileId: data.audioFileId || current.audioFileId || '',
        audioCloudPath: data.audioCloudPath || current.audioCloudPath || '',
        updatedAt: data.updatedAt
      }
    });
    return { saved: true, existed: true, flashcardKey: record.flashcardKey };
  }
  await dbAdapter.collection(COLLECTION).add({ data });
  return { saved: true, existed: false, flashcardKey: record.flashcardKey };
}

function normalizeSpelling(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s*([/-])\s*/g, '$1');
}

function acceptedSpellings(word) {
  const raw = normalizeText(word);
  const values = raw.split(/\s+\/\s+|\s+or\s+/i).map(normalizeSpelling).filter(Boolean);
  return values.length ? values : [normalizeSpelling(raw)];
}

function normalizeDictationQuestion(item) {
  const word = normalizeText(item && item.word);
  const input = normalizeText(item && item.input);
  return {
    word,
    phonetic: normalizeText(item && item.phonetic),
    meaning: normalizeText(item && item.meaning),
    input,
    correct: acceptedSpellings(word).includes(normalizeSpelling(input))
  };
}

function isLearnedFlashcard(item) {
  return !!item && (item.status === 'reviewing' || item.status === 'mastered');
}

function dictationSummary(item) {
  const questions = Array.isArray(item && item.questions) ? item.questions : [];
  return {
    id: item.recordId || item._id || '',
    recordId: item.recordId || '',
    attemptId: item.attemptId || '',
    date: item.date || '',
    sourceId: item.sourceId || '',
    sourceTitle: item.sourceTitle || '',
    practiceMode: item.practiceMode || 'dictation',
    totalCount: Number(item.totalCount || questions.length || 0),
    answeredCount: Number(item.answeredCount || questions.length || 0),
    correctCount: Number(item.correctCount || questions.filter((question) => question.correct).length || 0),
    wrongCount: Number(item.wrongCount || questions.filter((question) => !question.correct).length || 0),
    wrongWords: questions.filter((question) => !question.correct).map((question) => question.word).slice(0, 30),
    status: item.status || 'completed',
    startedAt: item.startedAt || '',
    completedAt: item.completedAt || '',
    updatedAt: item.updatedAt || ''
  };
}

async function listDictationAttempts(ctx, sourceId, maxRows = 500) {
  const where = { familyId: ctx.family.familyId, childId: ctx.child.childId, recordType: 'attempt' };
  if (sourceId) where.sourceId = sourceId;
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += 100) {
    const result = await dbAdapter.collection(DICTATION_COLLECTION).where(where).skip(offset).limit(100).get();
    const batch = result && result.data || [];
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

async function saveVocabularyDictationAttempt(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'saveVocabularyDictationAttempt' }));
  if (isPreviewWrite(ctx)) return { saved: false, reason: 'preview-role' };
  const sourceId = normalizeText(payload.sourceId);
  const sourceTitle = normalizeText(payload.sourceTitle);
  const startedAt = normalizeText(payload.startedAt) || new Date().toISOString();
  const questions = (Array.isArray(payload.questions) ? payload.questions : []).slice(0, 200).map(normalizeDictationQuestion).filter((item) => item.word);
  if (!sourceId || !questions.length) return { saved: false, reason: 'missing-content' };
  const correctCount = questions.filter((item) => item.correct).length;
  const wrongCount = questions.length - correctCount;
  const attemptId = normalizeText(payload.attemptId) || `${sourceId}:${startedAt}`;
  const recordId = [ctx.family.familyId, ctx.child.childId, today, 'dictation', attemptId].join('_');
  const now = new Date().toISOString();
  const record = {
    recordType: 'attempt',
    recordId,
    attemptId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    memberId: ctx.member.memberId,
    date: today,
    sourceId,
    sourceTitle,
    practiceMode: normalizeText(payload.practiceMode) || 'dictation',
    totalCount: questions.length,
    answeredCount: questions.length,
    correctCount,
    wrongCount,
    questions,
    status: 'completed',
    startedAt,
    completedAt: now,
    updatedAt: now
  };
  const attemptResult = await dbAdapter.collection(DICTATION_COLLECTION).where({
    familyId: record.familyId,
    childId: record.childId,
    recordId
  }).limit(1).get();
  const currentAttempt = attemptResult && attemptResult.data && attemptResult.data[0];
  if (currentAttempt && currentAttempt._id) {
    await dbAdapter.collection(DICTATION_COLLECTION).doc(currentAttempt._id).update({ data: record });
  } else {
    await dbAdapter.collection(DICTATION_COLLECTION).add({ data: Object.assign({}, record, { createdAt: now }) });
  }

  const wrongRecordId = [ctx.family.familyId, ctx.child.childId, 'dictation-wrong', sourceId].join('_');
  const wrongResult = await dbAdapter.collection(DICTATION_COLLECTION).where({
    familyId: record.familyId,
    childId: record.childId,
    recordId: wrongRecordId
  }).limit(1).get();
  const currentWrong = wrongResult && wrongResult.data && wrongResult.data[0];
  const wrongMap = (currentWrong && Array.isArray(currentWrong.wrongWords) ? currentWrong.wrongWords : []).reduce((map, item) => {
    const key = normalizeSpelling(item.word);
    if (key) map[key] = Object.assign({}, item);
    return map;
  }, {});
  questions.forEach((question) => {
    const key = normalizeSpelling(question.word);
    const current = wrongMap[key];
    if (question.correct) {
      if (!current) return;
      const correctStreak = Number(current.correctStreak || 0) + 1;
      if (correctStreak >= 2) delete wrongMap[key];
      else wrongMap[key] = Object.assign({}, current, { correctStreak, lastCorrectAt: now });
      return;
    }
    wrongMap[key] = Object.assign({}, current || {}, {
      word: question.word,
      phonetic: question.phonetic,
      meaning: question.meaning,
      wrongCount: Number(current && current.wrongCount || 0) + 1,
      correctStreak: 0,
      lastInput: question.input,
      lastWrongAt: now
    });
  });
  const wrongRecord = {
    recordType: 'wrongBook',
    recordId: wrongRecordId,
    familyId: record.familyId,
    childId: record.childId,
    sourceId,
    sourceTitle,
    wrongWords: Object.values(wrongMap).sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0)).slice(0, 500),
    updatedAt: now
  };
  if (currentWrong && currentWrong._id) {
    await dbAdapter.collection(DICTATION_COLLECTION).doc(currentWrong._id).update({ data: wrongRecord });
  } else {
    await dbAdapter.collection(DICTATION_COLLECTION).add({ data: Object.assign({}, wrongRecord, { createdAt: now }) });
  }

  await completionService.upsertStudyCompletion(ctx, today, {
    type: 'vocabulary',
    targetId: sourceId,
    section: 'dictation',
    title: sourceTitle || '听音写词',
    meta: '词汇听写',
    progressText: `听写 ${correctCount}/${questions.length} · 错词 ${wrongCount}`,
    latestAttempt: Object.assign(dictationSummary(record), { wrongBookCount: wrongRecord.wrongWords.length })
  });
  return { saved: true, attempt: dictationSummary(record), wrongWords: wrongRecord.wrongWords };
}

async function getVocabularyDictationData(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getVocabularyDictationData' }));
  const sourceId = normalizeText(payload.sourceId);
  if (!sourceId) return { today, attempts: [], wrongWords: [] };
  const [attemptRows, wrongResult] = await Promise.all([
    listDictationAttempts(ctx, sourceId),
    dbAdapter.collection(DICTATION_COLLECTION).where({ familyId: ctx.family.familyId, childId: ctx.child.childId, sourceId, recordType: 'wrongBook' }).limit(1).get()
  ]);
  const attempts = attemptRows.filter((item) => item.date === today).map(dictationSummary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const wrongBook = wrongResult && wrongResult.data && wrongResult.data[0];
  return { today, attempts, wrongWords: wrongBook && Array.isArray(wrongBook.wrongWords) ? wrongBook.wrongWords : [] };
}

async function getVocabularyDictationHistory(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getVocabularyDictationHistory' }));
  const rows = await listDictationAttempts(ctx);
  return { attempts: rows.map(dictationSummary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 100) };
}

async function getVocabularyDictationSourceCounts(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getVocabularyDictationSourceCounts' }));
  const rows = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await dbAdapter.collection(COLLECTION)
      .where({ familyId: ctx.family.familyId, childId: ctx.child.childId })
      .field({ sourceId: true, status: true, firstLearnedDate: true })
      .skip(offset)
      .limit(100)
      .get();
    const batch = result && result.data || [];
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  const counts = rows.reduce((map, item) => {
    const sourceId = normalizeText(item && item.sourceId);
    if (!sourceId.startsWith('dictionary-book-')) return map;
    if (!isLearnedFlashcard(item)) return map;
    map[sourceId] = Number(map[sourceId] || 0) + 1;
    return map;
  }, {});
  return { counts, total: Object.keys(counts).reduce((sum, key) => sum + Number(counts[key] || 0), 0) };
}

async function getVocabularyDictationSourceWords(event) {
  const payload = (event && event.payload) || {};
  const sourceId = normalizeText(payload.sourceId);
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getVocabularyDictationSourceWords' }));
  if (!sourceId.startsWith('dictionary-book-')) return { sourceId, rows: [], total: 0 };
  const loadStatus = async (status) => {
    const rows = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const result = await dbAdapter.collection(COLLECTION)
        .where({ familyId: ctx.family.familyId, childId: ctx.child.childId, sourceId, status })
        .field(DICTATION_CARD_FIELDS)
        .skip(offset)
        .limit(100)
        .get();
      const batch = result && result.data || [];
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    return rows;
  };
  const groups = await Promise.all(['reviewing', 'mastered'].map(loadStatus));
  const rows = groups.flat();
  return { sourceId, rows, total: rows.length };
}

async function getVocabularyDictationAttemptDetail(event) {
  const payload = (event && event.payload) || {};
  const recordId = normalizeText(payload.recordId);
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, { action: 'getVocabularyDictationAttemptDetail' }));
  if (!recordId) return { attempt: null };
  const result = await dbAdapter.collection(DICTATION_COLLECTION).where({ familyId: ctx.family.familyId, childId: ctx.child.childId, recordId, recordType: 'attempt' }).limit(1).get();
  const item = result && result.data && result.data[0];
  return { attempt: item ? Object.assign(dictationSummary(item), { questions: item.questions || [] }) : null };
}

module.exports = {
  upsertStudyPackFlashcards,
  getFlashcardReview,
  getFlashcardDue,
  getJuniorVocabularyPlan,
  completeJuniorVocabularyPlan,
  getJuniorListPlanSummary,
  updateFlashcardReview,
  saveSettings,
  saveFlashcardAudio,
  addDictionaryBook,
  getDictionaryBook,
  addDictionaryWord,
  saveVocabularyDictationAttempt,
  getVocabularyDictationData,
  getVocabularyDictationHistory,
  getVocabularyDictationSourceCounts,
  getVocabularyDictationSourceWords,
  getVocabularyDictationAttemptDetail,
  _test: {
    buildFlashcardWhere,
    summarizeFlashcards,
    CLIENT_CARD_FIELDS,
    DICTATION_CARD_FIELDS,
    DICTIONARY_SOURCE_IDS,
    isPreviewWrite,
    normalizeSpelling,
    acceptedSpellings,
    normalizeDictationQuestion,
    isLearnedFlashcard,
    normalizeJuniorListPlanState,
    getJuniorListPlanDescriptor,
    advanceJuniorListPlanState,
    selectJuniorCurrentCards,
    isJuniorCurrentListComplete,
    isJuniorUnfamiliarPending,
    isJuniorUnfamiliarReviewDue
  }
};
