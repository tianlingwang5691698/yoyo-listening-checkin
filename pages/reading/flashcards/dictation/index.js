const page = require('../../../../utils/page');
const store = require('../../../../utils/store');
const effects = require('../../../../utils/effects');
const i18n = require('../../../../utils/i18n');
const { formatVocabularyDefinitions, formatVocabularyMeaning } = require('../../../../utils/vocabulary-definitions');
const { resolveVocabularyEntry } = require('../../../../utils/vocabulary-phonetics');
const { createVocabularySessionTimer, formatDuration } = require('../../../../utils/vocabulary-session-timer');
const {
  buildDictionaryVoiceUrls,
  buildDictionaryVoiceSegments,
  buildDictionaryVoiceSegmentUrls
} = require('../../../../utils/dictionary-voice');

const text = (key, fallback) => i18n.getPageText('vocabularyDictation', key, undefined, fallback);
const SESSION_LIMIT = 20;
const DICTATION_AUDIO_TOTAL_TIMEOUT_MS = 5000;
const CORRECT_AUTO_ADVANCE_MS = 800;

function defaultPracticeCount(total) {
  const available = Math.max(0, Number(total || 0));
  return available ? Math.min(SESSION_LIMIT, available) : 0;
}

function randomCards(cards, count) {
  const rows = (cards || []).slice();
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = rows[index];
    rows[index] = rows[swapIndex];
    rows[swapIndex] = current;
  }
  return rows.slice(0, Math.max(0, Number(count || 0)));
}

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

function normalizeSpelling(value) {
  return String(value || '').trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').replace(/\s*([/-])\s*/g, '$1');
}

function isCorrectSpelling(word, input) {
  const answers = String(word || '').split(/\s+\/\s+|\s+or\s+/i).map(normalizeSpelling).filter(Boolean);
  return answers.includes(normalizeSpelling(input));
}

function mapBookCard(entry, index, sourceId) {
  const resolved = resolveVocabularyEntry(sourceId || entry.sourceId, entry.word || entry.wordLower, entry.phonetic);
  const word = resolved.word;
  return {
    key: `${normalizeSpelling(word)}:${index}`,
    word,
    phonetic: resolved.phonetic,
    meaning: Array.isArray(entry.definitions) ? formatVocabularyDefinitions(entry.definitions) : formatVocabularyMeaning(entry.meaning),
    input: '',
    correct: false
  };
}

function mapWrongCard(entry, index, sourceId) {
  const resolved = resolveVocabularyEntry(sourceId || entry.sourceId, entry.word, entry.phonetic);
  return {
    key: `${normalizeSpelling(resolved.word)}:${index}`,
    word: resolved.word,
    phonetic: resolved.phonetic,
    meaning: formatVocabularyMeaning(entry.meaning),
    wrongCount: Number(entry.wrongCount || 0),
    lastInput: entry.lastInput || '',
    input: '',
    correct: false
  };
}

