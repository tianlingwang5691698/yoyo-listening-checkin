const store = require('../../utils/store');
const player = require('../../domain/player/index');
const appConfig = require('../../data/app-config');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const monitor = require('../../utils/monitor');

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
  return labels.decodeHtmlEntities(decodeURIComponent(fileName).replace(/\.[^.]+$/i, ''));
}

function normalizePlayableUrl(url) {
  const raw = String(url || '').trim();
  if (!/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const queryIndex = raw.indexOf('?');
  const basePart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex) : '';
  const matched = basePart.match(/^(https?:\/\/[^/]+)\/?(.*)$/i);
  if (!matched) {
    return raw;
  }
  const origin = matched[1];
  const rawPath = matched[2] || '';
  const encodedPath = rawPath
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch (error) {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
  return `${origin}/${encodedPath}${queryPart}`;
}

function buildCurrentAudio(task, playableUrl, playbackMode) {
  if (!task || task.isPendingAsset) {
    return null;
  }
  const cloudPath = String(task.audioCloudPath || '').trim();
  const fileID = String(task.audioFileId || buildCloudFileId(cloudPath)).trim();
  const src = normalizePlayableUrl(String(playableUrl || task.audioUrl || '').trim());
  const title = String(
    labels.decodeHtmlEntities(task.audioTitle)
    || getDisplayNameFromPath(cloudPath || src)
    || labels.decodeHtmlEntities(task.title)
    || labels.decodeHtmlEntities(task.displayTitle)
    || ''
  ).trim();
  return {
    title,
    fileID,
    src,
    durationSec: Number(task.durationSec || 0),
    course: labels.decodeHtmlEntities(String(task.displayTitle || task.title || '').trim()),
    cloudPath,
    source: String(task.audioSource || 'none').trim(),
    playbackMode: String(playbackMode || 'idle').trim(),
    taskId: String(task.taskId || '').trim()
  };
}

function buildPassSteps(progress) {
  const repeatTarget = Number((progress && progress.repeatTarget) || 3);
  const playCount = Number((progress && progress.playCount) || 0);
  const steps = [];
  for (let step = 1; step <= repeatTarget; step += 1) {
    steps.push({
      key: `step-${step}`,
      text: String(step),
      done: playCount >= step,
      current: playCount + 1 === step && playCount < repeatTarget
    });
  }
  if (steps.length && playCount <= 0) {
    steps[0].current = true;
  }
  return steps;
}

function buildPreviewProgress(progress, playCount, task) {
  const repeatTarget = Number((progress && progress.repeatTarget) || 3);
  const safePlayCount = Math.max(0, Math.min(Number(playCount || 0), repeatTarget));
  const currentPass = safePlayCount >= repeatTarget ? repeatTarget : safePlayCount + 1;
  const speakingMode = String((task && task.speakingMode) || '').trim();
  const planPhase = String((task && task.planPhase) || '').trim();
  const transcriptVisible = speakingMode === 'nce-question-answer'
    ? currentPass === 1
    : (planPhase === 'round-2' ? currentPass === 1 : currentPass !== 2 || safePlayCount >= repeatTarget);
  return Object.assign({}, progress, {
    playCount: safePlayCount,
    currentPass,
    repeatTarget,
    playStepText: `${safePlayCount}/${repeatTarget}`,
    textUnlocked: safePlayCount >= repeatTarget - 1,
    transcriptVisible,
    completedToday: safePlayCount >= repeatTarget
  });
}

function buildPreviewTask(task, progress) {
  return Object.assign({}, task, {
    playCount: progress.playCount,
    currentPass: progress.currentPass,
    playStepText: progress.playStepText,
    textUnlocked: progress.textUnlocked,
    transcriptVisible: progress.transcriptVisible,
    completedToday: progress.completedToday,
    note: progress.completedToday ? '预览已完成。' : `预览第 ${progress.currentPass} 遍。`
  });
}

function buildLocalSpeakingSummary(attempts) {
  const scores = (attempts || []).map((item) => Number(item.score || 0)).filter((score) => score > 0);
  const latestScore = scores.length ? scores[scores.length - 1] : 0;
  const bestScore = scores.length ? Math.max.apply(null, scores) : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  return { latestScore, bestScore, averageScore, scoredCount: scores.length };
}

function normalizeSpeakingAttempts(attempts) {
  return (attempts || []).map((item) => {
    const feedback = String(item.feedback || '').replace(/模型繁忙，?/g, '录音已保存，');
    return Object.assign({}, item, { feedback });
  });
}

function formatRecordDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}秒` : '';
}

function formatAudioErrorText(code) {
  const value = String(code || '').trim();
  if (!value) {
    return '';
  }
  if (value === 'playback-error') {
    return '音频暂时不可用，请重新加载。';
  }
  if (value === 'temp-url-failed') {
    return '音频地址获取失败，请重新加载。';
  }
  if (value === 'missing-audio-url') {
    return '当前音频还没有准备好。';
  }
  return '云端音频暂时不可用，请稍后再试。';
}

Page({
  data: page.createCloudPageData({
    child: null,
    currentMember: {},
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
    playbackRateText: '1.0',
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
    audioErrorText: '',
    audioErrorDetail: '',
    audioPlaybackMode: 'idle',
    currentAudio: null,
    studyWriteAllowed: true,
    studyModeLabel: '学生设备',
    isPreviewMode: false,
    checkinReady: false,
    transcriptPendingLoad: false,
    transcriptLoadFailed: false,
    passSteps: [],
    completionCardVisible: false,
    speakingPanelVisible: false,
    speakingMode: '',
    speakingAttemptIndex: 0,
    speakingQuestionText: '',
    passQuestionVisible: false,
    passQuestionText: '',
    speakingPromptText: '',
    speakingRecording: false,
    speakingTempFilePath: '',
    speakingRecordStartedAt: 0,
    speakingRecordDurationMs: 0,
    speakingRecordDurationText: '',
    speakingSubmitting: false,
    speakingAttempts: [],
    speakingSummary: {},
    pendingListenAfterSpeaking: false,
    repeatLines: [],
    repeatActiveIndex: 0,
    activeRepeatLine: null,
    repeatCompletedCount: 0,
    speakingPlayingAttemptKey: '',
    lessonLoading: true
  }),
  isStudyWriteAllowed() {
    const currentMember = this.data.currentMember || {};
    return currentMember.studyRole === 'student';
  },
  onLoad(query) {
    this.category = query.category || 'peppa';
    this.taskId = query.taskId || '';
    this.planRunType = query.planRunType || 'normal';
    this.targetDate = query.targetDate || '';
    this.planDayIndex = query.planDayIndex || '';
    this.pendingAutoPlay = false;
    this.checkinConfirmShowing = false;
    this.audioPlayRequested = false;
    this.pendingSpeakingAfterListen = null;
    this.recorderManager = wx.getRecorderManager ? wx.getRecorderManager() : null;
    if (this.recorderManager) {
      this.recorderManager.onStop((result) => {
        const durationMs = Number(result.duration || 0) || (this.data.speakingRecordStartedAt ? Date.now() - this.data.speakingRecordStartedAt : 0);
        this.setData({
          speakingRecording: false,
          speakingTempFilePath: result.tempFilePath || '',
          speakingRecordDurationMs: durationMs,
          speakingRecordDurationText: formatRecordDuration(durationMs)
        });
      });
      this.recorderManager.onError(() => {
        this.setData({ speakingRecording: false });
        wx.showToast({ title: '录音失败，请重试', icon: 'none' });
      });
    }
    this.audioErrorTimer = null;
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.obeyMuteSwitch = false;
    this.speakingAudioContext = wx.createInnerAudioContext();
    this.speakingAudioContext.obeyMuteSwitch = false;
    this.speakingAudioContext.onEnded(() => {
      this.setData({ speakingPlayingAttemptKey: '' });
    });
    this.speakingAudioContext.onStop(() => {
      this.setData({ speakingPlayingAttemptKey: '' });
    });
    this.speakingAudioContext.onError(() => {
      this.setData({ speakingPlayingAttemptKey: '' });
      wx.showToast({ title: '录音播放失败', icon: 'none' });
    });
    this.innerAudioContext.onCanplay(() => {
      const durationFromContext = Number(this.innerAudioContext.duration || 0);
      const taskDuration = (this.data.currentAudio && this.data.currentAudio.durationSec)
        || ((this.data.task && this.data.task.durationSec) || 0);
      this.setData({
        audioReady: true,
        audioResolving: false,
        audioError: '',
        audioErrorText: '',
        audioErrorDetail: '',
        audioPlaybackMode: 'ready',
        durationLabel: this.formatTime(Math.floor(durationFromContext || taskDuration))
      });
      if (this.pendingAutoPlay) {
        this.pendingAutoPlay = false;
        this.audioPlayRequested = true;
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
        audioErrorText: '',
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
        audioErrorText: '',
        audioErrorDetail: `${error.errCode || ''}`.trim(),
        audioPlaybackMode: 'error'
      });
      this.scheduleAudioErrorText('playback-error');
      if (this.audioPlayRequested) {
        wx.showToast({
          title: '云端音频加载失败',
          icon: 'none'
        });
      }
    });
  },
  async onShow() {
    page.syncTheme(this);
    if (!page.requireIdentityConfirmed()) {
      this.setData({ lessonLoading: false });
      return;
    }
    await this.refreshPage();
  },
  onHide() {
    if (this.innerAudioContext) {
      this.innerAudioContext.pause();
    }
    if (this.speakingAudioContext) {
      this.speakingAudioContext.pause();
      this.setData({ speakingPlayingAttemptKey: '' });
    }
    this.clearTranscriptState();
  },
  onUnload() {
    if (this.completionCardTimer) {
      clearTimeout(this.completionCardTimer);
      this.completionCardTimer = null;
    }
    if (this.audioErrorTimer) {
      clearTimeout(this.audioErrorTimer);
      this.audioErrorTimer = null;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
    if (this.speakingAudioContext) {
      this.speakingAudioContext.destroy();
      this.speakingAudioContext = null;
    }
  },
  formatTime(totalSeconds) {
    return player.formatTime(totalSeconds);
  },
  clearAudioErrorTimer() {
    if (this.audioErrorTimer) {
      clearTimeout(this.audioErrorTimer);
      this.audioErrorTimer = null;
    }
  },
  scheduleAudioErrorText(code) {
    this.clearAudioErrorTimer();
    this.audioErrorTimer = setTimeout(() => {
      this.setData({
        audioErrorText: formatAudioErrorText(code)
      });
      this.audioErrorTimer = null;
    }, 1500);
  },
  async resolveTaskAudio(task) {
    const startedAt = Date.now();
    if (!task || task.isPendingAsset) {
      monitor.logPerf('lesson', 'resolveTaskAudio', Date.now() - startedAt, {
        mode: 'pending'
      });
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
        const tempUrl = await store.getTempFileURL(audioFileId);
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
        monitor.logError('lesson', 'resolveTaskAudio', error, {
          category: task.category,
          taskId: task.taskId,
          mode: 'temp-url'
        });
      }
    }
    monitor.logPerf('lesson', 'resolveTaskAudio', Date.now() - startedAt, {
      category: task.category,
      taskId: task.taskId,
      mode: audioResolveError ? 'static-fallback' : (task.audioUrl ? 'static-cloud-url' : 'missing')
    });
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
        audioErrorText: '',
        audioErrorDetail: '',
        audioPlaybackMode: 'error'
      }));
      this.scheduleAudioErrorText(resolvedTask && resolvedTask.audioResolveError ? resolvedTask.audioResolveError : 'missing-audio-url');
      return;
    }
    let playableUrl = normalizePlayableUrl(resolvedTask.audioUrl);
    let playbackMode = resolvedTask.audioSource === 'temp-url'
      ? 'temp-url'
      : (resolvedTask.audioResolveError ? 'static-fallback' : 'static-cloud-url');
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
      audioErrorText: '',
      audioErrorDetail: '',
      audioPlaybackMode: playbackMode
    }));
  },
  async refreshPage() {
    const startedAt = Date.now();
    this.setData({
      lessonLoading: true
    });
    const detail = await store.getTaskDetail(this.category, this.taskId, {
      view: 'lesson',
      planRunType: this.planRunType,
      targetDate: this.targetDate,
      planDayIndex: this.planDayIndex
    });
    this.taskId = detail && detail.task ? detail.task.taskId || this.taskId : this.taskId;
    this.planRunType = detail && detail.planRunType ? detail.planRunType : this.planRunType;
    this.targetDate = detail && detail.targetDate ? detail.targetDate : this.targetDate;
    this.planDayIndex = detail && detail.planDayIndex ? String(detail.planDayIndex) : this.planDayIndex;
    const normalizedTask = labels.normalizeTask(detail.task);
    const previewAudio = buildCurrentAudio(normalizedTask, '', 'idle');
    this.setData(page.buildCloudPageData(this.data, {
      syncMode: detail.syncMode,
      isReviewBuild: detail.isReviewBuild,
      showCloudDebug: detail.showCloudDebug,
      syncDebug: detail.syncDebug,
      lessonLoading: false,
      child: detail.child,
      task: normalizedTask,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      passSteps: buildPassSteps(detail.progress),
      scriptSource: null,
      transcriptTrack: null,
      transcriptLines: [],
      transcriptPendingLoad: !!detail.transcriptPendingLoad,
      transcriptLoadFailed: false,
      transcriptSyncGranularity: 'word',
      currentMember: detail.currentMember,
      studyWriteAllowed: detail.studyWriteAllowed !== false,
      isPreviewMode: this.planRunType === 'preview',
      studyModeLabel: this.planRunType === 'preview' ? '预览模式' : (detail.currentMember && detail.currentMember.studyRole === 'student' ? '学生设备' : '家长模式'),
      currentTimeMs: 0,
      currentTimeLabel: '00:00',
      progressPercent: 0,
      playbackRate: 1,
      playbackRateText: '1.0',
      canRewind: false,
      activeLineId: '',
      activeLineIndex: -1,
      activeWordIndex: -1,
      transcriptScrollIntoView: '',
      prevLine: null,
      activeLine: null,
      activeWord: null,
      nextLine: null,
      currentAudio: previewAudio,
      audioSource: normalizedTask && normalizedTask.audioSource ? normalizedTask.audioSource : 'none',
      audioReady: false,
      audioResolving: false,
      audioError: '',
      audioErrorText: '',
      audioErrorDetail: '',
      audioPlaybackMode: 'idle'
    }));
    await this.refreshSpeakingAttempts(normalizedTask);
    await this.updatePassQuestion(normalizedTask, detail.progress);
    if (normalizedTask) {
      await this.syncPlayer(normalizedTask);
      monitor.logPerf('lesson', 'refreshPage', Date.now() - startedAt, {
        category: this.category,
        taskId: this.taskId
      });
      return;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
  },
  getQuestionFromLines(lines) {
    const items = lines || [];
    const cueIndex = items.findIndex((line) => /answer this question/i.test(String(line.text || '')));
    const question = items.find((line, index) => index > cueIndex && /[?？]\s*$/.test(String(line.text || '').trim()))
      || items.find((line) => /[?？]\s*$/.test(String(line.text || '').trim()));
    return question ? question.text : '';
  },
  async ensureTranscriptLoadedForSpeaking() {
    if (this.data.transcriptLines && this.data.transcriptLines.length) {
      return this.data.transcriptLines;
    }
    if (!this.data.transcriptPendingLoad) {
      return [];
    }
    await this.loadTranscript();
    return this.data.transcriptLines || [];
  },
  async refreshSpeakingAttempts(task) {
    const targetTask = task || this.data.task;
    if (!targetTask || !targetTask.speakingMode) {
      return;
    }
    const attemptType = targetTask.speakingMode === 'unlock-sentence-repeat'
      ? 'unlock_sentence_repeat'
      : 'nce_question_answer';
    const result = await store.getSpeakingAttempts({
      category: this.category,
      taskId: targetTask.taskId,
      targetDate: this.targetDate,
      planRunType: this.planRunType,
      planDayIndex: this.planDayIndex,
      attemptType
    });
    const attempts = normalizeSpeakingAttempts(result.attempts || []);
    const repeated = {};
    attempts.filter((item) => item.attemptType === 'unlock_sentence_repeat').forEach((item) => {
      repeated[item.sentenceIndex] = true;
    });
    this.setData({
      speakingAttempts: attempts,
      speakingSummary: result.summary || {},
      repeatCompletedCount: Object.keys(repeated).length
    });
  },
  async updatePassQuestion(task, progress) {
    const targetTask = task || this.data.task || {};
    const currentPass = Number((progress && progress.currentPass) || (this.data.progress && this.data.progress.currentPass) || 1);
    if (targetTask.speakingMode !== 'nce-question-answer' || (currentPass !== 2 && currentPass !== 3)) {
      this.setData({
        passQuestionVisible: false,
        passQuestionText: ''
      });
      return;
    }
    const lines = await this.ensureTranscriptLoadedForSpeaking();
    const questionText = this.getQuestionFromLines(lines);
    this.setData({
      passQuestionVisible: true,
      passQuestionText: questionText
    });
  },
  async openSpeakingPanelForPass(passNumber) {
    const task = this.data.task || {};
    const lines = await this.ensureTranscriptLoadedForSpeaking();
    if (task.speakingMode === 'nce-question-answer') {
      const doneAttempts = (this.data.speakingAttempts || [])
        .filter((item) => item.attemptType === 'nce_question_answer')
        .map((item) => Number(item.attemptIndex || 0));
      const hasAttempt2 = doneAttempts.includes(2);
      const attemptIndex = passNumber >= 3 ? (hasAttempt2 ? 3 : 2) : 1;
      this.setData({
        speakingPanelVisible: true,
        speakingMode: task.speakingMode,
        speakingAttemptIndex: attemptIndex,
        speakingQuestionText: this.data.passQuestionText || this.getQuestionFromLines(lines),
        speakingPromptText: '',
        speakingTempFilePath: '',
        pendingListenAfterSpeaking: true
      });
      return true;
    }
    if (task.speakingMode === 'unlock-sentence-repeat' && passNumber === 3) {
      this.setData({
        speakingPanelVisible: true,
        speakingMode: task.speakingMode,
        repeatLines: lines,
        repeatActiveIndex: 0,
        activeRepeatLine: lines[0] || null,
        speakingTempFilePath: '',
        pendingListenAfterSpeaking: true
      });
      return true;
    }
    return false;
  },
  startSpeakingRecord() {
    if (!this.recorderManager || this.data.speakingRecording) {
      return;
    }
    this.setData({
      speakingTempFilePath: '',
      speakingRecordDurationMs: 0,
      speakingRecordDurationText: '',
      speakingRecordStartedAt: Date.now(),
      speakingRecording: true
    });
    this.recorderManager.start({
      duration: 60000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 128000,
      format: 'mp3'
    });
  },
  stopSpeakingRecord() {
    if (this.recorderManager && this.data.speakingRecording) {
      this.recorderManager.stop();
    }
  },
  async submitSpeakingRecord() {
    if (this.data.speakingRecording) {
      wx.showToast({ title: '请先停止录音', icon: 'none' });
      return;
    }
    if (!this.data.speakingTempFilePath || this.data.speakingSubmitting) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    const task = this.data.task || {};
    const isRepeat = this.data.speakingMode === 'unlock-sentence-repeat';
    const sentence = isRepeat ? (this.data.repeatLines[this.data.repeatActiveIndex] || {}) : {};
    const attemptType = isRepeat ? 'unlock_sentence_repeat' : 'nce_question_answer';
    const attemptIndex = isRepeat ? 1 : this.data.speakingAttemptIndex;
    const sentenceIndex = isRepeat ? this.data.repeatActiveIndex + 1 : 0;
    this.setData({ speakingSubmitting: true });
    try {
      if (this.planRunType === 'preview' && isRepeat) {
        const attempts = (this.data.speakingAttempts || []).concat([{
          attemptType,
          attemptIndex,
          sentenceIndex,
          questionText: this.data.speakingQuestionText,
          promptText: isRepeat ? sentence.text : this.data.speakingQuestionText,
          localAudioPath: this.data.speakingTempFilePath,
          answerDurationMs: this.data.speakingRecordDurationMs,
          answerDurationText: this.data.speakingRecordDurationText,
          score: Math.max(70, Math.min(95, 82 + ((attemptIndex + sentenceIndex) % 9))),
          feedback: isRepeat ? '预览评分：发音流程可继续检查。' : '预览评分：回答流程可继续检查。',
          status: 'preview',
          createdAt: new Date().toISOString()
        }]);
        const repeated = {};
        attempts.filter((item) => item.attemptType === 'unlock_sentence_repeat').forEach((item) => {
          repeated[item.sentenceIndex] = true;
        });
        this.setData({
          speakingAttempts: attempts,
          speakingSummary: buildLocalSpeakingSummary(attempts),
          repeatCompletedCount: Object.keys(repeated).length,
          speakingTempFilePath: '',
          speakingRecordDurationMs: 0,
          speakingRecordDurationText: '',
          speakingPromptText: attempts[attempts.length - 1].feedback
        });
        if (isRepeat) {
          if (this.data.repeatActiveIndex < (this.data.repeatLines || []).length - 1) {
            const nextIndex = this.data.repeatActiveIndex + 1;
            this.setData({
              repeatActiveIndex: nextIndex,
              activeRepeatLine: (this.data.repeatLines || [])[nextIndex] || null
            });
          }
          wx.showToast({ title: '预览评分完成', icon: 'none' });
          return;
        }
        if (attemptIndex === 1) {
          wx.showToast({ title: '评分完成', icon: 'none' });
          return;
        }
        if (attemptIndex === 2) {
          this.setData({ speakingAttemptIndex: 3 });
          wx.showToast({ title: '请录最终回答', icon: 'none' });
          return;
        }
        await this.finishPendingListenAfterSpeaking();
        return;
      }
      const upload = await store.createSpeakingUploadUrl({
        category: this.category,
        taskId: task.taskId,
        targetDate: this.targetDate,
        planRunType: this.planRunType,
        planDayIndex: this.planDayIndex,
        attemptType,
        attemptIndex,
        sentenceIndex
      });
      const fileId = await store.uploadSpeakingAudio(upload.cloudPath, this.data.speakingTempFilePath);
      const result = await store.submitSpeakingAttempt({
        category: this.category,
        taskId: task.taskId,
        targetDate: this.targetDate,
        planRunType: this.planRunType,
        planDayIndex: this.planDayIndex,
        attemptType,
        attemptIndex,
        sentenceIndex,
        questionText: this.data.speakingQuestionText,
        promptText: isRepeat ? sentence.text : this.data.speakingQuestionText,
        answerAudioFileId: fileId || upload.fileId,
        answerCloudPath: upload.cloudPath,
        answerDurationMs: this.data.speakingRecordDurationMs
      });
      if (!result || result.cloudError || !result.attempt) {
        wx.showToast({ title: '评分失败，请看云函数日志', icon: 'none' });
        return;
      }
      const normalizedAttempts = normalizeSpeakingAttempts(result.attempts || []);
      const normalizedAttempt = normalizeSpeakingAttempts([result.attempt])[0] || result.attempt;
      this.setData({
        speakingAttempts: normalizedAttempts,
        speakingSummary: buildLocalSpeakingSummary(normalizedAttempts),
        speakingTempFilePath: '',
        speakingRecordDurationMs: 0,
        speakingRecordDurationText: '',
        speakingPromptText: normalizedAttempt && normalizedAttempt.feedback ? normalizedAttempt.feedback : ''
      });
      if (normalizedAttempt && normalizedAttempt.status === 'score-pending') {
        wx.showToast({
          title: normalizedAttempt.scoreErrorType === 'audio-download' ? '录音读取失败，请重录' : '录音已保存，稍后刷新评分',
          icon: 'none'
        });
        return;
      }
      if (isRepeat) {
        await this.refreshSpeakingAttempts(task);
        if (this.data.repeatActiveIndex < (this.data.repeatLines || []).length - 1) {
          const nextIndex = this.data.repeatActiveIndex + 1;
          this.setData({
            repeatActiveIndex: nextIndex,
            activeRepeatLine: (this.data.repeatLines || [])[nextIndex] || null
          });
        }
        wx.showToast({ title: '本句已评分', icon: 'none' });
        return;
      }
      if (attemptIndex === 1) {
        wx.showToast({ title: '评分完成', icon: 'none' });
        return;
      }
      if (attemptIndex === 2) {
        this.setData({ speakingAttemptIndex: 3 });
        wx.showToast({ title: '请录最终回答', icon: 'none' });
        return;
      }
      await this.finishPendingListenAfterSpeaking();
    } catch (error) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ speakingSubmitting: false });
    }
  },
  async finishPendingListenAfterSpeaking() {
    if (!this.data.pendingListenAfterSpeaking) {
      return;
    }
    this.setData({
      pendingListenAfterSpeaking: false,
      speakingPanelVisible: false
    });
    await this.markCurrentTaskListened();
  },
  async continueAfterSpeakingFeedback() {
    await this.finishPendingListenAfterSpeaking();
  },
  async playSpeakingAttempt(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const audioType = String(event.currentTarget.dataset.audioType || 'answer');
    const attempt = (this.data.speakingAttempts || [])[index] || null;
    if (!attempt || !this.speakingAudioContext) {
      return;
    }
    const key = `${audioType}-${attempt.attemptType || 'attempt'}-${attempt.attemptIndex || 0}-${attempt.sentenceIndex || 0}-${index}`;
    if (this.data.speakingPlayingAttemptKey === key) {
      this.speakingAudioContext.stop();
      return;
    }
    let src = String(attempt.localAudioPath || '').trim();
    if (audioType === 'feedback') {
      src = '';
    }
    if (!src) {
      const fileId = audioType === 'feedback'
        ? String(attempt.feedbackAudioFileId || buildCloudFileId(attempt.feedbackAudioCloudPath)).trim()
        : String(attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath)).trim();
      if (fileId) {
        src = await store.getTempFileURL(fileId);
      }
    }
    if (!src) {
      wx.showToast({ title: audioType === 'feedback' ? '建议语音暂不可播放' : '录音暂不可播放', icon: 'none' });
      return;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.pause();
    }
    this.speakingAudioContext.stop();
    this.speakingAudioContext.src = normalizePlayableUrl(src);
    this.setData({ speakingPlayingAttemptKey: key });
    this.speakingAudioContext.play();
  },
  async completeUnlockRepeat() {
    const total = (this.data.repeatLines || []).length;
    if (total && this.data.repeatCompletedCount < total) {
      wx.showToast({ title: `还剩 ${total - this.data.repeatCompletedCount} 句`, icon: 'none' });
      return;
    }
    await this.finishPendingListenAfterSpeaking();
  },
  switchRepeatLine(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    this.setData({
      repeatActiveIndex: index,
      activeRepeatLine: (this.data.repeatLines || [])[index] || null,
      speakingTempFilePath: ''
    });
  },
  async loadTranscript() {
    if (!this.data.transcriptPendingLoad || this.data.transcriptLines.length) {
      return;
    }
    const startedAt = Date.now();
    this.setData({
      transcriptLoadFailed: false
    });
    const detail = await store.getTaskTranscript(this.category, this.taskId, {
      planRunType: this.planRunType,
      targetDate: this.targetDate,
      planDayIndex: this.planDayIndex,
      taskSnapshot: this.data.task
    }).catch((error) => {
      monitor.logError('lesson', 'loadTranscript', error, {
        category: this.category,
        taskId: this.taskId
      });
      this.setData({
        transcriptPendingLoad: false,
        transcriptLoadFailed: true
      });
      return null;
    });
    if (!detail) {
      return;
    }
    const normalizedTask = labels.normalizeTask(detail.task || this.data.task);
    this.setData(page.buildCloudPageData(this.data, {
      task: normalizedTask,
      scriptSource: detail.scriptSource || this.data.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      transcriptPendingLoad: !!detail.transcriptPendingLoad,
      transcriptLoadFailed: false,
      transcriptSyncGranularity: detail.transcriptTrack ? (detail.transcriptTrack.syncGranularity || 'word') : 'word',
      prevLine: null,
      activeLine: null,
      activeWord: null,
      nextLine: detail.transcriptTrack && detail.transcriptTrack.lines.length ? detail.transcriptTrack.lines[0] : null
    }));
    monitor.logPerf('lesson', 'loadTranscript', Date.now() - startedAt, {
      category: this.category,
      taskId: this.taskId,
      lines: detail.transcriptLines ? detail.transcriptLines.length : 0
    });
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
  showCompletionCard() {
    if (this.completionCardTimer) {
      clearTimeout(this.completionCardTimer);
    }
    this.setData({
      completionCardVisible: true
    });
    this.completionCardTimer = setTimeout(() => {
      this.setData({
        completionCardVisible: false
      });
      this.completionCardTimer = null;
    }, 1800);
  },
  returnToTodayAfterCompletion() {
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/index'
      });
    }, 900);
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
    this.audioPlayRequested = true;
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
        this.audioPlayRequested = true;
        this.innerAudioContext.play();
      } else {
        this.pendingAutoPlay = true;
        this.setData({
          audioResolving: true,
          audioError: '',
          audioErrorText: '',
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
    const nextRate = this.data.playbackRate === 1 ? 0.9 : 1;
    this.innerAudioContext.playbackRate = nextRate;
    this.setData({
      playbackRate: nextRate,
      playbackRateText: nextRate.toFixed(1)
    });
  },
  async handleAudioEnded() {
    if (!this.data.task || this.data.task.isPendingAsset) {
      return;
    }
    if (this.planRunType !== 'preview' && !this.isStudyWriteAllowed()) {
      wx.showToast({
        title: '试听完成',
        icon: 'none'
      });
      return;
    }
    const passNumber = Number((this.data.progress && this.data.progress.currentPass) || (this.data.task && this.data.task.currentPass) || 1);
    if (this.data.task && this.data.task.speakingMode) {
      const shouldOpen = (this.data.task.speakingMode === 'nce-question-answer' && (passNumber === 2 || passNumber === 3))
        || (this.data.task.speakingMode === 'unlock-sentence-repeat' && passNumber === 3);
      if (shouldOpen && await this.openSpeakingPanelForPass(passNumber)) {
        return;
      }
    }
    await this.markCurrentTaskListened();
  },
  async markCurrentTaskListened() {
    if (this.planRunType === 'preview') {
      await this.markPreviewTaskListened();
      return;
    }
    const detail = await store.markTaskListened({
      childId: this.data.child.childId,
      category: this.category,
      taskId: this.taskId,
      planRunType: this.planRunType,
      targetDate: this.targetDate,
      planDayIndex: this.planDayIndex
    });
    if (detail && detail.syncMode === 'cloud-error') {
      wx.showToast({
        title: '进度同步失败',
        icon: 'none'
      });
      return;
    }
    this.taskId = detail && detail.task ? detail.task.taskId || this.taskId : this.taskId;
    this.planRunType = detail && detail.planRunType ? detail.planRunType : this.planRunType;
    this.targetDate = detail && detail.targetDate ? detail.targetDate : this.targetDate;
    this.planDayIndex = detail && detail.planDayIndex ? String(detail.planDayIndex) : this.planDayIndex;
    const normalizedTask = labels.normalizeTask(detail.task);
    this.setData(page.buildCloudPageData(this.data, {
      child: detail.child,
      task: normalizedTask,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      passSteps: buildPassSteps(detail.progress),
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines: detail.transcriptTrack ? detail.transcriptTrack.lines : [],
      transcriptSyncGranularity: detail.transcriptTrack ? (detail.transcriptTrack.syncGranularity || 'word') : 'word',
      history: detail.history,
      currentMember: detail.currentMember,
      studyWriteAllowed: detail.studyWriteAllowed !== false,
      studyModeLabel: detail.currentMember && detail.currentMember.studyRole === 'student' ? '学生设备' : '家长模式',
      checkinReady: !!detail.checkinReady,
      transcriptPendingLoad: !!detail.transcriptPendingLoad,
      transcriptLoadFailed: false,
      audioSource: normalizedTask && normalizedTask.audioSource ? normalizedTask.audioSource : 'none',
      playbackRate: 1,
      playbackRateText: '1.0'
    }));
    await this.updatePassQuestion(normalizedTask, detail.progress);
    await this.syncPlayer(normalizedTask);
    wx.showToast({
      title: detail.progress.completedToday ? `${normalizedTask.categoryLabel} 今天完成` : `已完成第 ${detail.progress.playCount} 遍`,
      icon: 'none'
    });
    if (detail.checkinReady) {
      this.promptCompleteTodayCheckin();
    }
  },
  async markPreviewTaskListened() {
    const currentProgress = this.data.progress || {};
    const nextProgress = buildPreviewProgress(currentProgress, Number(currentProgress.playCount || 0) + 1, this.data.task);
    const nextTask = buildPreviewTask(this.data.task || {}, nextProgress);
    this.setData(page.buildCloudPageData(this.data, {
      task: nextTask,
      progress: nextProgress,
      passSteps: buildPassSteps(nextProgress),
      studyWriteAllowed: false,
      isPreviewMode: true,
      studyModeLabel: '预览模式',
      checkinReady: false
    }));
    await this.updatePassQuestion(nextTask, nextProgress);
    wx.showToast({
      title: nextProgress.completedToday ? '预览流程完成' : `预览第 ${nextProgress.playCount} 遍完成`,
      icon: 'none'
    });
  },
  async promptCompleteTodayCheckin() {
    if (this.checkinConfirmShowing || !this.data.checkinReady) {
      return;
    }
    this.checkinConfirmShowing = true;
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '今天听完啦',
        content: '点一下，完成今天打卡。',
        confirmText: '完成打卡',
        showCancel: false,
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
    this.checkinConfirmShowing = false;
    if (!confirmed) {
      return;
    }
    try {
      const data = await store.completeTodayCheckin();
      page.bumpHeatmapRefreshToken();
      this.setData(page.buildCloudPageData(this.data, {
        child: data.child || this.data.child,
        stats: data.stats || this.data.stats,
        todayRecord: data.todayRecord || null,
        checkinReady: !!data.checkinReady
      }));
      this.showCompletionCard();
      this.returnToTodayAfterCompletion();
    } catch (error) {
      wx.showToast({
        title: error.message || '打卡失败',
        icon: 'none'
      });
    }
  }
});
