const page = require('../../../utils/page');
const store = require('../../../utils/store');
const effects = require('../../../utils/effects');
const i18n = require('../../../utils/i18n');
const { formatVocabularyDefinitions, formatVocabularyMeaning } = require('../../../utils/vocabulary-definitions');

const text = (key, fallback) => i18n.getPageText('flashcards', key, undefined, fallback);

const TYPE_LABELS = {
  all: text('all', '全部'),
  word: text('word', '生词'),
  phrase: text('phrase', '短语'),
  pattern: text('pattern', '句型')
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
  { level: 'junior', title: text('juniorBook', '初中英语词汇 乱序'), coverMark: text('juniorMark', '初'), imported: 0, cloudPath: 'dictionary_books/word-dictionary-junior.json' },
  { level: 'senior', title: text('seniorBook', '高中英语词汇 乱序'), coverMark: text('seniorMark', '高'), imported: 0, cloudPath: 'dictionary_books/word-dictionary-senior.json' },
  ...[1, 2, 3, 4].flatMap((unlockLevel) => [1, 2, 3, 4, 5, 6, 7, 8].flatMap((unit) => ['ls', 'rw'].map((section) => ({
    level: `unlock-${unlockLevel}-u${unit}-${section}`,
    unlockLevel,
    unit,
    section,
    title: `Unlock ${unlockLevel} Unit ${unit} ${section.toUpperCase()} 词汇表`,
    coverMark: section.toUpperCase(),
    imported: 0,
    cloudPath: `dictionary_books/unlock-v2/level-${unlockLevel}/unit-${unit}/${section}.json`
  }))))
];
const STANDARD_DICTIONARY_BOOKS = DEFAULT_DICTIONARY_BOOKS.filter((book) => !book.unlockLevel);
const UNLOCK_LEVELS = [1, 2, 3, 4].map((level) => ({
  level,
  title: `Unlock ${level}`,
  coverMark: String(level),
  units: [1, 2, 3, 4, 5, 6, 7, 8].map((unit) => ({ unit, title: `Unit ${unit}`, coverMark: `U${unit}` }))
}));
const FLASHCARD_SOURCE_CACHE_PREFIX = 'flashcardSourceCache:';
const FLASHCARD_SOURCE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const FLASHCARD_SOURCE_CACHE_VERSION_KEY = 'flashcardSourceCacheVersion';
const FLASHCARD_SOURCE_CACHE_CONTENT_VERSION = 2026071302;
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

function formatPhonetic(value) {
  const text = String(value || '').trim().replace(/^[/\[]+|[/\]]+$/g, '');
  return text ? `/${text}/` : '';
}

function getPhoneticBody(value) {
  return String(value || '').trim().replace(/^[/\[]+|[/\]]+$/g, '');
}

