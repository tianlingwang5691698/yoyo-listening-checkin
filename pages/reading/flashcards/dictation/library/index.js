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
    { key: 'cet4', mark: texts.cet4Mark || '四', title: texts.cet4BookShort, meta: texts.randomWords },
    { key: 'ielts', mark: texts.ieltsMark || '雅', title: texts.ieltsBookShort, meta: texts.randomWords },
    { key: 'unlock-v2', mark: 'U2', title: texts.unlockSecondBook || 'Unlock 第二版词汇书', meta: 'Level 1–4 · Unit 1–8' },
    { key: 'unlock-v3', mark: 'U3', title: texts.unlockThirdBook || 'Unlock 第三版词汇书', meta: 'Level 1–4 · Unit 1–8' }
  ];
}

function unlockLevelKey(edition, level, unit, section) {
  return edition === 'v3' ? `unlock-v3-${level}-u${unit}-${section}` : `unlock-${level}-u${unit}-${section}`;
}

function unlockCountPrefix(edition, level, unit) {
  const base = edition === 'v3' ? 'dictionary-book-unlock-v3-' : 'dictionary-book-unlock-';
  return `${base}${level == null ? '' : `${level}-`}${unit == null ? '' : `u${unit}-`}`;
}

function levelItems() {
  return [1, 2, 3, 4].map((level) => ({ key: String(level), mark: String(level), title: `Unlock ${level}`, meta: 'Unit 1–8' }));
}

function unitItems() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((unit) => ({ key: String(unit), mark: `U${unit}`, title: `Unit ${unit}`, meta: 'LS / RW' }));
}

function standardListItems(stage) {
  const count = stage === 'junior' ? 32 : (stage === 'senior' ? 40 : (stage === 'cet4' ? 35 : 48));
  const titles = { junior: getTexts().juniorBookShort, senior: getTexts().seniorBookShort, cet4: getTexts().cet4BookShort, ielts: getTexts().ieltsBookShort };
  return Array.from({ length: count }, (_, index) => ({ key: String(index + 1), mark: `L${index + 1}`, title: `List ${index + 1}`, meta: titles[stage] }));
}

