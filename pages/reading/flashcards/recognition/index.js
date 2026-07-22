const page = require('../../../../utils/page');
const store = require('../../../../utils/store');
const effects = require('../../../../utils/effects');
const { formatVocabularyDefinitions, formatVocabularyMeaning } = require('../../../../utils/vocabulary-definitions');
const { createDictionaryVoicePlayer } = require('../../../../utils/dictionary-voice-player');
const { buildRecognitionQuestions, isRecognitionTargetAllowed } = require('../../../../utils/vocabulary-recognition');
const { resolveVocabularyEntry } = require('../../../../utils/vocabulary-phonetics');
const { createVocabularySessionTimer, formatDuration } = require('../../../../utils/vocabulary-session-timer');

const SESSION_LIMIT = 20;
const MINIMUM_WORDS = 4;
const CORRECT_AUTO_ADVANCE_MS = 600;

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

function mapCard(entry, index, sourceId) {
  const resolved = resolveVocabularyEntry(sourceId || entry.sourceId, entry.word, entry.phonetic);
  const word = resolved.word;
  const meaning = Array.isArray(entry.definitions)
    ? formatVocabularyDefinitions(entry.definitions)
    : formatVocabularyMeaning(entry.meaning);
  return {
    key: word.toLowerCase() || String(index),
    sourceId: String(sourceId || entry.sourceId || ''),
    word,
    phonetic: resolved.phonetic,
    meaning,
    example: String(entry.example || '').trim(),
    exampleMeaning: String(entry.exampleMeaning || '').trim()
  };
}

function defaultCount(total) {
  return total ? Math.min(10, SESSION_LIMIT, total) : 0;
}

function localAttemptKey(sourceId, practiceMode) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `vocabularyRecognitionAttemptsV1:${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}:${sourceId}:${practiceMode}`;
}