function normalizeCard(item, index) {
  const type = item.type || (item.pattern ? 'pattern' : (item.phrase ? 'phrase' : 'word'));
  const displayText = item.text || item.word || item.phrase || item.pattern || '';
  const longestTokenLength = String(displayText).split(/\s+/).reduce((max, token) => Math.max(max, token.length), 0);
  const displaySizeClass = longestTokenLength >= 18
    ? 'is-word-extra-long'
    : ((longestTokenLength >= 12 || String(displayText).length >= 28) ? 'is-word-long' : '');
  const phoneticBody = getPhoneticBody(item.phonetic);
  const displayPhonetic = phoneticBody ? `/${phoneticBody}/` : '';
  const isUnlockBook = /^dictionary-book-unlock-/.test(String(item.sourceId || ''));
  return Object.assign({}, item, {
    type,
    displayText,
    displaySizeClass,
    phonetic: formatPhonetic(item.phonetic),
    phoneticBody,
    displayPhonetic,
    meaning: isUnlockBook ? formatVocabularyMeaning(item.meaning) : item.meaning,
    canSpeak: (type === 'word' || type === 'phrase') && canUseDictionaryVoice(item.word || item.phrase || displayText),
    typeLabel: TYPE_LABELS[type] || text('word', '生词'),
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
  const newUsed = (library || []).filter((item) => item.firstLearnedDate === today).length;
  const reviewUsed = (library || []).filter((item) => item.lastReviewDate === today && item.firstLearnedDate !== today).length;
  const newRemaining = Math.max(0, Number(settings.newLimit || 0) - newUsed);
  const reviewRemaining = Math.max(0, Number(settings.reviewLimit || 0) - reviewUsed);
  return due
    .filter((item) => item.status !== 'new' && item.lastReviewDate !== today)
    .slice(0, reviewRemaining)
    .concat(due.filter((item) => item.status === 'new').slice(0, newRemaining));
}

function isBookSource(sourceId) {
  return String(sourceId || '').indexOf('dictionary-book-') === 0;
}

function getDictationSourceTitle(sourceId, fallback) {
  const level = String(sourceId || '').replace(/^dictionary-book-/, '');
  if (level === 'junior') return text('juniorBook', '初中英语词汇 乱序');
  if (level === 'senior') return text('seniorBook', '高中英语词汇 乱序');
  const match = level.match(/^unlock-(\d+)-u(\d+)-(ls|rw)$/i);
  if (match) return `Unlock ${match[1]} · Unit ${match[2]} · ${match[3].toUpperCase()}`;
  return fallback || text('dictationShelf', '听音拼写');
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

function buildCompletionRewardKey(data) {
  const current = data || {};
  const settings = current.settings || {};
  const date = current.today || effects.todayKey();
  const sourceId = current.activeSourceId || 'daily-vocabulary';
  const newLimit = Number(settings.newLimit || 0);
  const reviewLimit = Number(settings.reviewLimit || 0);
  const sessionMode = current.repeatMode
    ? `repeat-today-${current.repeatSessionId || 'session'}`
    : 'daily-plan';
  return `flashcards:${date}:${sourceId}:${sessionMode}:new-${newLimit}:review-${reviewLimit}`;
}

function buildPhoneticPreview(library) {
  const first = (library || []).find((item) => item && (item.displayPhonetic || item.phoneticBody || item.phonetic));
  if (!first) return '';
  const body = first.phoneticBody || getPhoneticBody(first.phonetic);
  return `${first.displayText || first.word || first.text || ''} ${first.displayPhonetic || (body ? `/${body}/` : '')}`.trim();
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
    firstLearnedDate: card.firstLearnedDate || (card.status === 'new' ? today : ''),
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

function buildTodayPracticeCards(library, today) {
  return (library || []).filter((item) => (
    item.firstLearnedDate === today || item.lastReviewDate === today
  ));
}

function getDefaultRepeatLimit(total) {
  return Math.max(1, Number(total || 0));
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
      firstLearnedDate: useCachedProgress ? (cached.firstLearnedDate || item.firstLearnedDate) : item.firstLearnedDate,
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
      phonetic: item.phonetic || progress.phonetic || '',
      meaning: item.meaning || progress.meaning || '',
      example: item.example || progress.example || '',
      status: progress.status || item.status,
      nextReviewDate: progress.nextReviewDate || '',
      reviewStep: progress.reviewStep != null ? progress.reviewStep : item.reviewStep,
      familiarLevel: progress.familiarLevel || item.familiarLevel || '',
      unfamiliarCount: progress.unfamiliarCount || 0,
      lastReviewedAt: progress.lastReviewedAt || item.lastReviewedAt,
      lastReviewDate: progress.lastReviewDate || item.lastReviewDate,
      firstLearnedDate: progress.firstLearnedDate || item.firstLearnedDate,
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
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const targetPart = `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
  return `${FLASHCARD_PLAN_SETTINGS_PREFIX}${targetPart}:${sourceId || 'all'}`;
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
    title: fallback.title || book.title || text('wordBook', '词汇书'),
    coverMark: fallback.coverMark || book.coverMark || '',
    sourceId: getBookSourceId(book.level)
  });
}

async function loadBookCardsFromStorage(book) {
  const response = await store.getDictionaryBook(book.level);
  if (response && response.syncMode === 'cloud-error') {
    const error = new Error((response.cloudError && response.cloudError.message) || 'getDictionaryBook-cloud-error');
    error.cloudError = response.cloudError;
    throw error;
  }
  const rows = response && Array.isArray(response.rows) ? response.rows : [];
  if (!Array.isArray(rows)) throw new Error('dictionary-book-json-invalid');
  return {
    rows,
    cards: rows.map((entry, index) => buildBookCard(entry, book, index)).filter((item) => item.word)
  };
}

function getSourceCacheKey(sourceId) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const targetPart = `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
  return `${FLASHCARD_SOURCE_CACHE_PREFIX}${targetPart}:${sourceId || 'all'}`;
}

function getSourceCacheFilePath(sourceId) {
  if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) return '';
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const targetPart = `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
  return `${wx.env.USER_DATA_PATH}/flashcard-source-${encodeURIComponent(`${targetPart}:${sourceId || 'all'}`)}.json`;
}

function getFlashcardSourceCacheVersion() {
  try {
    return Math.max(
      FLASHCARD_SOURCE_CACHE_CONTENT_VERSION,
      Number(wx.getStorageSync(FLASHCARD_SOURCE_CACHE_VERSION_KEY) || 0)
    );
  } catch (error) {
    return FLASHCARD_SOURCE_CACHE_CONTENT_VERSION;
  }
}

function isStaleSourceCache(cached) {
  const version = getFlashcardSourceCacheVersion();
  return version && Number((cached && cached.version) || 0) < version;
}

function isStaleBookCache(sourceId, data) {
  if (!isBookSource(sourceId) || !data || !Array.isArray(data.library) || !data.library.length) return false;
  return !data.library.some((item) => item && item.phonetic);
}

function readSourceCache(sourceId) {
  const filePath = getSourceCacheFilePath(sourceId);
  if (filePath) {
    try {
      const cached = JSON.parse(wx.getFileSystemManager().readFileSync(filePath, 'utf8'));
      if (cached && Date.now() - Number(cached.cachedAt || 0) <= FLASHCARD_SOURCE_CACHE_TTL) {
        if (isStaleSourceCache(cached)) return null;
        if (isStaleBookCache(sourceId, cached.data)) return null;
        return cached.data || null;
      }
    } catch (error) {}
  }
  try {
    const cached = wx.getStorageSync(getSourceCacheKey(sourceId));
    if (!cached || Date.now() - Number(cached.cachedAt || 0) > FLASHCARD_SOURCE_CACHE_TTL) return null;
    if (isStaleSourceCache(cached)) return null;
    if (isStaleBookCache(sourceId, cached.data)) return null;
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
        version: getFlashcardSourceCacheVersion(),
        data
      }), 'utf8');
      return;
    } catch (error) {}
  }
  try {
    wx.setStorageSync(getSourceCacheKey(sourceId), {
      cachedAt: Date.now(),
      version: getFlashcardSourceCacheVersion(),
      data
    });
  } catch (error) {}
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
    meaning: formatVocabularyDefinitions(entry.definitions),
    example: entry.example || '',
    exampleMeaning: entry.exampleMeaning || '',
    status: 'new',
    nextReviewDate: '',
    localBook: true
  }, index);
}

function getTargetDebugText() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return [
    `targetChildId=${target.targetChildId || ''}`,
    `targetFamilyId=${target.targetFamilyId || ''}`
  ].join('；');
}

function buildBookDebugLines(stage, book, options) {
  const data = options || {};
  const rows = data.rows || [];
  const cards = data.cards || [];
  const firstRow = rows[0] || {};
  const firstCard = cards[0] || {};
  const firstWithPhonetic = cards.find((item) => item && item.phonetic) || null;
  const phoneticCount = cards.filter((item) => item && item.phonetic).length;
  const cloudPath = book.cloudPath || '';
  const lines = [
    `DEBUG: reading/flashcards.importDictionaryBook -> store.getDictionaryBook -> cloud.getDictionaryBook.${cloudPath || 'empty'} -> phonetic：${firstCard.phonetic || 'missing'}`,
    `stage=${stage}；level=${book.level || ''}；sourceId=${getBookSourceId(book.level)}；cacheHit=${data.cacheHit ? 'true' : 'false'}`,
    `rows=${rows.length || data.rowCount || 0}；rendered=${cards.length || data.cardCount || 0}；phoneticCount=${phoneticCount || data.phoneticCount || 0}`,
    `firstRow.word=${firstRow.word || firstRow.wordLower || firstCard.word || ''}；firstRow.phonetic=${firstRow.phonetic || ''}；firstCard.phonetic=${firstCard.phonetic || ''}`,
    `sample.word=${(firstWithPhonetic && firstWithPhonetic.word) || ''}；sample.phonetic=${(firstWithPhonetic && firstWithPhonetic.phonetic) || ''}`,
    `${getTargetDebugText()}；cloudPath=${cloudPath}`
  ];
  if (data.error) {
    lines.push(`cloudError.message=${data.error.message || data.error.errMsg || String(data.error)}`);
    lines.push('FIX: Check getDictionaryBook in flashcard.service.js or storage.adapter.downloadCloudJson.');
  } else if (!phoneticCount && cards.length) {
    lines.push('FIX: The cloud word-book JSON lacks phonetic, or buildBookCard did not map it.');
  } else if (!rows.length && !cards.length) {
    lines.push('DEBUG: Preparing to read the cloud word-book JSON.');
  } else {
    lines.push('DEBUG: Cloud JSON returned phonetic; check WXML rendering or stale cache if it is still missing.');
  }
  return lines;
}

function shouldShowBookDebug(lines) {
  return (lines || []).some((line) => (
    String(line || '').indexOf('FIX:') >= 0
    || String(line || '').indexOf('cloudError.message=') === 0
  ));
}

function buildLibraryDebugLines(data, activeSourceId, library) {
  if (activeSourceId || (library || []).length) return [];
  const syncMode = (data && data.syncMode) || '';
  if (syncMode !== 'cloud-error') return [];
  const target = getTargetDebugText();
  const cloudError = (data && data.cloudError) || {};
  const syncDebug = (data && data.syncDebug) || {};
  return [
    `DEBUG: reading/flashcards.loadCards -> store.getFlashcardReview -> cloud.getFlashcardReview.library：${(library || []).length}`,
    `${target}；syncMode=${syncMode}；cloudError.message=${cloudError.message || syncDebug.reason || 'unknown'}；envId=${syncDebug.envId || 'unknown'}`,
    'DEBUG: Cloud vocabulary failed. Check store.getFlashcardReview and cloud.getFlashcardReview.'
  ];
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
    sourceMode: 'practice-home',
    mode: 'library',
    library: [],
    libraryGroups: [],
    cards: [],
    current: null,
    currentIndex: 0,
    total: 0,
    empty: false,
    repeatMode: false,
    repeatSessionId: '',
    todayRepeatTotal: 0,
    repeatLimit: 1,
    stats: { all: 0, word: 0, phrase: 0, pattern: 0 },
    progress: { total: 0, mastered: 0, reviewing: 0, fresh: 0 },
    planSummary: { total: 0, learned: 0, learnedPercent: 0, boatPercent: 4, mastered: 0, reviewing: 0, fresh: 0, todayPlan: 0 },
    logs: [],
    dictionaryBooks: DEFAULT_DICTIONARY_BOOKS,
    standardDictionaryBooks: STANDARD_DICTIONARY_BOOKS,
    unlockLevels: UNLOCK_LEVELS,
    activeUnlockLevel: 0,
    activeUnlockUnit: 0,
    activeUnlockUnits: [],
    activeUnlockSections: [],
    importingBook: '',
    activeSourceId: '',
    activeSourceTitle: text('myLibrary', '我的词库'),
    phoneticPreview: '',
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
    reviewCompleted: false,
    dictationPromptVisible: false,
    dictationPromptPending: false,
    dictationJumping: false,
    dictationPromptSourceTitle: '',
    cardRevealed: false,
    cardChoice: '',
    previousCardChoice: '',
    reviewDays: 0,
    vocabCheckinDays: 0,
    loading: false,
    audioLoading: false,
    audioPlaying: false,
    libraryAudioKey: '',
    audioCompleted: true,
    navStyle: '',
    pageTopStyle: '',
    flashcardDebugLines: [],
    previewMode: store.getDeviceStudyRole() !== 'student'
  }),
  onUnload() {
    this.flushReviewQueue(true);
    this.syncVocabularyCompletion(true);
    if (this.autoSpeakTimer) {
      clearTimeout(this.autoSpeakTimer);
      this.autoSpeakTimer = null;
    }
    if (this.audioPrefetchTimer) {
      clearTimeout(this.audioPrefetchTimer);
      this.audioPrefetchTimer = null;
    }
    if (this.sourcePrefetchTimer) {
      clearTimeout(this.sourcePrefetchTimer);
      this.sourcePrefetchTimer = null;
    }
    if (this.dictationPromptTimer) {
      clearTimeout(this.dictationPromptTimer);
      this.dictationPromptTimer = null;
    }
    if (this.flashcardAudioContext) {
      this.flashcardAudioContext.destroy();
      this.flashcardAudioContext = null;
    }
  },
  onShow() {
    this.flashcardPerf = page.startPagePerf('flashcards');
    page.syncTheme(this);
    this.setData(Object.assign({}, getNavLayout(), {
      previewMode: store.getDeviceStudyRole() !== 'student',
      dictionaryBooks: (this.data.dictionaryBooks || DEFAULT_DICTIONARY_BOOKS).map((book) => Object.assign({}, book, {
        title: book.level === 'senior' ? text('seniorBook', book.title) : (book.level === 'junior' ? text('juniorBook', book.title) : book.title),
        coverMark: book.level === 'senior' ? text('seniorMark', book.coverMark) : (book.level === 'junior' ? text('juniorMark', book.coverMark) : book.coverMark)
      })),
      activeSourceTitle: this.data.activeSourceId ? this.data.activeSourceTitle : text('myLibrary', '我的词库')
    }), () => {
      if (this.flashcardPerf) {
        this.flashcardPerf.ready('pageReady', {
          cacheHit: this.data.mode === 'review',
          source: this.data.mode === 'review' ? 'session' : 'static-library',
          total: this.getFlashcardLibrary().length
        });
      }
    });
    if (this.data.mode === 'review') return;
    if (this.data.sourceMode === 'practice-home') return;
    if (this.data.sourceMode === 'bookshelf') {
      this.prefetchVocabularySources();
      return;
    }
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
  startSourcePerf(sourceId) {
    this.sourcePerfId = sourceId || 'all';
    this.sourcePerf = page.startPagePerf(`flashcards-data:${this.sourcePerfId}`);
  },
  markSourceReady(meta) {
    if (!this.sourcePerf) return;
    this.sourcePerf.ready('pageReady', Object.assign({
      sourceId: this.sourcePerfId
    }, meta || {}));
  },
  markSourceCloudRefresh(meta) {
    if (!this.sourcePerf) return;
    this.sourcePerf.mark('cloudRefresh', Object.assign({
      sourceId: this.sourcePerfId
    }, meta || {}));
  },
  prefetchVocabularySources() {
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const targetPart = `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
    const cacheVocabularyProgress = (data) => {
      const currentTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      const currentTargetPart = `${currentTarget.targetFamilyId || 'self'}:${currentTarget.targetChildId || 'self'}`;
      if (!data || data.syncMode === 'cloud-error' || currentTargetPart !== targetPart) return;
      writeSourceCache('', this.buildFlashcardData(data, '', readSourceCache('')));
      STANDARD_DICTIONARY_BOOKS.forEach((sourceBook) => {
        const sourceId = getBookSourceId(sourceBook.level);
        const cachedBook = readSourceCache(sourceId);
        if (cachedBook && (cachedBook.library || []).length) {
          writeSourceCache(sourceId, this.buildFlashcardData(data, sourceId, cachedBook));
        }
      });
    };
    const reviewRequest = store.getFlashcardReview({ scope: 'personal' }, cacheVocabularyProgress);
    reviewRequest.then(cacheVocabularyProgress).catch(() => {});
    if (this.sourcePrefetchTimer) clearTimeout(this.sourcePrefetchTimer);
    this.sourcePrefetchTimer = setTimeout(async () => {
      this.sourcePrefetchTimer = null;
      for (let index = 0; index < STANDARD_DICTIONARY_BOOKS.length; index += 1) {
        const book = normalizeBook(STANDARD_DICTIONARY_BOOKS[index]);
        const sourceId = getBookSourceId(book.level);
        if (readSourceCache(sourceId)) continue;
        try {
          const bookData = await loadBookCardsFromStorage(book);
          const currentTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
          const currentTargetPart = `${currentTarget.targetFamilyId || 'self'}:${currentTarget.targetChildId || 'self'}`;
          if (currentTargetPart !== targetPart) return;
          const baseCache = {
            library: bookData.cards || [],
            settings: readPlanSettings(sourceId, this.data.settings),
            today: effects.todayKey(),
            logs: [],
            dictionaryBooks: this.data.dictionaryBooks
          };
          const reviewData = await store.getFlashcardReview({ sourceId }).catch(() => null);
          writeSourceCache(sourceId, reviewData && reviewData.syncMode !== 'cloud-error'
            ? this.buildFlashcardData(reviewData, sourceId, baseCache)
            : baseCache);
        } catch (error) {}
      }
    }, 500);
  },
  buildFlashcardData(data, activeSourceId, cached) {
    const rawLibrary = data && Array.isArray(data.library) ? data.library : [];
    let library = filterBySource(rawLibrary, activeSourceId).map(normalizeCard);
    let demoMode = false;
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
    const todayRepeatTotal = buildTodayPracticeCards(library, data.today).length;
    return {
      library,
      libraryGroups: [],
      cards,
      currentIndex: 0,
      current: cards[0] || null,
      total: cards.length,
      empty: !library.length,
      repeatMode: false,
      todayRepeatTotal,
      repeatLimit: getDefaultRepeatLimit(todayRepeatTotal),
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
      phoneticPreview: buildPhoneticPreview(library),
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
      flashcardDebugLines: buildLibraryDebugLines(data, activeSourceId, library),
      loading: false
    };
  },
  async loadCards() {
    const keepReviewSession = this.data.mode === 'review';
    this.setData({ loading: true });
    const activeSourceId = this.data.activeSourceId || '';
    const reviewOptions = isBookSource(activeSourceId)
      ? { sourceId: activeSourceId }
      : { scope: 'personal' };
    const cached = readSourceCache(activeSourceId);
    if (cached && !keepReviewSession) {
      const cachedData = this.buildFlashcardData(Object.assign({}, cached, { __cacheHit: true }), activeSourceId, cached);
      this.applyFlashcardData(Object.assign({}, cachedData, {
        loading: false
      }));
      writeSourceCache(activeSourceId, cachedData);
      this.markSourceReady({
        cacheHit: true,
        source: 'source-cache',
        total: (cached.library || []).length
      });
      if (this.flashcardPerf) {
        this.flashcardPerf.ready('pageReady', {
          cacheHit: true,
          sourceId: activeSourceId || 'all',
          total: (cached.library || []).length
        });
      }
      store.getFlashcardReview(reviewOptions, (fresh) => {
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
          this.markSourceCloudRefresh({ total: freshData.library.length });
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
    const data = await store.getFlashcardReview(reviewOptions, (fresh) => {
      if (this.data.mode !== 'review' && (this.data.activeSourceId || '') === activeSourceId) {
        const freshData = this.buildFlashcardData(fresh, activeSourceId, cached);
        this.applyFlashcardData(freshData);
        writeSourceCache(activeSourceId, freshData);
        this.markSourceCloudRefresh({ total: freshData.library.length });
      }
    });
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
    this.markSourceReady({
      cacheHit: !!data.__cacheHit,
      source: data.__cacheHit ? 'cloud-cache' : 'cloud',
      total: nextData.library.length
    });
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
    this.startSourcePerf(sourceId);
    const book = normalizeBook((this.data.dictionaryBooks || []).find((item) => item.level === level) || { level });
    const cached = readSourceCache(sourceId);
    this.setData({
      sourceMode: 'library',
      mode: 'library',
      activeSourceId: sourceId,
      activeSourceTitle: book.title || text('wordBook', '词汇书'),
      importingBook: book.imported ? '' : level,
      flashcardDebugLines: []
    });
    if (cached) {
      const cachedLines = buildBookDebugLines('cache', book, {
        cacheHit: true,
        cards: cached.library || [],
        cardCount: (cached.library || []).length
      });
      this.setData({ flashcardDebugLines: shouldShowBookDebug(cachedLines) ? cachedLines : [] });
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
        const bookData = await loadBookCardsFromStorage(book);
        const rows = bookData.rows || [];
        const localCards = bookData.cards || [];
        const debugLines = buildBookDebugLines('cloud-json', book, { rows, cards: localCards });
        this.setData({ flashcardDebugLines: shouldShowBookDebug(debugLines) ? debugLines : [] });
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
          phoneticPreview: buildPhoneticPreview(localCards),
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
        this.markSourceReady({
          cacheHit: false,
          source: 'dictionary-cloud',
          total: localCards.length
        });
        ready = true;
        const applyFreshBookProgress = (fresh) => {
          if (this.data.mode !== 'review' && (this.data.activeSourceId || '') === sourceId) {
            const freshData = this.buildFlashcardData(fresh, sourceId, { library: localCards });
            this.applyFlashcardData(freshData);
            writeSourceCache(sourceId, freshData);
            this.markSourceCloudRefresh({ total: freshData.library.length });
          }
        };
        store.getFlashcardReview({ sourceId }, applyFreshBookProgress).then((fresh) => {
          if (fresh && !fresh.__cacheHit) applyFreshBookProgress(fresh);
        }).catch(() => {});
      } catch (error) {
        const debugLines = buildBookDebugLines('error', book, { error });
        this.setData({ flashcardDebugLines: debugLines });
        console.warn(debugLines.join('\n'));
        wx.showToast({ title: text('loadFailed', '词书读取失败'), icon: 'none' });
      }
    }
    this.setData({ importingBook: '' });
  },
  useAllVocabulary() {
    this.startSourcePerf('all');
    this.setData({
      sourceMode: 'library',
      mode: 'library',
      activeSourceId: '',
      activeSourceTitle: text('myLibrary', '我的词库'),
      loading: true
    });
    this.loadCards();
  },
  openDictationShelf() {
    wx.navigateTo({ url: '/pages/reading/flashcards/dictation/library/index' });
  },
  openReviewFolder() {
    this.setData({ sourceMode: 'bookshelf', mode: 'library' });
    this.prefetchVocabularySources();
  },
  openUnlockBooks() {
    this.setData({ sourceMode: 'unlock-levels', activeUnlockLevel: 0, activeUnlockUnit: 0, activeUnlockUnits: [], activeUnlockSections: [] });
  },
  chooseUnlockLevel(event) {
    const level = Number(event.currentTarget.dataset.level || 0);
    const group = UNLOCK_LEVELS.find((item) => item.level === level);
    if (!group) return;
    this.setData({
      sourceMode: 'unlock-units',
      activeUnlockLevel: level,
      activeUnlockUnits: group.units
    });
  },
  chooseUnlockUnit(event) {
    const unit = Number(event.currentTarget.dataset.unit || 0);
    if (!unit || !this.data.activeUnlockLevel) return;
    this.setData({
      sourceMode: 'unlock-sections',
      activeUnlockUnit: unit,
      activeUnlockSections: DEFAULT_DICTIONARY_BOOKS.filter((book) => book.unlockLevel === this.data.activeUnlockLevel && book.unit === unit)
    });
  },
  backToBookshelf() {
    if (this.data.sourceMode === 'library' && /^dictionary-book-unlock-/.test(this.data.activeSourceId || '')) {
      this.setData({ sourceMode: 'unlock-sections', mode: 'library', planSettingsVisible: false, libraryVisible: false });
      return;
    }
    if (this.data.sourceMode === 'unlock-sections') {
      this.setData({ sourceMode: 'unlock-units', activeUnlockUnit: 0, activeUnlockSections: [] });
      return;
    }
    if (this.data.sourceMode === 'unlock-units') {
      this.setData({ sourceMode: 'unlock-levels', activeUnlockLevel: 0, activeUnlockUnits: [] });
      return;
    }
    if (this.data.sourceMode === 'unlock-levels') {
      this.setData({ sourceMode: 'bookshelf' });
      return;
    }
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
    if (this.data.dictationPromptPending || this.data.dictationPromptVisible) return;
    if (this.data.mode === 'review') {
      this.exitReview();
      return;
    }
    if (this.data.sourceMode === 'bookshelf') {
      this.setData({ sourceMode: 'practice-home' });
      return;
    }
    if (this.data.sourceMode !== 'practice-home') {
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
      limitPickerTitle: field === 'newLimit' ? text('newToday', '今日新学') : text('reviewToday', '今日复习'),
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
    if (this.data.previewMode) return;
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
      this.flashcardAudioContext.onPlay(() => this.clearCardAudioStartTimer());
      this.flashcardAudioContext.onEnded(() => {
        this.clearCardAudioStartTimer();
        this.setData({ audioPlaying: false, audioCompleted: true, libraryAudioKey: '' });
      });
      this.flashcardAudioContext.onError(() => {
        this.clearCardAudioStartTimer();
        this.setData({ audioPlaying: false, audioCompleted: true, libraryAudioKey: '' });
        if (Date.now() < Number(this.silentAudioErrorUntil || 0)) {
          return;
        }
        wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
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
  cancelCurrentAudio() {
    this.clearCardAudioStartTimer();
    this._flashcardAudioRequestId = Number(this._flashcardAudioRequestId || 0) + 1;
    this._flashcardAudioLoading = false;
    if (this.flashcardAudioContext) {
      try {
        this.flashcardAudioContext.stop();
      } catch (error) {}
    }
    this.setData({ audioLoading: false, audioPlaying: false, audioCompleted: true, libraryAudioKey: '' });
  },
  clearCardAudioStartTimer() {
    if (!this.cardAudioStartTimer) return;
    clearTimeout(this.cardAudioStartTimer);
    this.cardAudioStartTimer = null;
  },
  startCardAudioStartTimer(audioRequestId) {
    this.clearCardAudioStartTimer();
    this.cardAudioStartTimer = setTimeout(() => {
      this.cardAudioStartTimer = null;
      if (this._flashcardAudioRequestId !== audioRequestId) return;
      this._flashcardAudioRequestId += 1;
      this._flashcardAudioLoading = false;
      this.silentAudioErrorUntil = Date.now() + 1000;
      if (this.flashcardAudioContext) {
        try {
          this.flashcardAudioContext.stop();
        } catch (error) {}
      }
      this.setData({ audioLoading: false, audioPlaying: false, audioCompleted: true, libraryAudioKey: '' });
    }, 3000);
  },
  playCompletionSfx() {
    if (this.data.audioPlaying || this.data.audioLoading) return;
    effects.playComplete({
      voiceKey: 'flashcardComplete',
      voiceDelayMs: 1000,
      onceKey: buildCompletionRewardKey(this.data)
    });
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
    }, 60);
  },
  scheduleAudioPrefetchAroundCurrent() {
    if (this.audioPrefetchTimer) {
      clearTimeout(this.audioPrefetchTimer);
      this.audioPrefetchTimer = null;
    }
    const cards = this.data.cards || [];
    const startIndex = Number(this.data.currentIndex || 0) + 1;
    const nextCards = cards.slice(startIndex, startIndex + 2).filter((item) => item && item.canSpeak);
    if (!nextCards.length) return;
    this.audioPrefetchTimer = setTimeout(() => {
      this.audioPrefetchTimer = null;
      nextCards.reduce((chain, card) => chain.then(() => this.prefetchCardAudio(card)), Promise.resolve());
    }, 120);
  },
  async prefetchCardAudio(card) {
    if (!card || !card.canSpeak || !card.flashcardKey) return;
    this.prefetchingAudioKeys = this.prefetchingAudioKeys || {};
    if (this.prefetchingAudioKeys[card.flashcardKey]) return;
    const text = card.word || card.phrase || card.displayText || '';
    if (!text) return;
    const localAudioPath = card.audioLocalPath || getLocalAudioPath(card.flashcardKey);
    if (localFileExists(localAudioPath)) return;
    this.prefetchingAudioKeys[card.flashcardKey] = true;
    try {
      if (card.audioUrl) {
        const path = await downloadAudioToLocal(card.audioUrl, card.flashcardKey);
        if (path) this.updateCardAudioCache(card.flashcardKey, { audioLocalPath: path });
        return;
      }
      if (card.audioFileId) {
        const url = await store.getTempFileURL(card.audioFileId);
        if (url) {
          const path = await downloadAudioToLocal(url, card.flashcardKey);
          if (path) this.updateCardAudioCache(card.flashcardKey, { audioUrl: url, audioLocalPath: path });
          return;
        }
      }
      const result = await store.synthesizeReadingAudio({ text });
      let url = result && result.audioUrl ? result.audioUrl : '';
      const audioFileId = result && result.fileId ? result.fileId : '';
      const audioCloudPath = result && result.cloudPath ? result.cloudPath : '';
      if (!url && audioFileId) {
        url = await store.getTempFileURL(audioFileId);
      }
      if (!url) throw new Error('audio-url-empty');
      if (audioFileId || audioCloudPath) {
        store.saveFlashcardAudio({
          flashcardKey: card.flashcardKey,
          audioFileId,
          audioCloudPath
        }).catch(() => {});
      }
      const path = await downloadAudioToLocal(url, card.flashcardKey);
      this.updateCardAudioCache(card.flashcardKey, {
        audioUrl: url,
        audioFileId,
        audioCloudPath,
        audioLocalPath: path || ''
      });
    } catch (error) {
      // Prefetch failure does not block manual playback.
    } finally {
      delete this.prefetchingAudioKeys[card.flashcardKey];
    }
  },
  async speakCurrent(options) {
    const silent = !!(options && options.auto);
    const requestedCard = options && options.card ? options.card : null;
    const current = requestedCard || this.data.current || {};
    if (this._flashcardAudioLoading) return;
    const audioRequestId = Number(this._flashcardAudioRequestId || 0) + 1;
    this._flashcardAudioRequestId = audioRequestId;
    if (!current.canSpeak) return;
    const audioText = current.word || current.phrase || current.displayText || '';
    if (!audioText) {
      this.setData({ audioCompleted: true });
      if (!silent) {
        wx.showToast({ title: text('noAudio', '暂无发音内容'), icon: 'none' });
      }
      return;
    }
    this.startCardAudioStartTimer(audioRequestId);
    const localAudioPath = current.audioLocalPath || getLocalAudioPath(current.flashcardKey);
    if (localFileExists(localAudioPath)) {
      this.playAudioUrl(localAudioPath, { silent });
      return;
    }
    if (canUseDictionaryVoice(audioText)) {
      const url = buildDictionaryVoiceUrl(audioText);
      this.playAudioUrl(url, { silent });
      this.updateCardAudioCache(current.flashcardKey, { audioUrl: url });
      downloadAudioToLocal(url, current.flashcardKey).then((path) => {
        if (path) this.updateCardAudioCache(current.flashcardKey, { audioLocalPath: path });
      });
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
        if (this._flashcardAudioRequestId !== audioRequestId) return;
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
    this._flashcardAudioLoading = true;
    this.setData({ audioLoading: true });
    try {
      const result = await store.synthesizeReadingAudio({ text: audioText });
      if (this._flashcardAudioRequestId !== audioRequestId) return;
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
      const nextState = {
        cards,
        library: [],
        libraryGroups: this.getRenderedLibraryGroups(library)
      };
      if (!requestedCard) {
        nextState.current = Object.assign({}, current, { audioUrl: url, audioFileId, audioCloudPath });
      }
      this.setData(nextState);
      this.playAudioUrl(url, { silent });
      downloadAudioToLocal(url, current.flashcardKey).then((path) => {
        if (path) this.updateCardAudioCache(current.flashcardKey, { audioLocalPath: path });
      });
    } catch (error) {
      if (this._flashcardAudioRequestId !== audioRequestId) return;
      if (!silent) {
        this.setData({ audioCompleted: true, libraryAudioKey: '' });
        wx.showToast({ title: text('pronunciationFailed', '发音失败，稍后重试'), icon: 'none' });
      } else {
        this.setData({ audioCompleted: true });
      }
    } finally {
      if (this._flashcardAudioRequestId === audioRequestId) {
        this.setData({ audioLoading: false });
        this._flashcardAudioLoading = false;
      }
    }
  },
  speakLibraryCard(event) {
    const flashcardKey = String((event.currentTarget.dataset || {}).key || '');
    const card = this.getFlashcardLibrary().find((item) => item && item.flashcardKey === flashcardKey);
    if (!card || !card.canSpeak) return;
    this.setData({ libraryAudioKey: flashcardKey });
    this.speakCurrent({ card });
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
    if (this.data.previewMode) return;
    const activeSourceId = this.data.activeSourceId || '';
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
    if (this.data.previewMode || !current || current.demo || !current.flashcardKey) return;
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
    if (this.data.previewMode) {
      this.pendingReviewQueue = [];
      this.forceFlushReviewQueue = false;
      return;
    }
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
    if (this.data.previewMode) return;
    const stats = this.vocabularySessionStats || {};
    if (!stats.reviewed || (!force && stats.reviewed % 5 !== 0)) return;
    if (this.lastVocabularyCompletionSyncedReviewed === stats.reviewed) return;
    this.lastVocabularyCompletionSyncedReviewed = stats.reviewed;
    const sourceTitle = this.data.activeSourceTitle || text('navTitle', '词汇复习');
    store.recordStudyCompletion({
      type: 'vocabulary',
      targetId: this.data.activeSourceId || 'daily-vocabulary',
      title: sourceTitle === text('myLibrary', '我的词库') ? text('navTitle', '词汇复习') : sourceTitle,
      meta: text('vocabulary', '词汇'),
      progressText: `${text('reviewProgress', '复习')} ${stats.reviewed}${text('cardUnit', ' 张')} · ${text('unfamiliarProgress', '不熟')} ${stats.unfamiliar || 0}${text('cardUnit', ' 张')}`,
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
    const reviewCompleted = !nextCard && reviewDone >= Number(this.data.reviewSessionTotal || 0);
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: nextCard,
      total: cards.length,
      reviewDone,
      reviewCompleted,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(nextCard),
      empty: !this.getFlashcardLibrary().length
    });
    if (shouldPersist) this.persistActiveSourceState();
    if (reviewCompleted) {
      const todayRepeatTotal = buildTodayPracticeCards(this.getFlashcardLibrary(), this.data.today).length;
      this.setData({
        todayRepeatTotal,
        repeatLimit: Math.min(Math.max(1, Number(this.data.repeatLimit || 1)), Math.max(1, todayRepeatTotal))
      });
      if (!this.data.repeatMode) {
        this.syncVocabularyCompletion(true);
        this.flushReviewQueue(true);
      }
      this.playCompletionSfx();
      this.scheduleDictationPrompt();
      return;
    }
    this.scheduleAutoSpeakCurrent();
    this.scheduleAudioPrefetchAroundCurrent();
  },
  scheduleDictationPrompt() {
    if (this.data.previewMode || !isBookSource(this.data.activeSourceId)) return;
    if (this.dictationPromptTimer) clearTimeout(this.dictationPromptTimer);
    this.setData({ dictationPromptPending: true });
    this.dictationPromptTimer = setTimeout(() => {
      this.dictationPromptTimer = null;
      if (this.data.reviewCompleted && isBookSource(this.data.activeSourceId)) {
        this.setData({
          dictationPromptVisible: true,
          dictationPromptPending: false,
          dictationJumping: false,
          dictationPromptSourceTitle: getDictationSourceTitle(this.data.activeSourceId, this.data.activeSourceTitle)
        });
      }
    }, 900);
  },
  dismissDictationPrompt() {
    if (this.data.dictationJumping) return;
    this.setData({ dictationPromptVisible: false, dictationPromptPending: false });
  },
  waitForReviewSync() {
    this.flushReviewQueue(true);
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const pending = this.pendingReviewQueue && this.pendingReviewQueue.length;
        if ((!this.reviewQueueFlushing && !pending) || Date.now() - startedAt >= 5000) {
          resolve();
          return;
        }
        setTimeout(check, 80);
      };
      check();
    });
  },
  async openCompletedDictation() {
    if (this.data.dictationJumping || !isBookSource(this.data.activeSourceId)) return;
    this.setData({ dictationJumping: true });
    await this.waitForReviewSync();
    const level = String(this.data.activeSourceId || '').replace(/^dictionary-book-/, '');
    const title = this.data.dictationPromptSourceTitle || getDictationSourceTitle(this.data.activeSourceId, this.data.activeSourceTitle);
    this.setData({ dictationPromptVisible: false, dictationPromptPending: false, dictationJumping: false });
    wx.navigateTo({ url: `/pages/reading/flashcards/dictation/index?level=${encodeURIComponent(level)}&title=${encodeURIComponent(title)}` });
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
    this.scheduleAudioPrefetchAroundCurrent();
  },
  startReview() {
    const cards = buildReviewQueue(this.getFlashcardLibrary(), this.data.settings, this.data.today);
    const current = cards[0] || null;
    const previewMode = store.getDeviceStudyRole() !== 'student';
    if (previewMode) {
      this.previewSourceSnapshot = {
        library: this.getFlashcardLibrary().map((item) => Object.assign({}, item)),
        settings: Object.assign({}, this.data.settings),
        today: this.data.today,
        logs: (this.data.logs || []).slice(),
        dictionaryBooks: (this.data.dictionaryBooks || []).map((item) => Object.assign({}, item))
      };
    }
    this.setData({
      sourceMode: 'library',
      mode: 'review',
      cards,
      currentIndex: 0,
      current,
      reviewDone: 0,
      reviewSessionTotal: cards.length,
      reviewCompleted: false,
      repeatMode: false,
      total: cards.length,
      dueCount: cards.length,
      newDueCount: cards.filter((item) => item.status === 'new').length,
      reviewDueCount: cards.filter((item) => item.status !== 'new').length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(current),
      previewMode
    });
    this.vocabularySessionStats = null;
    this.lastVocabularyCompletionSyncedReviewed = 0;
    this.scheduleAutoSpeakCurrent();
    this.scheduleAudioPrefetchAroundCurrent();
  },
  exitReview() {
    if (this.data.dictationPromptPending || this.data.dictationPromptVisible) return;
    if (this.dictationPromptTimer) {
      clearTimeout(this.dictationPromptTimer);
      this.dictationPromptTimer = null;
    }
    if (!this.data.repeatMode) {
      this.syncVocabularyCompletion(true);
      this.flushReviewQueue(true);
    }
    if (this.data.previewMode && this.previewSourceSnapshot) {
      const snapshot = this.previewSourceSnapshot;
      this.previewSourceSnapshot = null;
      const restored = this.buildFlashcardData(snapshot, this.data.activeSourceId || '', snapshot);
      this.applyFlashcardData(Object.assign({}, restored, {
        mode: 'library',
        reviewCompleted: false
      }));
      return;
    }
    this.setData({ mode: 'library', reviewCompleted: false, repeatMode: false, dictationPromptVisible: false, dictationPromptPending: false, dictationJumping: false });
  },
  changeRepeatLimit(event) {
    const total = Math.max(1, Number(this.data.todayRepeatTotal || 1));
    const delta = Number(event.currentTarget.dataset.delta || 0);
    this.setData({ repeatLimit: Math.max(1, Math.min(total, Number(this.data.repeatLimit || 1) + delta)) });
  },
  handleRepeatSlider(event) {
    const total = Math.max(1, Number(this.data.todayRepeatTotal || 1));
    const value = Math.max(1, Math.min(total, Number(event.detail.value || 1)));
    if (value !== this.data.repeatLimit) this.setData({ repeatLimit: value });
  },
  startTodayRepeat() {
    const repeatPerf = page.startPagePerf('flashcards-repeat');
    const available = buildTodayPracticeCards(this.getFlashcardLibrary(), this.data.today);
    const limit = Math.max(1, Math.min(available.length, Number(this.data.repeatLimit || 1)));
    const cards = available.slice(0, limit);
    const current = cards[0] || null;
    if (!current) return;
    this.setData({
      sourceMode: 'library',
      mode: 'review',
      repeatMode: true,
      repeatSessionId: String(Date.now()),
      cards,
      currentIndex: 0,
      current,
      reviewDone: 0,
      reviewSessionTotal: cards.length,
      reviewCompleted: false,
      total: cards.length,
      newDueCount: 0,
      reviewDueCount: cards.length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      audioPlaying: false,
      audioCompleted: isAudioCompletedForCard(current)
    }, () => {
      repeatPerf.ready('pageReady', {
        cacheHit: true,
        source: 'memory',
        total: cards.length
      });
      this.scheduleAutoSpeakCurrent();
      this.scheduleAudioPrefetchAroundCurrent();
    });
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
    this.cancelCurrentAudio();
    const nextResult = typeof result === 'string' ? result : (this.data.cardChoice || 'remembered');
    if (this.data.repeatMode) {
      if (nextResult === 'unfamiliar') {
        this.repeatCurrentCard(false);
      } else {
        this.advanceVisibleCards(false);
      }
      return;
    }
    if (!this.data.previewMode) {
      const checkinDays = writeVocabularyCheckinDay(this.data.today);
      this.setData({
        reviewDays: Object.keys(checkinDays).length,
        vocabCheckinDays: Object.keys(checkinDays).length
      });
    }
    if (nextResult === 'unfamiliar') {
      if (!current.demo) {
        this.recordVocabularyResult(nextResult, current);
        this.updateCurrentReviewState(current, nextResult);
        this.syncReviewToCloud(current, nextResult);
      }
      this.repeatCurrentCard(!this.data.previewMode);
      return;
    }
    if (current.demo) {
      this.advanceVisibleCards(false);
      return;
    }
    this.updateCurrentReviewState(current, nextResult);
    this.syncReviewToCloud(current, nextResult);
    this.recordVocabularyResult(nextResult, current);
    this.advanceVisibleCards(!this.data.previewMode);
  }
});
