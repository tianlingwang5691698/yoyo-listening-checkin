const page = require('../../../utils/page');

const FLASHCARD_ITEM_KEYS = [
  'listeningFlashcardItemsV1',
  'readingFlashcardItemsV1',
  'grammarFlashcardItemsV1',
  'writingFlashcardItemsV1',
  'speakingFlashcardItemsV1'
];

const DEFAULT_FLASHCARD_ITEMS_KEY = FLASHCARD_ITEM_KEYS[0];

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayString() {
  return formatDate(Date.now());
}

function tomorrowString() {
  return formatDate(Date.now() + 24 * 60 * 60 * 1000);
}

function normalizeCard(item, index) {
  return Object.assign({}, item, {
    displayText: item.text || item.word || item.phrase || '',
    typeLabel: item.type === 'phrase' ? '短语' : '单词',
    index: index + 1
  });
}

function readItems() {
  const seen = {};
  return FLASHCARD_ITEM_KEYS.reduce((list, sourceKey) => {
    let items = [];
    try {
      items = wx.getStorageSync(sourceKey) || [];
    } catch (error) {
      items = [];
    }
    items.forEach((item) => {
      if (!item) return;
      const flashcardKey = item.flashcardKey || `${item.type || 'word'}:${item.text || item.word || item.phrase || ''}`;
      if (!flashcardKey || seen[flashcardKey]) return;
      seen[flashcardKey] = true;
      list.push(Object.assign({}, item, {
        flashcardKey,
        sourceKey
      }));
    });
    return list;
  }, []);
}

function writeItems(items) {
  const grouped = {};
  FLASHCARD_ITEM_KEYS.forEach((key) => {
    grouped[key] = [];
  });
  items.forEach((item) => {
    const sourceKey = item.sourceKey || DEFAULT_FLASHCARD_ITEMS_KEY;
    const stored = Object.assign({}, item);
    delete stored.sourceKey;
    if (!grouped[sourceKey]) grouped[sourceKey] = [];
    grouped[sourceKey].push(stored);
  });
  Object.keys(grouped).forEach((key) => {
    wx.setStorageSync(key, grouped[key]);
  });
}

Page({
  data: page.createCloudPageData({
    cards: [],
    current: null,
    currentIndex: 0,
    total: 0,
    empty: false
  }),
  onShow() {
    page.syncTheme(this);
    this.loadCards();
  },
  loadCards() {
    const today = todayString();
    const cards = readItems()
      .filter((item) => item && item.familiarLevel !== 'mastered' && (!item.nextReviewDate || item.nextReviewDate <= today))
      .map(normalizeCard);
    this.setData({
      cards,
      currentIndex: 0,
      current: cards[0] || null,
      total: cards.length,
      empty: !cards.length
    });
  },
  speakCurrent() {
    const current = this.data.current || {};
    if (!current.audioUrl) {
      wx.showToast({ title: '暂无发音音频', icon: 'none' });
      return;
    }
    const audio = wx.createInnerAudioContext();
    audio.src = current.audioUrl;
    audio.play();
  },
  advanceVisibleCards() {
    const cards = this.data.cards.slice();
    cards.splice(this.data.currentIndex, 1);
    const nextIndex = Math.min(this.data.currentIndex, Math.max(cards.length - 1, 0));
    this.setData({
      cards,
      currentIndex: nextIndex,
      current: cards[nextIndex] || null,
      total: cards.length,
      empty: !cards.length
    });
  },
  markRemembered() {
    const current = this.data.current;
    if (!current || !current.flashcardKey) return;
    const items = readItems().map((item) => {
      if (item.flashcardKey !== current.flashcardKey) return item;
      const schedule = Array.isArray(item.reviewSchedule) ? item.reviewSchedule : [];
      const currentStep = Number(item.reviewStep || 0);
      const reviewSchedule = schedule.map((slot) => (
        Number(slot.step) === currentStep
          ? Object.assign({}, slot, { done: true, doneAt: Date.now() })
          : slot
      ));
      const nextSlot = reviewSchedule.find((slot) => Number(slot.step) > currentStep && !slot.done);
      return Object.assign({}, item, {
        reviewSchedule,
        reviewStep: nextSlot ? Number(nextSlot.step) : currentStep,
        nextReviewDate: nextSlot ? nextSlot.date : '',
        familiarLevel: nextSlot ? 'reviewing' : 'mastered',
        updatedAt: Date.now()
      });
    });
    writeItems(items);
    this.advanceVisibleCards();
  },
  markUnfamiliar() {
    const current = this.data.current;
    if (!current || !current.flashcardKey) return;
    const items = readItems().map((item) => (
      item.flashcardKey === current.flashcardKey
        ? Object.assign({}, item, {
          familiarLevel: 'unfamiliar',
          nextReviewDate: tomorrowString(),
          updatedAt: Date.now()
        })
        : item
    ));
    writeItems(items);
    this.advanceVisibleCards();
  }
});
