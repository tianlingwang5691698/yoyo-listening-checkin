const page = require('../../../../../utils/page');
const store = require('../../../../../utils/store');
const i18n = require('../../../../../utils/i18n');

function getNavLayout() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = Number(systemInfo.statusBarHeight || 0);
    const navBarHeight = menu && menu.height ? (menu.top - statusBarHeight) * 2 + menu.height : 44;
    const navHeight = statusBarHeight + navBarHeight;
    return { navStyle: `height:${navHeight}px;padding-top:${statusBarHeight}px;`, pageTopStyle: `padding-top:${navHeight + 16}px;` };
  } catch (error) {
    return { navStyle: 'height:88px;padding-top:44px;', pageTopStyle: 'padding-top:112px;' };
  }
}

function getTexts() {
  return i18n.getPageTexts('vocabularyDictation');
}

function sourceItems(texts) {
  return [
    { key: 'junior', mark: texts.juniorMark || '初', title: texts.juniorBookShort, meta: texts.randomWords },
    { key: 'senior', mark: texts.seniorMark || '高', title: texts.seniorBookShort, meta: texts.randomWords },
    { key: 'unlock', mark: 'U', title: texts.unlockBookShort, meta: 'Level 1–4 · Unit 1–8' }
  ];
}

function levelItems() {
  return [1, 2, 3, 4].map((level) => ({ key: String(level), mark: String(level), title: `Unlock ${level}`, meta: 'Unit 1–8' }));
}

function unitItems() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((unit) => ({ key: String(unit), mark: `U${unit}`, title: `Unit ${unit}`, meta: 'LS / RW' }));
}

