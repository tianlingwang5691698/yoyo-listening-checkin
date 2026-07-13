const store = require('../../utils/store');
const player = require('../../domain/player/index');
const appConfig = require('../../app-config');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const monitor = require('../../utils/monitor');
const snapshotStore = require('../../utils/snapshot');
const effects = require('../../utils/effects');
const i18n = require('../../utils/i18n');
const text = (key, fallback) => i18n.getPageText('lesson', key, undefined, fallback);
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LESSON_STUDY_PACK_SNAPSHOT_KEY = 'lessonStudyPackSnapshotV1';
const LESSON_TASK_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const NEW_CONCEPT_CATEGORIES = ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'];
const NEW_CONCEPT_AUDIO_ROOTS = {
  newconcept1: 'A1/NewConcept1-US',
  newconcept2: 'A2/NewConcept2-US',
  newconcept3: 'B1/NewConcept3-US',
  newconcept4: 'B2/NewConcept4-US'
};

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function getFlashcardTargetDebugText() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return [
    `targetChildId=${target.targetChildId || ''}`,
    `targetFamilyId=${target.targetFamilyId || ''}`
  ].join('；');
}

function encodeUrlPathSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment)).replace(/'/g, '%27');
  } catch (error) {
    return encodeURIComponent(segment).replace(/'/g, '%27');
  }
}

function buildCloudAssetUrl(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(cloudPath || '').replace(/^\/+|\/+$/g, '');
  if (!baseUrl || !normalizedPath) {
    return '';
  }
  const encodedPath = normalizedPath
    .split('/')
    .map(encodeUrlPathSegment)
    .join('/');
  return `${baseUrl}/${encodedPath}`;
}

function getCloudPathFromFileId(fileId) {
  const value = String(fileId || '').trim();
  if (!/^cloud:\/\//.test(value)) {
    return '';
  }
  return value.replace(/^cloud:\/\/[^/]+\//, '').replace(/^\/+|\/+$/g, '');
}

function getTaskTextTitle(task) {
  return labels.decodeHtmlEntities(String(
    (task && (task.audioTitle || task.title || task.displayTitle || task.audioCompactTitle))
    || ''
  )).trim();
}

function inferPeppaAudioCloudPath(task) {
  const title = getTaskTextTitle(task);
  const taskId = String((task && task.taskId) || '').trim();
  let season = 0;
  let episode = 0;
  const titleCode = title.match(/^S(\d)(\d{2})\s+(.+)$/i);
  if (titleCode) {
    season = Number(titleCode[1]);
    episode = Number(titleCode[2]);
    return `A1/Peppa/第${season}季/${title}.mp3`;
  }
  const s1Match = taskId.match(/^peppa-(\d+)$/);
  const seasonMatch = taskId.match(/^peppa-s(\d+)-(\d+)$/);
  if (s1Match) {
    season = 1;
    episode = Number(s1Match[1]);
  } else if (seasonMatch) {
    season = Number(seasonMatch[1]);
    episode = Number(seasonMatch[2]);
  }
  if (!season || !episode || !title) {
    return '';
  }
  return `A1/Peppa/第${season}季/S${season}${String(episode).padStart(2, '0')} ${title}.mp3`;
}

function inferNewConceptAudioCloudPath(task) {
  const category = String((task && task.category) || '').trim();
  const root = NEW_CONCEPT_AUDIO_ROOTS[category] || '';
  const title = getTaskTextTitle(task);
  if (!root || !title) {
    return '';
  }
  const match = title.match(/^(\d{3}&\d{3})\s*(?:[-–—－]\s*)?(.+)$/);
  if (!match) {
    return '';
  }
  const fileTitle = `${match[1]}－${String(match[2] || '').trim().replace(/'/g, '&#39;')}.mp3`;
  return `${root}/${fileTitle}`;
}

function inferTaskAudioCloudPath(task) {
  const category = String((task && task.category) || '').trim();
  if (category === 'peppa') {
    return inferPeppaAudioCloudPath(task);
  }
  if (NEW_CONCEPT_CATEGORIES.includes(category)) {
    return inferNewConceptAudioCloudPath(task);
  }
  return '';
}

function hasTaskAudioSource(task) {
  return !!(task && (
    task.isPendingAsset
    || task.audioUrl
    || task.audioCloudPath
    || task.audioFileId
  ));
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
    .map(encodeUrlPathSegment)
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

function isNewConceptTask(task, fallbackCategory) {
  return NEW_CONCEPT_CATEGORIES.includes(String((task && task.category) || fallbackCategory || '').trim());
}

function hasAnswerQuestionCue(lines) {
  return (lines || []).some((line) => /answer (?:this|these) questions?/i.test(String(line && line.text || '')));
}

function getLocalFileInfo(filePath) {
  return new Promise((resolve) => {
    if (!filePath || !wx.getFileInfo) {
      resolve({ size: -1, error: filePath ? 'wx.getFileInfo unavailable' : 'missing filePath' });
      return;
    }
    wx.getFileInfo({
      filePath,
      success: (res) => resolve({ size: Number(res.size || 0), error: '' }),
      fail: (error) => resolve({ size: -1, error: (error && error.errMsg) || String(error || '') })
    });
  });
}

function buildSpeakingDebugLine(step, detail) {
  return `DEBUG: pages/lesson.${step} -> store.${detail.storeAction} -> cloud.${detail.cloudAction} -> ${detail.field}：${detail.value}`;
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
    ? false
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
    note: progress.completedToday ? text('previewDone', '预览已完成。') : `${text('previewPassPrefix', '预览第 ')}${progress.currentPass}${text('passSuffix', ' 遍。')}`
  });
}

function buildLocalSpeakingSummary(attempts) {
  const scores = (attempts || []).map((item) => Number(item.score || 0)).filter((score) => score > 0);
  const latestScore = scores.length ? scores[scores.length - 1] : 0;
  const bestScore = scores.length ? Math.max.apply(null, scores) : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  return { latestScore, bestScore, averageScore, scoredCount: scores.length };
}

function buildSpeakingScoreDetail(attempts) {
  const latest = (attempts || []).filter((item) => (
    item.attemptType === 'nce_question_answer'
    && (
      item.status === 'scored'
      || item.status === 'scored-local'
      || Number(item.score || 0) > 0
      || Number(item.pronunciationFluencyScore || 0) > 0
      || Number(item.contentGrammarScore || 0) > 0
    )
  )).slice(-1)[0];
  if (!latest) {
    return { visible: false, pronunciationFluencyScore: 0, contentGrammarScore: 0 };
  }
  return {
    visible: true,
    pronunciationFluencyScore: Math.round(Number(latest.pronunciationFluencyScore || 0)),
    contentGrammarScore: Math.round(Number(latest.contentGrammarScore || 0))
  };
}

function normalizeSpeakingAttempts(attempts) {
  return (attempts || []).map((item) => {
    const feedback = String(item.feedback || '').replace(/模型繁忙，?/g, '录音已保存，');
    return Object.assign({}, item, { feedback });
  });
}

function canContinueAfterSpeaking(attempts) {
  const latest = (attempts || [])
    .filter((item) => item.attemptType === 'nce_question_answer')
    .slice(-1)[0];
  return !!(latest && (
    Number(latest.score || 0) > 0
    || latest.status === 'score-pending'
    || latest.answerAudioFileId
    || latest.answerCloudPath
    || latest.localAudioPath
  ));
}

function formatRecordDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}${i18n.getLanguage() === 'en' ? ' sec' : '秒'}` : '';
}

function formatAudioErrorText(code) {
  const value = String(code || '').trim();
  if (!value) {
    return '';
  }
  if (value === 'playback-error') {
    return text('audioUnavailable', '音频暂时不可用，请重新加载。');
  }
  if (value === 'temp-url-failed') {
    return text('audioAddressFailed', '音频地址获取失败，请重新加载。');
  }
  if (value === 'missing-audio-url') {
    return text('audioNotReady', '当前音频还没有准备好。');
  }
  return text('cloudAudioUnavailable', '云端音频暂时不可用，请稍后再试。');
}

function lessonStudyDoneKey(category, taskId) {
  return `lessonListeningStudyDoneV1:${category || ''}:${taskId || ''}`;
}

function isSingleWord(text) {
  return /^[A-Za-z][A-Za-z'-]{0,40}$/.test(String(text || '').trim());
}

function canUseDictionaryVoice(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 60 || /[.!?;:]/.test(value)) return false;
  const words = value.split(' ').filter(Boolean);
  return words.length >= 1
    && words.length <= 6
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

function buildDictionaryVoiceUrls(text) {
  const encoded = encodeURIComponent(text);
  return [
    `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`,
    `https://dict.youdao.com/dictvoice?audio=${encoded}&type=1`
  ];
}

function normalizeLessonStudyCards(cards, type) {
  return (cards || []).map((card, index) => {
    const text = String(type === 'phrase' ? (card.text || card.phrase || '') : type === 'pattern' ? (card.pattern || card.text || '') : (card.word || card.text || '')).trim();
    return Object.assign({}, card, {
      groupIndex: card.groupIndex || index + 1,
      text,
      word: type === 'word' ? (card.word || text) : card.word,
      pattern: type === 'pattern' ? (card.pattern || text) : card.pattern,
      flashcardKey: card.flashcardKey || `${type}:${text}`,
      canSpeak: canUseDictionaryVoice(text)
    });
  });
}

