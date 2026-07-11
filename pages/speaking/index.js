const page = require('../../utils/page');
const store = require('../../utils/store');
const effects = require('../../utils/effects');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('speaking', key, undefined, fallback);

const EXERCISES = [
  {
    id: 'sentence-1',
    title: text('repeat', '句子跟读'),
    meta: text('under10', '10 秒以内'),
    prompt: 'I usually read English aloud after dinner.'
  },
  {
    id: 'sentence-2',
    title: text('campus', '校园表达'),
    meta: text('junior', '适合初中'),
    prompt: 'Our school life is busy but interesting.'
  },
  {
    id: 'sentence-3',
    title: text('opinion', '观点表达'),
    meta: text('senior', '适合高中'),
    prompt: 'I think practice is the best way to improve spoken English.'
  }
];

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}${text('scoreUnit', ' 秒').replace('分', '秒').replace(' points', ' sec')}` : '';
}

function localizeExercises() {
  const keys = [['repeat', 'under10'], ['campus', 'junior'], ['opinion', 'senior']];
  return EXERCISES.map((item, index) => Object.assign({}, item, {
    title: text(keys[index][0], item.title),
    meta: text(keys[index][1], item.meta)
  }));
}

Page({
  data: page.createCloudPageData({
    exercises: localizeExercises(),
    activeId: EXERCISES[0].id,
    activeExercise: localizeExercises()[0],
    recording: false,
    tempFilePath: '',
    recordStartedAt: 0,
    recordDurationMs: 0,
    recordDurationText: '',
    submitting: false,
    questionPlaying: false,
    questionLoading: false,
    result: null,
    resultCelebrating: false,
    errorText: ''
  }),

  onLoad() {
    this.speakingPerf = page.startPagePerf('speaking');
    page.syncTheme(this);
    const exercises = localizeExercises();
    this.setData({ exercises, activeExercise: exercises[0] });
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
        errorText: text('recordFailed', '录音没有成功，请重新录一次。')
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
        errorText: text('playFailed', '问题播放失败，请稍后再试。')
      });
    });
    this.speakingPerf.ready('pageReady', {
      source: 'static',
      cacheHit: true,
      exercises: EXERCISES.length
    });
  },

  onShow() {
    page.syncTheme(this);
    const currentId = this.data.activeId;
    const exercises = localizeExercises();
    this.setData({
      exercises,
      activeExercise: exercises.find((item) => item.id === currentId) || exercises[0]
    });
  },

  onUnload() {
    if (this.recorderManager && this.data.recording) {
      this.recorderManager.stop();
    }
    if (this.questionAudioContext) {
      this.questionAudioContext.destroy();
      this.questionAudioContext = null;
    }
    if (this.resultEffectTimer) {
      clearTimeout(this.resultEffectTimer);
      this.resultEffectTimer = null;
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
        errorText: text('playFailed', '问题播放失败，请稍后再试。')
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
      if (response.pronunciation) {
        this.playScoreEffect();
      }
    } catch (error) {
      this.setData({
        errorText: text('scoreFailed', '评分暂时没有成功，请稍后再试。')
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
  playScoreEffect() {
    if (this.resultEffectTimer) {
      clearTimeout(this.resultEffectTimer);
    }
    effects.playComplete({
      onceKey: `speaking:${effects.todayKey()}:${this.data.activeId || 'current'}`
    });
    this.setData({ resultCelebrating: true });
    this.resultEffectTimer = setTimeout(() => {
      this.resultEffectTimer = null;
      this.setData({ resultCelebrating: false });
    }, 1500);
  }
});
