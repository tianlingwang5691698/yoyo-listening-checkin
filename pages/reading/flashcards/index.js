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

const LIMIT_MIN = 5;
const LIMIT_DEFAULT_MAX = 500;
const LIMIT_STEP = 5;

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

function readSourceCache(sourceId) {
  try {
    const cached = wx.getStorageSync(getSourceCacheKey(sourceId));
    if (!cached || Date.now() - Number(cached.cachedAt || 0) > FLASHCARD_SOURCE_CACHE_TTL) return null;
    return cached.data || null;
  } catch (error) {
    return null;
  }
}

function writeSourceCache(sourceId, data) {
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
    loading: false,
    audioLoading: false,
    navStyle: '',
    pageTopStyle: ''
  }),
  onUnload() {
    if (this.flashcardAudioContext) {
      this.flashcardAudioContext.destroy();
      this.flashcardAudioContext = null;
    }
  },
  onShow() {
    page.syncTheme(this);
    this.setData(getNavLayout());
    this.loadCards();
  },
  async loadCards() {
    this.setData({ loading: true });
    const activeSourceId = this.data.activeSourceId || '';
    const cached = readSourceCache(activeSourceId);
    if (cached) {
      this.setData(Object.assign({}, cached, { loading: false }));
    }
    const data = await store.getFlashcardReview();
    const rawLibrary = data.library && data.library.length ? data.library : DEMO_FLASHCARDS;
    let library = filterBySource(rawLibrary, activeSourceId).map(normalizeCard);
    const demoMode = rawLibrary === DEMO_FLASHCARDS;
    const settings = {
      newLimit: normalizeLimit((data.settings || {}).newLimit == null ? 10 : data.settings.newLimit),
      reviewLimit: normalizeLimit((data.settings || {}).reviewLimit == null ? 20 : data.settings.reviewLimit)
    };
    if (activeSourceId && !library.length && cached && cached.library && cached.library.length) {
      library = cached.library.map(normalizeCard);
    }
    const sourceSettings = readPlanSettings(activeSourceId, settings);
    const effectiveSettings = getEffectiveSettings(sourceSettings, library, activeSourceId);
    const limitOptions = buildLimitOptions(library.length || LIMIT_DEFAULT_MAX);
    const cards = (activeSourceId
      ? buildDueCards(library, effectiveSettings, data.today)
      : ((data.cards && data.cards.length ? data.cards : rawLibrary).map(normalizeCard)));
    const nextData = {
      library,
      libraryGroups: groupLibrary(library),
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
      progress: demoMode
        ? { total: library.length, mastered: 0, reviewing: 0, fresh: library.length }
        : {
          total: library.length,
          mastered: library.filter((item) => item.status === 'mastered').length,
          reviewing: library.filter((item) => item.status === 'reviewing').length,
          fresh: library.filter((item) => item.status === 'new').length
        },
      reviewDays: Number((data.progress && data.progress.reviewDays) || countLogDays(data.logs || [])),
      logs: data.logs || [],
      dictionaryBooks: (data.dictionaryBooks && data.dictionaryBooks.length ? data.dictionaryBooks : DEFAULT_DICTIONARY_BOOKS).map(normalizeBook),
      demoMode,
      loading: false
    };
    this.setData(nextData);
    writeSourceCache(activeSourceId, nextData);
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
    if (cached || book.imported) {
      await this.loadCards();
    } else {
      this.setData({
        loading: true,
        library: [],
        libraryGroups: [],
        empty: false,
        stats: { all: 0, word: 0, phrase: 0, pattern: 0 }
      });
    }
    if (!book.imported && !this.data.library.length) {
      try {
        const localCards = await loadBookCardsFromStorage(book);
        const sourceSettings = readPlanSettings(sourceId, this.data.settings);
        const effectiveSettings = getEffectiveSettings(sourceSettings, localCards, sourceId);
        const limitOptions = buildLimitOptions(localCards.length);
        const cards = buildDueCards(localCards, effectiveSettings, this.data.today);
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
          progress: {
            total: localCards.length,
            mastered: 0,
            reviewing: 0,
            fresh: localCards.length
          },
          demoMode: false,
          loading: false
        };
        this.setData(nextData);
        writeSourceCache(sourceId, nextData);
      } catch (error) {
        wx.showToast({ title: '词书读取失败', icon: 'none' });
      }
    }
    if (book.imported) return;
    try {
      let offset = 0;
      let done = false;
      while (!done) {
        const result = await store.addDictionaryBook(level, { offset, limit: 80 });
        if (!result.saved) throw new Error('dictionary-book-import-failed');
        offset = Number(result.nextOffset || 0);
        done = !!result.done;
        await this.loadCards();
      }
      wx.showToast({ title: '计划已建立', icon: 'none' });
    } catch (error) {
      // 本机计划已可用时，不再打扰用户。
    } finally {
      this.setData({ importingBook: '' });
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
    const nextValue = normalizeLimit(currentValue + delta, this.data.library.length);
    if (nextValue === currentValue) return;
    await this.saveLimit(field, nextValue);
  },
  openLimitPicker(event) {
    const field = event.currentTarget.dataset.field;
    const selectedLimitIndex = getLimitIndex(this.data.settings[field], this.data.library.length);
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
    const settings = Object.assign({}, this.data.settings, {
      [field]: normalizeLimit(nextValue, this.data.library.length)
    });
    const planState = buildPlanState(this.data.library || [], settings, this.data.today);
    const nextData = Object.assign({
      settings,
      newLimitIndex: getLimitIndex(settings.newLimit, this.data.library.length),
      reviewLimitIndex: getLimitIndex(settings.reviewLimit, this.data.library.length)
    }, planState);
    this.setData(nextData);
    writePlanSettings(this.data.activeSourceId || '', settings);
    if (!this.data.activeSourceId) {
      await store.saveFlashcardSettings(settings);
    }
  },
  playAudioUrl(url) {
    if (!url) return;
    if (!this.flashcardAudioContext) {
      this.flashcardAudioContext = wx.createInnerAudioContext();
      this.flashcardAudioContext.obeyMuteSwitch = false;
      this.flashcardAudioContext.onError(() => {
        wx.showToast({ title: '播放失败，稍后再试', icon: 'none' });
      });
    }
    this.flashcardAudioContext.stop();
    this.flashcardAudioContext.src = url;
    this.flashcardAudioContext.play();
  },
  async speakCurrent() {
    const current = this.data.current || {};
    if (!current.canSpeak) return;
    const text = current.word || current.phrase || current.displayText || '';
    if (!text) {
      wx.showToast({ title: '暂无发音内容', icon: 'none' });
      return;
    }
    if (current.audioUrl) {
      this.playAudioUrl(current.audioUrl);
      return;
    }
    if (current.audioFileId) {
      try {
        const url = await store.getTempFileURL(current.audioFileId);
        if (url) {
          this.playAudioUrl(url);
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
      const library = (this.data.library || []).map((item) => (
        item.flashcardKey === current.flashcardKey ? Object.assign({}, item, { audioUrl: url, audioFileId, audioCloudPath }) : item
      ));
      this.setData({
        cards,
        library,
        libraryGroups: groupLibrary(library),
        current: Object.assign({}, current, { audioUrl: url, audioFileId, audioCloudPath })
      });
      this.playAudioUrl(url);
    } catch (error) {
      if (canUseDictionaryVoice(text)) {
        this.playAudioUrl(buildDictionaryVoiceUrl(text));
      } else {
        wx.showToast({ title: '发音失败，稍后重试', icon: 'none' });
      }
    } finally {
      this.setData({ audioLoading: false });
      this._flashcardAudioLoading = false;
    }
  },
  advanceVisibleCards() {
    const cards = this.data.cards.slice();
    cards.splice(this.data.currentIndex, 1);
    const nextIndex = Math.min(this.data.currentIndex, Math.max(cards.length - 1, 0));
    const reviewDone = Math.min(Number(this.data.reviewDone || 0) + 1, Number(this.data.reviewSessionTotal || 0));
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: cards[nextIndex] || null,
      total: cards.length,
      reviewDone,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: '',
      empty: !this.data.library.length
    });
  },
  repeatCurrentCard() {
    const cards = this.data.cards.slice();
    const current = cards[this.data.currentIndex];
    if (!current) return;
    cards.splice(this.data.currentIndex, 1);
    cards.push(current);
    const nextIndex = Math.min(this.data.currentIndex, Math.max(cards.length - 1, 0));
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: cards[nextIndex] || null,
      total: cards.length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: ''
    });
  },
  startReview() {
    this.setData({
      sourceMode: 'library',
      mode: 'review',
      currentIndex: 0,
      current: this.data.cards[0] || null,
      reviewDone: 0,
      reviewSessionTotal: this.data.cards.length,
      cardRevealed: false,
      cardChoice: '',
      previousCardChoice: ''
    });
  },
  exitReview() {
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
    const nextResult = typeof result === 'string' ? result : (this.data.cardChoice || 'remembered');
    if (nextResult === 'unfamiliar') {
      if (!current.demo && !current.localBook) {
        try {
          await store.updateFlashcardReview(current.flashcardKey, 'unfamiliar');
        } catch (error) {}
      }
      this.repeatCurrentCard();
      return;
    }
    if (current.demo || current.localBook) {
      this.advanceVisibleCards();
      return;
    }
    await store.updateFlashcardReview(current.flashcardKey, nextResult);
    this.advanceVisibleCards();
  }
});