function recordLessonStudyPackSynced(task, category, taskId) {
  const target = task || {};
  const safeCategory = target.category || category || '';
  const safeTaskId = target.taskId || taskId || '';
  const targetId = [safeCategory, safeTaskId].filter(Boolean).join(':');
  if (!targetId) return;
  store.recordStudyCompletion({
    id: `listening-study:${targetId}`,
    type: 'listening',
    targetId,
    category: safeCategory,
    taskId: safeTaskId,
    title: text('packTitle', '听力学习包'),
    meta: target.displayTitle || target.title || target.audioTitle || text('course', '听力课程'),
    progressText: text('packReady', '学习包已生成'),
    audioUrl: target.audioUrl || '',
    audioCloudPath: target.audioCloudPath || '',
    audioFileId: target.audioFileId || '',
    audioSource: target.audioSource || '',
    taskSnapshot: target
  });
}

function buildTranscriptText(lines) {
  return (lines || [])
    .map((line) => String(line && line.text || '').trim())
    .filter(Boolean)
    .join('\n');
}

function buildLessonStudyItem(task, category, taskId, transcript) {
  const target = task || {};
  return {
    _id: `lesson-${target.category || category}-${target.taskId || taskId}`,
    title: target.displayTitle || target.title || target.audioTitle || text('course', '听力课程'),
    transcript: transcript || ''
  };
}

function hasLessonStudyCards(studyPack) {
  return studyPack
    && ((studyPack.vocabularyCards || []).length
      || (studyPack.phraseCards || []).length
      || (studyPack.sentencePatternCards || []).length);
}

function getLessonStudyError(result) {
  const message = result && result.cloudError && result.cloudError.message;
  if (message) {
    return `${text('packTimeout', '生成超时，未拿到学习包，请稍后重试')}：${message}`;
  }
  return text('packFailed', '生成失败，稍后重试。');
}

function isLessonTrainingMode(member, planRunType, cloudStudyWriteAllowed) {
  return String(planRunType || 'normal') !== 'preview'
    && cloudStudyWriteAllowed !== false
    && String((member && member.studyRole) || '') === 'student';
}

function buildLocalMemberFromLastRole() {
  let role = '';
  try {
    role = wx.getStorageSync('lastStudyRole') || '';
  } catch (error) {}
  return {
    studyRole: role === 'student' ? 'student' : 'parent'
  };
}

