const page = require('../../utils/page');
const store = require('../../utils/store');

const EXERCISES = [
  {
    id: 'sentence-1',
    title: '句子跟读',
    meta: '10 秒以内',
    prompt: 'I usually read English aloud after dinner.'
  },
  {
    id: 'sentence-2',
    title: '校园表达',
    meta: '适合初中',
    prompt: 'Our school life is busy but interesting.'
  },
  {
    id: 'sentence-3',
    title: '观点表达',
    meta: '适合高中',
    prompt: 'I think practice is the best way to improve spoken English.'
  }
];

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}秒` : '';
}

Page({
  data: page.createCloudPageData({
    exercises: EXERCISES,
    activeId: EXERCISES[0].id,
    activeExercise: EXERCISES[0],
    recording: false,
    tempFilePath: '',
    recordStartedAt: 0,
    recordDurationMs: 0,
    recordDurationText: '',
    submitting: false,
    questionPlaying: false,
    questionLoading: false,
    result: null,
    errorText: ''
  }),

  onLoad() {
    page.syncTheme(this);
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStop((res) => {
      const durationMs = Number(res.duration || 0) || (this.data.recordStartedAt ? Date.now() - this.data.recordStartedAt : 0);
      this.setData({
        recording: false,
        tempFilePath: res.tempFilePath || '',
        recordDurationMs: durationMs,
        recordDurationText: formatDuration(durationMs),
        errorText: ''
      });
      if (res.tempFilePath) {
        setTimeout(() => this.submitPronunciation(), 120);
      }
    });
    this.recorderManager.onError(() => {
      this.setData({
        recording: false,
        errorText: '录音没有成功，请重新录一次。'
      });
    });
    this.questionAudioContext = wx.createInnerAudioContext();
    this.questionAudioContext.obeyMuteSwitch = false;
    this.questionAudioContext.onPlay(() => {
      this.setData({ questionPlaying: true, questionLoading: false });
    });
    this.questionAudioContext.onEnded(() => {
      this.setData({ questionPlaying: false });
    });
    this.questionAudioContext.onStop(() => {
      this.setData({ questionPlaying: false });
    });
    this.questionAudioContext.onError(() => {
      this.setData({
        questionPlaying: false,
        questionLoading: false,
        errorText: '问题播放失败，请稍后再试。'
      });
    });
  },

  onShow() {
    page.syncTheme(this);
  },

  onUnload() {
    if (this.recorderManager && this.data.recording) {
      this.recorderManager.stop();
    }
    if (this.questionAudioContext) {
      this.questionAudioContext.destroy();
      this.questionAudioContext = null;
    }
  },

  selectExercise(event) {
    const id = event.currentTarget.dataset.id;
    const activeExercise = EXERCISES.find((item) => item.id === id) || EXERCISES[0];
    this.setData({
      activeId: activeExercise.id,
      activeExercise,
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      questionPlaying: false,
      questionLoading: false,
      errorText: ''
    });
  },

  async playQuestion() {
    if (!this.questionAudioContext || this.data.recording || this.data.questionLoading) {
      return;
    }
    if (this.data.questionPlaying) {
      this.questionAudioContext.stop();
      return;
    }
    const active = this.data.activeExercise || EXERCISES[0];
    this.setData({ questionLoading: true, errorText: '' });
    try {
      const result = await store.synthesizeReadingAudio({
        text: active.prompt,
        skipYoudao: true
      });
      const src = result.audioUrl || (result.fileId ? await store.getTempFileURL(result.fileId) : '');
      if (!src) {
        throw new Error('empty-question-audio');
      }
      this.questionAudioContext.stop();
      this.questionAudioContext.src = src;
      this.questionAudioContext.play();
    } catch (error) {
      this.setData({
        questionLoading: false,
        questionPlaying: false,
        errorText: '问题播放失败，请稍后再试。'
      });
    }
  },

  startRecord() {
    if (this.data.recording || this.data.submitting) {
      return;
    }
    if (this.questionAudioContext) {
      this.questionAudioContext.stop();
    }
    this.setData({
      recording: true,
      tempFilePath: '',
      recordStartedAt: Date.now(),
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      errorText: ''
    });
    this.recorderManager.start({
      duration: 20000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 64000,
      format: 'mp3'
    });
  },

  stopRecord() {
    if (this.recorderManager && this.data.recording) {
      this.recorderManager.stop();
    }
  },

  holdToRecordStart() {
    this.startRecord();
  },

  holdToRecordEnd() {
    if (!this.data.recording) {
      return;
    }
    this.stopRecord();
  },

  async submitPronunciation() {
    if (!this.data.tempFilePath || this.data.submitting) {
      return;
    }
    const active = this.data.activeExercise || EXERCISES[0];
    this.setData({ submitting: true, errorText: '', result: null });
    try {
      const upload = await store.createSpeakingUploadUrl({
        category: 'speaking',
        taskId: active.id,
        attemptType: 'standalone_sentence_repeat'
      });
      const fileId = await store.uploadSpeakingAudio(upload.cloudPath, this.data.tempFilePath);
      const response = await store.evaluateSpeakingPronunciation({
        category: 'speaking',
        taskId: active.id,
        attemptType: 'standalone_sentence_repeat',
        answerAudioFileId: fileId,
        answerCloudPath: upload.cloudPath,
        answerDurationMs: this.data.recordDurationMs,
        refText: active.prompt
      });
      this.setData({
        result: response.pronunciation || null,
        tempFilePath: ''
      });
    } catch (error) {
      this.setData({
        errorText: '评分暂时没有成功，请稍后再试。'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
