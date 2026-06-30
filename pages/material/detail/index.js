const page = require('../../../utils/page');

function buildQuestions(item) {
  return (item.questions || []).map((question) => ({
    number: question.number,
    prompt: question.prompt,
    questionType: question.questionType || 'blank',
    optionsList: Object.keys(question.options || {}).map((key) => ({
      key,
      text: question.options[key],
      selected: false
    })),
    inputValue: '',
    selectedAnswer: '',
    answer: question.answer || '',
    checked: false,
    correct: false
  }));
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
    correctCount: 0
  }),
  onLoad() {
    const item = wx.getStorageSync('currentListeningSetV1') || null;
    this.setData({
      item,
      questions: item ? buildQuestions(item) : []
    });
    if (item && item.audioCloudPath) {
      this.prepareAudio(item.audioCloudPath);
    }
    if (item && item.images && item.images.length) {
      this.prepareImages(item.images);
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
  prepareAudio(cloudPath) {
    this.setData({ audioLoading: true, audioError: '' });
    wx.cloud.getTempFileURL({
      fileList: [cloudPath],
      success: (res) => {
        const file = res.fileList && res.fileList[0];
        const src = file && file.tempFileURL ? file.tempFileURL : '';
        if (!src) {
          this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
          return;
        }
        this.audio = wx.createInnerAudioContext();
        this.audio.src = src;
        this.audio.onEnded(() => this.setData({ isPlaying: false }));
        this.audio.onError(() => this.setData({ isPlaying: false, audioError: '音频播放失败' }));
        this.setData({ audioSrc: src, audioLoading: false });
      },
      fail: () => {
        this.setData({ audioLoading: false, audioError: '音频暂时无法加载' });
      }
    });
  },
  prepareImages(images) {
    const fileList = (images || []).map((image) => image.cloudPath).filter(Boolean);
    if (!fileList.length) return;
    wx.cloud.getTempFileURL({
      fileList,
      success: (res) => {
        const urls = {};
        (res.fileList || []).forEach((file) => {
          urls[file.fileID] = file.tempFileURL || '';
        });
        const item = Object.assign({}, this.data.item, {
          images: (images || []).map((image) => Object.assign({}, image, {
            src: urls[image.cloudPath] || ''
          }))
        });
        this.setData({ item });
      }
    });
  },
  toggleAudio() {
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
  }
});
