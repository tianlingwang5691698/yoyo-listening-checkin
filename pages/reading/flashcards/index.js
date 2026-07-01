const page = require('../../../utils/page');
const store = require('../../../utils/store');
const appConfig = require('../../../data/app-config');

const TYPE_LABELS = {
  all: '全部',
  word: '生词',
  phrase: '短语',
  pattern: '句型'
};

const DEMO_FLASHCARDS = [
  {
    flashcardKey: 'demo:word:destination',
    sourceTitle: '演示词库',
    type: 'word',
    text: 'destination',
    word: 'destination',
    phonetic: '/ˌdestɪˈneɪʃn/',
    meaning: '目的地；终点',
    example: 'Shanghai is a popular destination for visitors.',
    exampleMeaning: '上海是游客喜爱的目的地。',
    demo: true
  },
  {
    flashcardKey: 'demo:phrase:look forward to',
    sourceTitle: '演示词库',
    type: 'phrase',
    text: 'look forward to',
    phrase: 'look forward to',
    meaning: '期待；盼望',
    example: 'I look forward to hearing from you soon.',
    exampleMeaning: '我期待尽快收到你的来信。',
    demo: true
  },
  {
    flashcardKey: 'demo:pattern:it is adj for sb to do sth',
    sourceTitle: '演示词库',
    type: 'pattern',
    text: 'It is adj. for sb. to do sth.',
    pattern: 'It is adj. for sb. to do sth.',
    meaning: '对某人来说，做某事是……的。',
    example: 'It is important for us to protect the environment.',
    exampleMeaning: '对我们来说，保护环境很重要。',
    demo: true
  }
];

const DEFAULT_DICTIONARY_BOOKS = [
  { level: 'junior', title: '新东方 初中英语词汇词根+联想记忆法：乱序版', imported: 0, cloudPath: 'dictionary_books/word-dictionary-junior.json' },
  { level: 'senior', title: '高中英语词汇 乱序', imported: 0, cloudPath: 'dictionary_books/word-dictionary-senior.json' }
];
const FLASHCARD_SOURCE_CACHE_PREFIX = 'flashcardSourceCache:';
const FLASHCARD_SOURCE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const FLASHCARD_PLAN_SETTINGS_PREFIX = 'flashcardPlanSettings:';
const FLASHCARD_CHECKIN_DAYS_KEY = 'flashcardCheckinDays';
const FLASHCARD_AUDIO_CACHE_PREFIX = 'flashcard-audio-';

const LIMIT_MIN = 5;
const LIMIT_DEFAULT_MAX = 500;
const LIMIT_STEP = 5;
const REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];

function buildLimitOptions(maxValue) {
  const max = Math.max(LIMIT_MIN, Number(maxValue || LIMIT_DEFAULT_MAX));
  const roundedMax = Math.ceil(max / LIMIT_STEP) * LIMIT_STEP;
  return Array.from({ length: roundedMax / LIMIT_STEP }, (_, index) => Math.min((index + 1) * LIMIT_STEP, max));
}

function normalizeLimit(value, maxValue) {
  const numericValue = Number(value || 0);
  const max = Math.max(LIMIT_MIN, Number(maxValue || LIMIT_DEFAULT_MAX));
  if (numericValue >= max) return max;
  const steppedValue = Math.round(numericValue / LIMIT_STEP) * LIMIT_STEP;
  return Math.max(LIMIT_MIN, Math.min(max, steppedValue || LIMIT_MIN));
}

function getLimitIndex(value, maxValue) {
  const options = buildLimitOptions(maxValue);
  return Math.max(0, options.indexOf(normalizeLimit(value, maxValue)));
}

function getLimitItemHeightPx() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo.windowWidth * 84 / 750;
  } catch (error) {
    return 42;
  }
}

function getNavLayout() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = Number(systemInfo.statusBarHeight || 0);
    const navBarHeight = menu && menu.height
      ? (menu.top - statusBarHeight) * 2 + menu.height
      : 44;
    const navHeight = statusBarHeight + navBarHeight;
    return {
      navStyle: `height:${navHeight}px;padding-top:${statusBarHeight}px;`,
      pageTopStyle: `padding-top:${navHeight + 16}px;`
    };
  } catch (error) {
    return {
      navStyle: 'height:88px;padding-top:44px;',
      pageTopStyle: 'padding-top:112px;'
    };
  }
}

function normalizeCard(item, index) {
  const type = item.type || (item.pattern ? 'pattern' : (item.phrase ? 'phrase' : 'word'));
  const displayText = item.text || item.word || item.phrase || item.pattern || '';
  return Object.assign({}, item, {
    type,
    displayText,
    canSpeak: (type === 'word' || type === 'phrase') && canUseDictionaryVoice(item.word || item.phrase || displayText),
    typeLabel: TYPE_LABELS[type] || '生词',
    index: index + 1
  });
}

function countByType(cards) {
  return cards.reduce((stats, item) => {
    stats.all += 1;
    stats[item.type] = (stats[item.type] || 0) + 1;
    return stats;
  }, { all: 0, word: 0, phrase: 0, pattern: 0 });
}

function countLogDays(logs) {
  return Object.keys((logs || []).reduce((days, item) => {
    if (item && item.date) {
      days[item.date] = true;
    }
    return days;
  }, {})).length;
}

function readVocabularyCheckinDays() {
  try {
    return wx.getStorageSync(FLASHCARD_CHECKIN_DAYS_KEY) || {};
  } catch (error) {
    return {};
  }
}

function writeVocabularyCheckinDay(today) {
  if (!today) return readVocabularyCheckinDays();
  const days = Object.assign({}, readVocabularyCheckinDays(), { [today]: true });
  try {
    wx.setStorageSync(FLASHCARD_CHECKIN_DAYS_KEY, days);
  } catch (error) {}
  return days;
}

function countVocabularyCheckinDays(logs) {
  return Object.keys(Object.assign({}, readVocabularyCheckinDays(), (logs || []).reduce((days, item) => {
    if (item && item.date) {
      days[item.date] = true;
    }
    return days;
  }, {}))).length;
}

