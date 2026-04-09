const store = require('../../utils/store');
const player = require('../../domain/player/index');

Page({
  data: {
    child: null,
    task: null,
    stats: {},
    todayRecord: null,
    history: [],
    progress: null,
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    currentTimeMs: 0,
    currentTimeLabel: '00:00',
    durationLabel: '00:00',
    progressPercent: 0,
    isPlaying: false,
    playbackRate: 1,
    canRewind: false,
    activeLineId: '',
    activeLineIndex: -1,
    transcriptScrollIntoView: '',
    prevLine: null,
    activeLine: null,
    nextLine: null
  },
  onLoad(query) {
    this.category = query.category || 'peppa';
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.obeyMuteSwitch = false;
    this.innerAudioContext.onTimeUpdate(() => {
      const currentSeconds = this.innerAudioContext.currentTime || 0;
      const durationSeconds = (this.data.task && this.data.task.durationSec) || 0;
      const currentTimeMs = Math.floor(currentSeconds * 1000);
      this.updateTranscriptByTime(currentTimeMs);
      this.setData({
        currentTimeLabel: this.formatTime(Math.floor(currentSeconds)),
        progressPercent: player.getProgressPercent(currentSeconds, durationSeconds),
        canRewind: currentSeconds > 1
      });
    });
    this.innerAudioContext.onPlay(() => {
      this.setData({ isPlaying: true });
    });
    this.innerAudioContext.onPause(() => {
      this.setData({ isPlaying: false });
    });
    this.innerAudioContext.onStop(() => {
      this.setData({
        isPlaying: false,
        currentTimeMs: 0,
        currentTimeLabel: '00:00',
        progressPercent: 0,
        canRewind: false
      });
    });
    this.innerAudioContext.onEnded(() => {
      this.setData({
        isPlaying: false,
        currentTimeMs: 0,
        currentTimeLabel: '00:00',
        progressPercent: 100,
        canRewind: false
      });
      this.handleAudioEnded();
    });
  },
  async onShow() {
    await this.refreshPage();
  },
  onHide() {
    if (this.innerAudioContext) {
      this.innerAudioContext.pause();
    }
    this.clearTranscriptState();
  },
  onUnload() {
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
  },
  formatTime(totalSeconds) {
    return player.formatTime(totalSeconds);
  },
  syncPlayer(task) {
    const initialState = player.getInitialPlayerState((task && task.durationSec) || 0);
    if (!task || task.isPendingAsset || !task.audioUrl) {
      if (this.innerAudioContext) {
        this.innerAudioContext.stop();
      }
      this.setData(initialState);
      return;
    }
    if (this.innerAudioContext && this.innerAudioContext.src !== task.audioUrl) {
      this.innerAudioContext.stop();
      this.innerAudioContext.src = task.audioUrl;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.playbackRate = 1;
    }
    this.setData(initialState);
  },
  async refreshPage() {
    const detail = await store.getTaskDetail(this.category);
    this.setData({
      child: detail.child,
      task: detail.task,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      history: detail.history,
      currentTimeMs: 0,
      currentTimeLabel: '00:00',
      progressPercent: 0,
      canRewind: false,
      activeLineId: '',
      activeLineIndex: -1,
      transcriptScrollIntoView: '',
      prevLine: null,
      activeLine: null,
      nextLine: detail.transcriptTrack && detail.transcriptTrack.lines.length ? detail.transcriptTrack.lines[0] : null
    });
    this.syncPlayer(detail.task);
  },
  clearTranscriptState() {
    this.setData({
      currentTimeMs: 0,
      currentTimeLabel: '00:00',
      progressPercent: 0,
      canRewind: false,
      activeLineId: '',
      activeLineIndex: -1,
      transcriptScrollIntoView: '',
      prevLine: null,
      activeLine: null,
      nextLine: null
    });
  },
  updateTranscriptByTime(timeMs) {
    const lines = this.data.transcriptLines || [];
    if (!lines.length) {
      return;
    }
    let activeIndex = lines.findIndex((line, index) => {
      const next = lines[index + 1];
      const nextStart = next ? next.startMs : Number.POSITIVE_INFINITY;
      return timeMs >= line.startMs && timeMs < nextStart;
    });
    if (activeIndex < 0) {
      activeIndex = timeMs < lines[0].startMs ? 0 : lines.length - 1;
    }
    const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;
    const prevLine = activeIndex > 0 ? lines[activeIndex - 1] : null;
    const nextLine = activeIndex >= 0 && activeIndex < lines.length - 1 ? lines[activeIndex + 1] : null;
    this.setData({
      currentTimeMs: timeMs,
      activeLineIndex: activeIndex,
      activeLineId: activeLine ? activeLine.lineId : '',
      transcriptScrollIntoView: activeLine ? `line-${activeLine.lineId}` : '',
      prevLine,
      activeLine,
      nextLine
    });
  },
  handleAudioTimeUpdate(event) {
    this.updateTranscriptByTime(Math.floor((event.detail.currentTime || 0) * 1000));
  },
  handleMediaSeek(event) {
    this.updateTranscriptByTime(Math.floor((event.detail.position || 0) * 1000));
  },
  seekToLine(event) {
    const index = Number(event.currentTarget.dataset.index);
    const line = this.data.transcriptLines[index];
    if (!line || !this.innerAudioContext) {
      return;
    }
    const seconds = Math.floor(line.startMs / 1000);
    this.innerAudioContext.seek(seconds);
    this.innerAudioContext.play();
    this.updateTranscriptByTime(line.startMs);
  },
  toggleAudio() {
    if (!this.data.task || this.data.task.isPendingAsset || !this.innerAudioContext) {
      return;
    }
    if (this.data.isPlaying) {
      this.innerAudioContext.pause();
    } else {
      this.innerAudioContext.play();
    }
  },
  rewindAudio() {
    if (!this.innerAudioContext) {
      return;
    }
    const current = this.innerAudioContext.currentTime || 0;
    const nextValue = Math.max(0, current - 5);
    this.innerAudioContext.seek(nextValue);
    this.setData({
      currentTimeLabel: this.formatTime(nextValue),
      progressPercent: player.getProgressPercent(nextValue, this.data.task && this.data.task.durationSec),
      canRewind: nextValue > 1
    });
    this.updateTranscriptByTime(nextValue * 1000);
  },
  togglePlaybackRate() {
    if (!this.innerAudioContext) {
      return;
    }
    const nextRate = this.data.playbackRate === 1 ? 0.8 : 1;
    this.innerAudioContext.playbackRate = nextRate;
    this.setData({
      playbackRate: nextRate
    });
  },
  async handleAudioEnded() {
    if (!this.data.task || this.data.task.isPendingAsset) {
      return;
    }
    const detail = await store.markTaskListened({
      childId: this.data.child.childId,
      category: this.category
    });
    this.setData({
      child: detail.child,
      task: detail.task,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      history: detail.history
    });
    this.syncPlayer(detail.task);
    wx.showToast({
      title: detail.progress.completedToday ? `${detail.task.categoryLabel} 今天完成` : `已完成第 ${detail.progress.playCount} 遍`,
      icon: 'none'
    });
  }
});
