const store = require('../../../utils/store');
const page = require('../../../utils/page');

const STUDY_PACK_STORAGE_PREFIX = 'readingStudyPack:';
const FLASHCARD_WORDS_KEY = 'readingFlashcardWordsV1';
const FLASHCARD_ITEMS_KEY = 'readingFlashcardItemsV1';
const EBBINGHAUS_REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];

function buildOptionList(options) {
  return ['A', 'B', 'C', 'D'].filter((key) => options && options[key]).map((key) => ({
    key,
    text: options[key],
    selected: false
  }));
}

function hasOptions(question) {
  return !!(question && question.options && buildOptionList(question.options).length);
}

function normalizeAnswerText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePassage(passage, answers, submitted, review) {
  if (!passage) {
    return null;
  }
  const analysisByNumber = ((review && review.analysis) || []).reduce((map, item) => {
    if (item && item.number !== undefined && item.number !== null) {
      map[String(item.number)] = item;
    }
    return map;
  }, {});
  return Object.assign({}, passage, {
    questions: (passage.questions || []).map((question) => {
      const reviewAnalysis = analysisByNumber[String(question.number)] || null;
      const type = hasOptions(question) ? 'choice' : 'blank';
      const userAnswer = String(answers[String(question.number)] || '');
      const rawAnswer = String(question.answer || '').trim();
      const answer = type === 'choice' ? rawAnswer.toUpperCase() : rawAnswer;
      const selected = type === 'choice' ? userAnswer.trim().toUpperCase() : userAnswer;
      const isCorrect = submitted && answer ? (
        type === 'choice'
          ? selected === answer
          : normalizeAnswerText(selected) === normalizeAnswerText(answer)
      ) : null;
      return Object.assign({}, question, {
        type,
        selected,
        inputValue: type === 'blank' ? selected : '',
        answer,
        isCorrect,
        reviewAnalysis,
        optionsList: buildOptionList(question.options).map((option) => Object.assign({}, option, {
          selected: option.key === selected,
          correct: !!submitted && !!answer && option.key === answer,
          wrong: !!submitted && !!answer && option.key === selected && selected !== answer
        }))
      });
    })
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
    const needle = String((term && term.text) || term || '').trim().toLowerCase();
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
    pushTermRanges(source, termEntries([].concat(review.phraseCards || [], review.phrases || []), ['text', 'phrase']), 'phrase', false, ranges);
  }
  if (review && (activeMode === 'word' || activeMode === 'all')) {
    pushTermRanges(source, termEntries([].concat(review.vocabularyCards || [], review.vocabulary || []), ['word', 'text']), 'word', true, ranges);
  }
  ranges.sort((a, b) => a.start - b.start || a.rank - b.rank || (b.end - b.start) - (a.end - a.start));
  const selected = [];
  let coveredEnd = -1;
  ranges.forEach((range) => {
    if (range.start >= coveredEnd) {
      selected.push(range);
      coveredEnd = range.end;
    }
  });
  const segments = [];
  let cursor = 0;
  selected.forEach((range) => {
    if (range.start > cursor) {
      segments.push({ text: source.slice(cursor, range.start), tone: 'normal', start: cursor, end: range.start });
    }
    segments.push({
      text: source.slice(range.start, range.end),
      tone: range.tone,
      start: range.start,
      end: range.end,
      label: range.label || '',
      note: range.note || ''
    });
    cursor = range.end;
  });
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), tone: 'normal', start: cursor, end: source.length });
  }
  return segments.length ? segments : [{ text: source, tone: 'normal', start: 0, end: source.length }];
}

function pickSentenceAt(text, start, end) {
  const source = String(text || '');
  if (!source) return '';
  const from = Math.max(0, Math.min(Number(start || 0), source.length));
  const to = Math.max(from, Math.min(Number(end || from), source.length));
  const leftMarks = '.!?。！？\n';
  let left = from;
  while (left > 0 && !leftMarks.includes(source[left - 1])) left -= 1;
  let right = to;
  while (right < source.length && !leftMarks.includes(source[right])) right += 1;
  if (right < source.length) right += 1;
  return source.slice(left, right).replace(/\s+/g, ' ').trim();
}

function normalizeCardList(list, fallbackKey) {
  return (list || []).map((item) => {
    if (typeof item === 'string') {
      return { [fallbackKey]: item };
    }
    return item || {};
  }).filter((item) => item[fallbackKey] || item.word || item.text || item.pattern);
}