function groupLibrary(library) {
  return ['word', 'phrase', 'pattern'].map((type) => {
    const items = library.filter((item) => item.type === type);
    return {
      type,
      label: TYPE_LABELS[type],
      count: items.length,
      items
    };
  }).filter((group) => group.count > 0);
}

function getBookSourceId(level) {
  return level ? `dictionary-book-${level}` : '';
}

function filterBySource(items, sourceId) {
  if (!sourceId) return items;
  return (items || []).filter((item) => item.sourceId === sourceId);
}

function isCardDue(item, today) {
  return item && item.status !== 'mastered' && (!item.nextReviewDate || item.nextReviewDate <= today);
}

function buildDueCards(library, settings, today) {
  const due = (library || []).filter((item) => isCardDue(item, today));
  return due
    .filter((item) => item.status !== 'new')
    .slice(0, settings.reviewLimit)
    .concat(due.filter((item) => item.status === 'new').slice(0, settings.newLimit));
}

function isBookSource(sourceId) {
  return String(sourceId || '').indexOf('dictionary-book-') === 0;
}

function getEffectiveSettings(settings, library, sourceId) {
  const total = Math.max(LIMIT_MIN, (library || []).length || LIMIT_DEFAULT_MAX);
  return {
    newLimit: normalizeLimit(settings && settings.newLimit, total),
    reviewLimit: normalizeLimit(settings && settings.reviewLimit, total)
  };
}

function buildPlanState(library, settings, today) {
  const cards = buildDueCards(library, settings, today);
  return {
    cards,
    currentIndex: 0,
    current: cards[0] || null,
    total: cards.length,
    dueCount: cards.length,
    newDueCount: cards.filter((item) => item.status === 'new').length,
    reviewDueCount: cards.filter((item) => item.status !== 'new').length
  };
}

function buildPlanSummary(library, settings) {
  const total = (library || []).length;
  const mastered = (library || []).filter((item) => item.status === 'mastered').length;
  const reviewing = (library || []).filter((item) => item.status === 'reviewing').length;
  const fresh = (library || []).filter((item) => item.status === 'new').length;
  return {
    total,
    learned: mastered + reviewing,
    learnedPercent: total ? Math.round((mastered + reviewing) * 100 / total) : 0,
    boatPercent: total ? Math.max(4, Math.min(96, Math.round((mastered + reviewing) * 100 / total))) : 4,
    mastered,
    reviewing,
    fresh,
    todayPlan: Number((settings && settings.newLimit) || 0) + Number((settings && settings.reviewLimit) || 0)
  };
}

