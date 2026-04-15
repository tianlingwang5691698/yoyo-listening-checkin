const store = require('../../utils/store');
const player = require('../../domain/player/index');
const cloud = require('../../domain/cloud/index');
const appConfig = require('../../data/app-config');
const page = require('../../utils/page');

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function getDisplayNameFromPath(path) {
  const normalizedPath = String(path || '').split('?')[0];
  const fileName = normalizedPath.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(fileName).replace(/\.[^.]+$/i, '');
}

function buildCurrentAudio(task, playableUrl, playbackMode) {
  if (!task || task.isPendingAsset) {
    return null;
  }
  const cloudPath = String(task.audioCloudPath || '').trim();
  const fileID = String(task.audioFileId || buildCloudFileId(cloudPath)).trim();
  const src = String(playableUrl || task.audioUrl || '').trim();
  const title = String(
    task.audioTitle
    || getDisplayNameFromPath(cloudPath || src)
    || task.title
    || task.displayTitle
    || ''
  ).trim();
  return {
    title,
    fileID,
    src,
    durationSec: Number(task.durationSec || 0),
    course: String(task.displayTitle || task.title || '').trim(),
    cloudPath,
    source: String(task.audioSource || 'none').trim(),
    playbackMode: String(playbackMode || 'idle').trim(),
    taskId: String(task.taskId || '').trim()
  };
}