Page({
  data: page.createCloudPageData({
    level: '',
    sourceId: '',
    sourceTitle: '',
    mode: 'menu',
    cards: [],
    wrongWords: [],
    current: null,
    currentIndex: 0,
    inputValue: '',
    revealed: false,
    results: [],
    correctCount: 0,
    wrongCount: 0,
    totalCount: 0,
    accuracy: 0,
    durationSec: 0,
    durationText: '',
    audioFailed: false,
    todayAttempts: [],
    todayCorrect: 0,
    todayTotal: 0,
    availableCount: 0,
    practiceCount: 0,
    loading: true,
    saving: false,
    debugLines: [],
    previewMode: store.getDeviceStudyRole() !== 'student',
    navStyle: '',
    pageTopStyle: ''
  }),
  onLoad(options) {
    this.dictationPerf = page.startPagePerf('vocabulary-dictation');
    page.syncTheme(this);
    const level = decodeURIComponent(String(options.level || ''));
    const sourceTitle = decodeURIComponent(String(options.title || ''));
    this.setData(Object.assign({}, getNavLayout(), {
      level,
      sourceId: level ? `dictionary-book-${level}` : '',
      sourceTitle,
      previewMode: store.getDeviceStudyRole() !== 'student'
    }));
    this.loadData();
  },
  onUnload() {
    this.clearCorrectAdvanceTimer();
    this.clearAudioStartTimer();
    if (this.audioContext) this.audioContext.destroy();
    if (this.sessionTimer) this.sessionTimer.reset();
  },
  async loadData() {
    const startedAt = Date.now();
    const dictationPromise = store.getVocabularyDictationData(this.data.sourceId);
    const words = await store.getVocabularyDictationSourceWords(this.data.sourceId);
    if (words.syncMode === 'cloud-error' || !Array.isArray(words.rows)) {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ loading: false, debugLines: [
        `DEBUG: reading/flashcards/dictation.loadData -> store.getVocabularyDictationSourceWords -> cloud.getVocabularyDictationSourceWords.rows：${Array.isArray(words.rows) ? words.rows.length : 'missing'}`,
        `sourceId=${this.data.sourceId}；targetChildId=${target.targetChildId || 'self'}；syncMode=${words.syncMode || 'unknown'}；cloudError.message=${words.cloudError && words.cloudError.message || 'missing'}`
      ] });
      wx.showToast({ title: text('loadFailed', '词表读取失败'), icon: 'none' });
      return;
    }
    this.allCards = words.rows.map((item, index) => mapBookCard(item, index, this.data.sourceId)).filter((item) => item.word);
    this.setData({ loading: false, sourceTitle: this.data.sourceTitle || text('title', '听音写词'), availableCount: this.allCards.length, practiceCount: defaultPracticeCount(this.allCards.length) });
    if (!this.allCards.length) wx.showToast({ title: text('noLearned', '该词表还没有已背单词'), icon: 'none' });
    if (this.dictationPerf) this.dictationPerf.ready('pageReady', { source: 'learned-only', cacheHit: !!words.__cacheHit, total: this.allCards.length, elapsed: Date.now() - startedAt });
    const dictation = await dictationPromise;
    if (dictation.syncMode === 'cloud-error') {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ debugLines: [
        `DEBUG: reading/flashcards/dictation.loadData -> store.getVocabularyDictationData -> cloud.getVocabularyDictationData.attempts：${Array.isArray(dictation.attempts) ? dictation.attempts.length : 'missing'}`,
        `sourceId=${this.data.sourceId}；targetChildId=${target.targetChildId || 'self'}；cloudError.message=${dictation.cloudError && dictation.cloudError.message || 'missing'}`
      ] });
      return;
    }
    const wrongWords = (dictation.wrongWords || []).map((item, index) => mapWrongCard(item, index, this.data.sourceId)).filter((item) => item.word);
    const todayAttempts = dictation.attempts || [];
    this.setData({
      debugLines: [],
      wrongWords,
      todayAttempts,
      todayCorrect: todayAttempts.reduce((sum, item) => sum + Number(item.correctCount || 0), 0),
      todayTotal: todayAttempts.reduce((sum, item) => sum + Number(item.totalCount || 0), 0)
    });
  },
  onShow() {
    page.syncTheme(this);
    if (this.sessionTimer && this.data.mode === 'dictation') this.sessionTimer.resume();
  },
  onHide() {
    if (this.sessionTimer) this.sessionTimer.pause();
  },
  startAllDictation() {
    this.startDictation(randomCards(this.allCards, this.data.practiceCount || SESSION_LIMIT), 'dictation');
  },
  startWrongDictation() {
    this.startDictation((this.data.wrongWords || []).slice(0, Number(this.data.practiceCount || SESSION_LIMIT)), 'wrong-dictation');
  },
  changePracticeCount(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const max = Math.max(0, Number(this.data.availableCount || 0));
    if (!max) return;
    const current = Math.max(1, Number(this.data.practiceCount || 1));
    let next = current + delta;
    if (next < 1) next = 1;
    if (next > max) next = max;
    this.setData({ practiceCount: next });
  },
  handlePracticeSlider(event) {
    const max = Math.max(0, Number(this.data.availableCount || 0));
    if (!max) return;
    const value = Math.max(1, Math.min(max, Number(event.detail.value || 1)));
    if (value !== this.data.practiceCount) this.setData({ practiceCount: value });
  },
  startDictation(cards, practiceMode) {
    this.clearCorrectAdvanceTimer();
    if (!cards.length) {
      wx.showToast({ title: text('emptyWrong', '还没有错词'), icon: 'none' });
      return;
    }
    this.sessionStartedAt = new Date().toISOString();
    this.startSessionTimer();
    this.practiceMode = practiceMode;
    const sessionCards = cards.map((item) => Object.assign({}, item, { input: '', correct: false }));
    this.setData({ mode: 'dictation', cards: sessionCards, current: sessionCards[0], currentIndex: 0, inputValue: '', revealed: false, results: [], correctCount: 0, wrongCount: 0, durationSec: 0, durationText: formatDuration(0, this.data.language), audioFailed: false }, () => this.playCurrent());
  },
  startWrongStudy() {
    const cards = (this.data.wrongWords || []).slice(0, 50);
    if (!cards.length) {
      wx.showToast({ title: text('emptyWrong', '还没有错词'), icon: 'none' });
      return;
    }
    this.setData({ mode: 'wrong-study', cards, current: cards[0], currentIndex: 0 }, () => this.playCurrent());
  },
  handleInput(event) {
    this.setData({ inputValue: event.detail.value || '' });
  },
  submitCurrent() {
    if (this.data.revealed || !this.data.current) return;
    const input = String(this.data.inputValue || '').trim();
    if (!input) return;
    const result = Object.assign({}, this.data.current, { input, correct: isCorrectSpelling(this.data.current.word, input) });
    this.setData({
      current: result,
      revealed: true,
      results: this.data.results.concat(result),
      correctCount: this.data.correctCount + (result.correct ? 1 : 0),
      wrongCount: this.data.wrongCount + (result.correct ? 0 : 1)
    }, () => {
      if (result.correct) this.scheduleCorrectAdvance();
    });
  },
  nextCard() {
    this.clearCorrectAdvanceTimer();
    const nextIndex = this.data.currentIndex + 1;
    if (nextIndex >= this.data.cards.length) {
      this.finishSession();
      return;
    }
    this.setData({ currentIndex: nextIndex, current: this.data.cards[nextIndex], inputValue: '', revealed: false, audioFailed: false }, () => this.playCurrent());
  },
  nextStudyCard() {
    const nextIndex = this.data.currentIndex + 1;
    if (nextIndex >= this.data.cards.length) {
      this.startWrongDictation();
      return;
    }
    this.setData({ currentIndex: nextIndex, current: this.data.cards[nextIndex] }, () => this.playCurrent());
  },
  async finishSession() {
    this.clearCorrectAdvanceTimer();
    const totalCount = this.data.results.length;
    const accuracy = totalCount ? Math.round(this.data.correctCount * 100 / totalCount) : 0;
    const durationSec = this.sessionTimer ? this.sessionTimer.stop() : 0;
    this.setData({ mode: 'complete', saving: !this.data.previewMode, totalCount, accuracy, durationSec, durationText: formatDuration(durationSec, this.data.language) });
    effects.playComplete({
      voiceKey: 'flashcardComplete',
      voiceDelayMs: 1000,
      studentOnly: false,
      onceKey: `dictation:${this.data.sourceId}:${this.sessionStartedAt || Date.now()}`
    });
    if (this.data.previewMode) return;
    const result = await store.saveVocabularyDictationAttempt({
      attemptId: `${this.data.sourceId}:${this.sessionStartedAt}`,
      sourceId: this.data.sourceId,
      sourceTitle: this.data.sourceTitle,
      practiceMode: this.practiceMode,
      startedAt: this.sessionStartedAt,
      durationSec,
      questions: this.data.results.map((item) => ({ word: item.word, phonetic: item.phonetic, meaning: item.meaning, input: item.input }))
    });
    if (!result.saved) {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ saving: false, debugLines: [
        `DEBUG: reading/flashcards/dictation.finishSession -> store.saveVocabularyDictationAttempt -> cloud.saveVocabularyDictationAttempt.saved：${result.saved}`,
        `sourceId=${this.data.sourceId}；targetChildId=${target.targetChildId || 'self'}；syncMode=${result.syncMode || 'unknown'}；cloudError.message=${result.cloudError && result.cloudError.message || result.reason || 'missing'}`
      ] });
      wx.showToast({ title: text('saveFailed', '记录保存失败'), icon: 'none' });
      return;
    }
    this.setData({ saving: false, debugLines: [], wrongWords: (result.wrongWords || []).map(mapWrongCard) });
    wx.showToast({ title: text('saved', '记录已保存'), icon: 'success' });
  },
  playCurrent() {
    const word = this.data.current && this.data.current.word;
    if (!word) return;
    this.playingWord = word;
    const playToken = Number(this.audioPlayToken || 0) + 1;
    this.audioPlayToken = playToken;
    this.clearAudioStartTimer();
    this.setData({ audioFailed: false });
    this.dictationAudioFallbackUrls = buildDictionaryVoiceUrls(word);
    this.dictationAudioSegments = buildDictionaryVoiceSegments(word);
    this.dictationUsingSegments = false;
    this.dictationAudioFallbackIndex = 0;
    this.dictationAudioDeadlineAt = Date.now() + DICTATION_AUDIO_TOTAL_TIMEOUT_MS;
    if (!this.audioContext) {
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.obeyMuteSwitch = false;
      this.audioContext.onPlay(() => this.clearAudioStartTimer());
      this.audioContext.onEnded(() => {
        this.clearAudioStartTimer();
        if (this.playNextDictationAudioSegment()) return;
        this.dictationAudioFallbackUrls = [];
        this.dictationAudioSegments = [];
        this.dictationUsingSegments = false;
        this.dictationAudioDeadlineAt = 0;
      });
      this.audioContext.onError(() => {
        this.clearAudioStartTimer();
        if (this.tryNextDictationAudioFallback()) return;
        if (this.startDictationAudioSegmentFallback()) return;
        if (this.playNextDictationAudioSegment()) return;
        this.markDictationAudioFailed();
      });
    }
    this.audioContext.stop();
    this.audioContext.src = this.dictationAudioFallbackUrls[0];
    this.startDictationAudioAttemptTimer(word, playToken);
    this.audioContext.play();
  },
  startSessionTimer() {
    if (!this.sessionTimer) {
      this.sessionTimer = createVocabularySessionTimer((durationSec) => {
        if (this.data.mode === 'dictation') this.setData({ durationSec, durationText: formatDuration(durationSec, this.data.language) });
      });
    }
    this.sessionTimer.start();
  },
  tryNextDictationAudioFallback() {
    const urls = this.dictationAudioFallbackUrls || [];
    const nextIndex = Number(this.dictationAudioFallbackIndex || 0) + 1;
    if (!this.audioContext || nextIndex >= urls.length || Date.now() >= Number(this.dictationAudioDeadlineAt || 0)) return false;
    this.dictationAudioFallbackIndex = nextIndex;
    this.audioContext.src = urls[nextIndex];
    this.startDictationAudioAttemptTimer(this.playingWord, this.audioPlayToken);
    this.audioContext.play();
    return true;
  },
  startDictationAudioSegmentFallback() {
    if (this.dictationUsingSegments) return false;
    const segments = this.dictationAudioSegments || [];
    if (segments.length < 2 || Date.now() >= Number(this.dictationAudioDeadlineAt || 0)) return false;
    this.dictationUsingSegments = true;
    this.dictationAudioSegmentIndex = -1;
    return this.playNextDictationAudioSegment(false);
  },
  playNextDictationAudioSegment(resetDeadline = true) {
    if (!this.dictationUsingSegments || !this.audioContext) return false;
    const segments = this.dictationAudioSegments || [];
    const nextIndex = Number(this.dictationAudioSegmentIndex || 0) + 1;
    if (nextIndex >= segments.length) return false;
    this.dictationAudioSegmentIndex = nextIndex;
    this.dictationAudioFallbackUrls = buildDictionaryVoiceSegmentUrls(segments[nextIndex]);
    this.dictationAudioFallbackIndex = 0;
    if (resetDeadline) this.dictationAudioDeadlineAt = Date.now() + 2000;
    this.audioContext.src = this.dictationAudioFallbackUrls[0];
    this.startDictationAudioAttemptTimer(this.playingWord, this.audioPlayToken);
    this.audioContext.play();
    return true;
  },
  startDictationAudioAttemptTimer(word, playToken) {
    this.clearAudioStartTimer();
    const remainingMs = Math.max(0, Number(this.dictationAudioDeadlineAt || 0) - Date.now());
    const attemptsRemaining = Math.max(1, (this.dictationAudioFallbackUrls || []).length - Number(this.dictationAudioFallbackIndex || 0));
    const attemptTimeoutMs = Math.max(250, Math.floor(remainingMs / attemptsRemaining));
    this.audioStartTimer = setTimeout(() => {
      this.audioStartTimer = null;
      const currentWord = this.data.current && this.data.current.word;
      if (this.audioPlayToken !== playToken || currentWord !== word) return;
      if (Date.now() < Number(this.dictationAudioDeadlineAt || 0) && this.tryNextDictationAudioFallback()) return;
      if (this.startDictationAudioSegmentFallback()) return;
      if (this.playNextDictationAudioSegment()) return;
      this.markDictationAudioFailed();
    }, attemptTimeoutMs);
  },
  markDictationAudioFailed() {
    const currentWord = this.data.current && this.data.current.word;
    if (!currentWord || currentWord !== this.playingWord) return;
    this.dictationAudioFallbackUrls = [];
    this.dictationAudioSegments = [];
    this.dictationUsingSegments = false;
    this.dictationAudioDeadlineAt = 0;
    if (this.audioContext) {
      try {
        this.audioContext.stop();
      } catch (error) {}
    }
    this.setData({ audioFailed: true });
  },
  clearAudioStartTimer() {
    if (!this.audioStartTimer) return;
    clearTimeout(this.audioStartTimer);
    this.audioStartTimer = null;
  },
  scheduleCorrectAdvance() {
    this.clearCorrectAdvanceTimer();
    this.correctAdvanceTimer = setTimeout(() => {
      this.correctAdvanceTimer = null;
      this.nextCard();
    }, CORRECT_AUTO_ADVANCE_MS);
  },
  clearCorrectAdvanceTimer() {
    if (!this.correctAdvanceTimer) return;
    clearTimeout(this.correctAdvanceTimer);
    this.correctAdvanceTimer = null;
  },
  openHistory() {
    wx.navigateTo({ url: '/pages/practice-history/index?type=vocabulary' });
  },
  changePracticeMode() {
    if (this.data.saving) return;
    wx.redirectTo({ url: `/pages/reading/flashcards/practice/index?level=${encodeURIComponent(this.data.level)}&title=${encodeURIComponent(this.data.sourceTitle)}` });
  },
  backToMenu() {
    this.clearCorrectAdvanceTimer();
    this.clearAudioStartTimer();
    if (this.data.mode === 'menu') {
      wx.navigateBack({ delta: 1 });
      return;
    }
    if (this.sessionTimer) this.sessionTimer.reset();
    this.setData({ mode: 'menu', current: null, cards: [], inputValue: '', revealed: false, durationSec: 0, durationText: '' });
    this.loadData();
  }
});
