const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const storageAdapter = require('../adapters/storage.adapter');

const COLLECTION = 'studyFlashcards';
const SETTINGS_COLLECTION = 'studyFlashcardSettings';
const LOG_COLLECTION = 'studyFlashcardReviewLogs';
const DICTIONARY_BOOKS = [
  { level: 'junior', title: '新东方 初中英语词汇词根+联想记忆法：乱序版', cloudPath: 'dictionary_books/word-dictionary-junior.json' },
  { level: 'senior', title: '高中英语词汇 乱序', cloudPath: 'dictionary_books/word-dictionary-senior.json' }
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
  unfamiliarCount: true,
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

module.exports = {
  upsertStudyPackFlashcards,
  getFlashcardReview,
  getFlashcardDue,
  updateFlashcardReview,
  saveSettings,
  saveFlashcardAudio,
  addDictionaryBook,
  getDictionaryBook,
  addDictionaryWord,
  _test: {
    buildFlashcardWhere,
    summarizeFlashcards,
    CLIENT_CARD_FIELDS,
    DICTIONARY_SOURCE_IDS,
    isPreviewWrite
  }
};