Page({
  data: page.createCloudPageData({
    child: null,
    task: null,
    stats: {},
    todayRecord: null,
    history: [],
    progress: null,
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    transcriptSyncGranularity: 'word',
    currentTimeMs: 0,
    currentTimeLabel: '00:00',
    durationLabel: '00:00',
    progressPercent: 0,
    syncMode: 'cloud-error',
    isReviewBuild: false,
    showCloudDebug: false,
    syncDebug: null,
    isPlaying: false,
    playbackRate: 1,
    canRewind: false,
    activeLineId: '',
    activeLineIndex: -1,
    activeWordIndex: -1,
    transcriptScrollIntoView: '',
    prevLine: null,
    activeLine: null,
    activeWord: null,
    nextLine: null,
    audioSource: 'none',
    audioReady: false,
    audioResolving: false,
    audioError: '',
    audioErrorDetail: '',
    audioPlaybackMode: 'idle',
    currentAudio: null
  }),
  onLoad(query) {
    this.category = query.category || 'peppa';
    this.pendingAutoPlay = false;
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.obeyMuteSwitch = false;
    this.innerAudioContext.onCanplay(() => {
      const durationFromContext = Number(this.innerAudioContext.duration || 0);
      const taskDuration = (this.data.currentAudio && this.data.currentAudio.durationSec)
        || ((this.data.task && this.data.task.durationSec) || 0);
      this.setData({
        audioReady: true,
        audioResolving: false,
        audioError: '',
        audioErrorDetail: '',
        audioPlaybackMode: 'ready',
        durationLabel: this.formatTime(Math.floor(durationFromContext || taskDuration))
      });
      if (this.pendingAutoPlay) {
        this.pendingAutoPlay = false;
        this.innerAudioContext.play();
      }
    });
    this.innerAudioContext.onTimeUpdate(() => {
      const currentSeconds = this.innerAudioContext.currentTime || 0;
      const durationSeconds = (this.data.currentAudio && this.data.currentAudio.durationSec)
        || ((this.data.task && this.data.task.durationSec) || 0);
      const currentTimeMs = Math.floor(currentSeconds * 1000);
      this.updateTranscriptByTime(currentTimeMs);
      this.setData({
        currentTimeLabel: this.formatTime(Math.floor(currentSeconds)),
        progressPercent: player.getProgressPercent(currentSeconds, durationSeconds),
        canRewind: currentSeconds > 1
      });
    });
    this.innerAudioContext.onPlay(() => {
      this.setData({
        isPlaying: true,
        audioError: '',
        audioErrorDetail: ''
      });
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
        canRewind: false,
        audioReady: false,
        audioResolving: false,
        audioErrorDetail: '',
        audioPlaybackMode: 'idle',
        currentAudio: null
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
    this.innerAudioContext.onError((error) => {
      this.pendingAutoPlay = false;
      this.setData({
        isPlaying: false,
        audioReady: false,
        audioResolving: false,
        audioError: 'playback-error',
        audioErrorDetail: `${error.errCode || ''}`.trim(),
        audioPlaybackMode: 'error'
      });
      wx.showToast({
        title: '云端音频加载失败',
        icon: 'none'
      });
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
  async resolveTaskAudio(task) {
    if (!task || task.isPendingAsset) {
      return Object.assign({}, task, {
        audioUrl: '',
        audioFileId: '',
        audioSource: 'none',
        audioResolveError: ''
      });
    }
    const audioFileId = task.audioFileId || buildCloudFileId(task.audioCloudPath);
    let audioResolveError = '';
    if (audioFileId) {
      try {
        const tempUrl = await cloud.getTempFileURL(audioFileId);
        if (tempUrl) {
          return Object.assign({}, task, {
            audioUrl: tempUrl,
            audioFileId,
            audioSource: 'temp-url',
            audioResolveError
          });
        }
      } catch (error) {
        audioResolveError = 'temp-url-failed';
      }
    }
    return Object.assign({}, task, {
      audioFileId,
      audioSource: task.audioSource || (task.audioUrl ? 'static-cloud-url' : 'none'),
      audioResolveError
    });
  },
  downloadAudio(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
            resolve(response.tempFilePath);
            return;
          }
          reject(new Error(`download-${response.statusCode || 'failed'}`));
        },
        fail: reject
      });
    });
  },
  async syncPlayer(task) {
    const initialState = player.getInitialPlayerState((task && task.durationSec) || 0);
    const resolvedTask = await this.resolveTaskAudio(task);
    const missingAudio = buildCurrentAudio(resolvedTask, '', 'error');
    if (!resolvedTask || resolvedTask.isPendingAsset || !resolvedTask.audioUrl) {
      if (this.innerAudioContext) {
        this.innerAudioContext.stop();
      }
      this.setData(Object.assign({}, initialState, {
        currentAudio: missingAudio,
        audioSource: 'none',
        audioReady: false,
        audioResolving: false,
        audioError: resolvedTask && resolvedTask.audioResolveError ? resolvedTask.audioResolveError : 'missing-audio-url',
        audioErrorDetail: '',
        audioPlaybackMode: 'error'
      }));
      return;
    }
    let playableUrl = resolvedTask.audioUrl;
    let playbackMode = resolvedTask.audioSource === 'temp-url'
      ? 'temp-url'
      : (resolvedTask.audioResolveError ? 'static-fallback' : 'static-cloud-url');
    try {
      playableUrl = await this.downloadAudio(resolvedTask.audioUrl);
      playbackMode = 'downloaded';
    } catch (error) {
      if (!playableUrl) {
        this.setData(Object.assign({}, initialState, {
          audioSource: resolvedTask.audioSource || 'none',
          audioReady: false,
          audioResolving: false,
          audioError: 'download-failed',
          audioErrorDetail: '',
          audioPlaybackMode: 'error'
        }));
        wx.showToast({
          title: '云端音频下载失败',
          icon: 'none'
        });
        return;
      }
    }
    if (this.data.task !== resolvedTask) {
      this.setData({
        task: resolvedTask
      });
    }
    const currentAudio = buildCurrentAudio(resolvedTask, playableUrl, playbackMode);
    if (this.innerAudioContext && this.innerAudioContext.src !== playableUrl) {
      this.innerAudioContext.stop();
      this.innerAudioContext.src = playableUrl;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.playbackRate = 1;
    }
    this.setData(Object.assign({}, initialState, {
      currentAudio,
      audioSource: resolvedTask.audioSource || 'none',
      audioReady: false,
      audioResolving: true,
      audioError: '',
      audioErrorDetail: '',
      audioPlaybackMode: playbackMode
    }));
  },
  async refreshPage() {
    const detail = await store.getTaskDetail(this.category);
    const previewAudio = buildCurrentAudio(detail.task, '', 'idle');
    this.setData(page.buildCloudPageData(this.data, {
      child: detail.child,
      task: detail.task,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      transcriptSyncGranularity: detail.transcriptTrack ? (detail.transcriptTrack.syncGranularity || 'word') : 'word',
      history: detail.history,
      currentTimeMs: 0,
      currentTimeLabel: '00:00',
      progressPercent: 0,
      playbackRate: 1,
      canRewind: false,
      activeLineId: '',
      activeLineIndex: -1,
      activeWordIndex: -1,
      transcriptScrollIntoView: '',
      prevLine: null,
      activeLine: null,
      activeWord: null,
      nextLine: detail.transcriptTrack && detail.transcriptTrack.lines.length ? detail.transcriptTrack.lines[0] : null,
      currentAudio: previewAudio,
      audioSource: detail.task && detail.task.audioSource ? detail.task.audioSource : 'none',
      audioReady: false,
      audioResolving: false,
      audioError: '',
      audioErrorDetail: '',
      audioPlaybackMode: 'idle'
    }));
    if (detail.task) {
      await this.syncPlayer(detail.task);
      return;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
  },
  clearTranscriptState() {
    this.setData({
      currentTimeMs: 0,
      currentTimeLabel: '00:00',
      progressPercent: 0,
      canRewind: false,
      activeLineId: '',
      activeLineIndex: -1,
      activeWordIndex: -1,
      transcriptScrollIntoView: '',
      prevLine: null,
      activeLine: null,
      activeWord: null,
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
    const words = activeLine && activeLine.words ? activeLine.words : [];
    let activeWordIndex = -1;
    if (this.data.transcriptSyncGranularity === 'word' && words.length) {
      activeWordIndex = words.findIndex((word, index) => {
        const next = words[index + 1];
        const nextStart = next ? next.startMs : Number.POSITIVE_INFINITY;
        return timeMs >= word.startMs && timeMs < nextStart;
      });
      if (activeWordIndex < 0) {
        activeWordIndex = timeMs < words[0].startMs ? 0 : words.length - 1;
      }
    }
    this.setData({
      currentTimeMs: timeMs,
      activeLineIndex: activeIndex,
      activeLineId: activeLine ? activeLine.lineId : '',
      activeWordIndex,
      transcriptScrollIntoView: activeLine ? `line-${activeLine.lineId}` : '',
      prevLine,
      activeLine,
      activeWord: activeWordIndex >= 0 ? words[activeWordIndex] : null,
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
    const currentTimeMs = Number(this.data.currentTimeMs || 0);
    if (line.startMs > currentTimeMs + 300) {
      wx.showToast({
        title: '这里只能回退，不能快进',
        icon: 'none'
      });
      return;
    }
    const seconds = Math.floor(line.startMs / 1000);
    this.innerAudioContext.seek(seconds);
    this.innerAudioContext.play();
    this.updateTranscriptByTime(line.startMs);
  },
  async toggleAudio() {
    if (!this.data.task || this.data.task.isPendingAsset || !this.innerAudioContext) {
      return;
    }
    this.pendingAutoPlay = false;
    if (!this.innerAudioContext.src) {
      this.pendingAutoPlay = true;
      await this.syncPlayer(this.data.task);
    }
    if (!this.innerAudioContext.src) {
      wx.showToast({
        title: '云端音频暂时不可用',
        icon: 'none'
      });
      return;
    }
    if (this.data.isPlaying) {
      this.innerAudioContext.pause();
    } else {
      if (this.data.audioReady) {
        this.innerAudioContext.play();
      } else {
        this.pendingAutoPlay = true;
        this.setData({
          audioResolving: true,
          audioError: '',
          audioPlaybackMode: 'resolving'
        });
        wx.showToast({
          title: '音频加载中',
          icon: 'none'
        });
      }
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
      progressPercent: player.getProgressPercent(nextValue, (this.data.currentAudio && this.data.currentAudio.durationSec) || (this.data.task && this.data.task.durationSec)),
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
    this.setData(page.buildCloudPageData(this.data, {
      child: detail.child,
      task: detail.task,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      transcriptSyncGranularity: detail.transcriptTrack ? (detail.transcriptTrack.syncGranularity || 'word') : 'word',
      history: detail.history,
      audioSource: detail.task && detail.task.audioSource ? detail.task.audioSource : 'none',
      playbackRate: 1
    }));
    await this.syncPlayer(detail.task);
    wx.showToast({
      title: detail.progress.completedToday ? `${detail.task.categoryLabel} 今天完成` : `已完成第 ${detail.progress.playCount} 遍`,
      icon: 'none'
    });
  }
});