function addDaysString(today, days) {
  const parts = String(today || '').split('-').map((item) => Number(item));
  if (parts.length !== 3 || parts.some((item) => !item)) return '';
  const date = new Date(parts[0], parts[1] - 1, parts[2] + Number(days || 0));
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function applyReviewState(card, result, today) {
  const base = Object.assign({}, card, {
    lastReviewedAt: Date.now(),
    lastReviewDate: today || ''
  });
  if (result === 'easy') {
    return Object.assign(base, {
      status: 'mastered',
      nextReviewDate: '',
      reviewStep: 99
    });
  }
  if (result === 'unfamiliar') {
    return Object.assign(base, {
      status: 'reviewing',
      nextReviewDate: today || '',
      reviewStep: 0
    });
  }
  const nextStep = Math.max(1, Number(card.reviewStep || 0) + 1);
  if (nextStep >= REVIEW_DAYS.length) {
    return Object.assign(base, {
      status: 'mastered',
      nextReviewDate: '',
      reviewStep: nextStep
    });
  }
  return Object.assign(base, {
    status: 'reviewing',
    nextReviewDate: addDaysString(today, REVIEW_DAYS[nextStep]),
    reviewStep: nextStep
  });
}

function replaceCard(list, card) {
  return (list || []).map((item) => (
    item.flashcardKey === card.flashcardKey ? Object.assign({}, item, card) : item
  ));
}

function isAudioCompletedForCard(card) {
  return !(card && card.canSpeak);
}

function buildReviewQueue(library, settings, today) {
  return buildDueCards(library || [], settings || {}, today || '');
}

function mergeCachedCardState(library, cachedLibrary) {
  const cachedMap = (cachedLibrary || []).reduce((map, item) => {
    if (item && item.flashcardKey) map[item.flashcardKey] = item;
    return map;
  }, {});
  return (library || []).map((item) => {
    const cached = cachedMap[item.flashcardKey];
    if (!cached) return item;
    const cachedHasProgress = cached.status && cached.status !== 'new';
    const itemHasProgress = item.status && item.status !== 'new';
    const useCachedProgress = cachedHasProgress || !itemHasProgress;
    return Object.assign({}, item, {
      status: useCachedProgress ? (cached.status || item.status) : item.status,
      nextReviewDate: useCachedProgress ? (cached.nextReviewDate || '') : (item.nextReviewDate || ''),
      reviewStep: useCachedProgress && cached.reviewStep != null ? cached.reviewStep : item.reviewStep,
      lastReviewedAt: useCachedProgress ? (cached.lastReviewedAt || item.lastReviewedAt) : item.lastReviewedAt,
      lastReviewDate: useCachedProgress ? (cached.lastReviewDate || item.lastReviewDate) : item.lastReviewDate,
      audioUrl: cached.audioUrl || item.audioUrl || '',
      audioFileId: cached.audioFileId || item.audioFileId || '',
      audioCloudPath: cached.audioCloudPath || item.audioCloudPath || '',
      audioLocalPath: cached.audioLocalPath || item.audioLocalPath || ''
    });
  });
}

function mergeBookProgress(bookLibrary, progressLibrary) {
  const progressMap = (progressLibrary || []).reduce((map, item) => {
    if (item && item.flashcardKey) map[item.flashcardKey] = item;
    return map;
  }, {});
  return (bookLibrary || []).map((item) => {
    const progress = progressMap[item.flashcardKey];
    if (!progress) return item;
    return Object.assign({}, item, {
      status: progress.status || item.status,
      nextReviewDate: progress.nextReviewDate || '',
      reviewStep: progress.reviewStep != null ? progress.reviewStep : item.reviewStep,
      familiarLevel: progress.familiarLevel || item.familiarLevel || '',
      unfamiliarCount: progress.unfamiliarCount || 0,
      lastReviewedAt: progress.lastReviewedAt || item.lastReviewedAt,
      lastReviewDate: progress.lastReviewDate || item.lastReviewDate,
      audioUrl: progress.audioUrl || item.audioUrl || '',
      audioFileId: progress.audioFileId || item.audioFileId || '',
      audioCloudPath: progress.audioCloudPath || item.audioCloudPath || '',
      audioLocalPath: item.audioLocalPath || progress.audioLocalPath || ''
    });
  });
}

function getLocalAudioPath(flashcardKey) {
  if (!flashcardKey || !wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) return '';
  return `${wx.env.USER_DATA_PATH}/${FLASHCARD_AUDIO_CACHE_PREFIX}${encodeURIComponent(flashcardKey)}.mp3`;
}

function localFileExists(filePath) {
  if (!filePath || !wx.getFileSystemManager) return false;
  try {
    wx.getFileSystemManager().accessSync(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function downloadAudioToLocal(url, flashcardKey) {
  const filePath = getLocalAudioPath(flashcardKey);
  if (!url || !filePath || localFileExists(filePath)) {
    return Promise.resolve(filePath);
  }
  return new Promise((resolve) => {
    wx.downloadFile({
      url,
      filePath,
      success(result) {
        resolve(result && result.statusCode >= 200 && result.statusCode < 300 ? filePath : '');
      },
      fail() {
        resolve('');
      }
    });
  });
}

function getPlanSettingsKey(sourceId) {
  return `${FLASHCARD_PLAN_SETTINGS_PREFIX}${sourceId || 'all'}`;
}

function readPlanSettings(sourceId, fallback) {
  try {
    return Object.assign({}, fallback || {}, wx.getStorageSync(getPlanSettingsKey(sourceId)) || {});
  } catch (error) {
    return fallback || {};
  }
}

function writePlanSettings(sourceId, settings) {
  try {
    wx.setStorageSync(getPlanSettingsKey(sourceId), settings || {});
  } catch (error) {}
}

function normalizeBook(book) {
  const fallback = DEFAULT_DICTIONARY_BOOKS.find((item) => item.level === book.level) || {};
  return Object.assign({}, fallback, book, {
    sourceId: getBookSourceId(book.level)
  });
}

async function loadBookCardsFromStorage(book) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const cloudPath = String(book.cloudPath || '').replace(/^\/+/, '');
  if (!baseUrl || !cloudPath) throw new Error('dictionary-book-url-empty');
  const rows = await requestJson(`${baseUrl}/${encodeURI(cloudPath)}`);
  if (!Array.isArray(rows)) throw new Error('dictionary-book-json-invalid');
  return rows.map((entry, index) => buildBookCard(entry, book, index)).filter((item) => item.word);
}

function getSourceCacheKey(sourceId) {
  return `${FLASHCARD_SOURCE_CACHE_PREFIX}${sourceId || 'all'}`;
}

function getSourceCacheFilePath(sourceId) {
  if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) return '';
  return `${wx.env.USER_DATA_PATH}/flashcard-source-${encodeURIComponent(sourceId || 'all')}.json`;
}

function readSourceCache(sourceId) {
  const filePath = getSourceCacheFilePath(sourceId);
  if (filePath) {
    try {
      const cached = JSON.parse(wx.getFileSystemManager().readFileSync(filePath, 'utf8'));
      if (cached && Date.now() - Number(cached.cachedAt || 0) <= FLASHCARD_SOURCE_CACHE_TTL) {
        return cached.data || null;
      }
    } catch (error) {}
  }
  try {
    const cached = wx.getStorageSync(getSourceCacheKey(sourceId));
    if (!cached || Date.now() - Number(cached.cachedAt || 0) > FLASHCARD_SOURCE_CACHE_TTL) return null;
    return cached.data || null;
  } catch (error) {
    return null;
  }
}

function writeSourceCache(sourceId, data) {
  const filePath = getSourceCacheFilePath(sourceId);
  if (filePath) {
    try {
      wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify({
        cachedAt: Date.now(),
        data
      }), 'utf8');
      return;
    } catch (error) {}
  }
  try {
    wx.setStorageSync(getSourceCacheKey(sourceId), {
      cachedAt: Date.now(),
      data
    });
  } catch (error) {}
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
          return;
        }
        reject(new Error(`http-${response.statusCode || 0}`));
      },
      fail: reject
    });
  });
}

function buildBookCard(entry, book, index) {
  const word = String(entry.word || entry.wordLower || '').trim().toLowerCase();
  return normalizeCard({
    flashcardKey: `dictionaryBook:${book.level}:word:${word}`,
    sourceType: `dictionaryBook:${book.level}`,
    sourceId: getBookSourceId(book.level),
    sourceTitle: book.title,
    type: 'word',
    text: word,
    word,
    phonetic: entry.phonetic || '',
    meaning: Array.isArray(entry.definitions) ? entry.definitions.join('；') : '',
    example: entry.example || '',
    status: 'new',
    nextReviewDate: '',
    localBook: true
  }, index);
}

function canUseDictionaryVoice(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 60 || /[.!?;:]/.test(value)) return false;
  const words = value.split(' ').filter(Boolean);
  return words.length >= 1
    && words.length <= 6
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

