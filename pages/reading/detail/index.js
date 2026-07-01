const store = require('../../../utils/store');
const page = require('../../../utils/page');
const completed = require('../../../utils/completed');

const STUDY_PACK_STORAGE_PREFIX = 'readingStudyPack:';
const FLASHCARD_WORDS_KEY = 'readingFlashcardWordsV1';
const FLASHCARD_ITEMS_KEY = 'readingFlashcardItemsV1';
const EBBINGHAUS_REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];

function buildOptionList(options) {
  return ['A', 'B', 'C', 'D'].filter((key) => options && options[key]).map((key) => ({
    key,
    text: options[key],
    tokens: tokenizeChunkText(options[key]),
    selected: false
  }));
}

function hasOptions(question) {
  return !!(question && question.options && buildOptionList(question.options).length);
}

function normalizeAnswerText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatAnswerDisplay(value) {
  const text = String(value || '').trim();
  return /^[A-D]$/.test(text) ? text.toLowerCase() : text;
}

function findClozeBlanks(text) {
  const source = String(text || '');
  const found = {};
  const regex = /([A-Za-z])?[_＿]{1,}(\d{1,3})[_＿]{1,}/g;
  let match;
  while ((match = regex.exec(source))) {
    const number = Number(match[2]);
    if (!number || found[number]) {
      continue;
    }
    found[number] = {
      number,
      initial: match[1] || '',
      start: match.index,
      end: match.index + match[0].length
    };
  }
  return Object.keys(found).map((key) => found[key]).sort((a, b) => a.number - b.number);
}

function buildClozeQuestions(passage) {
  const existing = (passage.questions || []).reduce((map, question) => {
    map[String(question.number)] = question;
    return map;
  }, {});
  return findClozeBlanks(passage.passage).map((blank) => Object.assign({}, existing[String(blank.number)] || {}, {
    number: blank.number,
    initial: blank.initial,
    questionType: 'blank'
  }));
}