Page({
  data: page.createCloudPageData({
    stage: 'sources',
    unlockEdition: 'v2',
    unlockLevel: 0,
    unlockUnit: 0,
    standardStage: '',
    practiceMode: 'dictation',
    navTitle: '',
    kicker: '',
    showRecords: true,
    title: '',
    subtitle: '',
    items: [],
    loadingKey: '',
    countsLoaded: false,
    debugLines: [],
    navStyle: '',
    pageTopStyle: ''
  }),
  onLoad(options) {
    this.perf = page.startPagePerf('vocabulary-dictation-library');
    page.syncTheme(this);
    const texts = getTexts();
    const practiceMode = ['word-meaning', 'audio-meaning'].includes(String(options.practiceMode || '')) ? String(options.practiceMode) : 'dictation';
    const isDictation = practiceMode === 'dictation';
    this.setData(Object.assign({}, getNavLayout(), {
      practiceMode,
      navTitle: isDictation ? texts.shelfTitle : texts.practiceShelfTitle,
      kicker: isDictation ? 'LISTEN · SPELL · REVIEW' : 'CHOOSE A WORD LIST',
      showRecords: isDictation,
      title: isDictation ? texts.shelfTitle : texts.practiceShelfTitle,
      subtitle: isDictation ? texts.shelfCopy : texts.practiceShelfCopy,
      items: sourceItems(texts)
    }), () => this.perf.ready('pageReady', { stage: 'sources', total: 6, cacheHit: true, practiceMode }));
    this.loadCounts();
  },
  onShow() {
    page.syncTheme(this);
    if (this.data.loadingKey) this.setData({ loadingKey: '' });
    this.localizeCurrentStage();
  },
  handleBack() {
    if (this.data.stage === 'standard-lists') {
      this.showSources();
      return;
    }
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
      if (key === 'unlock-v2' || key === 'unlock-v3') this.showLevels(key === 'unlock-v3' ? 'v3' : 'v2');
      else this.showStandardLists(key);
      return;
    }
    if (this.data.stage === 'standard-lists') {
      const title = { junior: getTexts().juniorBookShort, senior: getTexts().seniorBookShort, cet4: getTexts().cet4BookShort, ielts: getTexts().ieltsBookShort }[this.data.standardStage];
      this.openBook(`${this.data.standardStage}-list-${key}`, `${title} · List ${key}`);
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
    const level = unlockLevelKey(this.data.unlockEdition, this.data.unlockLevel, this.data.unlockUnit, key);
    this.openBook(level, `Unlock ${this.data.unlockLevel} ${this.data.unlockEdition === 'v3' ? '第三版' : '第二版'} · Unit ${this.data.unlockUnit} · ${key.toUpperCase()}`);
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
  withCounts(items, stage, standardStage) {
    const counts = this.sourceCounts || {};
    const sumPrefix = (prefix) => Object.keys(counts).filter((key) => key.indexOf(prefix) === 0).reduce((sum, key) => sum + Number(counts[key] || 0), 0);
    return (items || []).map((item) => {
      let learnedCount = 0;
      if (stage === 'sources') {
        if (item.key === 'unlock-v2') learnedCount = Object.keys(counts).filter((key) => /^dictionary-book-unlock-[1-4]-/.test(key)).reduce((sum, key) => sum + Number(counts[key] || 0), 0);
        else if (item.key === 'unlock-v3') learnedCount = sumPrefix('dictionary-book-unlock-v3-');
        else learnedCount = sumPrefix(`dictionary-book-${item.key}-list-`);
      } else if (stage === 'standard-lists') {
        learnedCount = Number(counts[`dictionary-book-${standardStage || this.data.standardStage}-list-${item.key}`] || 0);
      } else if (stage === 'levels') {
        learnedCount = sumPrefix(unlockCountPrefix(this.data.unlockEdition, item.key));
      } else if (stage === 'units') {
        learnedCount = sumPrefix(unlockCountPrefix(this.data.unlockEdition, this.data.unlockLevel, item.key));
      } else if (stage === 'sections') {
        learnedCount = Number(counts[`dictionary-book-${unlockLevelKey(this.data.unlockEdition, this.data.unlockLevel, this.data.unlockUnit, item.key)}`] || 0);
      }
      return Object.assign({}, item, { learnedCount });
    });
  },
  showSources() {
    const texts = getTexts();
    const isDictation = this.data.practiceMode === 'dictation';
    this.setData({ stage: 'sources', title: isDictation ? texts.shelfTitle : texts.practiceShelfTitle, subtitle: isDictation ? texts.shelfCopy : texts.practiceShelfCopy, unlockEdition: 'v2', unlockLevel: 0, unlockUnit: 0, items: this.withCounts(sourceItems(texts), 'sources') });
  },
  showLevels(edition) {
    const texts = getTexts();
    const unlockEdition = edition || this.data.unlockEdition || 'v2';
    this.setData({ stage: 'levels', title: unlockEdition === 'v3' ? (texts.unlockThirdBook || 'Unlock 第三版词汇书') : (texts.unlockSecondBook || 'Unlock 第二版词汇书'), subtitle: texts.chooseLevel, unlockEdition, unlockLevel: 0, unlockUnit: 0 }, () => this.setData({ items: this.withCounts(levelItems(), 'levels') }));
  },
  showStandardLists(stage) {
    const title = { junior: getTexts().juniorBookShort, senior: getTexts().seniorBookShort, cet4: getTexts().cet4BookShort, ielts: getTexts().ieltsBookShort }[stage];
    const items = this.withCounts(standardListItems(stage), 'standard-lists', stage);
    this.setData({ stage: 'standard-lists', standardStage: stage, title, subtitle: getTexts().chooseList, items });
  },
  showUnits(level) {
    this.setData({ stage: 'units', title: `Unlock ${level} ${this.data.unlockEdition === 'v3' ? '第三版' : '第二版'}`, subtitle: getTexts().chooseUnit, unlockLevel: level, unlockUnit: 0 }, () => this.setData({ items: this.withCounts(unitItems(), 'units') }));
  },
  showSections(level, unit) {
    const texts = getTexts();
    const items = [
      { key: 'ls', mark: 'LS', title: texts.lsList, meta: `Unlock ${level} Unit ${unit}` },
      { key: 'rw', mark: 'RW', title: texts.rwList, meta: `Unlock ${level} Unit ${unit}` }
    ];
    this.setData({ stage: 'sections', title: `Unlock ${level} ${this.data.unlockEdition === 'v3' ? '第三版' : '第二版'} · Unit ${unit}`, subtitle: texts.chooseList, unlockLevel: level, unlockUnit: unit }, () => this.setData({ items: this.withCounts(items, 'sections') }));
  },
  localizeCurrentStage() {
    if (this.data.stage === 'levels') this.showLevels(this.data.unlockEdition);
    else if (this.data.stage === 'units') this.showUnits(this.data.unlockLevel);
    else if (this.data.stage === 'sections') this.showSections(this.data.unlockLevel, this.data.unlockUnit);
    else if (this.data.stage === 'standard-lists') this.showStandardLists(this.data.standardStage);
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
    const base = `level=${encodeURIComponent(level)}&title=${encodeURIComponent(title)}`;
    const url = this.data.practiceMode === 'dictation'
      ? `/pages/reading/flashcards/dictation/index?${base}`
      : `/pages/reading/flashcards/recognition/index?${base}&practiceMode=${encodeURIComponent(this.data.practiceMode)}`;
    wx.navigateTo({ url });
  },
  openHistory() {
    wx.navigateTo({ url: '/pages/practice-history/index?type=vocabulary' });
  }
});
