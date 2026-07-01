const page = require('../../../utils/page');
const store = require('../../../utils/store');

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

const LIMIT_MIN = 5;
const LIMIT_MAX = 500;
const LIMIT_STEP = 5;
const LIMIT_OPTIONS = Array.from({ length: LIMIT_MAX / LIMIT_STEP }, (_, index) => (index + 1) * LIMIT_STEP);

function normalizeLimit(value) {
  const numericValue = Number(value || 0);
  const steppedValue = Math.round(numericValue / LIMIT_STEP) * LIMIT_STEP;
  return Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, steppedValue || LIMIT_MIN));
}

function getLimitIndex(value) {
  return Math.max(0, LIMIT_OPTIONS.indexOf(normalizeLimit(value)));
}

function getLimitItemHeightPx() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo.windowWidth * 84 / 750;
  } catch (error) {
    return 42;
  }
}

function normalizeCard(item, index) {
  const type = item.type || (item.pattern ? 'pattern' : (item.phrase ? 'phrase' : 'word'));
  return Object.assign({}, item, {
    type,
    displayText: item.text || item.word || item.phrase || item.pattern || '',
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
    dueCount: 0,
    newDueCount: 0,
    reviewDueCount: 0,
    settings: { newLimit: 10, reviewLimit: 20 },
    limitOptions: LIMIT_OPTIONS,
    newLimitIndex: getLimitIndex(10),
    reviewLimitIndex: getLimitIndex(20),
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
    audioLoading: false
  }),
  onUnload() {
    if (this.flashcardAudioContext) {
      this.flashcardAudioContext.destroy();
      this.flashcardAudioContext = null;
    }
  },
  onShow() {
    page.syncTheme(this);
    this.loadCards();
  },
  async loadCards() {
    this.setData({ loading: true });
    const data = await store.getFlashcardReview();
    const rawLibrary = data.library && data.library.length ? data.library : DEMO_FLASHCARDS;
    const rawCards = data.cards && data.cards.length ? data.cards : rawLibrary;
    const library = rawLibrary.map(normalizeCard);
    const cards = rawCards.map(normalizeCard);
    const demoMode = rawLibrary === DEMO_FLASHCARDS;
    const settings = {
      newLimit: normalizeLimit((data.settings || {}).newLimit == null ? 10 : data.settings.newLimit),
      reviewLimit: normalizeLimit((data.settings || {}).reviewLimit == null ? 20 : data.settings.reviewLimit)
    };
    this.setData({
      library,
      libraryGroups: groupLibrary(library),
      cards,
      currentIndex: 0,
      current: cards[0] || null,
      total: cards.length,
      empty: !library.length,
      stats: countByType(library),
      dueCount: demoMode ? cards.length : (data.dueCount || 0),
      newDueCount: demoMode ? cards.length : (data.newDueCount || 0),
      reviewDueCount: data.reviewDueCount || 0,
      settings,
      newLimitIndex: getLimitIndex(settings.newLimit),
      reviewLimitIndex: getLimitIndex(settings.reviewLimit),
      progress: demoMode
        ? { total: library.length, mastered: 0, reviewing: 0, fresh: library.length }
        : Object.assign({ total: 0, mastered: 0, reviewing: 0, fresh: 0 }, data.progress || {}),
      reviewDays: Number((data.progress && data.progress.reviewDays) || countLogDays(data.logs || [])),
      logs: data.logs || [],
      demoMode,
      loading: false
    });
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
    const nextValue = normalizeLimit(currentValue + delta);
    if (nextValue === currentValue) return;
    await this.saveLimit(field, nextValue);
  },
  openLimitPicker(event) {
    const field = event.currentTarget.dataset.field;
    const selectedLimitIndex = getLimitIndex(this.data.settings[field]);
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
    const index = Math.max(0, Math.min(LIMIT_OPTIONS.length - 1, Math.round(Number(event.detail.scrollTop || 0) / getLimitItemHeightPx())));
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
    const nextValue = LIMIT_OPTIONS[this.data.selectedLimitIndex] || LIMIT_MIN;
    this.setData({ limitPickerVisible: false });
    if (!field || nextValue === Number(this.data.settings[field] || 0)) return;
    await this.saveLimit(field, nextValue);
  },
  async saveLimit(field, nextValue) {
    const settings = Object.assign({}, this.data.settings, {
      [field]: nextValue
    });
    this.setData({
      settings,
      newLimitIndex: getLimitIndex(settings.newLimit),
      reviewLimitIndex: getLimitIndex(settings.reviewLimit)
    });
    await store.saveFlashcardSettings(settings);
    this.loadCards();
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
    const text = current.displayText || current.text || current.word || current.phrase || current.pattern || '';
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
      if (!current.demo) {
        try {
          await store.updateFlashcardReview(current.flashcardKey, 'unfamiliar');
        } catch (error) {}
      }
      this.repeatCurrentCard();
      return;
    }
    if (current.demo) {
      this.advanceVisibleCards();
      return;
    }
    await store.updateFlashcardReview(current.flashcardKey, nextResult);
    this.advanceVisibleCards();
  }
});