Page({
  data: page.createCloudPageData({
    level: '',
    sourceId: '',
    sourceTitle: '',
    practiceMode: 'word-meaning',
    mode: 'menu',
    loading: true,
    cards: [],
    current: null,
    currentIndex: 0,
    selectedKey: '',
    revealed: false,
    results: [],
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    accuracy: 0,
    durationSec: 0,
    durationText: '',
    saving: false,
    availableCount: 0,
    practiceCount: 0,
    audioLoading: false,
    audioFailed: false,
    previewMode: store.getDeviceStudyRole() !== 'student',
    debugLines: [],
    navStyle: '',
    pageTopStyle: ''
  }),
  onLoad(options) {
    this.perf = page.startPagePerf('vocabulary-recognition');
    page.syncTheme(this);
    const level = decodeURIComponent(String(options.level || ''));
    const practiceMode = String(options.practiceMode || '') === 'audio-meaning' ? 'audio-meaning' : 'word-meaning';
    this.setData(Object.assign({}, getNavLayout(), {
      level,
      sourceId: level ? `dictionary-book-${level}` : '',
      sourceTitle: decodeURIComponent(String(options.title || '')),
      practiceMode,
      previewMode: store.getDeviceStudyRole() !== 'student'
    }));
    this.loadCards();
  },
  onShow() {
    page.syncTheme(this);
    if (this.sessionTimer && this.data.mode === 'question') this.sessionTimer.resume();
  },
  onHide() {
    if (this.sessionTimer) this.sessionTimer.pause();
  },
  onUnload() {
    this.clearCorrectAdvanceTimer();
    if (this.sessionTimer) this.sessionTimer.reset();
    if (this.voicePlayer) this.voicePlayer.destroy();
  },
  async loadCards() {
    const [result, bookResult] = await Promise.all([
      store.getVocabularyDictationSourceWords(this.data.sourceId),
      store.getDictionaryBook(this.data.level)
    ]);
    if (result.syncMode === 'cloud-error' || !Array.isArray(result.rows)) {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ loading: false, debugLines: [
        `DEBUG: reading/flashcards/recognition.loadCards -> store.getVocabularyDictationSourceWords -> cloud.getVocabularyDictationSourceWords.rows：${Array.isArray(result.rows) ? result.rows.length : 'missing'}`,
        `sourceId=${this.data.sourceId}；targetChildId=${target.targetChildId || 'self'}；syncMode=${result.syncMode || 'unknown'}；cloudError.message=${result.cloudError && result.cloudError.message || 'missing'}`
      ] });
      wx.showToast({ title: this.data.texts.loadFailed, icon: 'none' });
      return;
    }
    this.allCards = result.rows.map((item, index) => mapCard(item, index, this.data.sourceId))
      .filter((item) => item.word && item.meaning && isRecognitionTargetAllowed(item, this.data.sourceId));
    const fullSourceRows = bookResult && Array.isArray(bookResult.rows) ? bookResult.rows : [];
    this.optionCards = fullSourceRows.map((item, index) => mapCard(item, index, this.data.sourceId)).filter((item) => item.word && item.meaning);
    if (this.optionCards.length < MINIMUM_WORDS) this.optionCards = this.allCards;
    const availableCount = this.allCards.length;
    this.setData({
      loading: false,
      debugLines: [],
      availableCount,
      practiceCount: defaultCount(availableCount)
    });
    if (availableCount < MINIMUM_WORDS) wx.showToast({ title: this.data.texts.needFourWords, icon: 'none' });
    if (this.perf) this.perf.ready('pageReady', { cacheHit: !!result.__cacheHit, total: availableCount, mode: this.data.practiceMode });
  },
  changePracticeCount(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const max = Math.min(SESSION_LIMIT, Number(this.data.availableCount || 0));
    if (!max) return;
    this.setData({ practiceCount: Math.max(1, Math.min(max, Number(this.data.practiceCount || 1) + delta)) });
  },
  handlePracticeSlider(event) {
    const max = Math.min(SESSION_LIMIT, Number(this.data.availableCount || 0));
    if (!max) return;
    this.setData({ practiceCount: Math.max(1, Math.min(max, Number(event.detail.value || 1))) });
  },
  startPractice() {
    this.clearCorrectAdvanceTimer();
    if ((this.allCards || []).length < MINIMUM_WORDS) {
      wx.showToast({ title: this.data.texts.needFourWords, icon: 'none' });
      return;
    }
    const labels = ['A', 'B', 'C', 'D'];
    const cards = buildRecognitionQuestions(this.allCards, this.data.practiceCount || 10, Math.random, {
      optionCards: this.optionCards,
      sourceId: this.data.sourceId
    }).map((item) => Object.assign({}, item, {
      options: (item.options || []).map((option, index) => Object.assign({}, option, { label: labels[index] }))
    }));
    if (!cards.length) {
      wx.showToast({ title: this.data.texts.optionsUnavailable, icon: 'none' });
      return;
    }
    this.sessionStartedAt = new Date().toISOString();
    this.startSessionTimer();
    this.setData({
      mode: 'question',
      cards,
      current: cards[0],
      currentIndex: 0,
      selectedKey: '',
      revealed: false,
      results: [],
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      accuracy: 0,
      durationSec: 0,
      durationText: formatDuration(0, this.data.language),
      saving: false,
      audioFailed: false,
      audioLoading: false
    }, () => this.playCurrent());
  },
  selectOption(event) {
    if (this.data.revealed || !this.data.current) return;
    const selectedKey = String(event.currentTarget.dataset.key || '');
    const selected = (this.data.current.options || []).find((item) => String(item.key) === selectedKey);
    if (!selected) return;
    const correct = !!selected.correct;
    const result = Object.assign({}, this.data.current, { selectedKey, selectedText: selected.text, correct });
    this.setData({
      current: result,
      selectedKey,
      revealed: true,
      results: this.data.results.concat(result),
      correctCount: this.data.correctCount + (correct ? 1 : 0),
      wrongCount: this.data.wrongCount + (correct ? 0 : 1)
    }, () => {
      if (correct) this.scheduleCorrectAdvance();
    });
  },
  nextQuestion() {
    this.clearCorrectAdvanceTimer();
    this.advanceTo(this.data.currentIndex + 1);
  },
  scheduleCorrectAdvance() {
    this.clearCorrectAdvanceTimer();
    this.correctAdvanceTimer = setTimeout(() => {
      this.correctAdvanceTimer = null;
      this.advanceTo(this.data.currentIndex + 1);
    }, CORRECT_AUTO_ADVANCE_MS);
  },
  clearCorrectAdvanceTimer() {
    if (!this.correctAdvanceTimer) return;
    clearTimeout(this.correctAdvanceTimer);
    this.correctAdvanceTimer = null;
  },
  skipAudioQuestion() {
    if (!this.data.audioFailed || this.data.revealed || !this.data.current) return;
    this.setData({
      results: this.data.results.concat(Object.assign({}, this.data.current, { skipped: true })),
      skippedCount: this.data.skippedCount + 1
    }, () => this.advanceTo(this.data.currentIndex + 1));
  },
  advanceTo(nextIndex) {
    if (nextIndex >= this.data.cards.length) {
      this.finishPractice();
      return;
    }
    this.setData({
      currentIndex: nextIndex,
      current: this.data.cards[nextIndex],
      selectedKey: '',
      revealed: false,
      audioFailed: false,
      audioLoading: false
    }, () => this.playCurrent());
  },
  finishPractice() {
    this.clearCorrectAdvanceTimer();
    const answered = Number(this.data.correctCount || 0) + Number(this.data.wrongCount || 0);
    const accuracy = answered ? Math.round(this.data.correctCount * 100 / answered) : 0;
    const durationSec = this.sessionTimer ? this.sessionTimer.stop() : 0;
    this.setData({ mode: 'complete', accuracy, durationSec, durationText: formatDuration(durationSec, this.data.language), audioLoading: false, saving: !this.data.previewMode });
    effects.playComplete({ voiceKey: 'flashcardComplete', voiceDelayMs: 800, studentOnly: false, onceKey: `recognition:${this.data.sourceId}:${this.sessionStartedAt || Date.now()}` });
    if (!this.data.previewMode) this.saveAttempt(accuracy, durationSec);
  },
  startSessionTimer() {
    if (!this.sessionTimer) {
      this.sessionTimer = createVocabularySessionTimer((durationSec) => {
        if (this.data.mode === 'question') this.setData({ durationSec, durationText: formatDuration(durationSec, this.data.language) });
      });
    }
    this.sessionTimer.start();
  },
  async saveAttempt(accuracy, durationSec) {
    this.saveLocalAttempt(accuracy, durationSec);
    const result = await store.saveVocabularyDictationAttempt({
      attemptId: `${this.data.sourceId}:${this.data.practiceMode}:${this.sessionStartedAt}`,
      sourceId: this.data.sourceId,
      sourceTitle: this.data.sourceTitle,
      practiceMode: this.data.practiceMode,
      startedAt: this.sessionStartedAt,
      durationSec,
      questions: this.data.results.map((item) => ({
        word: item.word,
        phonetic: item.phonetic,
        meaning: item.meaning,
        input: item.selectedText || '',
        answer: item.meaning,
        correct: !!item.correct
      }))
    });
    if (!result.saved) {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      this.setData({ saving: false, debugLines: [
        `DEBUG: reading/flashcards/recognition.saveAttempt -> store.saveVocabularyDictationAttempt -> cloud.saveVocabularyDictationAttempt.saved：${result.saved}`,
        `sourceId=${this.data.sourceId}；targetChildId=${target.targetChildId || 'self'}；syncMode=${result.syncMode || 'unknown'}；cloudError.message=${result.cloudError && result.cloudError.message || result.reason || 'missing'}`
      ] });
      wx.showToast({ title: this.data.texts.saveFailed || '记录保存失败', icon: 'none' });
      return;
    }
    this.setData({ saving: false, debugLines: [] });
  },
  saveLocalAttempt(accuracy, durationSec) {
    try {
      const key = localAttemptKey(this.data.sourceId, this.data.practiceMode);
      const attempts = wx.getStorageSync(key) || [];
      attempts.unshift({
        startedAt: this.sessionStartedAt,
        sourceId: this.data.sourceId,
        sourceTitle: this.data.sourceTitle,
        practiceMode: this.data.practiceMode,
        correctCount: this.data.correctCount,
        wrongCount: this.data.wrongCount,
        skippedCount: this.data.skippedCount,
        accuracy,
        durationSec
      });
      wx.setStorageSync(key, attempts.slice(0, 20));
    } catch (error) {}
  },
  retryPractice() {
    this.clearCorrectAdvanceTimer();
    if (this.sessionTimer) this.sessionTimer.reset();
    this.setData({ mode: 'menu', durationSec: 0, durationText: '', saving: false });
  },
  changePracticeMode() {
    wx.redirectTo({ url: `/pages/reading/flashcards/practice/index?level=${encodeURIComponent(this.data.level)}&title=${encodeURIComponent(this.data.sourceTitle)}` });
  },
  playCurrent() {
    const word = this.data.current && this.data.current.word;
    if (!word) return;
    if (!this.voicePlayer) this.voicePlayer = createDictionaryVoicePlayer();
    this.voicePlayer.play(word, {
      onStart: () => this.setData({ audioLoading: true, audioFailed: false }),
      onDone: () => this.setData({ audioLoading: false }),
      onFailed: () => this.setData({ audioLoading: false, audioFailed: true })
    });
  },
  handleBack() {
    this.clearCorrectAdvanceTimer();
    if (this.data.mode === 'question') {
      if (this.voicePlayer) {
        this.voicePlayer.destroy();
        this.voicePlayer = null;
      }
      if (this.sessionTimer) this.sessionTimer.reset();
      this.setData({ mode: 'menu', audioLoading: false, durationSec: 0, durationText: '' });
      return;
    }
    wx.navigateBack({ delta: 1 });
  }
});