function buildDictionaryVoiceUrl(text) {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

Page({
  data: page.createCloudPageData({
    sourceMode: 'bookshelf',
    mode: 'library',
    library: [],
    libraryGroups: [],
    cards: [],
    current: null,
    currentIndex: 0,
    total: 0,
    empty: false,
    stats: { all: 0, word: 0, phrase: 0, pattern: 0 },
    progress: { total: 0, mastered: 0, reviewing: 0, fresh: 0 },
    planSummary: { total: 0, learned: 0, learnedPercent: 0, boatPercent: 4, mastered: 0, reviewing: 0, fresh: 0, todayPlan: 0 },
    logs: [],
    dictionaryBooks: DEFAULT_DICTIONARY_BOOKS,
    importingBook: '',
    activeSourceId: '',
    activeSourceTitle: '我的词库',
    isBookPlan: false,
    isUnlimitedPlan: false,
    dueCount: 0,
    newDueCount: 0,
    reviewDueCount: 0,
    settings: { newLimit: 10, reviewLimit: 20 },
    limitOptions: buildLimitOptions(LIMIT_DEFAULT_MAX),
    planLimitMax: LIMIT_DEFAULT_MAX,
    newLimitIndex: getLimitIndex(10, LIMIT_DEFAULT_MAX),
    reviewLimitIndex: getLimitIndex(20, LIMIT_DEFAULT_MAX),
    limitPickerVisible: false,
    planSettingsVisible: false,
    libraryVisible: false,
    limitPickerTitle: '',
    limitPickerField: '',
    selectedLimitIndex: 0,
    limitScrollTop: 0,
    reviewDone: 0,
    reviewSessionTotal: 0,
    cardRevealed: false,
    cardChoice: '',
    previousCardChoice: '',
    reviewDays: 0,
    vocabCheckinDays: 0,
    loading: false,
    audioLoading: false,
    audioPlaying: false,
    audioCompleted: true,
    navStyle: '',
    pageTopStyle: ''
  }),
  onUnload() {
    this.flushReviewQueue(true);
    this.syncVocabularyCompletion(true);
    if (this.autoSpeakTimer) {
      clearTimeout(this.autoSpeakTimer);
      this.autoSpeakTimer = null;
    }
    if (this.flashcardAudioContext) {
      this.flashcardAudioContext.destroy();
      this.flashcardAudioContext = null;
    }
  },
  onShow() {
    this.flashcardPerf = page.startPagePerf('flashcards');
    page.syncTheme(this);
    this.setData(getNavLayout());
    if (this.data.mode === 'review') return;
    this.loadCards();
  },
  getFlashcardLibrary() {
    return this.flashcardLibrary || [];
  },
  setFlashcardLibrary(library) {
    this.flashcardLibrary = library || [];
  },
  getRenderedLibraryGroups(library) {
    return this.data.libraryVisible ? groupLibrary(library || this.getFlashcardLibrary()) : [];
  },
  applyFlashcardData(data) {
    const library = data.library || [];
    this.setFlashcardLibrary(library);
    this.setData(Object.assign({}, data, {
      library: [],
      libraryGroups: this.getRenderedLibraryGroups(library)
    }));
  },
  buildFlashcardData(data, activeSourceId, cached) {
    const rawLibrary = data.partial ? (data.library || []) : (data.library && data.library.length ? data.library : DEMO_FLASHCARDS);
    let library = filterBySource(rawLibrary, activeSourceId).map(normalizeCard);
    let demoMode = rawLibrary === DEMO_FLASHCARDS;
    const settings = {
      newLimit: normalizeLimit((data.settings || {}).newLimit == null ? 10 : data.settings.newLimit),
      reviewLimit: normalizeLimit((data.settings || {}).reviewLimit == null ? 20 : data.settings.reviewLimit)
    };
    if (isBookSource(activeSourceId) && cached && cached.library && cached.library.length) {
      library = mergeBookProgress(cached.library.map(normalizeCard), library).map(normalizeCard);
      demoMode = false;
    } else if (activeSourceId && !library.length && cached && cached.library && cached.library.length) {
      library = cached.library.map(normalizeCard);
    } else if (activeSourceId && cached && cached.library && cached.library.length) {
      library = mergeCachedCardState(library, cached.library).map(normalizeCard);
    }
    const sourceSettings = readPlanSettings(activeSourceId, settings);
    const effectiveSettings = getEffectiveSettings(sourceSettings, library, activeSourceId);
    const limitOptions = buildLimitOptions(library.length || LIMIT_DEFAULT_MAX);
    const cards = (activeSourceId
      ? buildDueCards(library, effectiveSettings, data.today)
      : ((data.cards && data.cards.length ? data.cards : rawLibrary).map(normalizeCard)));
    const planSummary = buildPlanSummary(library, effectiveSettings);
    return {
      library,
      libraryGroups: [],
      cards,
      currentIndex: 0,
      current: cards[0] || null,
      total: cards.length,
      empty: !library.length,
      stats: countByType(library),
      dueCount: cards.length,
      newDueCount: cards.filter((item) => item.status === 'new').length,
      reviewDueCount: cards.filter((item) => item.status !== 'new').length,
      settings: effectiveSettings,
      limitOptions,
      planLimitMax: Math.max(LIMIT_MIN, library.length || LIMIT_DEFAULT_MAX),
      newLimitIndex: getLimitIndex(effectiveSettings.newLimit, library.length),
      reviewLimitIndex: getLimitIndex(effectiveSettings.reviewLimit, library.length),
      today: data.today,
      isBookPlan: isBookSource(activeSourceId),
      isUnlimitedPlan: false,
      planSummary,
      progress: demoMode
        ? { total: library.length, mastered: 0, reviewing: 0, fresh: library.length }
        : {
          total: library.length,
          mastered: library.filter((item) => item.status === 'mastered').length,
          reviewing: library.filter((item) => item.status === 'reviewing').length,
          fresh: library.filter((item) => item.status === 'new').length
        },
      reviewDays: countVocabularyCheckinDays(data.logs || []),
      vocabCheckinDays: countVocabularyCheckinDays(data.logs || []),
      logs: data.logs || [],
      dictionaryBooks: (data.dictionaryBooks && data.dictionaryBooks.length ? data.dictionaryBooks : DEFAULT_DICTIONARY_BOOKS).map(normalizeBook),
      demoMode,
      loading: false
    };
  },
  async loadCards() {
    const keepReviewSession = this.data.mode === 'review';
    this.setData({ loading: true });
    const activeSourceId = this.data.activeSourceId || '';
    const cached = readSourceCache(activeSourceId);
    if (cached && !keepReviewSession) {
      this.applyFlashcardData(Object.assign({}, cached, { loading: false }));
      if (this.flashcardPerf) {
        this.flashcardPerf.ready('pageReady', {
          cacheHit: true,
          sourceId: activeSourceId || 'all',
          total: (cached.library || []).length
        });
      }
      store.getFlashcardReview((fresh) => {
        if (this.data.mode !== 'review' && (this.data.activeSourceId || '') === activeSourceId) {
          const freshData = this.buildFlashcardData(fresh, activeSourceId, cached);
          this.applyFlashcardData(freshData);
          writeSourceCache(activeSourceId, freshData);
          if (this.flashcardPerf) {
            this.flashcardPerf.mark('cloudRefresh', {
              sourceId: activeSourceId || 'all',
              total: freshData.library.length
            });
          }
        }
      }).then((fresh) => {
        if (fresh && !fresh.__cacheHit && fresh.syncMode !== 'cloud-error' && this.data.mode !== 'review' && (this.data.activeSourceId || '') === activeSourceId) {
          const freshData = this.buildFlashcardData(fresh, activeSourceId, cached);
          this.applyFlashcardData(freshData);
          writeSourceCache(activeSourceId, freshData);
        }
      });
      return;
    }
    const data = activeSourceId ? await store.getFlashcardReview() : await store.getFlashcardDue();
    const nextData = this.buildFlashcardData(data, activeSourceId, cached);
    if (keepReviewSession) {
      this.setData({
        reviewDays: nextData.reviewDays,
        vocabCheckinDays: nextData.vocabCheckinDays,
        logs: nextData.logs,
        dictionaryBooks: nextData.dictionaryBooks,
        loading: false
      });
      writeSourceCache(activeSourceId, nextData);
      return;
    }
    this.applyFlashcardData(nextData);
    writeSourceCache(activeSourceId, nextData);
    if (!activeSourceId && data && data.partial) {
      store.getFlashcardReview().then((fresh) => {
        if (fresh && fresh.syncMode !== 'cloud-error' && this.data.mode !== 'review' && !(this.data.activeSourceId || '')) {
          const freshData = this.buildFlashcardData(fresh, activeSourceId, nextData);
          this.applyFlashcardData(freshData);
          writeSourceCache(activeSourceId, freshData);
        }
      }).catch(() => {});
    }
    if (this.flashcardPerf) {
      this.flashcardPerf.ready('pageReady', {
        cacheHit: !!data.__cacheHit,
        sourceId: activeSourceId || 'all',
        total: nextData.library.length
      });
    }
  },
  async importDictionaryBook(event) {
    const level = event.currentTarget.dataset.level || '';
    if (!level || this.data.importingBook) return;
    const sourceId = getBookSourceId(level);
    const book = normalizeBook((this.data.dictionaryBooks || []).find((item) => item.level === level) || { level });
    this.setData({
      sourceMode: 'library',
      mode: 'library',
      activeSourceId: sourceId,
      activeSourceTitle: book.title || '词汇书',
      importingBook: book.imported ? '' : level
    });
    const cached = readSourceCache(sourceId);
    if (cached) {
      await this.loadCards();
    } else {
      this.setFlashcardLibrary([]);
      this.setData({
        loading: true,
        library: [],
        libraryGroups: [],
        empty: false,
        stats: { all: 0, word: 0, phrase: 0, pattern: 0 }
      });
    }
    let ready = !!cached;
    if (!cached) {
      try {
        const localCards = await loadBookCardsFromStorage(book);
        const sourceSettings = readPlanSettings(sourceId, this.data.settings);
        const effectiveSettings = getEffectiveSettings(sourceSettings, localCards, sourceId);
        const limitOptions = buildLimitOptions(localCards.length);
        const cards = buildDueCards(localCards, effectiveSettings, this.data.today);
        const planSummary = buildPlanSummary(localCards, effectiveSettings);
        const nextData = {
          library: localCards,
          libraryGroups: groupLibrary(localCards),
          cards,
          currentIndex: 0,
          current: cards[0] || null,
          total: cards.length,
          empty: !localCards.length,
          stats: countByType(localCards),
          dueCount: cards.length,
          newDueCount: cards.filter((item) => item.status === 'new').length,
          reviewDueCount: cards.filter((item) => item.status !== 'new').length,
          settings: effectiveSettings,
          limitOptions,
          planLimitMax: Math.max(LIMIT_MIN, localCards.length || LIMIT_DEFAULT_MAX),
          newLimitIndex: getLimitIndex(effectiveSettings.newLimit, localCards.length),
          reviewLimitIndex: getLimitIndex(effectiveSettings.reviewLimit, localCards.length),
          today: this.data.today,
          isBookPlan: true,
          isUnlimitedPlan: false,
          planSummary,
          progress: {
            total: localCards.length,
            mastered: 0,
            reviewing: 0,
            fresh: localCards.length
          },
          demoMode: false,
          loading: false
        };
        this.applyFlashcardData(nextData);
        writeSourceCache(sourceId, nextData);
        ready = true;
        store.getFlashcardReview().then((fresh) => {
          if (this.data.mode !== 'review' && (this.data.activeSourceId || '') === sourceId) {
            const freshData = this.buildFlashcardData(fresh, sourceId, { library: localCards });
            this.applyFlashcardData(freshData);
            writeSourceCache(sourceId, freshData);
          }
        }).catch(() => {});
      } catch (error) {
        wx.showToast({ title: '词书读取失败', icon: 'none' });
      }
    }
    this.setData({ importingBook: '' });
    if (ready) {
      wx.showToast({ title: '计划已建立', icon: 'none' });
    }
  },
  useAllVocabulary() {
    this.setData({
      sourceMode: 'library',
      mode: 'library',
      activeSourceId: '',
      activeSourceTitle: '我的词库'
    });
    this.loadCards();
  },
  backToBookshelf() {
    this.setData({
      sourceMode: 'bookshelf',
      mode: 'library',
      planSettingsVisible: false,
      libraryVisible: false,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: ''
    });
  },
  handlePageBack() {
    if (this.data.mode === 'review') {
      this.exitReview();
      return;
    }
    if (this.data.sourceMode !== 'bookshelf') {
      this.backToBookshelf();
      return;
    }
    wx.navigateBack({ delta: 1 });
  },
  switchMode(event) {
    const mode = event.currentTarget.dataset.mode || 'library';
    if (mode === 'review') {
      this.startReview();
      return;
    }
    this.setData({ mode });
  },
  noop() {},
  async changeLimit(event) {
    const field = event.currentTarget.dataset.field;
    const isLongPress = event.type === 'longpress';
    const delta = Number((isLongPress ? event.currentTarget.dataset.longDelta : event.currentTarget.dataset.delta) || 0);
    const currentValue = Number(this.data.settings[field] || 0);
    const library = this.getFlashcardLibrary();
    const nextValue = normalizeLimit(currentValue + delta, library.length);
    if (nextValue === currentValue) return;
    await this.saveLimit(field, nextValue);
  },
  openLimitPicker(event) {
    const field = event.currentTarget.dataset.field;
    const selectedLimitIndex = getLimitIndex(this.data.settings[field], this.getFlashcardLibrary().length);
    this.setData({
      limitPickerVisible: true,
      limitPickerField: field,
      limitPickerTitle: field === 'newLimit' ? '今日新学' : '今日复习',
      selectedLimitIndex,
      limitScrollTop: selectedLimitIndex * getLimitItemHeightPx()
    });
  },
  closeLimitPicker() {
    this.setData({ limitPickerVisible: false });
  },
  togglePlanSettings() {
    this.setData({ planSettingsVisible: !this.data.planSettingsVisible });
  },
  toggleLibraryVisible() {
    const libraryVisible = !this.data.libraryVisible;
    this.setData({
      libraryVisible,
      libraryGroups: libraryVisible ? groupLibrary(this.getFlashcardLibrary()) : []
    });
  },
  scrollLimit(event) {
    const index = Math.max(0, Math.min((this.data.limitOptions || []).length - 1, Math.round(Number(event.detail.scrollTop || 0) / getLimitItemHeightPx())));
    if (index !== this.data.selectedLimitIndex) {
      this.setData({ selectedLimitIndex: index });
    }
  },
  tapLimitOption(event) {
    const selectedLimitIndex = Number(event.currentTarget.dataset.index || 0);
    this.setData({
      selectedLimitIndex,
      limitScrollTop: selectedLimitIndex * getLimitItemHeightPx()
    });
  },
  async confirmLimit() {
    const field = this.data.limitPickerField;
    const nextValue = this.data.limitOptions[this.data.selectedLimitIndex] || LIMIT_MIN;
    this.setData({ limitPickerVisible: false });
    if (!field || nextValue === Number(this.data.settings[field] || 0)) return;
    await this.saveLimit(field, nextValue);
  },
  async saveLimit(field, nextValue) {
    const library = this.getFlashcardLibrary();
    const settings = Object.assign({}, this.data.settings, {
      [field]: normalizeLimit(nextValue, library.length)
    });
    const planState = buildPlanState(library, settings, this.data.today);
    const nextData = Object.assign({
      settings,
      newLimitIndex: getLimitIndex(settings.newLimit, library.length),
      reviewLimitIndex: getLimitIndex(settings.reviewLimit, library.length),
      planSummary: buildPlanSummary(library, settings)
    }, planState);
    this.setData(nextData);
    writePlanSettings(this.data.activeSourceId || '', settings);
    if (!this.data.activeSourceId) {
      await store.saveFlashcardSettings(settings);
    }
  },
  playAudioUrl(url, options) {
    if (!url) return;
    if (!this.flashcardAudioContext) {
      this.flashcardAudioContext = wx.createInnerAudioContext();
      this.flashcardAudioContext.obeyMuteSwitch = false;
      this.flashcardAudioContext.onEnded(() => {
        this.setData({ audioPlaying: false, audioCompleted: true });
      });
      this.flashcardAudioContext.onError(() => {
        this.setData({ audioPlaying: false, audioCompleted: true });
        if (Date.now() < Number(this.silentAudioErrorUntil || 0)) {
          return;
        }
        wx.showToast({ title: '播放失败，稍后再试', icon: 'none' });
      });
    }
    if (options && options.silent) {
      this.silentAudioErrorUntil = Date.now() + 3000;
    }
    this.flashcardAudioContext.stop();
    this.flashcardAudioContext.src = url;
    this.setData({ audioPlaying: true, audioCompleted: false });
    this.flashcardAudioContext.play();
  },
  scheduleAutoSpeakCurrent() {
    if (this.autoSpeakTimer) {
      clearTimeout(this.autoSpeakTimer);
      this.autoSpeakTimer = null;
    }
    const current = this.data.current || {};
    if (!current.canSpeak) return;
    const key = current.flashcardKey || current.displayText || '';
    this.autoSpeakTimer = setTimeout(() => {
      this.autoSpeakTimer = null;
      const latest = this.data.current || {};
      const latestKey = latest.flashcardKey || latest.displayText || '';
      if (latestKey === key) {
        this.speakCurrent({ auto: true });
      }
    }, 160);
  },
  async speakCurrent(options) {
    const silent = !!(options && options.auto);
    const current = this.data.current || {};
    if (!current.canSpeak) return;
    const text = current.word || current.phrase || current.displayText || '';
    if (!text) {
      this.setData({ audioCompleted: true });
      if (!silent) {
        wx.showToast({ title: '暂无发音内容', icon: 'none' });
      }
      return;
    }
    const localAudioPath = current.audioLocalPath || getLocalAudioPath(current.flashcardKey);
    if (localFileExists(localAudioPath)) {
      this.playAudioUrl(localAudioPath, { silent });
      return;
    }
    if (current.audioUrl) {
      this.playAudioUrl(current.audioUrl, { silent });
      downloadAudioToLocal(current.audioUrl, current.flashcardKey).then((path) => {
        if (path) this.updateCardAudioCache(current.flashcardKey, { audioLocalPath: path });
      });
      return;
    }
    if (current.audioFileId) {
      try {
        const url = await store.getTempFileURL(current.audioFileId);
        if (url) {
          this.playAudioUrl(url, { silent });
          downloadAudioToLocal(url, current.flashcardKey).then((path) => {
            if (path) this.updateCardAudioCache(current.flashcardKey, { audioLocalPath: path });
          });
          return;
        }
      } catch (error) {
        // Fall through to regenerate audio.
      }
    }
    if (this._flashcardAudioLoading) return;
    this._flashcardAudioLoading = true;
    this.setData({ audioLoading: true });
    try {
      const result = await store.synthesizeReadingAudio({ text });
      let url = result && result.audioUrl ? result.audioUrl : '';
      const audioFileId = result && result.fileId ? result.fileId : '';
      const audioCloudPath = result && result.cloudPath ? result.cloudPath : '';
      if (!url && result && result.fileId) {
        url = await store.getTempFileURL(result.fileId);
      }
      if (!url) throw new Error('audio-url-empty');
      if (current.flashcardKey && (audioFileId || audioCloudPath)) {
        store.saveFlashcardAudio({
          flashcardKey: current.flashcardKey,
          audioFileId,
          audioCloudPath
        }).catch(() => {});
      }
      const cards = (this.data.cards || []).map((item) => (
        item.flashcardKey === current.flashcardKey ? Object.assign({}, item, { audioUrl: url, audioFileId, audioCloudPath }) : item
      ));
      const library = this.getFlashcardLibrary().map((item) => (
        item.flashcardKey === current.flashcardKey ? Object.assign({}, item, { audioUrl: url, audioFileId, audioCloudPath }) : item
      ));
      this.setFlashcardLibrary(library);
      this.setData({
        cards,
        library: [],
        libraryGroups: this.getRenderedLibraryGroups(library),
        current: Object.assign({}, current, { audioUrl: url, audioFileId, audioCloudPath })
      });
      this.playAudioUrl(url, { silent });
      downloadAudioToLocal(url, current.flashcardKey).then((path) => {
        if (path) this.updateCardAudioCache(current.flashcardKey, { audioLocalPath: path });
      });
    } catch (error) {
      if (canUseDictionaryVoice(text)) {
        const url = buildDictionaryVoiceUrl(text);
        this.playAudioUrl(url, { silent });
        downloadAudioToLocal(url, current.flashcardKey).then((path) => {
          if (path) this.updateCardAudioCache(current.flashcardKey, { audioUrl: url, audioLocalPath: path });
        });
      } else if (!silent) {
        this.setData({ audioCompleted: true });
        wx.showToast({ title: '发音失败，稍后重试', icon: 'none' });
      } else {
        this.setData({ audioCompleted: true });
      }
    } finally {
      this.setData({ audioLoading: false });
      this._flashcardAudioLoading = false;
    }
  },
  updateCardAudioCache(flashcardKey, patch) {
    if (!flashcardKey || !patch) return;
    const cards = (this.data.cards || []).map((item) => (
      item.flashcardKey === flashcardKey ? Object.assign({}, item, patch) : item
    ));
    const library = this.getFlashcardLibrary().map((item) => (
      item.flashcardKey === flashcardKey ? Object.assign({}, item, patch) : item
    ));
    this.setFlashcardLibrary(library);
    const current = this.data.current && this.data.current.flashcardKey === flashcardKey
      ? Object.assign({}, this.data.current, patch)
      : this.data.current;
    this.setData({
      cards,
      library: [],
      libraryGroups: this.getRenderedLibraryGroups(library),
      current
    });
    this.persistActiveSourceState();
  },
  persistActiveSourceState() {
    const activeSourceId = this.data.activeSourceId || '';
    if (!activeSourceId) return;
    writeSourceCache(activeSourceId, {
      library: this.getFlashcardLibrary(),
      libraryGroups: [],
      cards: this.data.cards,
      currentIndex: this.data.currentIndex,
      current: this.data.current,
      total: this.data.total,
      empty: this.data.empty,
      stats: this.data.stats,
      dueCount: this.data.dueCount,
      newDueCount: this.data.newDueCount,
      reviewDueCount: this.data.reviewDueCount,
      settings: this.data.settings,
      limitOptions: this.data.limitOptions,
      planLimitMax: this.data.planLimitMax,
      newLimitIndex: this.data.newLimitIndex,
      reviewLimitIndex: this.data.reviewLimitIndex,
      today: this.data.today,
      isBookPlan: this.data.isBookPlan,
      isUnlimitedPlan: this.data.isUnlimitedPlan,
      planSummary: this.data.planSummary,
      progress: this.data.progress,
      demoMode: this.data.demoMode,
      loading: false
    });
  },
  updateCurrentReviewState(current, nextResult) {
    const updatedCard = applyReviewState(current, nextResult, this.data.today);
    const library = replaceCard(this.getFlashcardLibrary(), updatedCard);
    const cards = replaceCard(this.data.cards, updatedCard);
    this.setFlashcardLibrary(library);
    this.setData({
      library: [],
      cards,
      libraryGroups: this.getRenderedLibraryGroups(library),
      progress: {
        total: library.length,
        mastered: library.filter((item) => item.status === 'mastered').length,
        reviewing: library.filter((item) => item.status === 'reviewing').length,
        fresh: library.filter((item) => item.status === 'new').length
      },
      planSummary: buildPlanSummary(library, this.data.settings)
    });
  },
  syncReviewToCloud(current, nextResult) {
    if (!current || current.demo || !current.flashcardKey) return;
    this.pendingReviewQueue = this.pendingReviewQueue || [];
    this.pendingReviewQueue.push({
      flashcardKey: current.flashcardKey,
      result: nextResult,
      card: current
    });
    if (this.pendingReviewQueue.length >= 5) {
      this.flushReviewQueue();
    }
  },
  flushReviewQueue(force) {
    if (this.reviewQueueFlushing) {
      if (force) this.forceFlushReviewQueue = true;
      return;
    }
    if (!this.pendingReviewQueue || !this.pendingReviewQueue.length) return;
    const batch = this.pendingReviewQueue.splice(0, this.pendingReviewQueue.length);
    this.reviewQueueFlushing = true;
    Promise.all(batch.map((item) => (
      store.updateFlashcardReview(item.flashcardKey, item.result, item.card).catch(() => null)
    ))).then(() => {
      this.reviewQueueFlushing = false;
      if (this.pendingReviewQueue && (this.pendingReviewQueue.length >= 5 || this.forceFlushReviewQueue)) {
        this.forceFlushReviewQueue = false;
        this.flushReviewQueue(true);
      }
    }).catch(() => {
      this.reviewQueueFlushing = false;
    });
  },
  recordVocabularyResult(result, card) {
    if (!card || card.demo) return;
    const stats = this.vocabularySessionStats || {
      reviewed: 0,
      remembered: 0,
      easy: 0,
      unfamiliar: 0
    };
    stats.reviewed += 1;
    if (result === 'unfamiliar') {
      stats.unfamiliar += 1;
    } else if (result === 'easy') {
      stats.easy += 1;
    } else {
      stats.remembered += 1;
    }
    this.vocabularySessionStats = stats;
    if (stats.reviewed % 5 === 0) {
      this.syncVocabularyCompletion(false);
    }
  },
  syncVocabularyCompletion(force) {
    const stats = this.vocabularySessionStats || {};
    if (!stats.reviewed || (!force && stats.reviewed % 5 !== 0)) return;
    if (this.lastVocabularyCompletionSyncedReviewed === stats.reviewed) return;
    this.lastVocabularyCompletionSyncedReviewed = stats.reviewed;
    const sourceTitle = this.data.activeSourceTitle || '词汇复习';
    store.recordStudyCompletion({
      type: 'vocabulary',
      targetId: this.data.activeSourceId || 'daily-vocabulary',
      title: sourceTitle === '我的词库' ? '词汇复习' : sourceTitle,
      meta: '词汇',
      progressText: `复习 ${stats.reviewed} 张 · 不熟 ${stats.unfamiliar || 0} 张`,
      latestAttempt: Object.assign({}, stats, {
        sourceId: this.data.activeSourceId || '',
        sourceTitle,
        date: this.data.today || ''
      })
    }).catch(() => null);
  },
  advanceVisibleCards(shouldPersist) {
    const cards = this.data.cards.slice();
    cards.splice(this.data.currentIndex, 1);
    const nextIndex = Math.min(this.data.currentIndex, Math.max(cards.length - 1, 0));
    const nextCard = cards[nextIndex] || null;
    const reviewDone = Math.min(Number(this.data.reviewDone || 0) + 1, Number(this.data.reviewSessionTotal || 0));
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: nextCard,
      total: cards.length,
      reviewDone,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(nextCard),
      empty: !this.getFlashcardLibrary().length
    });
    if (shouldPersist) this.persistActiveSourceState();
    this.scheduleAutoSpeakCurrent();
  },
  repeatCurrentCard(shouldPersist) {
    const cards = this.data.cards.slice();
    const current = cards[this.data.currentIndex];
    if (!current) return;
    cards.splice(this.data.currentIndex, 1);
    cards.push(current);
    const nextIndex = Math.min(this.data.currentIndex, Math.max(cards.length - 1, 0));
    const nextCard = cards[nextIndex] || null;
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: nextCard,
      total: cards.length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(nextCard)
    });
    if (shouldPersist) this.persistActiveSourceState();
    this.scheduleAutoSpeakCurrent();
  },
  startReview() {
    const cards = buildReviewQueue(this.getFlashcardLibrary(), this.data.settings, this.data.today);
    const current = cards[0] || null;
    this.setData({
      sourceMode: 'library',
      mode: 'review',
      cards,
      currentIndex: 0,
      current,
      reviewDone: 0,
      reviewSessionTotal: cards.length,
      total: cards.length,
      dueCount: cards.length,
      newDueCount: cards.filter((item) => item.status === 'new').length,
      reviewDueCount: cards.filter((item) => item.status !== 'new').length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(current)
    });
    this.vocabularySessionStats = null;
    this.lastVocabularyCompletionSyncedReviewed = 0;
    this.scheduleAutoSpeakCurrent();
  },
  exitReview() {
    this.syncVocabularyCompletion(true);
    this.setData({ mode: 'library' });
  },
  async markRemembered() {
    if (!this.data.cardRevealed) {
      this.setData({ cardRevealed: true, cardChoice: 'remembered', previousCardChoice: '' });
      return;
    }
    await this.commitCurrentCard('remembered');
  },
  markUnfamiliar() {
    if (!this.data.cardRevealed) {
      this.setData({ cardRevealed: true, cardChoice: 'unfamiliar', previousCardChoice: '' });
      return;
    }
  },
  markTooEasy() {
    if (this.data.cardChoice === 'easy') return;
    this.setData({
      cardChoice: 'easy',
      previousCardChoice: this.data.cardChoice || 'remembered'
    });
  },
  undoTooEasy() {
    if (this.data.cardChoice !== 'easy') return;
    this.setData({
      cardChoice: this.data.previousCardChoice || 'remembered',
      previousCardChoice: ''
    });
  },
  async commitCurrentCard(result) {
    const current = this.data.current;
    if (!current || !current.flashcardKey) return;
    if (this.data.audioLoading || this.data.audioPlaying) return;
    const nextResult = typeof result === 'string' ? result : (this.data.cardChoice || 'remembered');
    const checkinDays = writeVocabularyCheckinDay(this.data.today);
    this.setData({
      reviewDays: Object.keys(checkinDays).length,
      vocabCheckinDays: Object.keys(checkinDays).length
    });
    if (nextResult === 'unfamiliar') {
      if (!current.demo) {
        this.recordVocabularyResult(nextResult, current);
        this.updateCurrentReviewState(current, nextResult);
        this.syncReviewToCloud(current, nextResult);
      }
      this.repeatCurrentCard(!!this.data.activeSourceId);
      return;
    }
    if (current.demo) {
      this.advanceVisibleCards(false);
      return;
    }
    this.updateCurrentReviewState(current, nextResult);
    this.syncReviewToCloud(current, nextResult);
    this.recordVocabularyResult(nextResult, current);
    this.advanceVisibleCards(!!this.data.activeSourceId);
  }
});