Page({
  data: page.createCloudPageData({
    child: null,
    currentMember: { studyRole: 'parent' },
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
    studyWriteAllowed: false,
    studyModeLabel: text('parentModeLabel', '家长模式'),
    isPreviewMode: false,
    checkinReady: false,
    transcriptPendingLoad: false,
    transcriptLoadFailed: false,
    transcriptManualVisible: false,
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
    speakingScoreDetail: { visible: false, pronunciationFluencyScore: 0, contentGrammarScore: 0 },
    speakingRescoringKey: '',
    speakingCanContinue: false,
    speakingDebugLines: [],
    recorderPrivacyVisible: false,
    pendingListenAfterSpeaking: false,
    repeatLines: [],
    repeatActiveIndex: 0,
    activeRepeatLine: null,
    repeatCompletedCount: 0,
    speakingPlayingAttemptKey: '',
    speakingPausedAttemptKey: '',
    lessonLoading: true,
    lessonStudyPack: null,
    lessonStudyLoading: false,
    lessonStudyError: '',
    lessonStudyCompleted: false,
    lessonStudyTab: 'vocabulary',
    lessonStudyTabs: [
      { key: 'vocabulary', label: text('vocabulary', '生词') },
      { key: 'phrases', label: text('phrases', '短语') },
      { key: 'patterns', label: text('patterns', '句型') }
    ],
    lessonVocabularyCards: [],
    lessonPhraseCards: [],
    lessonPatternCards: [],
    speakingWord: '',
    lessonDictionaryAddedMap: {},
    flashcardAddDebugLines: [],
    dictionaryVisible: false,
    dictionaryLoading: false,
    dictionaryAdding: false,
    dictionaryAudioLoading: false,
    dictionaryWord: '',
    dictionaryEntry: null,
    lessonCelebrateVisible: false
  }),
  markLessonRoute(step, meta) {
    const startedAt = Number(this.routeStartedAt || 0) || Date.now();
    monitor.logPerf('lesson-route', step, Date.now() - startedAt, Object.assign({
      category: this.category || '',
      taskId: this.taskId || ''
    }, meta || {}));
  },
  readLessonTaskSnapshot() {
    const id = `${this.category || ''}:${this.taskId || ''}`;
    const snapshot = snapshotStore.read(LESSON_TASK_SNAPSHOT_KEY, {
      id,
      maxAgeMs: LESSON_TASK_SNAPSHOT_MAX_AGE_MS
    });
    const task = snapshot && snapshot.task ? snapshot.task : null;
    if (!task || String(task.category || snapshot.category || '') !== this.category) {
      return null;
    }
    if (this.taskId && String(task.taskId || snapshot.taskId || '') !== this.taskId) {
      return null;
    }
    return task;
  },
  readLessonStudyPackSnapshot() {
    const id = `${this.category || ''}:${this.taskId || ''}`;
    const snapshot = snapshotStore.read(LESSON_STUDY_PACK_SNAPSHOT_KEY, {
      id,
      maxAgeMs: LESSON_TASK_SNAPSHOT_MAX_AGE_MS
    });
    return snapshot && hasLessonStudyCards(snapshot.studyPack) ? snapshot.studyPack : null;
  },
  applyLessonStudyPackSnapshot() {
    const studyPack = this.readLessonStudyPackSnapshot();
    if (!studyPack) return false;
    this.applyLessonStudyPack(studyPack);
    return true;
  },
  isLessonStudyCompletedForTask(task) {
    const target = task || {};
    return !!this.studyPackDone
      || !!target.lessonStudyCompleted
      || !!this.data.lessonStudyCompleted
      || !!wx.getStorageSync(lessonStudyDoneKey(target.category || this.category, target.taskId || this.taskId));
  },
  applyTaskSnapshot(task) {
    const normalizedTask = labels.normalizeTask(task);
    if (!normalizedTask) return;
    const progress = {
      playCount: Number(normalizedTask.playCount || 0),
      playStepText: normalizedTask.playStepText || `${Number(normalizedTask.playCount || 0)}/${Number(normalizedTask.repeatTarget || 3)}`,
      currentPass: Number(normalizedTask.currentPass || 1),
      repeatTarget: Number(normalizedTask.repeatTarget || 3),
      textUnlocked: !!normalizedTask.textUnlocked,
      transcriptVisible: !!normalizedTask.transcriptVisible,
      completedToday: !!normalizedTask.completedToday
    };
    const previewAudio = buildCurrentAudio(normalizedTask, '', 'idle');
    this.setData(page.buildCloudPageData(this.data, {
      lessonLoading: false,
      task: normalizedTask,
      progress,
      passSteps: buildPassSteps(progress),
      currentAudio: previewAudio,
      audioSource: normalizedTask.audioSource || 'none',
      audioReady: false,
      audioResolving: false,
      audioPlaybackMode: 'idle',
      lessonStudyCompleted: this.isLessonStudyCompletedForTask(normalizedTask)
    }));
    this.markLessonRoute('snapshotRendered', {
      hasAudio: hasTaskAudioSource(normalizedTask) ? 'yes' : 'no'
    });
    if (this.lessonPerf) {
      this.lessonPerf.ready('pageReady', {
        source: 'snapshot',
        cacheHit: true,
        category: this.category,
        taskId: this.taskId,
        hasAudio: hasTaskAudioSource(normalizedTask)
      });
    }
    this.prefetchTaskAudio(normalizedTask);
  },
  noop() {},
  isStudyWriteAllowed() {
    return isLessonTrainingMode(this.data.currentMember, this.planRunType, this.data.studyWriteAllowed);
  },
  buildRecordDebugLines(source, error, extra) {
    const errMsg = error && error.errMsg ? error.errMsg : (error && error.message ? error.message : String(error || 'unknown'));
    const audioWasPlaying = extra && extra.audioWasPlaying ? 'yes' : 'no';
    return [
      `DEBUG: pages/lesson.startSpeakingRecord -> ${source} -> errMsg=${errMsg}`,
      `DEBUG: pages/lesson.startSpeakingRecord -> recorderManager.start -> audioWasPlaying=${audioWasPlaying}`
    ];
  },
  isRecorderPrivacyBanned(error) {
    const errMsg = error && error.errMsg ? error.errMsg : (error && error.message ? error.message : String(error || ''));
    return errMsg.indexOf('privacy api banned') >= 0;
  },
  showRecorderPrivacyGuide() {
    this.pendingRecordAfterPrivacy = true;
    this.setData({
      recorderPrivacyVisible: true,
      speakingDebugLines: []
    });
  },
  hideRecorderPrivacyGuide() {
    this.pendingRecordAfterPrivacy = false;
    this.setData({ recorderPrivacyVisible: false });
  },
  openRecorderPrivacyContract() {
    if (!wx.openPrivacyContract) {
      return;
    }
    wx.openPrivacyContract({
      fail: () => wx.showToast({ title: text('privacyUnavailable', '隐私指引暂不可打开'), icon: 'none' })
    });
  },
  handleAgreePrivacyAuthorization(event) {
    const errMsg = String(event && event.detail && event.detail.errMsg || '');
    if (errMsg && errMsg.indexOf(':ok') < 0) {
      wx.showToast({ title: text('agreeRecording', '请先同意录音用途'), icon: 'none' });
      return;
    }
    this.recorderPrivacyAuthorized = true;
    const shouldStart = !!this.pendingRecordAfterPrivacy;
    this.pendingRecordAfterPrivacy = false;
    this.setData({ recorderPrivacyVisible: false }, () => {
      if (shouldStart) {
        this.startSpeakingRecord();
      }
    });
  },
  async ensureRecorderPrivacyAuthorized() {
    if (this.recorderPrivacyAuthorized || !wx.requirePrivacyAuthorize) {
      return true;
    }
    return new Promise((resolve) => {
      wx.requirePrivacyAuthorize({
        success: () => {
          this.recorderPrivacyAuthorized = true;
          resolve(true);
        },
        fail: () => resolve(false)
      });
    });
  },
  onLoad(query) {
    this.lessonPerf = page.startPagePerf('lesson');
    this.category = query.category || 'peppa';
    this.taskId = query.taskId || '';
    this.routeStartedAt = Number(query.routeStartedAt || 0) || Date.now();
    this.planRunType = query.planRunType || 'normal';
    this.source = query.source || '';
    this.focus = query.focus || '';
    this.studyPackDone = query.studyPackDone === '1';
    this.targetDate = query.targetDate || '';
    this.planDayIndex = query.planDayIndex || '';
    this.pendingAutoPlay = false;
    this.songAudioDownloadKey = '';
    this.songAudioDownloadPromise = null;
    this.songAudioLocalPath = '';
    this.checkinConfirmShowing = false;
    this.audioPlayRequested = false;
    this.pendingSpeakingAfterListen = null;
    const localMember = buildLocalMemberFromLastRole();
    this.setData({
      currentMember: localMember,
      studyWriteAllowed: isLessonTrainingMode(localMember, this.planRunType, true),
      studyModeLabel: this.planRunType === 'preview'
        ? text('previewModeLabel', '预览模式')
        : (localMember.studyRole === 'student' ? text('studentDevice', '学生设备') : text('parentModeLabel', '家长模式'))
    });
    this.markLessonRoute('onLoad');
    this.recorderManager = wx.getRecorderManager ? wx.getRecorderManager() : null;
    if (this.recorderManager) {
      this.recorderManager.onStop((result) => {
        const durationMs = Number(result.duration || 0) || (this.data.speakingRecordStartedAt ? Date.now() - this.data.speakingRecordStartedAt : 0);
        this.setData({
          speakingRecording: false,
          speakingTempFilePath: result.tempFilePath || '',
          speakingRecordDurationMs: durationMs,
          speakingRecordDurationText: formatRecordDuration(durationMs)
        }, () => {
          if (result.tempFilePath && !this.data.speakingSubmitting) {
            this.submitSpeakingRecord();
          }
        });
      });
      this.recorderManager.onError((error) => {
        const privacyBanned = this.isRecorderPrivacyBanned(error);
        const debugLines = this.buildRecordDebugLines('recorderManager.onError', error, {
          audioWasPlaying: this.recordStartAudioWasPlaying
        });
        this.setData({
          speakingRecording: false,
          speakingDebugLines: privacyBanned ? [] : debugLines
        });
        if (privacyBanned) {
          this.showRecorderPrivacyGuide();
        } else {
          wx.showToast({ title: text('recordFailed', '录音失败，请重试'), icon: 'none' });
        }
      });
    }
    this.audioErrorTimer = null;
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.obeyMuteSwitch = false;
    this.speakingAudioContext = wx.createInnerAudioContext();
    this.speakingAudioContext.obeyMuteSwitch = false;
    this.speakingAudioContext.onPlay(() => {
      this.setData({ speakingPausedAttemptKey: '' });
    });
    this.speakingAudioContext.onPause(() => {
      this.setData({ speakingPausedAttemptKey: this.data.speakingPlayingAttemptKey });
    });
    this.speakingAudioContext.onEnded(() => {
      this.setData({ speakingPlayingAttemptKey: '', speakingPausedAttemptKey: '' });
    });
    this.speakingAudioContext.onStop(() => {
      this.setData({ speakingPlayingAttemptKey: '', speakingPausedAttemptKey: '' });
    });
    this.speakingAudioContext.onError(() => {
      this.setData({ speakingPlayingAttemptKey: '', speakingPausedAttemptKey: '' });
      wx.showToast({ title: text('playbackFailed', '录音播放失败'), icon: 'none' });
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
      this.markLessonRoute('audioCanplay', {
        duration: Math.floor(durationFromContext || taskDuration || 0)
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
        audioReady: true,
        audioResolving: false,
        audioError: '',
        audioErrorText: '',
        audioErrorDetail: '',
        audioPlaybackMode: this.data.audioPlaybackMode === 'resolving' ? 'ready' : this.data.audioPlaybackMode
      });
      this.markLessonRoute('audioPlay');
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
          title: text('cloudAudioFailed', '云端音频加载失败'),
          icon: 'none'
        });
      }
    });
    const snapshotTask = this.readLessonTaskSnapshot();
    if (snapshotTask) {
      this.applyTaskSnapshot(snapshotTask);
      if (this.focus === 'study') {
        this.applyLessonStudyPackSnapshot();
        this.loadCachedLessonStudyPack(snapshotTask).catch(() => {});
      }
    } else {
      this.markLessonRoute('snapshotMiss');
    }
  },
  async onShow() {
    page.syncTheme(this);
    if (!page.requireIdentityConfirmed()) {
      this.setData({ lessonLoading: false });
      await new Promise((resolve) => wx.nextTick(resolve));
      this.lessonPerf.ready('pageReady', {
        source: 'identity-blocked',
        cacheHit: true,
        category: this.category,
        taskId: this.taskId,
        hasAudio: false
      });
      return;
    }
    if (!this.data.task) {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.lessonPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        category: this.category,
        taskId: this.taskId,
        hasAudio: false
      });
    }
    const detail = await this.refreshPage();
    if (this.lessonPerf) {
      this.lessonPerf.mark('cloudRefresh', {
        source: detail && detail.__cacheHit ? 'cache' : (detail && detail.syncMode === 'cloud-error' ? 'error' : 'cloud'),
        cacheHit: !!(detail && detail.__cacheHit),
        category: this.category,
        taskId: this.taskId,
        hasAudio: !!(detail && detail.task && hasTaskAudioSource(detail.task))
      });
    }
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
    if (this.lessonCelebrateTimer) {
      clearTimeout(this.lessonCelebrateTimer);
      this.lessonCelebrateTimer = null;
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
    if (this.lessonStudyAudioContext) {
      this.lessonStudyAudioContext.destroy();
      this.lessonStudyAudioContext = null;
    }
    if (this.dictionaryAudioContext) {
      this.dictionaryAudioContext.destroy();
      this.dictionaryAudioContext = null;
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
    const audioCloudPath = String(task.audioCloudPath || getCloudPathFromFileId(task.audioFileId) || inferTaskAudioCloudPath(task) || '').trim();
    const audioFileId = task.audioFileId || buildCloudFileId(audioCloudPath);
    let audioResolveError = '';
    const fallbackAudioUrl = String(task.audioUrl || buildCloudAssetUrl(audioCloudPath) || '').trim();
    if (fallbackAudioUrl) {
      monitor.logPerf('lesson', 'resolveTaskAudio', Date.now() - startedAt, {
        category: task.category,
        taskId: task.taskId,
        mode: 'static-cloud-url',
        from: task.audioUrl ? 'audioUrl' : (audioCloudPath ? 'cloudPath' : '')
      });
      return Object.assign({}, task, {
        audioUrl: fallbackAudioUrl,
        audioCloudPath,
        audioFileId,
        audioSource: task.audioSource || 'static-cloud-url',
        audioResolveError
      });
    }
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
      mode: audioResolveError ? 'static-fallback' : 'missing'
    });
    return Object.assign({}, task, {
      audioUrl: '',
      audioCloudPath,
      audioFileId,
      audioSource: task.audioSource || 'none',
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
  async preparePlayableAudio(task) {
    const remoteUrl = normalizePlayableUrl(task && task.audioUrl);
    if (!remoteUrl || !task || task.category !== 'song') {
      return remoteUrl;
    }
    const downloadKey = `${task.category}:${task.taskId || remoteUrl}`;
    if (this.songAudioDownloadKey === downloadKey && this.songAudioLocalPath) {
      return this.songAudioLocalPath;
    }
    if (this.songAudioDownloadKey !== downloadKey || !this.songAudioDownloadPromise) {
      this.songAudioDownloadKey = downloadKey;
      this.songAudioLocalPath = '';
      const startedAt = Date.now();
      this.songAudioDownloadPromise = this.downloadAudio(remoteUrl)
        .then((tempFilePath) => {
          if (this.songAudioDownloadKey === downloadKey) {
            this.songAudioLocalPath = tempFilePath;
          }
          monitor.logPerf('lesson', 'prepareSongAudio', Date.now() - startedAt, {
            taskId: task.taskId,
            mode: 'downloaded'
          });
          return tempFilePath;
        })
        .catch((error) => {
          monitor.logError('lesson', 'prepareSongAudio', error, {
            taskId: task.taskId,
            mode: 'remote-fallback'
          });
          return remoteUrl;
        });
    }
    return this.songAudioDownloadPromise;
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
    let playableUrl = await this.preparePlayableAudio(resolvedTask);
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
  async prefetchTaskAudio(task) {
    if (!task || task.isPendingAsset || !this.innerAudioContext) {
      return;
    }
    const prefetchKey = `${task.category || this.category}:${task.taskId || this.taskId}`;
    if (this.audioPrefetchKey === prefetchKey && (this.data.audioReady || (this.innerAudioContext && this.innerAudioContext.src))) {
      return;
    }
    this.audioPrefetchKey = prefetchKey;
    this.markLessonRoute('audioResolveStart', {
      hasAudio: hasTaskAudioSource(task) ? 'yes' : 'no'
    });
    try {
      const resolvedTask = await this.resolveTaskAudio(task);
      if (!resolvedTask || resolvedTask.isPendingAsset || !resolvedTask.audioUrl || this.audioPrefetchKey !== prefetchKey) {
        this.markLessonRoute('audioMissing', {
          hasTask: resolvedTask ? 'yes' : 'no',
          hasUrl: resolvedTask && resolvedTask.audioUrl ? 'yes' : 'no'
        });
        this.audioPrefetchKey = '';
        return;
      }
      const playableUrl = await this.preparePlayableAudio(resolvedTask);
      const playbackMode = resolvedTask.audioSource === 'temp-url'
        ? 'temp-url'
        : (resolvedTask.audioResolveError ? 'static-fallback' : 'static-cloud-url');
      const currentAudio = buildCurrentAudio(resolvedTask, playableUrl, playbackMode);
      if (this.innerAudioContext && this.innerAudioContext.src !== playableUrl) {
        this.innerAudioContext.stop();
        this.innerAudioContext.src = playableUrl;
        this.innerAudioContext.playbackRate = 1;
        this.markLessonRoute('audioSrcSet', {
          source: playbackMode,
          duration: Number(resolvedTask.durationSec || 0)
        });
      }
      if (this.data.task && this.data.task.taskId === resolvedTask.taskId) {
        this.setData({
          task: resolvedTask,
          currentAudio,
          audioSource: resolvedTask.audioSource || 'none',
          audioPlaybackMode: playbackMode,
          audioError: '',
          audioErrorText: '',
          audioErrorDetail: ''
        });
      }
    } catch (error) {
      this.audioPrefetchKey = '';
      this.markLessonRoute('audioResolveFailed', {
        error: (error && (error.errMsg || error.message)) || String(error || '')
      });
    }
  },
  applyFreshTaskDetail(detail) {
    if (!detail || !detail.task) {
      return;
    }
    this.taskId = detail.task.taskId || this.taskId;
    this.planRunType = detail.planRunType || this.planRunType;
    this.targetDate = detail.targetDate || this.targetDate;
    this.planDayIndex = detail.planDayIndex ? String(detail.planDayIndex) : this.planDayIndex;
    const normalizedTask = labels.normalizeTask(detail.task);
    const studyCompleted = normalizedTask ? this.isLessonStudyCompletedForTask(normalizedTask) : false;
    const studyWriteAllowed = isLessonTrainingMode(detail.currentMember, this.planRunType, detail.studyWriteAllowed);
    this.setData(page.buildCloudPageData(this.data, {
      syncMode: detail.syncMode,
      isReviewBuild: detail.isReviewBuild,
      showCloudDebug: detail.showCloudDebug,
      syncDebug: detail.syncDebug,
      child: detail.child,
      task: normalizedTask,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      passSteps: buildPassSteps(detail.progress),
      transcriptManualVisible: false,
      currentMember: detail.currentMember,
      studyWriteAllowed,
      isPreviewMode: this.planRunType === 'preview',
      studyModeLabel: this.planRunType === 'preview' ? text('previewModeLabel', '预览模式') : (detail.currentMember && detail.currentMember.studyRole === 'student' ? text('studentDevice', '学生设备') : text('parentModeLabel', '家长模式')),
      lessonStudyCompleted: studyCompleted
    }));
    this.prefetchTaskAudio(normalizedTask);
  },
  async refreshPage() {
    const startedAt = Date.now();
    this.markLessonRoute('detailRequestStart', {
      hasSnapshot: this.data.task ? 'yes' : 'no'
    });
    const hasSnapshotTask = !!this.data.task;
    if (!hasSnapshotTask) {
      this.setData({
        lessonLoading: true
      });
    }
    const detail = await store.getTaskDetail(this.category, this.taskId, {
      view: 'lesson',
      planRunType: this.planRunType,
      targetDate: this.targetDate,
      planDayIndex: this.planDayIndex,
      source: this.source,
      taskSnapshot: hasTaskAudioSource(this.data.task) ? this.data.task : undefined
    }, (fresh) => {
      this.applyFreshTaskDetail(fresh);
      if (this.lessonPerf) {
        this.lessonPerf.mark('cloudRefresh', {
          category: this.category,
          taskId: this.taskId,
          hasAudio: !!(fresh && fresh.task && hasTaskAudioSource(fresh.task))
        });
      }
    });
    this.markLessonRoute('detailLoaded', {
      hasTask: detail && detail.task ? 'yes' : 'no',
      hasAudio: detail && detail.task && hasTaskAudioSource(detail.task) ? 'yes' : 'no'
    });
    if (detail && detail.syncMode === 'cloud-error' && hasSnapshotTask) {
      this.setData(page.buildCloudPageData(this.data, {
        lessonLoading: false,
        syncMode: 'cloud',
        syncDebug: detail.syncDebug || this.data.syncDebug
      }));
      return detail;
    }
    this.taskId = detail && detail.task ? detail.task.taskId || this.taskId : this.taskId;
    this.planRunType = detail && detail.planRunType ? detail.planRunType : this.planRunType;
    this.targetDate = detail && detail.targetDate ? detail.targetDate : this.targetDate;
    this.planDayIndex = detail && detail.planDayIndex ? String(detail.planDayIndex) : this.planDayIndex;
    const normalizedTask = labels.normalizeTask(detail.task);
    const previewAudio = buildCurrentAudio(normalizedTask, '', 'idle');
    const studyCompleted = normalizedTask ? this.isLessonStudyCompletedForTask(normalizedTask) : false;
    const studyWriteAllowed = isLessonTrainingMode(detail.currentMember, this.planRunType, detail.studyWriteAllowed);
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
      transcriptManualVisible: false,
      transcriptSyncGranularity: 'word',
      currentMember: detail.currentMember,
      studyWriteAllowed,
      isPreviewMode: this.planRunType === 'preview',
      studyModeLabel: this.planRunType === 'preview' ? text('previewModeLabel', '预览模式') : (detail.currentMember && detail.currentMember.studyRole === 'student' ? text('studentDevice', '学生设备') : text('parentModeLabel', '家长模式')),
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
      audioPlaybackMode: 'idle',
      lessonStudyPack: null,
      lessonStudyLoading: false,
      lessonStudyError: '',
      lessonStudyCompleted: studyCompleted,
      lessonStudyTab: 'vocabulary',
      lessonVocabularyCards: [],
      lessonPhraseCards: [],
      lessonPatternCards: []
    }));
    if (normalizedTask) {
      this.prefetchTaskAudio(normalizedTask);
      this.loadLessonSecondaryData(normalizedTask, detail.progress);
      monitor.logPerf('lesson', 'refreshPage', Date.now() - startedAt, {
        category: this.category,
        taskId: this.taskId
      });
      return detail;
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
    return detail;
  },
  async loadLessonSecondaryData(task, progress) {
    const startedAt = Date.now();
    await Promise.allSettled([
      this.loadCachedLessonStudyPack(task),
      this.refreshSpeakingAttempts(task),
      this.updatePassQuestion(task, progress)
    ]);
    monitor.logPerf('lesson', 'secondaryData', Date.now() - startedAt, {
      category: this.category,
      taskId: this.taskId
    });
    this.markLessonRoute('secondaryLoaded');
  },
  getQuestionFromLines(lines, options = {}) {
    const items = lines || [];
    const cueIndex = items.findIndex((line) => /answer (?:this|these) questions?/i.test(String(line.text || '')));
    if (options.requireAnswerCue && cueIndex < 0) {
      return '';
    }
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
      speakingScoreDetail: buildSpeakingScoreDetail(attempts),
      speakingCanContinue: canContinueAfterSpeaking(attempts),
      repeatCompletedCount: Object.keys(repeated).length
    });
  },
  async updatePassQuestion(task, progress) {
    const targetTask = task || this.data.task || {};
    const currentPass = Number((progress && progress.currentPass) || (this.data.progress && this.data.progress.currentPass) || 1);
    if (!currentPass) {
      this.setData({
        passQuestionVisible: false,
        passQuestionText: ''
      });
      return;
    }
    const explicitQuestionMode = targetTask.speakingMode === 'nce-question-answer';
    if (explicitQuestionMode && !(this.data.transcriptLines || []).length) {
      this.setData({
        passQuestionVisible: true,
        passQuestionText: targetTask.questionText || targetTask.passQuestionText || text('answerRecordHint', '听完问题后录音回答')
      });
      return;
    }
    const lines = this.data.transcriptLines || [];
    const questionText = this.getQuestionFromLines(lines, { requireAnswerCue: !explicitQuestionMode });
    const enabledByText = isNewConceptTask(targetTask, this.category) && questionText && hasAnswerQuestionCue(lines);
    if (!explicitQuestionMode && !enabledByText) {
      this.setData({
        passQuestionVisible: false,
        passQuestionText: ''
      });
      return;
    }
    if (!explicitQuestionMode) {
      const nextTask = Object.assign({}, targetTask, {
        speakingMode: 'nce-question-answer',
        questionAnswerRequired: true
      });
      this.setData({ task: nextTask });
      await this.refreshSpeakingAttempts(nextTask);
    }
    this.setData({
      passQuestionVisible: true,
      passQuestionText: questionText || text('answerRecordHint', '听完问题后录音回答')
    });
  },
  async openSpeakingPanelForPass(passNumber) {
    const task = this.data.task || {};
    const lines = await this.ensureTranscriptLoadedForSpeaking();
    const questionText = this.data.passQuestionText || this.getQuestionFromLines(lines, {
      requireAnswerCue: task.speakingMode !== 'nce-question-answer'
    });
    const canQuestionAnswer = task.speakingMode === 'nce-question-answer'
      || (isNewConceptTask(task, this.category) && questionText && hasAnswerQuestionCue(lines));
    if (canQuestionAnswer) {
      const attemptCount = (this.data.speakingAttempts || [])
        .filter((item) => item.attemptType === 'nce_question_answer')
        .length;
      const nextTask = task.speakingMode === 'nce-question-answer'
        ? task
        : Object.assign({}, task, { speakingMode: 'nce-question-answer', questionAnswerRequired: true });
      this.setData({
        task: nextTask,
        speakingPanelVisible: true,
        speakingMode: 'nce-question-answer',
        speakingAttemptIndex: attemptCount + 1,
        speakingQuestionText: questionText,
        speakingPromptText: '',
        speakingTempFilePath: '',
        speakingCanContinue: false,
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
        speakingCanContinue: false,
        pendingListenAfterSpeaking: true
      });
      return true;
    }
    return false;
  },
  async startQuestionAnswerNow() {
    const passNumber = Number((this.data.progress && this.data.progress.currentPass) || (this.data.task && this.data.task.currentPass) || 1);
    await this.openSpeakingPanelForPass(passNumber);
  },
  async showTranscriptOnDemand() {
    await this.ensureTranscriptLoadedForSpeaking();
    this.setData({ transcriptManualVisible: true });
  },
  async startSpeakingRecord() {
    if (!this.recorderManager) {
      wx.showToast({ title: text('recordUnsupported', '当前微信不支持录音'), icon: 'none' });
      return;
    }
    if (!this.recorderManager || this.data.speakingRecording) {
      return;
    }
    const privacyAuthorized = await this.ensureRecorderPrivacyAuthorized();
    if (!privacyAuthorized) {
      this.setData({
        speakingDebugLines: []
      });
      this.showRecorderPrivacyGuide();
      return;
    }
    this.recordStartAudioWasPlaying = !!this.data.isPlaying;
    if (this.innerAudioContext && this.data.isPlaying) {
      this.innerAudioContext.pause();
    }
    if (this.speakingAudioContext) {
      this.speakingAudioContext.stop();
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    this.setData({
      speakingTempFilePath: '',
      speakingPromptText: '',
      speakingCanContinue: false,
      speakingRecordDurationMs: 0,
      speakingRecordDurationText: '',
      speakingRecordStartedAt: Date.now(),
      speakingRecording: true,
      speakingDebugLines: []
    });
    try {
      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3'
      });
    } catch (error) {
      const privacyBanned = this.isRecorderPrivacyBanned(error);
      const debugLines = this.buildRecordDebugLines('recorderManager.start.catch', error, {
        audioWasPlaying: this.recordStartAudioWasPlaying
      });
      this.setData({
        speakingRecording: false,
        speakingDebugLines: privacyBanned ? [] : debugLines
      });
      if (privacyBanned) {
        this.showRecorderPrivacyGuide();
      } else {
        wx.showToast({ title: text('recordFailed', '录音启动失败，请重试'), icon: 'none' });
      }
    }
  },
  stopSpeakingRecord() {
    if (this.recorderManager && this.data.speakingRecording) {
      this.recorderManager.stop();
    }
  },
  async submitSpeakingRecord() {
    if (this.data.speakingRecording) {
      wx.showToast({ title: text('stopFirst', '请先停止录音'), icon: 'none' });
      return;
    }
    if (!this.data.speakingTempFilePath || this.data.speakingSubmitting) {
      wx.showToast({ title: text('recordFirst', '请先录音'), icon: 'none' });
      return;
    }
    const task = this.data.task || {};
    const isRepeat = this.data.speakingMode === 'unlock-sentence-repeat';
    const sentence = isRepeat ? (this.data.repeatLines[this.data.repeatActiveIndex] || {}) : {};
    const attemptType = isRepeat ? 'unlock_sentence_repeat' : 'nce_question_answer';
    const attemptIndex = isRepeat ? 1 : this.data.speakingAttemptIndex;
    const sentenceIndex = isRepeat ? this.data.repeatActiveIndex + 1 : 0;
    this.setData({ speakingSubmitting: true });
    let speakingFailureDebugLines = [];
    try {
      const localFileInfo = await getLocalFileInfo(this.data.speakingTempFilePath);
      const baseDebugLines = [
        buildSpeakingDebugLine('submitSpeakingRecord', {
          storeAction: 'uploadSpeakingAudio',
          cloudAction: 'wx.cloud.uploadFile',
          field: 'localFile',
          value: `path=${this.data.speakingTempFilePath || 'missing'}, size=${localFileInfo.size}, error=${localFileInfo.error || 'none'}`
        })
      ];
      speakingFailureDebugLines = baseDebugLines;
      this.setData({ speakingDebugLines: [] });
      if (this.planRunType === 'preview' || !this.isStudyWriteAllowed()) {
        const upload = await store.createSpeakingUploadUrl({
          category: this.category,
          taskId: task.taskId,
          targetDate: this.targetDate,
          planRunType: 'preview',
          planDayIndex: this.planDayIndex,
          attemptType,
          attemptIndex,
          sentenceIndex
        });
        const uploadTargetDebugLines = baseDebugLines.concat([
          buildSpeakingDebugLine('submitSpeakingRecord', {
            storeAction: 'createSpeakingUploadUrl',
            cloudAction: 'createSpeakingUploadUrl',
            field: 'uploadTarget',
            value: `cloudPath=${upload.cloudPath || 'missing'}, fileId=${upload.fileId ? 'present' : 'missing'}`
          })
        ]);
        speakingFailureDebugLines = uploadTargetDebugLines;
        const fileId = await store.uploadSpeakingAudio(upload.cloudPath, this.data.speakingTempFilePath);
        const uploadDebugLines = uploadTargetDebugLines.concat([
          buildSpeakingDebugLine('submitSpeakingRecord', {
            storeAction: 'uploadSpeakingAudio',
            cloudAction: 'wx.cloud.uploadFile',
            field: 'uploadResult',
            value: `fileId=${fileId ? 'present' : 'missing'}`
          })
        ]);
        speakingFailureDebugLines = uploadDebugLines;
        const submitStartDebugLines = uploadDebugLines.concat([
          buildSpeakingDebugLine('submitSpeakingRecord', {
            storeAction: 'submitSpeakingAttempt',
            cloudAction: 'submitSpeakingAttempt',
            field: 'request',
            value: `started, answerAudioFileId=${fileId || upload.fileId ? 'present' : 'missing'}, answerCloudPath=${upload.cloudPath || 'missing'}, targetChildId=N/A`
          })
        ]);
        speakingFailureDebugLines = submitStartDebugLines;
        const result = await store.submitSpeakingAttempt({
          category: this.category,
          taskId: task.taskId,
          targetDate: this.targetDate,
          planRunType: 'preview',
          planDayIndex: this.planDayIndex,
          attemptType,
          attemptIndex,
          sentenceIndex,
          questionText: this.data.speakingQuestionText,
          promptText: isRepeat ? sentence.text : this.data.speakingQuestionText,
          taskSnapshot: task,
          answerAudioFileId: fileId || upload.fileId,
          answerCloudPath: upload.cloudPath,
          answerDurationMs: this.data.speakingRecordDurationMs
        });
        const resultDebugLines = submitStartDebugLines.concat([
          buildSpeakingDebugLine('submitSpeakingRecord', {
            storeAction: 'submitSpeakingAttempt',
            cloudAction: 'submitSpeakingAttempt',
            field: 'attempt',
            value: `status=${result && result.attempt ? result.attempt.status || 'missing' : 'missing'}, scoreErrorType=${result && result.attempt ? result.attempt.scoreErrorType || 'none' : 'missing'}, scoreError=${result && result.attempt ? result.attempt.scoreError || 'none' : ((result && result.cloudError && result.cloudError.message) || 'missing')}`
          })
        ]);
        speakingFailureDebugLines = resultDebugLines;
        if (!result || result.cloudError || !result.attempt) {
          this.setData({ speakingDebugLines: resultDebugLines });
          if (await this.finishPendingListenAfterSpeakingFailure(text('speakingFallback', '评分失败，按听力完成'))) {
            return;
          }
          wx.showToast({ title: text('trialScoreFailed', '试做评分失败'), icon: 'none' });
          return;
        }
        const previewAttempt = Object.assign({}, normalizeSpeakingAttempts([result.attempt])[0] || result.attempt, {
          localAudioPath: this.data.speakingTempFilePath
        });
        const attempts = (this.data.speakingAttempts || []).concat([previewAttempt]);
        const repeated = {};
        attempts.filter((item) => item.attemptType === 'unlock_sentence_repeat').forEach((item) => {
          repeated[item.sentenceIndex] = true;
        });
        this.setData({
          speakingAttempts: attempts,
          speakingSummary: buildLocalSpeakingSummary(attempts),
          speakingScoreDetail: buildSpeakingScoreDetail(attempts),
          repeatCompletedCount: Object.keys(repeated).length,
          speakingTempFilePath: '',
          speakingRecordDurationMs: 0,
          speakingRecordDurationText: '',
          speakingPromptText: attempts[attempts.length - 1].feedback,
          speakingCanContinue: !isRepeat && canContinueAfterSpeaking(attempts),
          speakingDebugLines: []
        });
        if (isRepeat) {
          if (this.data.repeatActiveIndex < (this.data.repeatLines || []).length - 1) {
            const nextIndex = this.data.repeatActiveIndex + 1;
            this.setData({
              repeatActiveIndex: nextIndex,
              activeRepeatLine: (this.data.repeatLines || [])[nextIndex] || null
            });
          }
          wx.showToast({ title: text('trialScoreDone', '云端试做评分完成'), icon: 'none' });
          return;
        }
        this.setData({ speakingAttemptIndex: attemptIndex + 1 });
        wx.showToast({ title: text('scoreDoneRerecord', '云端评分完成，可重录'), icon: 'none' });
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
      const uploadTargetDebugLines = baseDebugLines.concat([
        buildSpeakingDebugLine('submitSpeakingRecord', {
          storeAction: 'createSpeakingUploadUrl',
          cloudAction: 'createSpeakingUploadUrl',
          field: 'uploadTarget',
          value: `cloudPath=${upload.cloudPath || 'missing'}, fileId=${upload.fileId ? 'present' : 'missing'}`
        })
      ]);
      speakingFailureDebugLines = uploadTargetDebugLines;
      const fileId = await store.uploadSpeakingAudio(upload.cloudPath, this.data.speakingTempFilePath);
      const uploadDebugLines = uploadTargetDebugLines.concat([
        buildSpeakingDebugLine('submitSpeakingRecord', {
          storeAction: 'uploadSpeakingAudio',
          cloudAction: 'wx.cloud.uploadFile',
          field: 'uploadResult',
          value: `fileId=${fileId ? 'present' : 'missing'}`
        })
      ]);
      speakingFailureDebugLines = uploadDebugLines;
      const submitStartDebugLines = uploadDebugLines.concat([
        buildSpeakingDebugLine('submitSpeakingRecord', {
          storeAction: 'submitSpeakingAttempt',
          cloudAction: 'submitSpeakingAttempt',
          field: 'request',
          value: `started, answerAudioFileId=${fileId || upload.fileId ? 'present' : 'missing'}, answerCloudPath=${upload.cloudPath || 'missing'}, targetChildId=N/A`
        })
      ]);
      speakingFailureDebugLines = submitStartDebugLines;
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
        taskSnapshot: task,
        answerAudioFileId: fileId || upload.fileId,
        answerCloudPath: upload.cloudPath,
        answerDurationMs: this.data.speakingRecordDurationMs
      });
      const resultDebugLines = submitStartDebugLines.concat([
        buildSpeakingDebugLine('submitSpeakingRecord', {
          storeAction: 'submitSpeakingAttempt',
          cloudAction: 'submitSpeakingAttempt',
          field: 'attempt',
          value: `status=${result && result.attempt ? result.attempt.status || 'missing' : 'missing'}, scoreErrorType=${result && result.attempt ? result.attempt.scoreErrorType || 'none' : 'missing'}, scoreError=${result && result.attempt ? result.attempt.scoreError || 'none' : ((result && result.cloudError && result.cloudError.message) || 'missing')}`
        })
      ]);
      speakingFailureDebugLines = resultDebugLines;
      if (!result || result.cloudError || !result.attempt) {
        this.setData({ speakingDebugLines: resultDebugLines });
        if (await this.finishPendingListenAfterSpeakingFailure(text('speakingFallback', '评分失败，按听力完成'))) {
          return;
        }
        wx.showToast({ title: text('scoreFailed', '评分失败，请重试'), icon: 'none' });
        return;
      }
      const normalizedAttempts = normalizeSpeakingAttempts(result.attempts || []);
      const normalizedAttempt = normalizeSpeakingAttempts([result.attempt])[0] || result.attempt;
      this.setData({
        speakingAttempts: normalizedAttempts,
        speakingSummary: buildLocalSpeakingSummary(normalizedAttempts),
        speakingScoreDetail: buildSpeakingScoreDetail(normalizedAttempts),
        speakingTempFilePath: '',
        speakingRecordDurationMs: 0,
        speakingRecordDurationText: '',
        speakingPromptText: normalizedAttempt && normalizedAttempt.feedback ? normalizedAttempt.feedback : '',
        speakingCanContinue: !isRepeat && canContinueAfterSpeaking(normalizedAttempts),
        speakingDebugLines: normalizedAttempt && normalizedAttempt.status === 'score-pending' ? resultDebugLines : []
      });
      if (normalizedAttempt && normalizedAttempt.status === 'score-pending') {
        wx.showToast({
          title: normalizedAttempt.scoreErrorType === 'audio-download' ? text('recordReadFailed', '录音读取失败，请重录') : text('recordSaved', '录音已保存，稍后刷新评分'),
          icon: 'none'
        });
        await this.finishPendingListenAfterSpeaking();
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
        wx.showToast({ title: text('sentenceScored', '本句已评分'), icon: 'none' });
        return;
      }
      this.setData({ speakingAttemptIndex: attemptIndex + 1 });
      wx.showToast({ title: text('scoreProgressDone', '评分完成，已计入进度'), icon: 'none' });
      await this.finishPendingListenAfterSpeaking();
    } catch (error) {
      const errorMessage = (error && (error.errMsg || error.message)) || String(error || '');
      this.setData({
        speakingDebugLines: (speakingFailureDebugLines || []).concat([
          buildSpeakingDebugLine('submitSpeakingRecord', {
            storeAction: 'submitSpeakingAttempt',
            cloudAction: 'submitSpeakingAttempt',
            field: 'exception',
            value: errorMessage || 'unknown'
          })
        ])
      });
      if (await this.finishPendingListenAfterSpeakingFailure(text('speakingFallback', '提交失败，按听力完成'))) {
        return;
      }
      wx.showToast({ title: text('submitFailed', '提交失败，请重试'), icon: 'none' });
    } finally {
      this.setData({ speakingSubmitting: false });
    }
  },
  async finishPendingListenAfterSpeakingFailure(title) {
    if (!this.data.pendingListenAfterSpeaking) {
      return false;
    }
    this.setData({
      speakingSubmitting: false,
      speakingRecording: false
    });
    wx.showToast({ title: title || text('speakingFallback', '口语失败，按听力完成'), icon: 'none' });
    try {
      await this.finishPendingListenAfterSpeaking();
    } catch (error) {
      wx.showToast({ title: text('progressSyncFailed', '听力进度同步失败'), icon: 'none' });
    }
    return true;
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
    if (!this.data.speakingCanContinue) {
      wx.showToast({ title: text('saveRecordFirst', '录音保存后才能继续'), icon: 'none' });
      return;
    }
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
      if (this.data.speakingPausedAttemptKey === key) {
        this.speakingAudioContext.play();
      } else {
        this.speakingAudioContext.pause();
      }
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
      wx.showToast({ title: audioType === 'feedback' ? text('feedbackUnavailable', '建议语音暂不可播放') : text('recordUnavailable', '录音暂不可播放'), icon: 'none' });
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
  async rescoreSpeakingAttempt(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const attempt = (this.data.speakingAttempts || [])[index] || null;
    const attemptId = String(attempt && (attempt.attemptId || attempt._id) || '').trim();
    if (!attemptId || this.data.speakingRescoringKey) {
      return;
    }
    this.setData({ speakingRescoringKey: attemptId });
    try {
      const result = await store.rescoreSpeakingAttempt({ attemptId });
      const normalizedAttempts = normalizeSpeakingAttempts(result.attempts || []);
      const normalizedAttempt = normalizeSpeakingAttempts([result.attempt])[0] || result.attempt;
      this.setData({
        speakingAttempts: normalizedAttempts,
        speakingSummary: buildLocalSpeakingSummary(normalizedAttempts),
        speakingScoreDetail: buildSpeakingScoreDetail(normalizedAttempts),
        speakingPromptText: normalizedAttempt && normalizedAttempt.feedback ? normalizedAttempt.feedback : '',
        speakingCanContinue: canContinueAfterSpeaking(normalizedAttempts)
      });
      wx.showToast({
        title: normalizedAttempt && normalizedAttempt.status === 'scored' ? text('scoreDone', '评分完成') : text('retryNeeded', '仍需稍后重试'),
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({ title: text('rescoreFailed', '重新评分失败'), icon: 'none' });
    } finally {
      this.setData({ speakingRescoringKey: '' });
    }
  },
  async completeUnlockRepeat() {
    const total = (this.data.repeatLines || []).length;
    if (total && this.data.repeatCompletedCount < total) {
      wx.showToast({ title: `${text('remainingPrefix', '还剩 ')}${total - this.data.repeatCompletedCount}${text('remainingSuffix', ' 句')}`, icon: 'none' });
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
    await this.updatePassQuestion(normalizedTask, this.data.progress);
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
        title: text('rewindOnly', '这里只能回退，不能快进'),
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
    this.markLessonRoute('playTap', {
      hasSrc: this.innerAudioContext.src ? 'yes' : 'no',
      ready: this.data.audioReady ? 'yes' : 'no'
    });
    if (!this.innerAudioContext.src) {
      this.pendingAutoPlay = true;
      await this.syncPlayer(this.data.task);
    }
    if (!this.innerAudioContext.src) {
      wx.showToast({
        title: text('cloudAudioUnavailable', '云端音频暂时不可用'),
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
        this.innerAudioContext.play();
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
  selectLessonStudyTab(event) {
    this.setData({ lessonStudyTab: event.currentTarget.dataset.tab || 'vocabulary' });
  },
  scrollToLessonStudy() {
    if (!wx.pageScrollTo) return;
    setTimeout(() => {
      wx.pageScrollTo({
        selector: '#lesson-study-card',
        duration: 220
      });
    }, 120);
  },
  applyLessonStudyPack(studyPack) {
    const pack = studyPack || {};
    this.setData({
      lessonStudyPack: pack,
      lessonVocabularyCards: normalizeLessonStudyCards(pack.vocabularyCards || [], 'word'),
      lessonPhraseCards: normalizeLessonStudyCards(pack.phraseCards || [], 'phrase'),
      lessonPatternCards: normalizeLessonStudyCards(pack.sentencePatternCards || [], 'pattern')
    }, () => {
      if (this.focus === 'study') {
        this.scrollToLessonStudy();
      }
    });
    recordLessonStudyPackSynced(this.data.task || {}, this.category, this.taskId);
  },
  async loadCachedLessonStudyPack(task) {
    const target = task || this.data.task || {};
    const result = await store.getListeningStudyPack(
      buildLessonStudyItem(target, this.category, this.taskId, ''),
      { cacheOnly: true }
    );
    const studyPack = result && result.studyPack;
    const hasCards = studyPack
      && ((studyPack.vocabularyCards || []).length || (studyPack.phraseCards || []).length || (studyPack.sentencePatternCards || []).length);
    if (hasCards) {
      this.applyLessonStudyPack(studyPack);
      return true;
    }
    return this.applyLessonStudyPackSnapshot();
  },
  async loadLessonStudyPack() {
    if (this.data.lessonStudyLoading) return;
    if (this.data.lessonStudyPack) return;
    const task = this.data.task || {};
    if (this.data.lessonStudyCompleted && !this.data.lessonStudyPack) {
      this.setData({ lessonStudyLoading: true, lessonStudyError: '' });
      const restored = await this.loadCachedLessonStudyPack(task);
      this.setData({ lessonStudyLoading: false });
      if (!restored) {
        this.setData({ lessonStudyError: text('packCacheMiss', '学习包已生成，但本页没有命中缓存；请稍后从日报再试。') });
      }
      return;
    }
    let lines = this.data.transcriptLines || [];
    if (!buildTranscriptText(lines) && this.data.transcriptPendingLoad) {
      await this.loadTranscript();
      lines = this.data.transcriptLines || [];
    }
    const transcript = buildTranscriptText(lines);
    if (!transcript) {
      this.setData({
        lessonStudyError: text('noTextPack', '这条听力暂无文本，暂不能生成。')
      });
      return;
    }
    this.setData({ lessonStudyLoading: true, lessonStudyError: '' });
    const result = await store.getListeningStudyPack(buildLessonStudyItem(task, this.category, this.taskId, transcript), { useCache: false });
    let studyPack = result && result.studyPack;
    if (hasLessonStudyCards(studyPack)) {
      this.applyLessonStudyPack(studyPack);
      this.setData({ lessonStudyLoading: false });
      return;
    }
    const cachedResult = await store.getListeningStudyPack(buildLessonStudyItem(task, this.category, this.taskId, ''), { cacheOnly: true, useCache: false });
    studyPack = cachedResult && cachedResult.studyPack;
    if (hasLessonStudyCards(studyPack)) {
      this.applyLessonStudyPack(studyPack);
      this.setData({ lessonStudyLoading: false });
      return;
    }
    this.setData({
      lessonStudyLoading: false,
      lessonStudyError: getLessonStudyError(result)
    });
  },
  completeLessonStudy() {
    const task = this.data.task || {};
    if (!this.data.lessonStudyPack) return;
    wx.setStorageSync(lessonStudyDoneKey(task.category || this.category, task.taskId || this.taskId), true);
    this.setData({
      lessonStudyCompleted: true,
      lessonStudyError: ''
    });
  },
  async speakLessonStudyAudio(event) {
    const type = String(event.currentTarget.dataset.type || 'word');
    const text = String(event.currentTarget.dataset.text || '').replace(/\s+/g, ' ').trim();
    const audioKey = `${type}:${text}`;
    if (!text || this._lessonStudyAudioLoading || !canUseDictionaryVoice(text)) return;
    const cards = type === 'phrase' ? this.data.lessonPhraseCards : this.data.lessonVocabularyCards;
    const card = (cards || []).find((item) => (item.word || item.text || item.phrase) === text) || {};
    this._lessonStudyAudioLoading = true;
    this.setData({ speakingWord: audioKey });
    try {
      const localUrls = [];
      const cachedUrl = this._lessonStudyAudioUrls && this._lessonStudyAudioUrls[text];
      if (cachedUrl) localUrls.push(cachedUrl);
      if (card.audioUrl && card.audioUrl !== cachedUrl) localUrls.push(card.audioUrl);
      this._lessonStudyAudioFallbackUrls = [];
      this._lessonStudyAudioFallbackIndex = 0;
      this._lessonStudyAudioDictionaryFallbackTried = false;
      this._lessonStudyAudioFileFallbackTried = false;
      this._lessonStudyAudioFileId = card.audioFileId || '';
      this._lessonStudyAudioText = text;
      this._lessonStudyAudioFallbackUrls = localUrls.concat(buildDictionaryVoiceUrls(text));
      const url = this._lessonStudyAudioFallbackUrls[0];
      this._lessonStudyAudioUrls = Object.assign({}, this._lessonStudyAudioUrls || {}, { [text]: url });
      if (!this.lessonStudyAudioContext) {
        this.lessonStudyAudioContext = wx.createInnerAudioContext();
        this.lessonStudyAudioContext.obeyMuteSwitch = false;
        this.lessonStudyAudioContext.onEnded(() => {
          this.setData({ speakingWord: '' });
        });
        this.lessonStudyAudioContext.onError(async () => {
          const urls = this._lessonStudyAudioFallbackUrls || [];
          this._lessonStudyAudioFallbackIndex = Number(this._lessonStudyAudioFallbackIndex || 0) + 1;
          if (this._lessonStudyAudioFallbackIndex < urls.length) {
            this.lessonStudyAudioContext.src = urls[this._lessonStudyAudioFallbackIndex];
            this.lessonStudyAudioContext.play();
            return;
          }
          if (!this._lessonStudyAudioFileFallbackTried && this._lessonStudyAudioFileId) {
            this._lessonStudyAudioFileFallbackTried = true;
            try {
              const fileUrl = await store.getTempFileURL(this._lessonStudyAudioFileId);
              if (fileUrl) {
                this._lessonStudyAudioUrls = Object.assign({}, this._lessonStudyAudioUrls || {}, { [this._lessonStudyAudioText]: fileUrl });
                this.lessonStudyAudioContext.src = fileUrl;
                this.lessonStudyAudioContext.play();
                return;
              }
            } catch (fileError) {}
          }
          if (!this._lessonStudyAudioDictionaryFallbackTried && isSingleWord(this._lessonStudyAudioText)) {
            this._lessonStudyAudioDictionaryFallbackTried = true;
            try {
              const audioResult = await store.synthesizeReadingAudio({
                text: this._lessonStudyAudioText,
                skipYoudao: true
              });
              if (audioResult && audioResult.audioUrl) {
                this.lessonStudyAudioContext.src = audioResult.audioUrl;
                this.lessonStudyAudioContext.play();
                return;
              }
            } catch (fallbackError) {}
          }
          this.setData({ speakingWord: '' });
          wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
        });
      }
      this.lessonStudyAudioContext.stop();
      this.lessonStudyAudioContext.src = url;
      this.lessonStudyAudioContext.play();
    } catch (error) {
      this.setData({ speakingWord: '' });
      wx.showToast({ title: text('pronunciationFailed', '发音失败，稍后重试'), icon: 'none' });
    } finally {
      this._lessonStudyAudioLoading = false;
    }
  },
  async lookupLessonStudyWord(event) {
    const word = String(event.currentTarget.dataset.word || event.currentTarget.dataset.text || '').trim();
    if (!word || this.data.dictionaryLoading) return;
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    this.setData({
      dictionaryVisible: true,
      dictionaryLoading: true,
      dictionaryWord: word,
      dictionaryEntry: null
    });
    const localKey = `dictionary:${word.toLowerCase()}`;
    try {
      const cached = wx.getStorageSync(localKey);
      const cacheAge = Date.now() - Number(cached && cached._cachedAt || 0);
      if (cached && cached.wordLower && cacheAge < 30 * 60 * 1000) {
        this.setData({ dictionaryEntry: cached, dictionaryLoading: false });
        return;
      }
    } catch (error) {}
    try {
      const entry = await store.lookupWord(word);
      try {
        wx.setStorageSync(localKey, Object.assign({}, entry, { _cachedAt: Date.now() }));
      } catch (error) {}
      this.setData({ dictionaryEntry: entry, dictionaryLoading: false });
    } catch (error) {
      this.setData({ dictionaryLoading: false });
      wx.showToast({ title: text('lookupFailed', '查词失败'), icon: 'none' });
    }
  },
  closeDictionary() {
    this.setData({ dictionaryVisible: false, dictionaryLoading: false, dictionaryAudioLoading: false });
  },
  async addDictionaryWordToLibrary() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    if (!word || this.data.dictionaryAdding) return;
    this.setData({ dictionaryAdding: true });
    try {
      const result = await store.addDictionaryWord(Object.assign({}, entry, { word }));
      const key = result && result.flashcardKey ? result.flashcardKey : `word:${word}`;
      this.setData({
        lessonDictionaryAddedMap: Object.assign({}, this.data.lessonDictionaryAddedMap || {}, { [key]: true, [word]: true }),
        flashcardAddDebugLines: []
      });
      wx.showToast({ title: text('addSuccess', '已加入词库'), icon: 'none' });
    } catch (error) {
      this.setData({
        flashcardAddDebugLines: [
          `DEBUG: lesson.addDictionaryWordToLibrary -> store.addDictionaryWord -> cloud.addDictionaryWord.saved：false`,
          `${getFlashcardTargetDebugText()}；cloudError.message=${error && error.message ? error.message : String(error)}`
        ]
      });
      wx.showToast({ title: text('addFailed', '加入失败'), icon: 'none' });
    } finally {
      this.setData({ dictionaryAdding: false });
    }
  },
  async addLessonStudyWordToLibrary(event) {
    const type = String(event.currentTarget.dataset.type || 'word');
    const text = String(event.currentTarget.dataset.text || event.currentTarget.dataset.word || '').trim();
    if (!text || this.data.dictionaryAdding) return;
    const cards = type === 'phrase'
      ? this.data.lessonPhraseCards
      : (type === 'pattern' ? this.data.lessonPatternCards : this.data.lessonVocabularyCards);
    const card = (cards || []).find((item) => (item.word || item.text || item.phrase || item.pattern) === text) || { word: text, text, pattern: text };
    const task = this.data.task || {};
    this.setData({ dictionaryAdding: true });
    try {
      const result = await store.addDictionaryWord(Object.assign({}, card, {
        type,
        word: type === 'word' ? (card.word || card.text || text) : '',
        phrase: type === 'phrase' ? (card.text || card.phrase || text) : '',
        text,
        pattern: type === 'pattern' ? (card.pattern || text) : '',
        sourceType: 'listening',
        sourceId: task.taskId || this.taskId || '',
        sourceTitle: task.title || task.displayTitle || ''
      }));
      const key = result && result.flashcardKey ? result.flashcardKey : (card.flashcardKey || `${type}:${text}`);
      this.setData({
        lessonDictionaryAddedMap: Object.assign({}, this.data.lessonDictionaryAddedMap || {}, { [key]: true, [text]: true }),
        flashcardAddDebugLines: []
      });
      wx.showToast({ title: text('addSuccess', '已加入词库'), icon: 'none' });
    } catch (error) {
      this.setData({
        flashcardAddDebugLines: [
          `DEBUG: lesson.addLessonStudyWordToLibrary -> store.addDictionaryWord -> cloud.addDictionaryWord.saved：false`,
          `${getFlashcardTargetDebugText()}；type=${type}；text=${text}；cloudError.message=${error && error.message ? error.message : String(error)}`
        ]
      });
      wx.showToast({ title: text('addFailed', '加入失败'), icon: 'none' });
    } finally {
      this.setData({ dictionaryAdding: false });
    }
  },
  async playDictionaryWord() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    if (!word || this.data.dictionaryAudioLoading) return;
    const playUrl = (url) => {
      if (!this.dictionaryAudioContext) {
        this.dictionaryAudioContext = wx.createInnerAudioContext();
        this.dictionaryAudioContext.obeyMuteSwitch = false;
        this.dictionaryAudioContext.onEnded(() => {
          this.setData({ dictionaryAudioLoading: false });
        });
        this.dictionaryAudioContext.onError(() => {
          const urls = this._dictionaryAudioFallbackUrls || [];
          this._dictionaryAudioFallbackIndex = Number(this._dictionaryAudioFallbackIndex || 0) + 1;
          if (this._dictionaryAudioFallbackIndex < urls.length) {
            this.dictionaryAudioContext.src = urls[this._dictionaryAudioFallbackIndex];
            this.dictionaryAudioContext.play();
            return;
          }
          if (!this._dictionaryAudioFileFallbackTried && this._dictionaryAudioFileId) {
            this._dictionaryAudioFileFallbackTried = true;
            store.getTempFileURL(this._dictionaryAudioFileId).then((fileUrl) => {
              if (fileUrl) {
                this.dictionaryAudioContext.src = fileUrl;
                this.dictionaryAudioContext.play();
                return;
              }
              this.setData({ dictionaryAudioLoading: false });
              wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
            }).catch(() => {
              this.setData({ dictionaryAudioLoading: false });
              wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
            });
            return;
          }
          this.setData({ dictionaryAudioLoading: false });
          wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
        });
      }
      this.dictionaryAudioContext.stop();
      this.dictionaryAudioContext.src = url;
      this.setData({ dictionaryAudioLoading: true });
      this.dictionaryAudioContext.play();
    };
    try {
      const urls = [];
      if (entry.audioUrl) urls.push(entry.audioUrl);
      if (canUseDictionaryVoice(word)) urls.push(...buildDictionaryVoiceUrls(word));
      this._dictionaryAudioFileId = entry.audioFileId || '';
      this._dictionaryAudioFileFallbackTried = false;
      this._dictionaryAudioFallbackUrls = urls.length ? urls : buildDictionaryVoiceUrls(word);
      this._dictionaryAudioFallbackIndex = 0;
      playUrl(this._dictionaryAudioFallbackUrls[0]);
    } catch (error) {
      this.setData({ dictionaryAudioLoading: false });
      wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
    }
  },
  async handleAudioEnded() {
    if (!this.data.task || this.data.task.isPendingAsset) {
      return;
    }
    if (this.planRunType !== 'preview' && !this.isStudyWriteAllowed()) {
      wx.showToast({
        title: text('previewComplete', '试听完成'),
        icon: 'none'
      });
      return;
    }
    const passNumber = Number((this.data.progress && this.data.progress.currentPass) || (this.data.task && this.data.task.currentPass) || 1);
    if (this.data.task && this.data.task.speakingMode) {
      const shouldOpen = this.data.task.speakingMode === 'nce-question-answer'
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
    const wasCompleted = !!(this.data.progress && this.data.progress.completedToday);
    const detail = await store.markTaskListened({
      childId: this.data.child.childId,
      category: this.category,
      taskId: this.taskId,
      planRunType: this.planRunType,
      targetDate: this.targetDate,
      planDayIndex: this.planDayIndex,
      completeOnListen: true
    });
    if (detail && detail.syncMode === 'cloud-error') {
      wx.showToast({
        title: text('progressSyncFailed', '进度同步失败'),
        icon: 'none'
      });
      return;
    }
    this.taskId = detail && detail.task ? detail.task.taskId || this.taskId : this.taskId;
    this.planRunType = detail && detail.planRunType ? detail.planRunType : this.planRunType;
    this.targetDate = detail && detail.targetDate ? detail.targetDate : this.targetDate;
    this.planDayIndex = detail && detail.planDayIndex ? String(detail.planDayIndex) : this.planDayIndex;
    const normalizedTask = labels.normalizeTask(detail.task);
    const studyCompleted = normalizedTask ? this.isLessonStudyCompletedForTask(normalizedTask) : false;
    const transcriptLines = detail.transcriptTrack ? detail.transcriptTrack.lines : [];
    const studyWriteAllowed = isLessonTrainingMode(detail.currentMember, this.planRunType, detail.studyWriteAllowed);
    this.setData(page.buildCloudPageData(this.data, {
      child: detail.child,
      task: normalizedTask,
      stats: detail.stats,
      todayRecord: detail.todayRecord,
      progress: detail.progress,
      passSteps: buildPassSteps(detail.progress),
      scriptSource: detail.scriptSource,
      transcriptTrack: detail.transcriptTrack,
      transcriptLines,
      transcriptSyncGranularity: detail.transcriptTrack ? (detail.transcriptTrack.syncGranularity || 'word') : 'word',
      history: detail.history,
      currentMember: detail.currentMember,
      studyWriteAllowed,
      studyModeLabel: detail.currentMember && detail.currentMember.studyRole === 'student' ? text('studentDevice', '学生设备') : text('parentModeLabel', '家长模式'),
      checkinReady: !!detail.checkinReady,
      transcriptPendingLoad: !!detail.transcriptPendingLoad,
      transcriptLoadFailed: false,
      transcriptManualVisible: false,
      audioSource: normalizedTask && normalizedTask.audioSource ? normalizedTask.audioSource : 'none',
      playbackRate: 1,
      playbackRateText: '1.0',
      lessonStudyPack: null,
      lessonStudyLoading: false,
      lessonStudyError: '',
      lessonStudyCompleted: studyCompleted,
      lessonStudyTab: 'vocabulary',
      lessonVocabularyCards: [],
      lessonPhraseCards: [],
      lessonPatternCards: []
    }));
    await this.loadCachedLessonStudyPack(normalizedTask);
    await this.updatePassQuestion(normalizedTask, detail.progress);
    await this.syncPlayer(normalizedTask);
    if (!wasCompleted && detail.progress && detail.progress.completedToday) {
      this.showLessonCompletionEffect();
    }
    wx.showToast({
      title: detail.progress.completedToday ? `${normalizedTask.categoryLabel} ${text('completeToday', '今天完成')}` : `${text('completedPassPrefix', '已完成第 ')}${detail.progress.playCount}${text('completedPassSuffix', ' 遍')}`,
      icon: 'none'
    });
    if (detail.checkinReady) {
      this.promptCompleteTodayCheckin();
    }
  },
  showLessonCompletionEffect() {
    if (this.lessonCelebrateTimer) {
      clearTimeout(this.lessonCelebrateTimer);
    }
    const childId = (this.data.child && this.data.child.childId) || 'self';
    effects.playComplete({
      voiceKey: 'listeningComplete',
      onceKey: `listening:${this.targetDate || effects.todayKey()}:${childId}:${this.category || 'task'}:${this.taskId || 'current'}`
    });
    this.setData({ lessonCelebrateVisible: true });
    this.lessonCelebrateTimer = setTimeout(() => {
      this.lessonCelebrateTimer = null;
      this.setData({ lessonCelebrateVisible: false });
    }, 1800);
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
      studyModeLabel: text('previewModeLabel', '预览模式'),
      checkinReady: false,
      transcriptManualVisible: false
    }));
    await this.updatePassQuestion(nextTask, nextProgress);
    wx.showToast({
      title: nextProgress.completedToday ? text('previewFlowDone', '预览流程完成') : `${text('previewPassPrefix', '预览第 ')}${nextProgress.playCount}${text('passSuffix', ' 遍完成')}`,
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
        title: text('checkinTitle', '今天听完啦'),
        content: text('checkinContent', '点一下，完成今天打卡。'),
        confirmText: text('confirmCheckin', '完成打卡'),
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
        title: error.message || text('checkinFailed', '打卡失败'),
        icon: 'none'
      });
    }
  }
});
