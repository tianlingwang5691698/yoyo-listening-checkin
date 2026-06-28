const store = require('../../../utils/store');
const page = require('../../../utils/page');
const labels = require('../../../utils/labels');

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? `${month}月${day}日` : '日报详情';
}

function formatClock(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimeLines(item) {
  const playMoments = Array.isArray(item.playMoments) ? item.playMoments : [];
  const lines = playMoments
    .map((value, index) => ({
      key: `${item.category}-${item.taskId || 'task'}-${index}`,
      label: `第 ${index + 1} 遍`,
      timeText: formatClock(value)
    }))
    .filter((entry) => entry.timeText);
  if (lines.length) {
    return lines;
  }
  if ((item.playCount || 0) > 0 && item.updatedAt) {
    const timeText = formatClock(item.updatedAt);
    if (timeText) {
      return [{
        key: `${item.category}-${item.taskId || 'task'}-latest`,
        label: '最近一次',
        timeText
      }];
    }
  }
  return [];
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}秒` : '';
}

function normalizeSpeakingAttempt(item, index) {
  const safeItem = item || {};
  const score = Number(safeItem.score || 0);
  const pronunciationScore = Number(safeItem.pronunciationFluencyScore || 0);
  const contentScore = Number(safeItem.contentGrammarScore || 0);
  return {
    key: safeItem.attemptId || `${safeItem.taskId || 'task'}-${safeItem.attemptIndex || index}-${safeItem.createdAt || index}`,
    title: safeItem.attemptType === 'unlock_sentence_repeat' ? '跟读录音' : '回答录音',
    questionText: safeItem.questionText || '本次录音',
    studentTranscript: safeItem.studentTranscript || '',
    feedback: safeItem.feedback || '',
    score,
    pronunciationScore,
    contentScore,
    status: safeItem.status || '',
    scoreText: safeItem.status === 'score-pending' ? '待评分' : (score ? `${score} 分` : '已保存'),
    scoreDetailText: (pronunciationScore || contentScore) ? `发音 ${pronunciationScore || 0} · 内容 ${contentScore || 0}` : '',
    answerDurationText: formatDuration(safeItem.answerDurationMs),
    createdTimeText: formatClock(safeItem.createdAt),
    answerAudioFileId: safeItem.answerAudioFileId || '',
    answerCloudPath: safeItem.answerCloudPath || ''
  };
}

function buildSpeakingSummary(attempts) {
  const scored = (attempts || []).filter((item) => Number(item.score || 0) > 0);
  const total = scored.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const averageScore = scored.length ? Math.round(total / scored.length) : 0;
  return {
    totalCount: (attempts || []).length,
    scoredCount: scored.length,
    averageScore,
    latestScore: scored.length ? Number(scored[scored.length - 1].score || 0) : 0
  };
}

function normalizeReport(report) {
  const safeReport = report || {};
  const items = (safeReport.items || []).map((item) => Object.assign({}, labels.normalizeReportItem(item), {
    timeLines: buildTimeLines(item)
  }));
  const speakingAttempts = (safeReport.speakingAttempts || []).map(normalizeSpeakingAttempt);
  const speakingSummary = buildSpeakingSummary(speakingAttempts);
  const completedCount = items.filter((item) => item.completedToday).length;
  return {
    date: safeReport.date || '',
    dateLabel: formatDateLabel(safeReport.date),
    totalMinutes: safeReport.totalMinutes || 0,
    completedCount,
    totalCount: items.length,
    items,
    speakingAttempts,
    speakingSummary
  };
}

Page({
  data: page.createCloudPageData({
    date: '',
    report: {
      date: '',
      dateLabel: '',
      totalMinutes: 0,
      completedCount: 0,
      totalCount: 0,
      items: [],
      speakingAttempts: [],
      speakingSummary: {
        totalCount: 0,
        scoredCount: 0,
        averageScore: 0,
        latestScore: 0
      }
    },
    playingAttemptKey: '',
    pausedAttemptKey: '',
    loadingAttemptKey: ''
  }),
  onLoad(options) {
    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.obeyMuteSwitch = false;
    this.audioContext.onPlay(() => {
      this.setData({ loadingAttemptKey: '', pausedAttemptKey: '' });
    });
    this.audioContext.onCanplay(() => {
      this.setData({ loadingAttemptKey: '' });
    });
    this.audioContext.onWaiting(() => {
      if (this.data.playingAttemptKey) {
        this.setData({ loadingAttemptKey: this.data.playingAttemptKey });
      }
    });
    this.audioContext.onPause(() => {
      this.setData({
        pausedAttemptKey: this.data.playingAttemptKey,
        loadingAttemptKey: ''
      });
    });
    this.audioContext.onEnded(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
    });
    this.audioContext.onStop(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
    });
    this.audioContext.onError(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
      wx.showToast({ title: '录音播放失败', icon: 'none' });
    });
    const date = String((options && options.date) || '').slice(0, 10) || getTodayKey();
    this.setData({ date });
    wx.setNavigationBarTitle({
      title: formatDateLabel(date)
    });
  },
  onUnload() {
    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }
  },
  onShow() {
    page.syncTheme(this);
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const applyData = (data) => {
      this.setData(page.buildCloudPageData(this.data, {
        date: this.data.date,
        report: normalizeReport(data.report)
      }));
    };
    store.getDailyReportByDate(this.data.date, applyData).then(applyData);
  },
  async playSpeakingAttempt(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const attempt = (this.data.report.speakingAttempts || [])[index] || null;
    if (!attempt || !this.audioContext) {
      return;
    }
    if (this.data.playingAttemptKey === attempt.key) {
      if (this.data.pausedAttemptKey === attempt.key) {
        this.setData({ loadingAttemptKey: attempt.key });
        this.audioContext.play();
      } else {
        this.setData({ loadingAttemptKey: '' });
        this.audioContext.pause();
      }
      return;
    }
    const fileId = String(attempt.answerAudioFileId || '').trim();
    if (!fileId) {
      wx.showToast({ title: '录音暂不可播放', icon: 'none' });
      return;
    }
    this.setData({ loadingAttemptKey: attempt.key, pausedAttemptKey: '' });
    try {
      const src = await store.getTempFileURL(fileId);
      if (!src) {
        throw new Error('empty-temp-url');
      }
      this.audioContext.stop();
      this.audioContext.src = src;
      this.setData({ playingAttemptKey: attempt.key, loadingAttemptKey: attempt.key });
      this.audioContext.play();
    } catch (error) {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
      wx.showToast({ title: '录音加载失败', icon: 'none' });
    }
  }
});