function buildClozePassageParts(passage, questions) {
  const source = String((passage && passage.passage) || '');
  const questionMap = (questions || []).reduce((map, question) => {
    map[String(question.number)] = question;
    return map;
  }, {});
  const parts = [];
  const regex = /([A-Za-z])?[_＿]{1,}(\d{1,3})[_＿]{1,}/g;
  let cursor = 0;
  let match;
  while ((match = regex.exec(source))) {
    if (match.index > cursor) {
      parts.push({ type: 'text', text: source.slice(cursor, match.index) });
    }
    const number = Number(match[2]);
    const question = questionMap[String(number)] || {};
    parts.push({
      type: 'blank',
      number,
      initial: match[1] || question.initial || '',
      inputValue: question.inputValue || '',
      answerDisplay: question.answerDisplay || '',
      isCorrect: question.isCorrect
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    parts.push({ type: 'text', text: source.slice(cursor) });
  }
  return parts;
}

function stripQuestionBlockFromPassage(text) {
  const source = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, '\n').trim();
  const match = /(?:^|\n)\s*\d{1,3}\.\s+[\s\S]*?(?:_{3,}|[A-D]\.\s+)/.exec(source);
  if (!match) {
    return source;
  }
  return source.slice(0, match.index).trim();
}

function normalizePassage(passage, answers, submitted, review) {
  if (!passage) {
    return null;
  }
  const cleanPassageText = stripQuestionBlockFromPassage(passage.passage);
  const isClozePassage = String(passage.section || '').toUpperCase() === 'C'
    || (passage.questions || []).some((question) => question.questionType === 'blank');
  const sourceQuestions = isClozePassage ? buildClozeQuestions(passage) : (passage.questions || []);
  const analysisByNumber = ((review && review.analysis) || []).reduce((map, item) => {
    if (item && item.number !== undefined && item.number !== null) {
      map[String(item.number)] = item;
    }
    return map;
  }, {});
  const questions = sourceQuestions.map((question) => {
    const reviewAnalysis = analysisByNumber[String(question.number)] || null;
    const type = hasOptions(question) ? 'choice' : 'blank';
    const userAnswer = String(answers[String(question.number)] || '');
    const rawAnswer = String(question.answer || '').trim();
    const answer = type === 'choice' ? rawAnswer.toUpperCase() : rawAnswer;
    const answerDisplay = formatAnswerDisplay(answer);
    const selected = type === 'choice' ? userAnswer.trim().toUpperCase() : userAnswer;
    const selectedDisplay = formatAnswerDisplay(selected);
    const isCorrect = submitted && answer ? (
      type === 'choice'
        ? selected === answer
        : normalizeAnswerText(selected) === normalizeAnswerText(answer)
    ) : null;
    return Object.assign({}, question, {
      type,
      promptTokens: tokenizeChunkText(question.prompt || ''),
      selected,
      selectedDisplay,
      inputValue: type === 'blank' ? selected : '',
      answer,
      answerDisplay,
      isCorrect,
      reviewAnalysis,
      optionsList: buildOptionList(question.options).map((option) => Object.assign({}, option, {
        selected: option.key === selected,
        correct: !!submitted && !!answer && option.key === answer,
        wrong: !!submitted && !!answer && option.key === selected && selected !== answer
      }))
    });
  });
  return Object.assign({}, passage, {
    passage: cleanPassageText,
    sectionDisplay: passage.sectionLabel || (passage.section ? `阅读 ${passage.section}` : '阅读'),
    difficultyDisplay: passage.difficultyLabel || '',
    isClozePassage,
    questions,
    clozePassageParts: isClozePassage ? buildClozePassageParts(passage, questions) : []
  });
}

function pickText(item, keys) {
  if (typeof item === 'string') {
    return item;
  }
  const source = item || {};
  for (let i = 0; i < keys.length; i += 1) {
    if (source[keys[i]]) {
      return source[keys[i]];
    }
  }
  return '';
}

function uniqueTerms(items, keys) {
  const seen = {};
  return (items || []).map((item) => pickText(item, keys).trim()).filter((text) => {
    const key = text.toLowerCase();
    if (!text || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

function termEntries(items, keys, options) {
  const seen = {};
  return (items || []).map((item, index) => {
    const text = pickText(item, keys).trim();
    const source = typeof item === 'string' ? {} : (item || {});
    const key = text.toLowerCase();
    if (!text || seen[key]) {
      return null;
    }
    seen[key] = true;

    let label = '';
    if (options && options.answer) {
      const raw = source.questionNumber || source.number || source.question || source.no || source.label || '';
      const match = String(raw).match(/\d+/);
      label = `第${match ? match[0] : index + 1}题`;
    }

    return {
      text,
      label,
      note: source.meaning || source.translation || source.cn || ''
    };
  }).filter(Boolean);
}

function isAlpha(ch) {
  return !!ch && /[A-Za-z]/.test(ch);
}

function pushTermRanges(source, terms, tone, wordBoundary, ranges) {
  const lower = source.toLowerCase();
  (terms || []).forEach((term) => {
    let needle = String((term && term.text) || term || '').trim().toLowerCase();
    if (tone === 'phrase') {
      needle = needle.replace(/[.!?。！？]+$/g, '').trim();
    }
    if (wordBoundary && /\s/.test(needle)) {
      return;
    }
    if (tone === 'phrase' && needle.length > 120) {
      return;
    }
    if (needle.length < (wordBoundary ? 2 : 4)) {
      return;
    }
    let from = 0;
    while (from < lower.length) {
      const start = lower.indexOf(needle, from);
      if (start < 0) {
        break;
      }
      const end = start + needle.length;
      if (!wordBoundary || (!isAlpha(source[start - 1]) && !isAlpha(source[end]))) {
        ranges.push({
          start,
          end,
          tone,
          label: term && term.label ? term.label : '',
          note: term && term.note ? term.note : '',
          rank: tone === 'answer' ? 0 : tone === 'phrase' ? 1 : 2
        });
      }
      from = end;
    }
  });
}

function splitSentenceRanges(source) {
  const text = String(source || '');
  if (!text) {
    return [];
  }
  const ranges = [];
  const marks = '.!?。！？';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const next = text[index + 1] || '';
    const isEnd = marks.includes(ch) || ch === '\n';
    if (!isEnd) {
      continue;
    }
    if (ch === '.' && isAlpha(text[index - 1]) && isAlpha(next)) {
      continue;
    }
    if (ch === '.') {
      const before = text.slice(Math.max(0, index - 8), index + 1);
      if (/\b(Mr|Mrs|Ms|Dr|No|St|Jr|Sr)\.$/.test(before)) {
        continue;
      }
      const nextNonSpace = text.slice(index + 1).match(/\S/);
      if (/\b[A-Z]\.$/.test(before) && nextNonSpace && /[A-Z]/.test(nextNonSpace[0])) {
        continue;
      }
    }
    let end = index + 1;
    while (end < text.length && /\s/.test(text[end])) {
      end += 1;
    }
    if (text.slice(start, end).trim()) {
      ranges.push({ start, end });
    }
    start = end;
  }
  if (start < text.length && text.slice(start).trim()) {
    ranges.push({ start, end: text.length });
  }
  return ranges.length ? ranges : [{ start: 0, end: text.length }];
}

function pickSentenceTone(sentenceRange, ranges) {
  const hits = ranges.filter((range) => range.start < sentenceRange.end && range.end > sentenceRange.start);
  if (!hits.length) {
    return { tone: 'normal', label: '', note: '' };
  }
  hits.sort((a, b) => a.rank - b.rank);
  const primary = hits[0];
  return {
    tone: primary.tone,
    label: primary.label || '',
    note: primary.note || ''
  };
}

function buildSentenceChunks(source, sentenceRange, ranges) {
  const hits = ranges
    .filter((range) => range.start >= sentenceRange.start && range.end <= sentenceRange.end)
    .sort((a, b) => a.start - b.start || a.rank - b.rank);
  const chunks = [];
  let cursor = sentenceRange.start;
  hits.forEach((range) => {
    if (range.start < cursor || range.end <= range.start) {
      return;
    }
    if (range.start > cursor) {
      chunks.push({ text: source.slice(cursor, range.start), tone: 'normal', highlight: false, className: 'passage-chunk' });
    }
    chunks.push({
      text: source.slice(range.start, range.end),
      tone: range.tone,
      label: range.label || '',
      note: range.note || '',
      highlight: true,
      className: `passage-chunk segment-${range.tone}`
    });
    cursor = range.end;
  });
  if (cursor < sentenceRange.end) {
    chunks.push({ text: source.slice(cursor, sentenceRange.end), tone: 'normal', highlight: false, className: 'passage-chunk' });
  }
  return chunks.length ? chunks : [{ text: source.slice(sentenceRange.start, sentenceRange.end), tone: 'normal', highlight: false, className: 'passage-chunk' }];
}

function tokenizeChunkText(text) {
  const source = String(text || '');
  if (!source) return [];
  const tokens = [];
  const regex = /[A-Za-z][A-Za-z'-]*/g;
  let cursor = 0;
  let match;
  while ((match = regex.exec(source))) {
    if (match.index > cursor) {
      tokens.push({ text: source.slice(cursor, match.index), isWord: false });
    }
    tokens.push({ text: match[0], isWord: true, word: match[0].toLowerCase() });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    tokens.push({ text: source.slice(cursor), isWord: false });
  }
  return tokens.length ? tokens : [{ text: source, isWord: false }];
}

function attachChunkTokens(segments) {
  return (segments || []).map((segment) => Object.assign({}, segment, {
    chunks: (segment.chunks || []).map((chunk) => Object.assign({}, chunk, {
      tokens: tokenizeChunkText(chunk.text)
    })),
    tokens: segment.chunks && segment.chunks.length ? [] : tokenizeChunkText(segment.text)
  }));
}

function buildPassageSegments(text, review, mode) {
  const source = String(text || '');
  if (!source) {
    return [];
  }
  const ranges = [];
  const activeMode = mode || 'none';
  if (review && (activeMode === 'answer' || activeMode === 'all')) {
    pushTermRanges(source, termEntries(review.answerSentences, ['text', 'sentence'], { answer: true }), 'answer', false, ranges);
  }
  if (review && (activeMode === 'phrase' || activeMode === 'all')) {
    pushTermRanges(source, termEntries([].concat(review.phraseCards || [], review.phrases || []), ['text', 'phrase', 'example']), 'phrase', false, ranges);
  }
  if (review && (activeMode === 'pattern' || activeMode === 'all')) {
    pushTermRanges(source, termEntries(review.sentencePatternCards || [], ['example', 'pattern', 'text']), 'pattern', false, ranges);
  }
  if (review && (activeMode === 'word' || activeMode === 'all')) {
    pushTermRanges(source, termEntries([].concat(review.vocabularyCards || [], review.vocabulary || []), ['word', 'text']), 'word', true, ranges);
  }
  return attachChunkTokens(splitSentenceRanges(source).map((sentenceRange) => {
    const meta = pickSentenceTone(sentenceRange, ranges);
    const shouldColorWholeSentence = meta.tone === 'answer';
    return Object.assign({
      text: source.slice(sentenceRange.start, sentenceRange.end),
      start: sentenceRange.start,
      end: sentenceRange.end,
      chunks: shouldColorWholeSentence ? [] : buildSentenceChunks(source, sentenceRange, ranges)
    }, shouldColorWholeSentence ? meta : { tone: 'normal', label: '', note: '' });
  }));
}

function pickSentenceAt(text, start, end) {
  const source = String(text || '');
  if (!source) return '';
  const from = Math.max(0, Math.min(Number(start || 0), source.length));
  const to = Math.max(from, Math.min(Number(end || from), source.length));
  return source.slice(from, to).replace(/\s+/g, ' ').trim();
}

function normalizeCardList(list, fallbackKey) {
  return (list || []).map((item) => {
    if (typeof item === 'string') {
      return { [fallbackKey]: item };
    }
    return item || {};
  }).filter((item) => item[fallbackKey] || item.word || item.text || item.pattern);
}

function withGroupIndexes(items) {
  return (items || []).map((item, index) => Object.assign({}, item, {
    groupIndex: item.groupIndex || index + 1
  }));
}

function normalizeReview(review) {
  if (!review) {
    return null;
  }
  const vocabularyCards = withGroupIndexes(normalizeCardList(review.vocabularyCards || review.vocabulary, 'word')).map((card) => Object.assign({}, card, {
    flashcardKey: `word:${card.word || card.text || ''}`
  }));
  const phraseCards = withGroupIndexes(normalizeCardList(review.phraseCards || review.phrases, 'text')).map((card) => Object.assign({}, card, {
    flashcardKey: `phrase:${card.text || card.phrase || ''}`
  }));
  return Object.assign({}, review, {
    answerSentences: normalizeCardList(review.answerSentences || [], 'text'),
    phrases: review.phrases || [],
    vocabulary: review.vocabulary || [],
    sentencePatterns: review.sentencePatterns || [],
    vocabularyCards,
    phraseCards,
    sentencePatternCards: withGroupIndexes(normalizeCardList(review.sentencePatternCards || review.sentencePatterns, 'pattern')),
    fullTranslation: review.fullTranslation || '',
    analysis: (review.analysis || []).map((item) => Object.assign({}, item, {
      answerDisplay: item && item.answer ? formatAnswerDisplay(item.answer) : '',
      selectedDisplay: item && item.selected ? formatAnswerDisplay(item.selected) : ''
    }))
  });
}

function buildScoreText(attempt) {
  if (!attempt) {
    return '';
  }
  const correctCount = Number(attempt.correctCount);
  const totalCount = Number(attempt.totalCount);
  if (Number.isFinite(correctCount) && Number.isFinite(totalCount) && totalCount > 0) {
    return `${correctCount * 2} / ${totalCount * 2} 分`;
  }
  const score = Number(attempt.score);
  const totalScore = Number(attempt.totalScore);
  if (Number.isFinite(score) && Number.isFinite(totalScore) && totalScore > 0) {
    return `${score} / ${totalScore} 分`;
  }
  if (Number.isFinite(score)) {
    return `${score} 分`;
  }
  return '';
}

function buildReviewSummary(attempt) {
  if (!attempt) {
    return '';
  }
  const correctCount = Number(attempt.correctCount);
  const totalCount = Number(attempt.totalCount);
  if (!Number.isFinite(totalCount) || totalCount <= 0) {
    return '';
  }
  const wrongCount = Math.max(0, totalCount - (Number.isFinite(correctCount) ? correctCount : 0));
  return wrongCount ? `答对 ${correctCount} 题，错 ${wrongCount} 题。解析已展开。` : `全部答对，共 ${totalCount} 题。解析已展开。`;
}

function mergeStudyPackIntoReview(review, studyPack) {
  const base = normalizeReview(review || {});
  const pack = studyPack || {};
  return normalizeReview(Object.assign({}, base, {
    vocabularyCards: pack.vocabularyCards || base.vocabularyCards,
    phraseCards: pack.phraseCards || base.phraseCards,
    sentencePatternCards: pack.sentencePatternCards || base.sentencePatternCards,
    studyPackSource: pack.source || base.studyPackSource
  }));
}

function isCompleteStudyPack(studyPack) {
  if (!studyPack || String(studyPack.source || '').indexOf('model:') !== 0) {
    return false;
  }
  const analyses = studyPack.questionAnalyses || studyPack.analysis || [];
  return !!(studyPack.vocabularyCards || []).length
    && !!(studyPack.phraseCards || []).length
    && !!(studyPack.sentencePatternCards || []).length
    && !(studyPack.sentencePatternCards || []).some((item) => !item.exampleMeaning)
    && !!analyses.length
    && !analyses.some((item) => !item.answerSentence);
}

function isQuestionStudyPack(studyPack) {
  if (!studyPack || String(studyPack.source || '').indexOf('model:') !== 0) {
    return false;
  }
  const analyses = studyPack.questionAnalyses || studyPack.analysis || [];
  return !!analyses.length && !analyses.some((item) => !item.answerSentence);
}

function isModelReview(review) {
  if (!review) {
    return false;
  }
  return isQuestionStudyPack({
    source: review.studyPackSource || '',
    questionAnalyses: review.analysis || []
  });
}

function isCardStudyPack(studyPack) {
  if (!studyPack || String(studyPack.source || '').indexOf('model:') !== 0) {
    return false;
  }
  return !!(studyPack.vocabularyCards || []).length
    && !!(studyPack.phraseCards || []).length
    && !!(studyPack.sentencePatternCards || []).length
    && !(studyPack.sentencePatternCards || []).some((item) => !item.exampleMeaning);
}

function getStudySectionLabel(section) {
  if (section === 'vocabulary') return '生词';
  if (section === 'phrases') return '短语';
  if (section === 'patterns') return '句型';
  return '学习卡';
}

function recordReadingCompleted(passage, attempt) {
  if (!passage || !passage._id) return;
  const item = {
    id: `reading:${passage._id}`,
    type: 'reading',
    targetId: passage._id,
    title: passage.title || '阅读练习',
    meta: passage.year ? `${passage.year} · ${passage.district || ''}` : '阅读',
    passageId: passage._id,
    latestAttempt: attempt || null
  };
  completed.addCompletedItem(item);
  store.recordStudyCompletion(item);
}

function recordReadingStudyCompleted(passage, section, studyPack) {
  if (!passage || !passage._id) return;
  const item = {
    id: `reading-study:${passage._id}:${section}`,
    type: 'reading-study',
    targetId: passage._id,
    title: `${getStudySectionLabel(section)}学习`,
    meta: passage.title || '阅读学习包',
    passageId: passage._id,
    section,
    progressText: `${getStudySectionLabel(section)}已生成`
  };
  completed.addCompletedItem(item);
  store.recordStudyCompletion(item);
}

function hasStudySection(review, section) {
  if (!review) {
    return false;
  }
  if (section === 'vocabulary') {
    return !!(review.vocabularyCards || []).length;
  }
  if (section === 'phrases') {
    return !!(review.phraseCards || []).length;
  }
  if (section === 'patterns') {
    return !!(review.sentencePatternCards || []).length;
  }
  if (section === 'cards') {
    return hasStudySection(review, 'vocabulary') && hasStudySection(review, 'phrases') && hasStudySection(review, 'patterns');
  }
  if (section === 'all') {
    return hasStudySection(review, 'cards');
  }
  return true;
}

function getPhoneStudyPack(passageId) {
  try {
    const cached = wx.getStorageSync(`${STUDY_PACK_STORAGE_PREFIX}${passageId}`) || null;
    if (!cached || (!isCompleteStudyPack(cached.studyPack) && !isQuestionStudyPack(cached.studyPack))) {
      wx.removeStorageSync(`${STUDY_PACK_STORAGE_PREFIX}${passageId}`);
      return null;
    }
    return cached;
  } catch (error) {
    return null;
  }
}

function savePhoneStudyPack(passageId, studyPack) {
  if (!isCompleteStudyPack(studyPack) && !isQuestionStudyPack(studyPack) && !isCardStudyPack(studyPack)) {
    return;
  }
  try {
    wx.setStorageSync(`${STUDY_PACK_STORAGE_PREFIX}${passageId}`, {
      savedAt: Date.now(),
      studyPack
    });
  } catch (error) {}
}

function mergePhoneStudyPack(passageId, studyPack) {
  if (!passageId || !studyPack) {
    return;
  }
  const cached = getPhoneStudyPack(passageId);
  const merged = Object.assign({}, (cached && cached.studyPack) || {}, studyPack, {
    source: studyPack.source || (cached && cached.studyPack && cached.studyPack.source) || ''
  });
  savePhoneStudyPack(passageId, merged);
}

function getUnfamiliarMap() {
  try {
    const legacyWords = wx.getStorageSync(FLASHCARD_WORDS_KEY) || [];
    const items = wx.getStorageSync(FLASHCARD_ITEMS_KEY) || [];
    return items.concat(legacyWords).reduce((map, item) => {
      const type = item && item.type ? item.type : 'word';
      const text = item && (item.text || item.word || item.phrase);
      if (text) {
        map[`${type}:${text}`] = true;
        map[text] = true;
      }
      return map;
    }, {});
  } catch (error) {
    return {};
  }
}

function formatReviewDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildReviewSchedule(now) {
  return EBBINGHAUS_REVIEW_DAYS.map((days, index) => ({
    step: index,
    days,
    date: formatReviewDate(now + days * 24 * 60 * 60 * 1000),
    done: false
  }));
}

function getCardText(card, type) {
  if (type === 'phrase') {
    return card.text || card.phrase;
  }
  if (type === 'pattern') {
    return card.pattern || card.text;
  }
  return card.word || card.text;
}

function addUnfamiliarCard(card, type) {
  const text = getCardText(card, type);
  if (!text) {
    return false;
  }
  const flashcardKey = `${type}:${text}`;
  let items = [];
  try {
    items = wx.getStorageSync(FLASHCARD_ITEMS_KEY) || [];
  } catch (error) {
    items = [];
  }
  if (items.some((item) => item && item.flashcardKey === flashcardKey)) {
    return false;
  }
  const now = Date.now();
  const reviewSchedule = buildReviewSchedule(now);
  items.push(Object.assign({}, card, {
    type,
    text,
    flashcardKey,
    addedAt: now,
    familiarLevel: 'unfamiliar',
    reviewStep: 0,
    nextReviewDate: reviewSchedule[0].date,
    reviewSchedule
  }));
  wx.setStorageSync(FLASHCARD_ITEMS_KEY, items);
  return true;
}

function addReviewFlashcards(review) {
  const normalized = normalizeReview(review);
  if (!normalized) {
    return 0;
  }
  const cards = []
    .concat((normalized.vocabularyCards || []).map((card) => ({ type: 'word', card })))
    .concat((normalized.phraseCards || []).map((card) => ({ type: 'phrase', card })))
    .concat((normalized.sentencePatternCards || []).map((card) => ({ type: 'pattern', card })));
  return cards.reduce((count, item) => (
    addUnfamiliarCard(item.card, item.type) ? count + 1 : count
  ), 0);
}

function canWriteStudyRecord() {
  try {
    return wx.getStorageSync('lastStudyRole') === 'student';
  } catch (error) {
    return false;
  }
}

function buildLocalReadingResult(passage, answers) {
  const questions = passage.questions || [];
  const answerSentences = passage.answerSentences || [];
  let correctCount = 0;
  const analysis = questions.map((question, index) => {
    const selected = String(answers[String(question.number)] || '').trim().toUpperCase();
    const answer = String(question.answer || '').trim().toUpperCase();
    const correct = selected === answer;
    if (correct) correctCount += 1;
    return {
      number: question.number,
      answer,
      selected,
      correct,
      answerSentence: answerSentences[index] || answerSentences[0] || null,
      text: question.analysis || '结合原文判断。'
    };
  });
  const review = {
    answerSentences,
    phrases: passage.phrases || [],
    vocabulary: passage.vocabulary || [],
    vocabularyCards: passage.vocabulary || [],
    phraseCards: (passage.phrases || []).map((item) => Object.assign({}, item, {
      text: item.text || item.phrase || ''
    })),
    sentencePatternCards: passage.sentencePatternCards || [],
    fullTranslation: passage.fullTranslation || '',
    analysis,
    studyPackSource: 'local'
  };
  const attempt = {
    passageId: passage._id,
    title: passage.title,
    answers,
    correctCount,
    totalCount: questions.length,
    score: correctCount * 2,
    totalScore: questions.length * 2,
    review,
    status: 'preview'
  };
  return {
    passage,
    attempt,
    review,
    studyWriteAllowed: false
  };
}

Page({
  data: page.createCloudPageData({
    loading: true,
    submitting: false,
    passageId: '',
    passage: null,
    answers: {},
    attempt: null,
    review: null,
    activeReviewTab: 'vocabulary',
    reviewTabs: [
      { key: 'vocabulary', label: '生词', tone: 'word' },
      { key: 'phrases', label: '短语', tone: 'phrase' },
      { key: 'patterns', label: '句型', tone: 'pattern' }
    ],
    activeHighlight: 'none',
    highlightButtons: [
      { key: 'none', label: '原文' },
      { key: 'word', label: '生词' },
      { key: 'phrase', label: '短语' },
      { key: 'answer', label: '答案句' },
      { key: 'pattern', label: '句型' },
      { key: 'all', label: '全部' }
    ],
    passageSegments: [],
    wordCards: [],
    phraseCards: [],
    sentencePatternCards: [],
    fullTranslation: '',
    selectedSentence: '',
    selectedSentenceStart: -1,
    selectedSentenceTranslation: '',
    sentenceTranslating: false,
    loadingStudySection: '',
    studyLoadingText: '',
    studyErrorText: '',
    failedStudySection: '',
    analysisErrorText: '',
    unfamiliarMap: {},
    scoreText: '',
    reviewSummary: '',
    submitted: false,
    showReviewDetails: false,
    hasScore: false,
    speakingWord: '',
    audioStatusText: '',
    dictionaryVisible: false,
    dictionaryLoading: false,
    dictionaryWord: '',
    dictionaryEntry: null
  }),
  async onLoad(options) {
    page.syncTheme(this);
    const passageId = options && options.passageId ? String(options.passageId) : '';
    this.setData({ passageId });
    await this.loadPassage(passageId);
  },
  async loadPassage(passageId) {
    const data = await store.getReadingPassage({ passageId }, (fresh) => this.applyPassage(fresh));
    this.applyPassage(data && data.passage ? data : { passage: null, latestAttempt: null });
  },
  applyPassage(data) {
    if (!data || !data.passage) {
      data = { passage: null, latestAttempt: null };
    }
    const rawLatestAttempt = data.latestAttempt || null;
    const latestAttempt = rawLatestAttempt && isModelReview(rawLatestAttempt.review) ? rawLatestAttempt : null;
    const answers = latestAttempt && latestAttempt.answers ? latestAttempt.answers : this.data.answers;
    const submitted = !!latestAttempt;
    const review = latestAttempt && latestAttempt.review ? normalizeReview(latestAttempt.review) : null;
    const cachedPack = data.passage && data.passage._id ? getPhoneStudyPack(data.passage._id) : null;
    const mergedReview = cachedPack && cachedPack.studyPack
      ? mergeStudyPackIntoReview(review, cachedPack.studyPack)
      : review;
    const passage = normalizePassage(data.passage, answers, submitted, mergedReview);
    const activeHighlight = submitted ? (this.data.activeHighlight === 'none' ? 'answer' : this.data.activeHighlight) : this.data.activeHighlight;
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      passage,
      answers,
      attempt: latestAttempt,
      review: mergedReview,
      activeHighlight,
      passageSegments: buildPassageSegments(passage ? passage.passage : '', mergedReview, activeHighlight),
      wordCards: mergedReview ? mergedReview.vocabularyCards : [],
      phraseCards: mergedReview ? mergedReview.phraseCards : [],
      sentencePatternCards: mergedReview ? mergedReview.sentencePatternCards : [],
      fullTranslation: mergedReview ? mergedReview.fullTranslation : '',
      unfamiliarMap: getUnfamiliarMap(),
      scoreText: buildScoreText(latestAttempt),
      reviewSummary: buildReviewSummary(latestAttempt),
      submitted,
      showReviewDetails: submitted,
      hasScore: !!latestAttempt && latestAttempt.score !== null && latestAttempt.score !== undefined
    }));
  },
  selectOption(event) {
    if (this.data.submitted || this.data.submitting) {
      return;
    }
    const number = String(event.currentTarget.dataset.number || '');
    const option = String(event.currentTarget.dataset.option || '');
    if (!number || !option) {
      return;
    }
    const answers = Object.assign({}, this.data.answers, { [number]: option });
    this.setData({
      answers,
      passage: normalizePassage(this.data.passage, answers, this.data.submitted, this.data.review)
    });
  },
  inputAnswer(event) {
    if (this.data.submitted || this.data.submitting) {
      return;
    }
    const number = String(event.currentTarget.dataset.number || '');
    if (!number) {
      return;
    }
    const answers = Object.assign({}, this.data.answers, {
      [number]: event.detail.value || ''
    });
    this.setData({
      answers,
      passage: normalizePassage(this.data.passage, answers, this.data.submitted, this.data.review)
    });
  },
  applyReview(review) {
    const normalized = normalizeReview(review);
    this.setData({
      review: normalized,
      passage: normalizePassage(this.data.passage, this.data.answers, this.data.submitted, normalized),
      passageSegments: buildPassageSegments(this.data.passage ? this.data.passage.passage : '', normalized, this.data.activeHighlight),
      wordCards: normalized ? normalized.vocabularyCards : [],
      phraseCards: normalized ? normalized.phraseCards : [],
      sentencePatternCards: normalized ? normalized.sentencePatternCards : [],
      fullTranslation: normalized ? normalized.fullTranslation : ''
    });
  },
  toggleReviewDetails() {
    this.setData({
      showReviewDetails: !this.data.showReviewDetails
    });
  },
  async ensureStudyPack(passageId) {
    if (!passageId || this._studyPackLoading) {
      return;
    }
    const cached = getPhoneStudyPack(passageId);
    if (cached && cached.studyPack) {
      this.applyReview(mergeStudyPackIntoReview(this.data.review, cached.studyPack));
      return;
    }
    this._studyPackLoading = true;
    try {
      const result = await store.getReadingStudyPack({ passageId });
      const studyPack = result && result.studyPack ? result.studyPack : null;
      if (studyPack) {
        savePhoneStudyPack(passageId, studyPack);
        this.applyReview(mergeStudyPackIntoReview(this.data.review, studyPack));
      }
    } finally {
      this._studyPackLoading = false;
    }
  },
  async ensureStudySection(section) {
    const passageId = this.data.passage && this.data.passage._id;
    if (!passageId || !section || hasStudySection(this.data.review, section)) {
      return;
    }
    if (this._studyPackLoading) {
      wx.showToast({ title: `${getStudySectionLabel(this.data.loadingStudySection || section)}生成中，请稍等`, icon: 'none' });
      return;
    }
    this._studyPackLoading = true;
    this.setData({
      loadingStudySection: section,
      studyLoadingText: `${getStudySectionLabel(section)}生成中。`,
      studyErrorText: '',
      failedStudySection: ''
    });
    wx.showToast({ title: `${getStudySectionLabel(section)}生成中`, icon: 'none' });
    try {
      const result = await store.getReadingStudyPack({ passageId, section });
      const studyPack = result && result.studyPack ? result.studyPack : null;
      if (studyPack) {
        mergePhoneStudyPack(passageId, studyPack);
        this.applyReview(mergeStudyPackIntoReview(this.data.review, studyPack));
        recordReadingStudyCompleted(this.data.passage, section, studyPack);
      }
    } catch (error) {
      this.setData({
        studyErrorText: `${getStudySectionLabel(section)}生成失败，可重试。`,
        failedStudySection: section
      });
      wx.showToast({ title: '生成失败，可重试', icon: 'none' });
    } finally {
      this._studyPackLoading = false;
      this.setData({ loadingStudySection: '', studyLoadingText: '' });
    }
  },
  retryStudySection() {
    const section = this.data.failedStudySection || this.data.activeReviewTab || 'vocabulary';
    this.ensureStudySection(section);
  },
  selectReviewTab(event) {
    const tab = String(event.currentTarget.dataset.tab || 'vocabulary');
    this.setData({ activeReviewTab: tab });
    this.ensureStudySection(tab);
  },
  selectHighlight(event) {
    const mode = String(event.currentTarget.dataset.mode || 'none');
    const activeHighlight = this.data.activeHighlight === mode ? 'none' : mode;
    this.setData({
      activeHighlight,
      passageSegments: buildPassageSegments(this.data.passage ? this.data.passage.passage : '', this.data.review, activeHighlight)
    });
    const sectionMap = { word: 'vocabulary', phrase: 'phrases', pattern: 'patterns', all: 'cards' };
    if (sectionMap[activeHighlight]) {
      this.ensureStudySection(sectionMap[activeHighlight]);
    }
  },
  hideSentenceTranslation(event) {
    const start = Number(event.currentTarget.dataset.start || 0);
    if (this.data.selectedSentenceStart !== start) {
      return;
    }
    this.setData({
      selectedSentence: '',
      selectedSentenceStart: -1,
      selectedSentenceTranslation: '',
      sentenceTranslating: false
    });
  },
  async translatePassageSentence(event) {
    if (!this.data.submitted) {
      return;
    }
    const start = Number(event.currentTarget.dataset.start || 0);
    if (this.data.selectedSentenceStart === start && !this.data.sentenceTranslating) {
      this.hideSentenceTranslation(event);
      return;
    }
    const sentence = pickSentenceAt(
      this.data.passage ? this.data.passage.passage : '',
      start,
      event.currentTarget.dataset.end
    );
    const passageId = this.data.passage && this.data.passage._id;
    if (!sentence || !passageId || this.data.sentenceTranslating) {
      return;
    }
    const cached = (this._sentenceTranslations || {})[sentence];
    if (cached) {
      this.setData({
        selectedSentence: sentence,
        selectedSentenceStart: start,
        selectedSentenceTranslation: cached
      });
      return;
    }
    this.setData({
      selectedSentence: sentence,
      selectedSentenceStart: start,
      selectedSentenceTranslation: '',
      sentenceTranslating: true
    });
    try {
      const result = await store.getReadingStudyPack({
        passageId,
        section: 'sentenceTranslation',
        text: sentence
      });
      const translated = result && result.sentenceTranslation ? result.sentenceTranslation.translation : '';
      if (!translated) {
        throw new Error('翻译失败');
      }
      this._sentenceTranslations = Object.assign({}, this._sentenceTranslations || {}, { [sentence]: translated });
      this.setData({
        selectedSentenceTranslation: translated
      });
    } catch (error) {
      wx.showToast({ title: error.message || '翻译失败', icon: 'none' });
    } finally {
      this.setData({ sentenceTranslating: false });
    }
  },
  toggleWordUnfamiliar(event) {
    if (!canWriteStudyRecord()) {
      wx.showToast({ title: '家长模式仅试做', icon: 'none' });
      return;
    }
    const word = String(event.currentTarget.dataset.word || '');
    if (!word) {
      return;
    }
    const card = (this.data.wordCards || []).find((item) => item.word === word) || { word };
    addUnfamiliarCard(card, 'word');
    this.setData({ unfamiliarMap: getUnfamiliarMap() });
    wx.showToast({ title: '已加入复习', icon: 'none' });
  },
  togglePhraseUnfamiliar(event) {
    if (!canWriteStudyRecord()) {
      wx.showToast({ title: '家长模式仅试做', icon: 'none' });
      return;
    }
    const text = String(event.currentTarget.dataset.text || '');
    if (!text) {
      return;
    }
    const card = (this.data.phraseCards || []).find((item) => item.text === text) || { text };
    addUnfamiliarCard(card, 'phrase');
    this.setData({ unfamiliarMap: getUnfamiliarMap() });
    wx.showToast({ title: '已加入复习', icon: 'none' });
  },
  async lookupPassageWord(event) {
    const word = String(event.currentTarget.dataset.word || '').trim();
    if (!word || this.data.dictionaryLoading) return;
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    this.setData({
      dictionaryVisible: true,
      dictionaryLoading: true,
      dictionaryWord: word,
      dictionaryEntry: null
    });
    const localKey = `dictionary:${word.toLowerCase()}`;
    try {
      const cached = wx.getStorageSync(localKey);
      const cacheAge = Date.now() - Number(cached && cached._cachedAt || 0);
      if (cached && cached.wordLower && cacheAge < 30 * 60 * 1000) {
        this.setData({ dictionaryEntry: cached, dictionaryLoading: false });
        return;
      }
    } catch (error) {}
    try {
      const entry = await store.lookupWord(word);
      try {
        wx.setStorageSync(localKey, Object.assign({}, entry, { _cachedAt: Date.now() }));
      } catch (error) {}
      this.setData({ dictionaryEntry: entry, dictionaryLoading: false });
    } catch (error) {
      this.setData({ dictionaryLoading: false });
      wx.showToast({ title: '查词失败', icon: 'none' });
    }
  },
  closeDictionary() {
    this.setData({ dictionaryVisible: false, dictionaryLoading: false });
  },
  async addDictionaryWordToLibrary() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    if (!word || this.data.dictionaryAdding) return;
    this.setData({ dictionaryAdding: true });
    try {
      await store.addDictionaryWord(Object.assign({}, entry, { word }));
      wx.showToast({ title: '已加入词库', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '加入失败', icon: 'none' });
    } finally {
      this.setData({ dictionaryAdding: false });
    }
  },
  playDictionaryWord() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    const playUrl = (url) => {
      if (!this.readingAudioContext) {
        this.readingAudioContext = wx.createInnerAudioContext();
        this.readingAudioContext.obeyMuteSwitch = false;
      }
      this.readingAudioContext.stop();
      this.readingAudioContext.src = url;
      this.readingAudioContext.play();
    };
    if (entry.audioUrl) {
      playUrl(entry.audioUrl);
      return;
    }
    if (entry.audioFileId) {
      store.getTempFileURL(entry.audioFileId).then((url) => {
        if (url) {
          this.setData({ dictionaryEntry: Object.assign({}, entry, { audioUrl: url }) });
          playUrl(url);
          return;
        }
        this.speakWord({ currentTarget: { dataset: { word } } });
      }).catch(() => {
        this.speakWord({ currentTarget: { dataset: { word } } });
      });
      return;
    }
    this.speakWord({ currentTarget: { dataset: { word } } });
  },
  async speakWord(event) {
    const word = String(event.currentTarget.dataset.word || '');
    const card = (this.data.wordCards || []).find((item) => item.word === word) || {};
    const text = word || card.text || '';
    if (!text || this._readingAudioLoading) return;
    this.setData({
      speakingWord: text,
      audioStatusText: '准备发音'
    });
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    try {
      let url = card.audioUrl || (this._wordAudioUrls && this._wordAudioUrls[text]);
      if (!url) {
        this._readingAudioLoading = true;
        this.setData({ audioStatusText: '生成发音中' });
        const result = await store.synthesizeReadingAudio({ text });
        url = result && result.audioUrl ? result.audioUrl : '';
        if (!url) {
          const fileId = result && result.fileId ? result.fileId : '';
          if (!fileId) throw new Error('发音生成失败');
          try {
            url = await store.getTempFileURL(fileId);
          } catch (error) {
            throw new Error('发音链接失败');
          }
        }
        if (!url) throw new Error('发音链接为空');
        this._wordAudioUrls = Object.assign({}, this._wordAudioUrls || {}, { [text]: url });
      }
      if (!this.readingAudioContext) {
        this.readingAudioContext = wx.createInnerAudioContext();
        this.readingAudioContext.obeyMuteSwitch = false;
        this.readingAudioContext.onPlay(() => {
          this.setData({ audioStatusText: '播放中' });
        });
        this.readingAudioContext.onEnded(() => {
          this.setData({ speakingWord: '', audioStatusText: '' });
        });
        this.readingAudioContext.onError((error) => {
          this.setData({ audioStatusText: '播放失败' });
          wx.showToast({ title: '播放失败，稍后再试', icon: 'none' });
          console.warn('reading-word-audio-error', error);
        });
      }
      this.readingAudioContext.stop();
      this.readingAudioContext.src = url;
      this.setData({ audioStatusText: '播放中' });
      this.readingAudioContext.play();
    } catch (error) {
      this.setData({ audioStatusText: '发音失败' });
      wx.showToast({ title: '发音失败，稍后重试', icon: 'none' });
    } finally {
      this._readingAudioLoading = false;
    }
  },
  async submit() {
    if (this.data.submitting || !this.data.passage) {
      return;
    }
    const questions = this.data.passage.questions || [];
    const hasUnanswered = questions.some((question) => !String((this.data.answers || {})[String(question.number)] || '').trim());
    if (hasUnanswered) {
      wx.showToast({ title: '先完成题目', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    this.setData({ analysisErrorText: '' });
    try {
      const result = await store.submitReadingAttempt({
        passageId: this.data.passage._id,
        answers: this.data.answers
      });
      if (!result || result.syncMode === 'cloud-error' || !result.attempt || !result.review || !isQuestionStudyPack({
        questionAnalyses: result.review.analysis,
        source: result.review.studyPackSource || 'model'
      })) {
        throw new Error((result && result.cloudError && result.cloudError.message) || '解析生成失败');
      }
      this.setData({
        submitting: false,
        attempt: result.attempt || null,
        passage: normalizePassage(this.data.passage, this.data.answers, true, normalizeReview(result.review)),
        activeHighlight: 'answer',
        showReviewDetails: true,
        passageSegments: buildPassageSegments(this.data.passage ? this.data.passage.passage : '', normalizeReview(result.review), 'answer'),
        scoreText: buildScoreText(result.attempt),
        reviewSummary: buildReviewSummary(result.attempt),
        submitted: true,
        hasScore: !!result.attempt && result.attempt.score !== null && result.attempt.score !== undefined
      });
      this.applyReview(result.review);
      recordReadingCompleted(this.data.passage, result.attempt);
      if (result.studyWriteAllowed !== false) {
        addReviewFlashcards(result.review);
      }
      if (result.studyWriteAllowed !== false && this.data.passage && this.data.passage._id && result.review) {
        savePhoneStudyPack(this.data.passage._id, {
          questionAnalyses: result.review.analysis,
          source: result.review.studyPackSource || 'submit'
        });
      }
      wx.showToast({ title: result.studyWriteAllowed === false ? '试做完成' : '已提交', icon: 'success' });
      wx.nextTick(() => {
        wx.pageScrollTo({ selector: '.review-card', duration: 240 });
      });
    } catch (error) {
      this.setData({
        submitting: false,
        analysisErrorText: '解析生成失败，可重试。'
      });
      wx.showToast({ title: '解析失败，可重试', icon: 'none' });
    }
  },
  retrySubmit() {
    this.submit();
  }
});
