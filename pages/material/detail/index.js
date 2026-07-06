const page = require('../../../utils/page');
const store = require('../../../utils/store');
const snapshotStore = require('../../../utils/snapshot');

const PICTURE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LISTENING_SET_SNAPSHOT_KEY = 'currentListeningSetV1';
const AUDIO_SLIDER_MAX = 1000;

function sectionForNumber(number) {
  if (number >= 1 && number <= 5) {
    return { key: 'A', title: 'A. Listen and choose the right picture.' };
  }
  if (number >= 6 && number <= 10) {
    return { key: 'B', title: 'B. Listen and choose the best answer.' };
  }
  if (number >= 11 && number <= 15) {
    return { key: 'C', title: 'C. Listen and tell whether the statements are true or false.' };
  }
  return { key: 'D', title: 'D. Listen and complete the sentences.' };
}

function buildQuestions(item) {
  let lastSection = '';
  return (item.questions || []).map((question) => {
    const section = question.sectionKey
      ? { key: question.sectionKey, title: question.sectionTitle || '' }
      : sectionForNumber(Number(question.number || 0));
    const showSectionTitle = section.key !== lastSection && !(section.key === 'A' && item.images && item.images.length);
    lastSection = section.key;
    return {
      number: question.number,
      prompt: question.prompt,
      questionType: question.questionType || 'blank',
      sectionKey: section.key,
      sectionTitle: section.title,
      showSectionTitle,
      optionsList: Object.keys(question.options || {}).map((key) => ({
        key,
        text: question.options[key],
        label: question.options[key] === key ? key : `${key} ${question.options[key]}`,
        isWide: String(question.options[key] || '').length > 34,
        selected: false
      })),
      inputValue: '',
      selectedAnswer: '',
      answer: question.answer || '',
      checked: false,
      correct: false
    };
  });
}

function studyDoneKey(item) {
  return `listeningStudyDoneV1:${item && (item._id || item.id || '')}`;
}

function hasListeningStudyCards(studyPack) {
  return studyPack
    && ((studyPack.vocabularyCards || []).length
      || (studyPack.phraseCards || []).length
      || (studyPack.sentencePatternCards || []).length);
}

function getListeningStudyError(result) {
  const message = result && result.cloudError && result.cloudError.message;
  if (message) {
    return `生成超时，未拿到学习包，请稍后重试：${message}`;
  }
  return '生成失败，稍后重试。';
}

function formatAudioTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes < 10 ? '0' : ''}${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

function normalizeAudioTime(value, max) {
  const time = Number(value) || 0;
  const duration = Number(max) || 0;
  if (duration <= 0) return Math.max(0, time);
  return Math.min(Math.max(0, time), duration);
}

function recordListeningStudyPackSynced(item) {
  if (!item) return;
  const targetId = String(item._id || item.id || item.audioCloudPath || item.title || '').trim();
  if (!targetId) return;
  store.recordStudyCompletion({
    id: `listening-study:${targetId}`,
    type: 'listening',
    targetId,
    title: '听力学习包',
    meta: item.title || item.displayTitle || item.audioTitle || '听力',
    progressText: '学习包已生成'
  });
}

function withImageDisplayMode(item) {
  if (!item) return item;
  const images = item.images || [];
  return Object.assign({}, item, {
    imageDisplayMode: images.length === 1 ? 'composite' : 'grid'
  });
}

function buildAnswerSummary(item) {
  return (item && item.questions || [])
    .filter((question) => question.answer)
    .map((question) => `${question.number}.${question.answer}`)
    .join('  ');
}

Page({
  data: page.createCloudPageData({
    item: null,
    questions: [],
    audioSrc: '',
    audioLoading: false,
    audioError: '',
    isPlaying: false,
    audioDuration: 0,
    audioCurrentTime: 0,
    audioCurrentText: '00:00',
    audioDurationText: '00:00',
    audioProgress: 0,
    audioSliderMax: AUDIO_SLIDER_MAX,
    audioSeeking: false,
    audioEnded: false,
    submitted: false,
    correctCount: 0,
    studyPack: null,
    studyLoading: false,
    studyError: '',
    activeStudyTab: 'vocabulary',
    studyTabs: [
      { key: 'vocabulary', label: '生词' },
      { key: 'phrases', label: '短语' },
      { key: 'patterns', label: '句型' }
    ],
    studyCompleted: false,
    transcriptVisible: false,
    audioLocked: false,
    answerSummary: '',
    vocabularyCards: [],
    phraseCards: [],
    sentencePatternCards: []
  }),
  onLoad() {
    const legacyItem = wx.getStorageSync('currentListeningSetV1') || null;
    const itemId = legacyItem && (legacyItem._id || legacyItem.id || '');
    const snapshot = itemId ? snapshotStore.read(LISTENING_SET_SNAPSHOT_KEY, {
      id: itemId,
      maxAgeMs: 5 * 60 * 1000
    }) : null;
    const item = withImageDisplayMode((snapshot && snapshot.item) || legacyItem || null);
    const studyCompleted = item ? !!wx.getStorageSync(studyDoneKey(item)) : false;
    this.setData({
      item,
      questions: item ? buildQuestions(item) : [],
      answerSummary: item ? buildAnswerSummary(item) : '',
      studyCompleted,
      audioLocked: false
    });
    if (item && item.audioCloudPath) {
      this.prepareAudio(item.audioCloudPath);
    }
    if (item && item.images && item.images.length) {
      this.prepareImages(item.images);
    }
    if (item) {
      this.loadCachedStudyPack(item);
    }
  },
  onShow() {
    page.syncTheme(this);
  },
  onUnload() {
    if (this.audioMetaTimer) {
      clearTimeout(this.audioMetaTimer);
      this.audioMetaTimer = null;
    }
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
  },
  async prepareAudio(cloudPath) {
    if (this.audioMetaTimer) {
      clearTimeout(this.audioMetaTimer);
      this.audioMetaTimer = null;
    }
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
    this.lastAudioSecond = -1;
    this.lastSliderPreviewAt = 0;
    this.setData({
      audioLoading: true,
      audioError: '',
      audioSrc: '',
      isPlaying: false,
      audioDuration: 0,
      audioCurrentTime: 0,
      audioCurrentText: '00:00',
      audioDurationText: '00:00',
      audioProgress: 0,
      audioSliderMax: AUDIO_SLIDER_MAX,
      audioSeeking: false,
      audioEnded: false
    });
    try {
      const src = await store.getTempFileURL(cloudPath);
      if (!src) {
        this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
        return;
      }
      this.audio = wx.createInnerAudioContext();
      this.audio.obeyMuteSwitch = false;
      this.audio.src = src;
      this.audio.onCanplay(() => {
        if (this.audioMetaTimer) {
          clearTimeout(this.audioMetaTimer);
        }
        this.setData({ audioLoading: false });
        this.audioMetaTimer = setTimeout(() => {
          this.updateAudioProgress(this.audio && this.audio.currentTime, this.audio && this.audio.duration, true);
        }, 240);
      });
      this.audio.onPlay(() => this.setData({ isPlaying: true, audioLoading: false, audioError: '', audioEnded: false }));
      this.audio.onPause(() => this.setData({ isPlaying: false }));
      this.audio.onStop(() => this.setData({ isPlaying: false }));
      this.audio.onTimeUpdate(() => {
        if (!this.audio || this.data.audioSeeking) return;
        this.updateAudioProgress(this.audio.currentTime, this.audio.duration);
      });
      this.audio.onEnded(() => {
        const duration = this.data.audioDuration || (this.audio && this.audio.duration) || 0;
        this.updateAudioProgress(duration, duration, true);
        this.setData({ isPlaying: false, audioEnded: true });
      });
      this.audio.onError(() => this.setData({
        isPlaying: false,
        audioLoading: false,
        audioError: '音频播放失败'
      }));
      this.setData({ audioSrc: src, audioLoading: false });
    } catch (error) {
      this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
    }
  },
  updateAudioProgress(current, duration, force) {
    const nextDuration = Number(duration) || this.data.audioDuration || 0;
    const nextCurrent = normalizeAudioTime(current, nextDuration);
    const nextSecond = Math.floor(nextCurrent);
    if (!force && nextSecond === this.lastAudioSecond) return;
    this.lastAudioSecond = nextSecond;
    this.setData({
      audioDuration: nextDuration,
      audioCurrentTime: nextCurrent,
      audioCurrentText: formatAudioTime(nextCurrent),
      audioDurationText: formatAudioTime(nextDuration),
      audioProgress: nextDuration ? Math.round((nextCurrent / nextDuration) * AUDIO_SLIDER_MAX) : 0
    });
  },
  async prepareImages(images) {
    const fileList = (images || []).map((image) => image.cloudPath).filter(Boolean);
    if (!fileList.length) return;
    const entries = await Promise.all(fileList.map((cloudPath) => (
      store.getTempFileURL(cloudPath)
        .then((url) => ({ cloudPath, url }))
        .catch(() => ({ cloudPath, url: '' }))
    )));
    const urls = entries.reduce((map, entry) => {
      map[entry.cloudPath] = entry.url || '';
      return map;
    }, {});
    const item = withImageDisplayMode(Object.assign({}, this.data.item, {
      images: (images || []).map((image, index) => Object.assign({}, image, {
        label: image.label || PICTURE_LABELS[index] || String(index + 1),
        src: urls[image.cloudPath] || ''
      }))
    }));
    this.setData({ item });
  },
  toggleAudio() {
    if (this.data.audioLoading || !this.data.audioSrc) return;
    if (!this.audio) return;
    if (this.data.isPlaying) {
      this.audio.pause();
      return;
    }
    if (this.data.audioEnded) {
      this.audio.seek(0);
      this.updateAudioProgress(0, this.data.audioDuration, true);
    }
    this.audio.play();
  },
  seekAudio(event) {
    if (this.data.audioLoading || !this.audio || !this.data.audioSrc) return;
    const delta = Number(event.currentTarget.dataset.delta) || 0;
    const duration = this.data.audioDuration || this.audio.duration || 0;
    const current = normalizeAudioTime((this.audio.currentTime || 0) + delta, duration);
    this.audio.seek(current);
    this.updateAudioProgress(current, duration, true);
    this.setData({ audioEnded: false });
  },
  changingAudioProgress(event) {
    const duration = this.data.audioDuration || 0;
    const value = Number(event.detail.value) || 0;
    const current = duration ? duration * value / AUDIO_SLIDER_MAX : 0;
    const now = Date.now();
    if (now - this.lastSliderPreviewAt < 80) {
      return;
    }
    this.lastSliderPreviewAt = now;
    this.setData({
      audioSeeking: true,
      audioCurrentTime: current,
      audioCurrentText: formatAudioTime(current),
      audioProgress: value
    });
  },
  changeAudioProgress(event) {
    if (!this.audio || !this.data.audioSrc) return;
    const duration = this.data.audioDuration || this.audio.duration || 0;
    const value = Number(event.detail.value) || 0;
    const current = normalizeAudioTime(duration ? duration * value / AUDIO_SLIDER_MAX : 0, duration);
    this.audio.seek(current);
    this.lastAudioSecond = -1;
    this.setData({ audioSeeking: false, audioEnded: false });
    this.updateAudioProgress(current, duration, true);
  },
  selectOption(event) {
    const number = Number(event.currentTarget.dataset.number);
    const answer = event.currentTarget.dataset.option || '';
    const questions = (this.data.questions || []).map((question) => {
      if (question.number !== number) return question;
      return Object.assign({}, question, {
        selectedAnswer: answer,
        optionsList: question.optionsList.map((option) => Object.assign({}, option, {
          selected: option.key === answer
        }))
      });
    });
    this.setData({ questions });
  },
  inputAnswer(event) {
    const number = Number(event.currentTarget.dataset.number);
    const value = event.detail.value || '';
    const questions = (this.data.questions || []).map((question) => (
      question.number === number ? Object.assign({}, question, { inputValue: value }) : question
    ));
    this.setData({ questions });
  },
  submit() {
    let correctCount = 0;
    const questions = (this.data.questions || []).map((question) => {
      const userAnswer = String(question.selectedAnswer || question.inputValue || '').trim();
      const answer = String(question.answer || '').trim();
      const correct = !!answer && userAnswer.toLowerCase() === answer.toLowerCase();
      if (correct) correctCount += 1;
      return Object.assign({}, question, { checked: true, correct });
    });
    this.setData({ questions, submitted: true, correctCount });
  },
  completeStudy() {
    const item = this.data.item;
    if (!item || !this.data.studyPack) return;
    wx.setStorageSync(studyDoneKey(item), true);
    this.setData({
      studyCompleted: true,
      audioLocked: false,
      studyError: ''
    });
  },
  selectStudyTab(event) {
    this.setData({ activeStudyTab: event.currentTarget.dataset.tab || 'vocabulary' });
  },
  applyStudyPack(studyPack) {
    const pack = studyPack || {};
    this.setData({
      studyPack: pack,
      vocabularyCards: pack.vocabularyCards || [],
      phraseCards: pack.phraseCards || [],
      sentencePatternCards: pack.sentencePatternCards || []
    });
    recordListeningStudyPackSynced(this.data.item);
  },
  async loadCachedStudyPack(item) {
    const result = await store.getListeningStudyPack(item, { cacheOnly: true });
    const studyPack = result && result.studyPack;
    const hasCards = studyPack
      && ((studyPack.vocabularyCards || []).length || (studyPack.phraseCards || []).length || (studyPack.sentencePatternCards || []).length);
    if (hasCards) {
      this.applyStudyPack(studyPack);
    }
  },
  async loadStudyPack() {
    const item = this.data.item;
    if (!item || this.data.studyLoading) return;
    if (!String(item.transcript || '').trim()) {
      if (this.data.answerSummary) {
        this.setData({ transcriptVisible: true, studyError: '' });
        return;
      }
      this.setData({ studyError: '这套听力暂无文本，暂不能生成。' });
      return;
    }
    this.setData({ studyLoading: true, studyError: '', transcriptVisible: true });
    const result = await store.getListeningStudyPack(item, { useCache: false });
    let studyPack = result && result.studyPack;
    if (hasListeningStudyCards(studyPack)) {
      this.applyStudyPack(studyPack);
      this.setData({ studyLoading: false });
      return;
    }
    const cachedResult = await store.getListeningStudyPack(item, { cacheOnly: true, useCache: false });
    studyPack = cachedResult && cachedResult.studyPack;
    if (hasListeningStudyCards(studyPack)) {
      this.applyStudyPack(studyPack);
      this.setData({ studyLoading: false });
      return;
    }
    this.setData({
      studyLoading: false,
      studyError: getListeningStudyError(result)
    });
  }
});
