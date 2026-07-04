const page = require('../../../utils/page');
const store = require('../../../utils/store');
const snapshotStore = require('../../../utils/snapshot');

const PICTURE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LISTENING_SET_SNAPSHOT_KEY = 'currentListeningSetV1';

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

Page({
  data: page.createCloudPageData({
    item: null,
    questions: [],
    audioSrc: '',
    audioLoading: false,
    audioError: '',
    isPlaying: false,
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
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
  },
  async prepareAudio(cloudPath) {
    this.setData({ audioLoading: true, audioError: '' });
    try {
      const src = await store.getTempFileURL(cloudPath);
      if (!src) {
        this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
        return;
      }
      this.audio = wx.createInnerAudioContext();
      this.audio.src = src;
      this.audio.onEnded(() => this.setData({ isPlaying: false }));
      this.audio.onError(() => this.setData({ isPlaying: false, audioError: '音频播放失败' }));
      this.setData({ audioSrc: src, audioLoading: false });
    } catch (error) {
      this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
    }
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
      this.setData({ isPlaying: false });
      return;
    }
    this.audio.play();
    this.setData({ isPlaying: true });
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
      this.setData({ studyError: '这套听力暂无文本，暂不能生成。' });
      return;
    }
    this.setData({ studyLoading: true, studyError: '', transcriptVisible: true });
    const result = await store.getListeningStudyPack(item, { useCache: false });
    const studyPack = result && result.studyPack;
    const hasCards = studyPack
      && ((studyPack.vocabularyCards || []).length || (studyPack.phraseCards || []).length || (studyPack.sentencePatternCards || []).length);
    if (hasCards) {
      this.applyStudyPack(studyPack);
      this.setData({ studyLoading: false });
      return;
    }
    this.setData({
      studyLoading: false,
      studyError: '生成失败，稍后重试。'
    });
  }
});