function normalizeReview(review) {
  if (!review) {
    return null;
  }
  const memoryChecks = review.memoryChecks || {};
  const vocabularyCards = normalizeCardList(review.vocabularyCards || review.vocabulary, 'word').map((card) => Object.assign({}, card, {
    flashcardKey: `word:${card.word || card.text || ''}`
  }));
  const phraseCards = normalizeCardList(review.phraseCards || review.phrases, 'text').map((card) => Object.assign({}, card, {
    flashcardKey: `phrase:${card.text || card.phrase || ''}`
  }));
  return Object.assign({}, review, {
    answerSentences: normalizeCardList(review.answerSentences || [], 'text'),
    phrases: review.phrases || [],
    vocabulary: review.vocabulary || [],
    sentencePatterns: review.sentencePatterns || [],
    vocabularyCards,
    phraseCards,
    sentencePatternCards: normalizeCardList(review.sentencePatternCards || review.sentencePatterns, 'pattern'),
    fullTranslation: review.fullTranslation || '',
    analysis: review.analysis || [],
    memoryChecks: {
      vocabulary: memoryChecks.vocabulary || [],
      phrases: memoryChecks.phrases || [],
      sentencePatterns: memoryChecks.sentencePatterns || []
    },
    memoryCheckTexts: {
      vocabulary: (memoryChecks.vocabulary || []).join(' / '),
      phrases: (memoryChecks.phrases || []).join(' / '),
      sentencePattern: (memoryChecks.sentencePatterns || [])[0] || ''
    }
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

function mergeStudyPackIntoReview(review, studyPack) {
  const base = normalizeReview(review || {});
  const pack = studyPack || {};
  return normalizeReview(Object.assign({}, base, {
    vocabularyCards: pack.vocabularyCards || base.vocabularyCards,
    phraseCards: pack.phraseCards || base.phraseCards,
    sentencePatternCards: pack.sentencePatternCards || base.sentencePatternCards,
    fullTranslation: pack.fullTranslation || base.fullTranslation,
    studyPackSource: pack.source || base.studyPackSource
  }));
}

function getPhoneStudyPack(passageId) {
  try {
    const cached = wx.getStorageSync(`${STUDY_PACK_STORAGE_PREFIX}${passageId}`) || null;
    if (!cached || !cached.studyPack || !cached.studyPack.source || String(cached.studyPack.source).indexOf('model:') !== 0) {
      return null;
    }
    return cached;
  } catch (error) {
    return null;
  }
}

function savePhoneStudyPack(passageId, studyPack) {
  if (!studyPack || !studyPack.source || String(studyPack.source).indexOf('model:') !== 0) {
    return;
  }
  try {
    wx.setStorageSync(`${STUDY_PACK_STORAGE_PREFIX}${passageId}`, {
      savedAt: Date.now(),
      studyPack
    });
  } catch (error) {}
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
      { key: 'patterns', label: '句型', tone: 'pattern' },
      { key: 'translation', label: '全文翻译', tone: 'translation' }
    ],
    activeHighlight: 'none',
    highlightButtons: [
      { key: 'answer', label: '答案句' },
      { key: 'word', label: '生词释义' },
      { key: 'phrase', label: '短语释义' },
      { key: 'all', label: '全部' }
    ],
    passageSegments: [],
    wordCards: [],
    phraseCards: [],
    sentencePatternCards: [],
    fullTranslation: '',
    unfamiliarMap: {},
    scoreText: '',
    submitted: false,
    showReviewDetails: false,
    hasScore: false
  }),
  async onLoad(options) {
    page.syncTheme(this);
    const passageId = options && options.passageId ? String(options.passageId) : '';
    this.setData({ passageId });
    await this.loadPassage(passageId);
  },
  async loadPassage(passageId) {
    const data = await store.getReadingPassage({ passageId }, (fresh) => this.applyPassage(fresh));
    this.applyPassage(data);
  },
  applyPassage(data) {
    const latestAttempt = data.latestAttempt || null;
    const answers = latestAttempt && latestAttempt.answers ? latestAttempt.answers : this.data.answers;
    const submitted = !!latestAttempt;
    const review = latestAttempt && latestAttempt.review ? normalizeReview(latestAttempt.review) : null;
    const passage = normalizePassage(data.passage, answers, submitted, review);
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      passage,
      answers,
      attempt: latestAttempt,
      review,
      passageSegments: buildPassageSegments(passage ? passage.passage : '', review, this.data.activeHighlight),
      wordCards: review ? review.vocabularyCards : [],
      phraseCards: review ? review.phraseCards : [],
      sentencePatternCards: review ? review.sentencePatternCards : [],
      fullTranslation: review ? review.fullTranslation : '',
      unfamiliarMap: getUnfamiliarMap(),
      scoreText: buildScoreText(latestAttempt),
      submitted,
      hasScore: !!latestAttempt && latestAttempt.score !== null && latestAttempt.score !== undefined
    }));
    if (submitted && data.passage && data.passage._id) {
      this.ensureStudyPack(data.passage._id);
    }
  },
  selectOption(event) {
    if (this.data.submitted) {
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
    if (this.data.submitted) {
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
  selectReviewTab(event) {
    this.setData({ activeReviewTab: String(event.currentTarget.dataset.tab || 'vocabulary') });
  },
  selectHighlight(event) {
    const mode = String(event.currentTarget.dataset.mode || 'none');
    const activeHighlight = this.data.activeHighlight === mode ? 'none' : mode;
    this.setData({
      activeHighlight,
      passageSegments: buildPassageSegments(this.data.passage ? this.data.passage.passage : '', this.data.review, activeHighlight)
    });
  },
  toggleWordUnfamiliar(event) {
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
    const text = String(event.currentTarget.dataset.text || '');
    if (!text) {
      return;
    }
    const card = (this.data.phraseCards || []).find((item) => item.text === text) || { text };
    addUnfamiliarCard(card, 'phrase');
    this.setData({ unfamiliarMap: getUnfamiliarMap() });
    wx.showToast({ title: '已加入复习', icon: 'none' });
  },
  speakWord(event) {
    const word = String(event.currentTarget.dataset.word || '');
    const card = (this.data.wordCards || []).find((item) => item.word === word) || {};
    if (!card.audioUrl) {
      wx.showToast({ title: '暂无发音音频', icon: 'none' });
      return;
    }
    const audio = wx.createInnerAudioContext();
    audio.src = card.audioUrl;
    audio.play();
  },
  async speakPassageSegment(event) {
    const sentence = pickSentenceAt(
      this.data.passage ? this.data.passage.passage : '',
      event.currentTarget.dataset.start,
      event.currentTarget.dataset.end
    );
    if (!sentence || this._readingAudioLoading) {
      return;
    }
    this._readingAudioLoading = true;
    try {
      const result = await store.synthesizeReadingAudio({ text: sentence });
      const url = result && result.fileId ? await store.getTempFileURL(result.fileId) : '';
      if (!url) {
        throw new Error('reading-audio-url-empty');
      }
      if (!this.readingAudioContext) {
        this.readingAudioContext = wx.createInnerAudioContext();
        this.readingAudioContext.obeyMuteSwitch = false;
      }
      this.readingAudioContext.stop();
      this.readingAudioContext.src = url;
      this.readingAudioContext.play();
    } catch (error) {
      wx.showToast({ title: error.message || '朗读失败', icon: 'none' });
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
    try {
      const result = await store.submitReadingAttempt({
        passageId: this.data.passage._id,
        answers: this.data.answers
      });
      this.setData({
        submitting: false,
        attempt: result.attempt || null,
        passage: normalizePassage(this.data.passage, this.data.answers, true, normalizeReview(result.review)),
        activeHighlight: 'answer',
        showReviewDetails: false,
        passageSegments: buildPassageSegments(this.data.passage ? this.data.passage.passage : '', normalizeReview(result.review), 'answer'),
        scoreText: buildScoreText(result.attempt),
        submitted: true,
        hasScore: !!result.attempt && result.attempt.score !== null && result.attempt.score !== undefined
      });
      this.applyReview(result.review);
      addReviewFlashcards(result.review);
      if (this.data.passage && this.data.passage._id && result.review) {
        savePhoneStudyPack(this.data.passage._id, {
          fullTranslation: result.review.fullTranslation,
          vocabularyCards: result.review.vocabularyCards,
          phraseCards: result.review.phraseCards,
          sentencePatternCards: result.review.sentencePatternCards,
          questionAnalyses: result.review.analysis,
          source: result.review.studyPackSource || 'submit'
        });
      }
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    }
  }
});