Page({
  data: page.createCloudPageData({
    stage: 'sources',
    unlockLevel: 0,
    unlockUnit: 0,
    title: '',
    subtitle: '',
    items: [],
    loadingKey: '',
    countsLoaded: false,
    debugLines: [],
    navStyle: '',
    pageTopStyle: ''
  }),
  onLoad() {
    this.perf = page.startPagePerf('vocabulary-dictation-library');
    page.syncTheme(this);
    const texts = getTexts();
    this.setData(Object.assign({}, getNavLayout(), { title: texts.shelfTitle, subtitle: texts.shelfCopy, items: sourceItems(texts) }), () => this.perf.ready('pageReady', { stage: 'sources', total: 3, cacheHit: true }));
    this.loadCounts();
  },
  onShow() {
    page.syncTheme(this);
    if (this.data.loadingKey) this.setData({ loadingKey: '' });
    this.localizeCurrentStage();
  },
  handleBack() {
    if (this.data.stage === 'sections') {
      this.showUnits(this.data.unlockLevel);
      return;
    }
    if (this.data.stage === 'units') {
      this.showLevels();
      return;
    }
    if (this.data.stage === 'levels') {
      this.showSources();
      return;
    }
    wx.navigateBack({ delta: 1 });
  },
  chooseItem(event) {
    const key = String(event.currentTarget.dataset.key || '');
    if (this.data.stage === 'sources') {
      if (key === 'unlock') this.showLevels();
      else this.openBook(key, key === 'junior' ? getTexts().juniorBookShort : getTexts().seniorBookShort);
      return;
    }
    if (this.data.stage === 'levels') {
      this.showUnits(Number(key));
      return;
    }
    if (this.data.stage === 'units') {
      this.showSections(this.data.unlockLevel, Number(key));
      return;
    }
    const level = `unlock-${this.data.unlockLevel}-u${this.data.unlockUnit}-${key}`;
    this.openBook(level, `Unlock ${this.data.unlockLevel} · Unit ${this.data.unlockUnit} · ${key.toUpperCase()}`);
  },
  async loadCounts() {
    const result = await store.getVocabularyDictationSourceCounts();
    if (result.syncMode === 'cloud-error') {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ debugLines: [
        `DEBUG: reading/flashcards/dictation/library.loadCounts -> store.getVocabularyDictationSourceCounts -> cloud.getVocabularyDictationSourceCounts.counts：${result.counts && typeof result.counts === 'object' ? 'object' : 'missing'}`,
        `targetChildId=${target.targetChildId || 'self'}；syncMode=${result.syncMode || 'unknown'}；cloudError.message=${result.cloudError && result.cloudError.message || 'missing'}`
      ] });
      return;
    }
    this.sourceCounts = result.counts || {};
    this.setData({ countsLoaded: true, debugLines: [], items: this.withCounts(this.data.items, this.data.stage) });
  },
  withCounts(items, stage) {
    const counts = this.sourceCounts || {};
    const sumPrefix = (prefix) => Object.keys(counts).filter((key) => key.indexOf(prefix) === 0).reduce((sum, key) => sum + Number(counts[key] || 0), 0);
    return (items || []).map((item) => {
      let learnedCount = 0;
      if (stage === 'sources') {
        learnedCount = item.key === 'unlock' ? sumPrefix('dictionary-book-unlock-') : Number(counts[`dictionary-book-${item.key}`] || 0);
      } else if (stage === 'levels') {
        learnedCount = sumPrefix(`dictionary-book-unlock-${item.key}-`);
      } else if (stage === 'units') {
        learnedCount = sumPrefix(`dictionary-book-unlock-${this.data.unlockLevel}-u${item.key}-`);
      } else if (stage === 'sections') {
        learnedCount = Number(counts[`dictionary-book-unlock-${this.data.unlockLevel}-u${this.data.unlockUnit}-${item.key}`] || 0);
      }
      return Object.assign({}, item, { learnedCount });
    });
  },
  showSources() {
    const texts = getTexts();
    this.setData({ stage: 'sources', title: texts.shelfTitle, subtitle: texts.shelfCopy, unlockLevel: 0, unlockUnit: 0, items: this.withCounts(sourceItems(texts), 'sources') });
  },
  showLevels() {
    const texts = getTexts();
    this.setData({ stage: 'levels', title: texts.unlockBookShort, subtitle: texts.chooseLevel, unlockLevel: 0, unlockUnit: 0, items: this.withCounts(levelItems(), 'levels') });
  },
  showUnits(level) {
    this.setData({ stage: 'units', title: `Unlock ${level}`, subtitle: getTexts().chooseUnit, unlockLevel: level, unlockUnit: 0 }, () => this.setData({ items: this.withCounts(unitItems(), 'units') }));
  },
  showSections(level, unit) {
    const texts = getTexts();
    const items = [
      { key: 'ls', mark: 'LS', title: texts.lsList, meta: `Unlock ${level} Unit ${unit}` },
      { key: 'rw', mark: 'RW', title: texts.rwList, meta: `Unlock ${level} Unit ${unit}` }
    ];
    this.setData({ stage: 'sections', title: `Unlock ${level} · Unit ${unit}`, subtitle: texts.chooseList, unlockLevel: level, unlockUnit: unit }, () => this.setData({ items: this.withCounts(items, 'sections') }));
  },
  localizeCurrentStage() {
    if (this.data.stage === 'levels') this.showLevels();
    else if (this.data.stage === 'units') this.showUnits(this.data.unlockLevel);
    else if (this.data.stage === 'sections') this.showSections(this.data.unlockLevel, this.data.unlockUnit);
    else this.showSources();
  },
  openBook(level, title) {
    if (!level || this.data.loadingKey) return;
    const sourceId = `dictionary-book-${level}`;
    const selected = (this.data.items || []).find((item) => String(item.key) === String(level).split('-').pop()) || null;
    if (this.data.countsLoaded && selected && !Number(selected.learnedCount || 0)) {
      wx.showToast({ title: getTexts().noLearned, icon: 'none' });
      return;
    }
    this.setData({ loadingKey: level, debugLines: [] });
    wx.navigateTo({ url: `/pages/reading/flashcards/dictation/index?level=${encodeURIComponent(level)}&title=${encodeURIComponent(title)}` });
  },
  openHistory() {
    wx.navigateTo({ url: '/pages/practice-history/index?type=vocabulary' });
  }
});
