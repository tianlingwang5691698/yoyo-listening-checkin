const page = require('../../utils/page');
const store = require('../../utils/store');
const effects = require('../../utils/effects');
const i18n = require('../../utils/i18n');
const labels = require('../../utils/labels');
const appConfig = require('../../app-config');

const text = (key, fallback) => i18n.getPageText('speaking', key, undefined, fallback);
const SPEAKING_LEVEL_KEY = 'speakingSelectedLevelV1';
const SPEAKING_LEVELS = ['Pre A1', 'A1', 'A2', 'B1', 'B2'].map((level) => ({
  id: level,
  label: level
}));

const SPEAKING_SERIES = {
  'Pre A1': [
    { id: 'song', title: 'Songs' },
    { id: 'littlebear', title: 'Little Bear' },
    { id: 'peppa', title: 'Peppa Pig · 第1–3季' }
  ],
  A1: [
    { id: 'newconcept1', title: 'New Concept 1' },
    { id: 'unlock1', title: 'Unlock 1 听口 第二版' },
    { id: 'unlock1thirdedition', title: 'Unlock 1 听口 第三版' },
    { id: 'unlock1workbookthirdedition', title: 'Unlock 1 听口练习册 第三版' },
    { id: 'unlock1workbook', title: 'Unlock 1 听口练习册 第二版' }
  ],
  A2: [
    { id: 'newconcept2', title: 'New Concept 2' },
    { id: 'petethecat', title: 'Pete the Cat' },
    { id: 'magictreehouse', title: 'Magic Tree House' },
    { id: 'unlock2', title: 'Unlock 2 课本' },
    { id: 'unlock2thirdedition', title: 'Unlock 2 听口 第三版' },
    { id: 'unlock2workbookthirdedition', title: 'Unlock 2 听口练习册 第三版' },
    { id: 'unlock2workbook', title: 'Unlock 2 练习册' }
  ],
  B1: [
    { id: 'newconcept3', title: 'New Concept 3' },
    { id: 'magictreehouseb1', title: 'Magic Tree House' },
    { id: 'unlock3textbook', title: 'Unlock 3 听口 第二版' },
    { id: 'unlock3thirdedition', title: 'Unlock 3 听口 第三版' },
    { id: 'unlock3workbookthirdedition', title: 'Unlock 3 听口练习册 第三版' },
    { id: 'unlock3', title: 'Unlock 3 听口练习册 第二版' }
  ],
  B2: [
    { id: 'newconcept4', title: 'New Concept 4' },
    { id: 'unlock4', title: 'Unlock 4 课本' },
    { id: 'unlock4thirdedition', title: 'Unlock 4 听口 第三版' },
    { id: 'unlock4workbookthirdedition', title: 'Unlock 4 听口练习册 第三版' },
    { id: 'unlock4workbook', title: 'Unlock 4 练习册' }
  ]
};

function getSpeakingSeries(level) {
  return SPEAKING_SERIES[level] || SPEAKING_SERIES.A2;
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
  if (!baseUrl || !normalizedPath) return '';
  return `${baseUrl}/${normalizedPath.split('/').map(encodeUrlPathSegment).join('/')}`;
}

function isHttpAudioUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = String(Math.floor(value / 60)).padStart(2, '0');
  const rest = String(value % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function formatAudioDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  return value ? formatClock(value) : text('durationPending', '时长待生成');
}

function normalizeRepeatAudio(task, index) {
  const source = task || {};
  const displayTitle = labels.decodeHtmlEntities(String(source.displayTitle || source.audioTitle || source.title || `${text('audioLabel', '音频')} ${index + 1}`));
  return Object.assign({}, source, {
    id: String(source.taskId || `audio-${index + 1}`),
    taskId: String(source.taskId || ''),
    pickerIndex: index,
    displayTitle,
    searchText: `${index + 1} ${displayTitle}`.toLowerCase().replace(/\s+/g, ''),
    meta: `${formatAudioDuration(source.durationSec)} · ${text('audioNumber', '第')} ${index + 1} ${text('audioNumberSuffix', '条')}`
  });
}

function buildTranscriptParagraphs(lines, taskId) {
  const sourceLines = (Array.isArray(lines) ? lines : []).filter((line) => String(line && line.text || '').trim());
  const groups = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const startMs = Number(current[0].startMs || 0);
    const endMs = Number(current[current.length - 1].endMs || startMs);
    groups.push({
      id: `${taskId || 'audio'}-paragraph-${groups.length + 1}`,
      title: `${text('paragraphPrefix', '第')} ${groups.length + 1} ${text('paragraphSuffix', '段')}`,
      meta: `${current.length} ${text('sentenceUnit', '句')} · ${formatClock(startMs / 1000)}–${formatClock(endMs / 1000)}`,
      preview: current.map((line) => String(line.text || '').trim()).join(' '),
      sentences: current.map((line) => ({
        lineId: String(line.lineId || ''),
        text: String(line.text || '').trim(),
        startMs: Number(line.startMs || 0),
        endMs: Math.max(Number(line.endMs || 0), Number(line.startMs || 0) + 1)
      }))
    });
    current = [];
  };
  sourceLines.forEach((line) => {
    const previous = current[current.length - 1];
    const gapMs = previous ? Number(line.startMs || 0) - Number(previous.endMs || 0) : 0;
    const blockDurationMs = current.length ? Number(line.endMs || 0) - Number(current[0].startMs || 0) : 0;
    if (current.length >= 3 && (gapMs >= 1800 || current.length >= 5 || blockDurationMs >= 30000)) flush();
    current.push(line);
  });
  flush();
  return groups;
}

function resolveExerciseAudioClip(task, sentence) {
  const startSec = Math.max(0, Number(sentence.startMs || 0) / 1000);
  const endSec = Math.max(startSec + 0.05, Number(sentence.endMs || 0) / 1000);
  const segment = (Array.isArray(task && task.audioSegments) ? task.audioSegments : []).find((item) => {
    const segmentStart = Number(item.startSec || 0);
    const segmentEnd = segmentStart + Number(item.durationSec || 0);
    return startSec >= segmentStart && endSec <= segmentEnd;
  });
  if (segment) {
    const segmentStart = Number(segment.startSec || 0);
    const segmentAudioUrl = String(segment.audioUrl || '').trim();
    return {
      audioUrl: String((isHttpAudioUrl(segmentAudioUrl) ? segmentAudioUrl : '') || buildCloudAssetUrl(segment.audioCloudPath) || segmentAudioUrl || segment.audioFileId || ''),
      audioFileId: String(segment.audioFileId || (segmentAudioUrl.startsWith('cloud://') ? segmentAudioUrl : '') || ''),
      audioCloudPath: String(segment.audioCloudPath || ''),
      audioStartSec: Math.max(0, startSec - segmentStart),
      audioEndSec: Math.max(0.05, endSec - segmentStart)
    };
  }
  const taskAudioUrl = String(task && task.audioUrl || '').trim();
  return {
    audioUrl: String((isHttpAudioUrl(taskAudioUrl) ? taskAudioUrl : '') || buildCloudAssetUrl(task && task.audioCloudPath) || taskAudioUrl || (task && task.audioFileId) || ''),
    audioFileId: String((task && task.audioFileId) || (taskAudioUrl.startsWith('cloud://') ? taskAudioUrl : '') || ''),
    audioCloudPath: String(task && task.audioCloudPath || ''),
    audioStartSec: startSec,
    audioEndSec: endSec
  };
}

function buildParagraphExercises(paragraph, task) {
  return (paragraph && paragraph.sentences || []).map((sentence, index) => {
    const suffix = text('sentenceSuffix', '句');
    return Object.assign({
      id: `${paragraph.id}-sentence-${index + 1}`,
      title: `${text('sentencePrefix', '第')} ${index + 1}${suffix ? ` ${suffix}` : ''}`,
      meta: text('sentencePractice', '逐句跟读'),
      prompt: sentence.text
    }, resolveExerciseAudioClip(task, sentence));
  });
}

function formatIeltsCuePrompt(task) {
  return [
    String(task.task || '').trim(),
    text('youShouldSay', 'You should say:'),
    ...(task.cuePoints || []).map((item) => `• ${String(item || '').trim()}`),
    String(task.closingPrompt || '').trim()
  ].filter(Boolean).join('\n');
}

function normalizeIeltsParts(item, exercises) {
  const byId = new Map((exercises || []).map((exercise) => [exercise.id, exercise]));
  const sourceParts = Array.isArray(item && item.parts) ? item.parts : [];
  if (!sourceParts.length) {
    return [1, 2, 3].map((part) => ({
      part,
      label: `PART ${part}`,
      topics: [{
        title: '',
        questions: (exercises || []).filter((exercise) => Number(exercise.part) === part).map((exercise, index) => ({
          exerciseId: exercise.id,
          viewKey: `${exercise.id}-question-${index + 1}`,
          number: index + 1,
          prompt: exercise.prompt
        }))
      }],
      tasks: []
    }));
  }
  return sourceParts.map((part) => ({
    part: Number(part.part || 0),
    label: String(part.label || `PART ${part.part || ''}`),
    topics: (part.topics || []).map((topic, topicIndex) => ({
      title: String(topic.title || '').trim(),
      questions: (topic.questions || []).map((question, questionIndex) => ({
        exerciseId: String(question.exerciseId || ''),
        viewKey: `${question.exerciseId}-part-${part.part}-topic-${topicIndex + 1}-question-${questionIndex + 1}`,
        number: questionIndex + 1,
        prompt: String(question.prompt || (byId.get(question.exerciseId) || {}).prompt || '').trim()
      })).filter((question) => question.exerciseId && question.prompt)
    })).filter((topic) => topic.questions.length),
    tasks: (part.tasks || []).map((task, taskIndex) => ({
      exerciseId: String(task.exerciseId || ''),
      viewKey: `${task.exerciseId}-part-${part.part}-task-${taskIndex + 1}`,
      task: String(task.task || '').trim(),
      cuePoints: (task.cuePoints || []).map((value) => String(value || '').trim()).filter(Boolean),
      closingPrompt: String(task.closingPrompt || '').trim(),
      prompt: formatIeltsCuePrompt(task)
    })).filter((task) => task.exerciseId && task.task)
  })).filter((part) => part.topics.length || part.tasks.length);
}

function firstIeltsSelection(parts, exercises) {
  const question = (parts || []).flatMap((part) => part.tasks.length ? part.tasks : part.topics.flatMap((topic) => topic.questions))[0];
  if (!question) return null;
  const base = (exercises || []).find((exercise) => exercise.id === question.exerciseId) || {};
  return {
    activeId: question.viewKey,
    activeExercise: Object.assign({}, base, { id: question.exerciseId, prompt: question.prompt })
  };
}

function buildIeltsQuestionSequence(parts) {
  const rows = [];
  (parts || []).forEach((part) => {
    (part.topics || []).forEach((topic) => {
      (topic.questions || []).forEach((question) => rows.push(Object.assign({}, question, {
        type: 'question',
        part: Number(part.part || 0),
        partLabel: part.label,
        topicTitle: topic.title || ''
      })));
    });
    (part.tasks || []).forEach((task) => rows.push(Object.assign({}, task, {
      type: 'cue',
      part: Number(part.part || 0),
      partLabel: part.label,
      topicTitle: ''
    })));
  });
  return rows.map((row, index) => {
    const samePart = rows.filter((item) => item.part === row.part);
    const partIndex = samePart.findIndex((item) => item.viewKey === row.viewKey);
    return Object.assign({}, row, {
      sequenceIndex: index,
      sequenceTotal: rows.length,
      partQuestionIndex: partIndex + 1,
      partQuestionTotal: samePart.length
    });
  });
}

function buildIeltsIntroText(question) {
  const topic = String(question && question.topicTitle || '').trim();
  return topic
    ? `Now, in this first part, I'd like to ask you some questions about yourself. Let's talk about ${topic}.`
    : "Now, in this first part, I'd like to ask you some questions about yourself.";
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? `${seconds}${text('scoreUnit', ' 秒').replace('分', '秒').replace(' points', ' sec')}` : '';
}

Page({
  data: page.createCloudPageData({
    viewMode: 'home',
    pageTitle: text('homeTitle', '口语练习'),
    pageCopy: text('homeCopy', '选择练习方式，开始今天的开口训练。'),
    levels: SPEAKING_LEVELS,
    selectedLevel: 'A2',
    repeatSeries: getSpeakingSeries('A2'),
    selectedSeriesId: '',
    selectedSeries: {},
    repeatAudios: [],
    selectedAudioIndex: 0,
    selectedAudioId: '',
    selectedAudio: {},
    repeatParagraphs: [],
    selectedParagraphId: '',
    selectedParagraph: {},
    repeatAudioLoading: false,
    repeatParagraphLoading: false,
    repeatLoadError: '',
    audioPickerVisible: false,
    audioPickerType: '',
    audioPickerTitle: '',
    audioPickerUnit: '',
    audioPickerSelectedId: '',
    audioPickerQuery: '',
    audioPickerAudios: [],
    audioPickerScrollIntoView: '',
    audioPickerListHeight: '58vh',
    exercises: [],
    activeId: '',
    activeExercise: null,
    recording: false,
    tempFilePath: '',
    recordStartedAt: 0,
    recordDurationMs: 0,
    recordDurationText: '',
    answerPlaying: false,
    submitting: false,
    repeatScoring: false,
    questionPlaying: false,
    questionLoading: false,
    repeatPromptReady: false,
    ieltsCueLineIndex: -1,
    result: null,
    resultCelebrating: false,
    errorText: '',
    ieltsTests: [],
    ieltsLoading: false,
    ieltsExpanded: false,
    ieltsMode: false,
    ieltsItemId: '',
    ieltsPromptReady: false,
    ieltsQuestionRevealed: false,
    ieltsSessionStarted: true,
    ieltsQuestionSequence: [],
    activeIeltsQuestion: null,
    ieltsQuestionIndex: 0,
    ieltsIntroText: '',
    ieltsIntroPlaying: false,
    ieltsIntroLoading: false,
    ieltsParts: [],
    ieltsSourceImages: [],
    ieltsSourceExpanded: false
  }),

  onLoad(options = {}) {
    this.speakingPerf = page.startPagePerf('speaking');
    page.syncTheme(this);
    this.repeatCatalogCache = {};
    this.repeatCatalogInflight = {};
    this.repeatPracticeSessions = {};
    this.repeatScoringRequests = {};
    this.repeatRequestToken = 0;
    this.ieltsItemCache = {};
    this.ieltsItemInflight = {};
    this.questionPlaybackRequestToken = 0;
    this.ieltsIntroPlaybackRequestToken = 0;
    this.selectedRepeatTask = null;
    this.repeatPlanRequest = String(options.dailyPlan || '') === 'unlock1speaking'
      ? {
        audioCategory: ['unlock1workbook', 'unlock1'].includes(String(options.audioCategory || '')) ? String(options.audioCategory) : 'unlock1workbook',
        audioTaskId: String(options.audioTaskId || ''),
        paragraphIndex: Math.max(1, Number(options.paragraphIndex || 1)),
        sentenceStartIndex: Math.max(1, Number(options.sentenceStart || 1)),
        sentenceEndIndex: Math.max(1, Number(options.sentenceEnd || options.sentenceStart || 1))
      }
      : null;
    let selectedLevel = this.repeatPlanRequest ? 'A1' : 'A2';
    try {
      const storedLevel = String(wx.getStorageSync(SPEAKING_LEVEL_KEY) || '');
      if (!this.repeatPlanRequest && SPEAKING_LEVELS.some((item) => item.id === storedLevel)) {
        selectedLevel = storedLevel;
      }
    } catch (error) {}
    const repeatSeries = getSpeakingSeries(selectedLevel);
    this.setData({
      selectedLevel,
      repeatSeries,
      selectedSeriesId: '',
      selectedSeries: {}
    });
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStop((res) => this.handleRecordingStopped(res));
    this.recorderManager.onError(() => {
      this.setData({
        recording: false,
        errorText: text('recordFailed', '录音没有成功，请重新录一次。')
      });
    });
    this.questionAudioContext = wx.createInnerAudioContext();
    this.questionAudioContext.obeyMuteSwitch = false;
    this.questionAudioContext.onCanplay(() => this.startPendingQuestionClip());
    this.questionAudioContext.onSeeked(() => this.startPendingQuestionClip(true));
    this.questionAudioContext.onTimeUpdate(() => {
      this.syncIeltsCueLineHighlight();
      const clip = this.pendingQuestionClip;
      if (!clip || !clip.started || !this.data.questionPlaying) return;
      if (Number(this.questionAudioContext.currentTime || 0) >= clip.endSec - 0.03) {
        this.pendingQuestionClip = null;
        if (!this.data.ieltsMode) this.setData({ repeatPromptReady: true });
        this.questionAudioContext.stop();
      }
    });
    this.questionAudioContext.onPlay(() => {
      this.setData({
        questionPlaying: true,
        questionLoading: false,
        repeatPromptReady: this.data.ieltsMode ? this.data.repeatPromptReady : false,
        ieltsCueLineIndex: /-part-2-/i.test(this.data.activeId) ? 0 : -1
      });
    });
    this.questionAudioContext.onEnded(() => {
      this.pendingQuestionClip = null;
      this.setData({
        questionPlaying: false,
        repeatPromptReady: this.data.ieltsMode ? this.data.repeatPromptReady : true,
        ieltsCueLineIndex: -1,
        ieltsPromptReady: this.data.ieltsMode ? true : this.data.ieltsPromptReady
      });
    });
    this.questionAudioContext.onStop(() => {
      this.setData({ questionPlaying: false, ieltsCueLineIndex: -1 });
    });
    this.questionAudioContext.onError((error) => this.handleQuestionAudioError(error));
    this.answerAudioContext = wx.createInnerAudioContext();
    this.answerAudioContext.obeyMuteSwitch = false;
    this.answerAudioContext.onPlay(() => this.setData({ answerPlaying: true }));
    this.answerAudioContext.onEnded(() => this.setData({ answerPlaying: false }));
    this.answerAudioContext.onStop(() => this.setData({ answerPlaying: false }));
    this.answerAudioContext.onError(() => this.setData({
      answerPlaying: false,
      errorText: text('answerPlaybackFailed', '录音回放失败，请重新录一次。')
    }));
    this.ieltsIntroAudioContext = wx.createInnerAudioContext();
    this.ieltsIntroAudioContext.obeyMuteSwitch = false;
    this.ieltsIntroAudioContext.autoplay = true;
    this.ieltsIntroAudioContext.onPlay(() => this.setData({ ieltsIntroPlaying: true, ieltsIntroLoading: false }));
    this.ieltsIntroAudioContext.onEnded(() => this.setData({ ieltsIntroPlaying: false, ieltsIntroLoading: false }));
    this.ieltsIntroAudioContext.onStop(() => this.setData({ ieltsIntroPlaying: false, ieltsIntroLoading: false }));
    this.ieltsIntroAudioContext.onError(() => this.setData({
      ieltsIntroPlaying: false,
      ieltsIntroLoading: false,
      errorText: text('ieltsIntroFailed', '考试开场播放失败，请稍后重试。')
    }));
    this.speakingPerf.ready('pageReady', {
      source: 'static',
      cacheHit: true,
      exercises: 0
    });
    if (this.repeatPlanRequest) {
      wx.nextTick(() => this.openDailyRepeatPlan());
    }
  },

  async openDailyRepeatPlan() {
    const request = this.repeatPlanRequest;
    if (!request) return;
    const selectedSeries = getSpeakingSeries('A1').find((item) => item.id === request.audioCategory);
    this.setData({
      selectedLevel: 'A1',
      repeatSeries: getSpeakingSeries('A1'),
      selectedSeriesId: request.audioCategory,
      selectedSeries,
      viewMode: 'repeat-select',
      pageTitle: request.audioCategory === 'unlock1workbook' ? '今日 Unlock 1 练习册跟读' : '今日 Unlock 1 课本跟读',
      pageCopy: '逐句听原音并完成跟读评分。'
    });
    const catalog = await this.loadRepeatSeriesCatalog(selectedSeries);
    const audioIndex = (this.data.repeatAudios || []).findIndex((item) => item.taskId === request.audioTaskId);
    if (!catalog || audioIndex < 0) {
      console.warn(`[speaking-daily-plan] pages/speaking.openDailyRepeatPlan -> catalog/audio: missing; taskId=${request.audioTaskId}`);
      this.setData({ repeatLoadError: '今日跟读内容加载失败，请返回后重试。' });
      return;
    }
    await this.selectRepeatAudio({ currentTarget: { dataset: { audioIndex } } });
    const paragraphId = `${request.audioTaskId}-paragraph-${request.paragraphIndex}`;
    const paragraph = (this.data.repeatParagraphs || []).find((item) => item.id === paragraphId);
    if (!paragraph) {
      console.warn(`[speaking-daily-plan] pages/speaking.openDailyRepeatPlan -> transcript/paragraph: missing; taskId=${request.audioTaskId}; paragraphIndex=${request.paragraphIndex}`);
      this.setData({ repeatLoadError: '今日指定段落加载失败，请返回后重试。' });
      return;
    }
    this.selectRepeatParagraph({ currentTarget: { dataset: { paragraphId } } });
    this.startSelectedRepeat();
  },

  onShow() {
    page.syncTheme(this);
  },

  onUnload() {
    this.pageUnloading = true;
    if (this.recorderManager && this.data.recording) {
      this.recorderManager.stop();
    }
    if (this.questionAudioContext) {
      this.questionAudioContext.destroy();
      this.questionAudioContext = null;
    }
    if (this.answerAudioContext) {
      this.answerAudioContext.destroy();
      this.answerAudioContext = null;
    }
    if (this.ieltsIntroAudioContext) {
      this.ieltsIntroPlaybackRequestToken += 1;
      this.ieltsIntroAudioContext.destroy();
      this.ieltsIntroAudioContext = null;
    }
    if (this.questionClipSeekTimer) {
      clearTimeout(this.questionClipSeekTimer);
      this.questionClipSeekTimer = null;
    }
    if (this.questionAutoPlayTimer) {
      clearTimeout(this.questionAutoPlayTimer);
      this.questionAutoPlayTimer = null;
    }
    if (this.ieltsIntroAutoPlayTimer) {
      clearTimeout(this.ieltsIntroAutoPlayTimer);
      this.ieltsIntroAutoPlayTimer = null;
    }
    if (this.audioPickerScrollTimer) {
      clearTimeout(this.audioPickerScrollTimer);
      this.audioPickerScrollTimer = null;
    }
    if (this.resultEffectTimer) {
      clearTimeout(this.resultEffectTimer);
      this.resultEffectTimer = null;
    }
  },

  async selectSpeakingLevel(event) {
    const selectedLevel = String(event.currentTarget.dataset.level || 'A2');
    if (!SPEAKING_LEVELS.some((item) => item.id === selectedLevel)) {
      return;
    }
    try {
      wx.setStorageSync(SPEAKING_LEVEL_KEY, selectedLevel);
    } catch (error) {}
    await this.loadRepeatLevel(selectedLevel);
  },

  async openRepeatPractice() {
    this.setData({
      viewMode: 'repeat-select',
      pageTitle: text('selectContentTitle', '选择跟读内容'),
      pageCopy: text('selectContentCopy', '按级别选择音频和段落。'),
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      repeatScoring: false,
      errorText: '',
      repeatPromptReady: false,
      ieltsMode: false,
      ieltsItemId: '',
      ieltsPromptReady: false,
      ieltsQuestionRevealed: false,
      ieltsParts: [],
      ieltsSourceImages: [],
      ieltsSourceExpanded: false
    });
    if (!this.data.repeatSeries.length) await this.loadRepeatLevel(this.data.selectedLevel);
  },

  loadRepeatCatalog(levelId, series) {
    const selectedSeries = series || {};
    const cacheKey = `${levelId}:${selectedSeries.id || ''}`;
    if (!selectedSeries.id) return Promise.resolve(null);
    if (!this.repeatCatalogCache) this.repeatCatalogCache = {};
    if (!this.repeatCatalogInflight) this.repeatCatalogInflight = {};
    if (this.repeatCatalogCache[cacheKey]) return Promise.resolve(this.repeatCatalogCache[cacheKey]);
    if (this.repeatCatalogInflight[cacheKey]) return this.repeatCatalogInflight[cacheKey];
    const request = store.getListeningMaterialCatalog({
      levelId,
      category: selectedSeries.id
    }).then((result) => {
      if (result && result.syncMode !== 'cloud-error' && (result.tasks || []).length) {
        this.repeatCatalogCache[cacheKey] = result;
      }
      return result;
    }).finally(() => {
      delete this.repeatCatalogInflight[cacheKey];
    });
    this.repeatCatalogInflight[cacheKey] = request;
    return request;
  },

  prefetchRepeatEntry() {
    const selectedSeries = this.data.selectedSeries || getSpeakingSeries(this.data.selectedLevel)[0];
    this.loadRepeatCatalog(this.data.selectedLevel, selectedSeries);
  },

  prefetchRepeatSeries(event) {
    const seriesId = String(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.seriesId || '');
    const selectedSeries = (this.data.repeatSeries || []).find((item) => item.id === seriesId);
    if (selectedSeries) this.loadRepeatCatalog(this.data.selectedLevel, selectedSeries);
  },

  async loadRepeatLevel(selectedLevel) {
    const repeatSeries = getSpeakingSeries(selectedLevel);
    this.repeatRequestToken += 1;
    this.repeatTranscriptToken = '';
    this.selectedRepeatTask = null;
    this.setData({
      selectedLevel,
      repeatSeries,
      selectedSeriesId: '',
      selectedSeries: {},
      repeatAudios: [],
      selectedAudioIndex: 0,
      selectedAudioId: '',
      selectedAudio: {},
      repeatParagraphs: [],
      selectedParagraphId: '',
      selectedParagraph: {},
      repeatLoadError: '',
      audioPickerVisible: false,
      audioPickerType: '',
      audioPickerTitle: '',
      audioPickerUnit: '',
      audioPickerSelectedId: '',
      audioPickerQuery: '',
      audioPickerAudios: [],
      audioPickerScrollIntoView: '',
      audioPickerListHeight: '58vh'
    });
    return null;
  },

  async selectRepeatSeries(event) {
    const seriesId = String(event.currentTarget.dataset.seriesId || '');
    const selectedSeries = (this.data.repeatSeries || []).find((item) => item.id === seriesId);
    if (!selectedSeries) return;
    this.closeRepeatAudioPicker();
    if (selectedSeries.id === this.data.selectedSeriesId && this.data.repeatAudios.length) return;
    this.setData({ selectedSeriesId: selectedSeries.id, selectedSeries });
    await this.loadRepeatSeriesCatalog(selectedSeries);
  },

  async loadRepeatSeriesCatalog(series) {
    const selectedSeries = series || this.data.selectedSeries;
    if (!selectedSeries || !selectedSeries.id) return null;
    const levelId = this.data.selectedLevel;
    const requestToken = ++this.repeatRequestToken;
    const cacheKey = `${levelId}:${selectedSeries.id}`;
    this.setData({
      repeatAudioLoading: true,
      repeatParagraphLoading: false,
      repeatLoadError: '',
      repeatAudios: [],
      selectedAudioIndex: 0,
      selectedAudioId: '',
      selectedAudio: {},
      repeatParagraphs: [],
      selectedParagraphId: '',
      selectedParagraph: {},
      audioPickerVisible: false,
      audioPickerType: '',
      audioPickerTitle: '',
      audioPickerUnit: '',
      audioPickerSelectedId: '',
      audioPickerQuery: '',
      audioPickerAudios: [],
      audioPickerScrollIntoView: '',
      audioPickerListHeight: '58vh'
    });
    try {
      const result = await this.loadRepeatCatalog(levelId, selectedSeries);
      if (requestToken !== this.repeatRequestToken) return null;
      const tasks = (result && result.tasks || []).map(normalizeRepeatAudio).filter((item) => item.taskId);
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || 'catalog-cloud-error');
      }
      if (!tasks.length) throw new Error('empty-audio-catalog');
      this.repeatCatalogCache[cacheKey] = result;
      this.setData({
        repeatAudios: tasks,
        selectedAudioIndex: 0,
        selectedAudioId: '',
        selectedAudio: {},
        repeatAudioLoading: false
      });
      return result;
    } catch (error) {
      if (requestToken !== this.repeatRequestToken) return null;
      const message = String((error && error.message) || error || '');
      console.warn(`[speaking-repeat-catalog] pages/speaking.loadRepeatSeriesCatalog -> store.getListeningMaterialCatalog -> cloud.getListeningMaterialCatalog -> tasks: ${message}; level=${levelId}; category=${selectedSeries.id}`);
      this.setData({
        repeatAudioLoading: false,
        repeatParagraphLoading: false,
        repeatLoadError: text('audioLoadFailed', '音频目录加载失败，请稍后重试。')
      });
      return null;
    }
  },

  async selectRepeatAudio(event) {
    const datasetIndex = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.audioIndex
      : undefined;
    const selectedAudioIndex = Math.max(0, Number(datasetIndex !== undefined ? datasetIndex : (event.detail && event.detail.value || 0)));
    const selectedAudio = (this.data.repeatAudios || [])[selectedAudioIndex];
    if (!selectedAudio) return;
    if (this.audioPickerScrollTimer) {
      clearTimeout(this.audioPickerScrollTimer);
      this.audioPickerScrollTimer = null;
    }
    this.setData({
      selectedAudioIndex,
      selectedAudioId: selectedAudio.id,
      selectedAudio,
      audioPickerVisible: false,
      audioPickerType: '',
      audioPickerTitle: '',
      audioPickerUnit: '',
      audioPickerSelectedId: '',
      audioPickerQuery: '',
      audioPickerAudios: [],
      audioPickerScrollIntoView: '',
      audioPickerListHeight: '58vh',
      repeatParagraphs: [],
      selectedParagraphId: '',
      selectedParagraph: {},
      repeatLoadError: ''
    });
    await this.loadRepeatTranscript(selectedAudio, this.repeatRequestToken);
  },

  openRepeatAudioPicker() {
    if (this.data.repeatAudioLoading || !(this.data.repeatAudios || []).length) return;
    this.openRepeatContentPicker({
      type: 'audio',
      title: text('selectAudio', '选择音频'),
      unit: text('audioUnit', ' 个音频'),
      items: this.data.repeatAudios,
      selectedId: this.data.selectedAudioId
    });
  },

  openRepeatSeriesPicker() {
    const items = (this.data.repeatSeries || []).map((item, index) => ({
      id: item.id,
      pickerIndex: index,
      displayTitle: item.title,
      meta: this.data.selectedLevel,
      searchText: `${index + 1} ${item.title}`.toLowerCase().replace(/\s+/g, '')
    }));
    if (!items.length) return;
    this.openRepeatContentPicker({
      type: 'series',
      title: text('selectSeries', '选择系列'),
      unit: text('seriesUnit', ' 个系列'),
      items,
      selectedId: this.data.selectedSeriesId
    });
  },

  openRepeatParagraphPicker() {
    const items = (this.data.repeatParagraphs || []).map((item, index) => Object.assign({}, item, {
      pickerIndex: index,
      displayTitle: item.title,
      searchText: `${index + 1} ${item.title} ${item.preview}`.toLowerCase().replace(/\s+/g, '')
    }));
    if (!items.length || this.data.repeatParagraphLoading) return;
    this.openRepeatContentPicker({
      type: 'paragraph',
      title: text('selectParagraph', '选择段落'),
      unit: text('paragraphUnit', ' 段'),
      items,
      selectedId: this.data.selectedParagraphId
    });
  },

  openRepeatContentPicker(options) {
    const config = options || {};
    const items = Array.isArray(config.items) ? config.items : [];
    const selectedIndex = Math.max(0, items.findIndex((item) => item.id === config.selectedId));
    this.repeatPickerItems = items;
    this.setData({
      audioPickerVisible: true,
      audioPickerType: config.type || '',
      audioPickerTitle: config.title || '',
      audioPickerUnit: config.unit || '',
      audioPickerSelectedId: config.selectedId || '',
      audioPickerQuery: '',
      audioPickerAudios: items,
      audioPickerScrollIntoView: '',
      audioPickerListHeight: '58vh'
    });
    if (this.audioPickerScrollTimer) clearTimeout(this.audioPickerScrollTimer);
    this.audioPickerScrollTimer = setTimeout(() => {
      this.audioPickerScrollTimer = null;
      if (this.data.audioPickerVisible) {
        this.setData({ audioPickerScrollIntoView: `repeat-audio-option-${selectedIndex}` });
      }
    }, 80);
  },

  closeRepeatAudioPicker() {
    if (this.audioPickerScrollTimer) {
      clearTimeout(this.audioPickerScrollTimer);
      this.audioPickerScrollTimer = null;
    }
    this.setData({
      audioPickerVisible: false,
      audioPickerType: '',
      audioPickerTitle: '',
      audioPickerUnit: '',
      audioPickerSelectedId: '',
      audioPickerQuery: '',
      audioPickerAudios: [],
      audioPickerScrollIntoView: '',
      audioPickerListHeight: '58vh'
    });
    this.repeatPickerItems = [];
  },

  filterRepeatAudios(event) {
    const audioPickerQuery = String(event.detail && event.detail.value || '');
    const query = labels.decodeHtmlEntities(audioPickerQuery).toLowerCase().replace(/\s+/g, '');
    const sourceItems = this.repeatPickerItems || [];
    const audioPickerAudios = query
      ? sourceItems.filter((item) => String(item.searchText || '').includes(query))
      : sourceItems;
    const audioPickerListHeight = query && audioPickerAudios.length < 5
      ? `${Math.max(180, audioPickerAudios.length * 104 + 28)}rpx`
      : '58vh';
    this.setData({
      audioPickerQuery,
      audioPickerAudios,
      audioPickerScrollIntoView: '',
      audioPickerListHeight
    });
  },

  clearRepeatAudioSearch() {
    const items = this.repeatPickerItems || [];
    const selectedIndex = Math.max(0, items.findIndex((item) => item.id === this.data.audioPickerSelectedId));
    this.setData({
      audioPickerQuery: '',
      audioPickerAudios: items,
      audioPickerScrollIntoView: `repeat-audio-option-${selectedIndex}`,
      audioPickerListHeight: '58vh'
    });
  },

  selectRepeatPickerItem(event) {
    const dataset = event && event.currentTarget && event.currentTarget.dataset || {};
    const pickerType = this.data.audioPickerType;
    if (pickerType === 'series') {
      return this.selectRepeatSeries({ currentTarget: { dataset: { seriesId: dataset.pickerId } } });
    }
    if (pickerType === 'paragraph') {
      return this.selectRepeatParagraph({ currentTarget: { dataset: { paragraphId: dataset.pickerId } } });
    }
    return this.selectRepeatAudio({ currentTarget: { dataset: { audioIndex: dataset.pickerIndex } } });
  },

  stopPickerEvent() {},

  async loadRepeatTranscript(selectedAudio, parentRequestToken) {
    const transcriptToken = `${parentRequestToken}:${selectedAudio.taskId}:${Date.now()}`;
    this.repeatTranscriptToken = transcriptToken;
    this.selectedRepeatTask = null;
    this.setData({
      repeatParagraphLoading: true,
      repeatParagraphs: [],
      selectedParagraphId: '',
      selectedParagraph: {},
      repeatLoadError: ''
    });
    try {
      const category = selectedAudio.category || this.data.selectedSeriesId;
      const detail = await store.getTaskDetail(category, selectedAudio.taskId, {
        view: 'lesson',
        planRunType: 'preview',
        source: 'catalog',
        taskSnapshot: selectedAudio
      });
      if (detail && detail.syncMode === 'cloud-error') {
        throw new Error((detail.cloudError && detail.cloudError.message) || 'task-detail-cloud-error');
      }
      const fullTask = Object.assign({}, selectedAudio, detail && detail.task || {});
      const result = await store.getTaskTranscript(category, selectedAudio.taskId, {
        planRunType: 'preview',
        source: 'catalog',
        taskSnapshot: fullTask
      });
      if (this.repeatTranscriptToken !== transcriptToken) return null;
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || 'transcript-cloud-error');
      }
      const paragraphs = buildTranscriptParagraphs(result && (result.transcriptLines || (result.transcriptTrack && result.transcriptTrack.lines)), selectedAudio.taskId);
      if (!paragraphs.length) throw new Error('empty-transcript-lines');
      this.selectedRepeatTask = Object.assign({}, fullTask, result.task || {});
      this.setData({
        repeatParagraphs: paragraphs,
        selectedParagraphId: '',
        selectedParagraph: {},
        repeatParagraphLoading: false
      });
      return result;
    } catch (error) {
      if (this.repeatTranscriptToken !== transcriptToken) return null;
      const message = String((error && error.message) || error || '');
      console.warn(`[speaking-repeat-transcript] pages/speaking.loadRepeatTranscript -> store.getTaskDetail/getTaskTranscript -> cloud.getTaskDetail/getTaskTranscript -> transcriptLines: ${message}; category=${selectedAudio.category || this.data.selectedSeriesId}; taskId=${selectedAudio.taskId}`);
      this.setData({
        repeatParagraphLoading: false,
        repeatLoadError: text('transcriptLoadFailed', '该音频暂无可用逐句文本。')
      });
      return null;
    }
  },

  selectRepeatParagraph(event) {
    const paragraphId = String(event.currentTarget.dataset.paragraphId || '');
    const selectedParagraph = (this.data.repeatParagraphs || []).find((item) => item.id === paragraphId);
    if (!selectedParagraph) return;
    this.closeRepeatAudioPicker();
    this.setData({ selectedParagraphId: selectedParagraph.id, selectedParagraph });
  },

  startSelectedRepeat() {
    const paragraph = this.data.selectedParagraph;
    const allExercises = buildParagraphExercises(paragraph, this.selectedRepeatTask || this.data.selectedAudio);
    const request = this.repeatPlanRequest;
    const isDailySegment = request
      && request.audioTaskId === String((this.data.selectedAudio || {}).taskId || '')
      && request.paragraphIndex === Number((paragraph && paragraph.id || '').split('-paragraph-')[1] || 0);
    const exercises = isDailySegment
      ? allExercises.slice(request.sentenceStartIndex - 1, request.sentenceEndIndex)
      : allExercises;
    if (!exercises.length) return;
    this.repeatPracticeSessions = {};
    this.repeatScoringRequests = {};
    this.setData({
      viewMode: 'practice',
      pageTitle: text('practiceTitle', '分级句子跟读'),
      pageCopy: text('copy', '听清原句，按住跟读。'),
      exercises,
      activeId: exercises[0].id,
      activeExercise: exercises[0],
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      repeatScoring: false,
      errorText: '',
      repeatPromptReady: false,
      ieltsMode: false,
      ieltsItemId: '',
      ieltsPromptReady: false,
      ieltsQuestionRevealed: false,
      ieltsParts: [],
      ieltsSourceImages: [],
      ieltsSourceExpanded: false
    });
    this.queueQuestionAutoPlay();
  },

  backToSpeakingHome() {
    const hasRepeatScoring = Object.keys(this.repeatScoringRequests || {}).length > 0;
    if (this.data.recording || this.data.submitting || hasRepeatScoring) {
      wx.showToast({
        title: hasRepeatScoring ? text('finishScoring', '请等待评分完成') : text('finishCurrent', '请先完成本次录音'),
        icon: 'none'
      });
      return;
    }
    if (this.questionAudioContext) {
      this.questionPlaybackRequestToken += 1;
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
    }
    if (this.ieltsIntroAudioContext) {
      this.ieltsIntroPlaybackRequestToken += 1;
      this.ieltsIntroAudioContext.stop();
    }
    if (this.questionAutoPlayTimer) {
      clearTimeout(this.questionAutoPlayTimer);
      this.questionAutoPlayTimer = null;
    }
    if (this.ieltsIntroAutoPlayTimer) {
      clearTimeout(this.ieltsIntroAutoPlayTimer);
      this.ieltsIntroAutoPlayTimer = null;
    }
    const returnToSelector = this.data.viewMode === 'practice' && !this.data.ieltsMode;
    this.setData({
      viewMode: returnToSelector ? 'repeat-select' : 'home',
      pageTitle: returnToSelector ? text('selectContentTitle', '选择跟读内容') : text('homeTitle', '口语练习'),
      pageCopy: returnToSelector ? text('selectContentCopy', '按级别选择音频和段落。') : text('homeCopy', '选择练习方式，开始今天的开口训练。'),
      selectedLevel: this.previousSpeakingLevel || this.data.selectedLevel,
      questionPlaying: false,
      questionLoading: false,
      repeatPromptReady: false,
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      repeatScoring: false,
      errorText: '',
      ieltsMode: false,
      ieltsSessionStarted: true,
      ieltsQuestionSequence: [],
      activeIeltsQuestion: null,
      ieltsQuestionIndex: 0,
      ieltsIntroText: '',
      ieltsIntroPlaying: false,
      ieltsIntroLoading: false,
      ieltsParts: [],
      ieltsSourceImages: [],
      ieltsSourceExpanded: false
    });
    this.previousSpeakingLevel = '';
  },

  async openIeltsSpeaking() {
    if (this.data.ieltsExpanded) {
      this.setData({ ieltsExpanded: false });
      return;
    }
    if (this.data.ieltsTests.length) {
      this.setData({ ieltsExpanded: true });
      return;
    }
    this.setData({ ieltsLoading: true, errorText: '' });
    try {
      const result = await store.getMaterialIndex({ moduleId: 'speaking' });
      const tests = (result.speakingIelts || []).map((item) => {
        const id = String(item._id || item.id || '');
        const match = id.match(/^ielts-academic-(1[0-9]|20|21)-test-(\d+)-/i);
        return {
          id,
          title: item.title || 'IELTS Speaking',
          bookNumber: Number(item.bookNumber || (match && match[1]) || 21),
          testNumber: Number(item.testNumber || (match && match[2]) || 0),
          meta: item.district || `Test ${Number(item.testNumber || (match && match[2]) || 0)}`
        };
      }).filter((item) => item.id).sort((left, right) => right.bookNumber - left.bookNumber || left.testNumber - right.testNumber)
        .map((item, index, rows) => Object.assign({}, item, {
          bookLabel: `Cambridge IELTS ${item.bookNumber}`,
          showBookHeader: !index || rows[index - 1].bookNumber !== item.bookNumber
        }));
      this.setData({ ieltsTests: tests, ieltsExpanded: true });
    } catch (error) {
      this.setData({ errorText: text('ieltsLoadFailed', '雅思口语加载失败') });
    } finally {
      this.setData({ ieltsLoading: false });
    }
  },

  loadIeltsItem(itemId) {
    const key = String(itemId || '');
    if (!key) return Promise.resolve(null);
    if (!this.ieltsItemCache) this.ieltsItemCache = {};
    if (!this.ieltsItemInflight) this.ieltsItemInflight = {};
    if (this.ieltsItemCache[key]) return Promise.resolve(this.ieltsItemCache[key]);
    if (this.ieltsItemInflight[key]) return this.ieltsItemInflight[key];
    const request = store.getMaterialItem({ moduleId: 'speaking', itemId: key })
      .then((result) => {
        if (result && result.item) this.ieltsItemCache[key] = result;
        return result;
      })
      .finally(() => {
        delete this.ieltsItemInflight[key];
      });
    this.ieltsItemInflight[key] = request;
    return request;
  },

  prefetchIeltsTest(event) {
    const itemId = String(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.itemId || '');
    if (itemId) this.loadIeltsItem(itemId);
  },

  async selectIeltsTest(event) {
    const itemId = String(event.currentTarget.dataset.itemId || '');
    if (!itemId || this.data.ieltsLoading) return;
    this.setData({ ieltsLoading: true, errorText: '' });
    try {
      const result = await this.loadIeltsItem(itemId);
      const item = result && result.item;
      const exercises = (item && item.exercises || []).map((exercise) => Object.assign({}, exercise, {
        id: String(exercise.id || ''),
        title: exercise.title || `Part ${exercise.part || ''}`,
        meta: exercise.meta || `${exercise.maxDurationSec || 60}${text('secondUnit', ' 秒')}`
      })).filter((exercise) => exercise.id && exercise.prompt);
      if (!exercises.length) throw new Error('empty-ielts-speaking');
      const ieltsParts = normalizeIeltsParts(item, exercises);
      const ieltsQuestionSequence = buildIeltsQuestionSequence(ieltsParts);
      const initial = firstIeltsSelection(ieltsParts, exercises);
      if (!initial || !ieltsQuestionSequence.length) throw new Error('empty-ielts-speaking-parts');
      this.previousSpeakingLevel = this.data.selectedLevel;
      this.setData({
        viewMode: 'practice',
        pageTitle: text('ieltsSpeaking', '雅思口语'),
        pageCopy: 'Part 1 · Part 2 · Part 3',
        selectedLevel: 'IELTS',
        exercises,
        activeId: initial.activeId,
        activeExercise: initial.activeExercise,
        ieltsMode: true,
        ieltsItemId: itemId,
        ieltsPromptReady: false,
        ieltsQuestionRevealed: false,
        ieltsSessionStarted: false,
        ieltsQuestionSequence,
        activeIeltsQuestion: ieltsQuestionSequence[0],
        ieltsQuestionIndex: 0,
        ieltsIntroText: buildIeltsIntroText(ieltsQuestionSequence[0]),
        ieltsIntroPlaying: false,
        ieltsIntroLoading: false,
        ieltsParts,
        ieltsSourceImages: item.images || [],
        ieltsSourceExpanded: false,
        tempFilePath: '',
        recordDurationMs: 0,
        recordDurationText: '',
        result: null,
        errorText: ''
      });
      this.queueIeltsIntroAutoPlay();
    } catch (error) {
      this.setData({ errorText: text('ieltsLoadFailed', '雅思口语加载失败') });
    } finally {
      this.setData({ ieltsLoading: false });
    }
  },

  queueIeltsIntroAutoPlay() {
    if (this.ieltsIntroAutoPlayTimer) clearTimeout(this.ieltsIntroAutoPlayTimer);
    this.ieltsIntroAutoPlayTimer = setTimeout(() => {
      this.ieltsIntroAutoPlayTimer = null;
      if (this.data.ieltsMode && !this.data.ieltsSessionStarted) this.playIeltsIntro();
    }, 180);
  },

  async playIeltsIntro() {
    if (!this.ieltsIntroAudioContext || this.data.ieltsSessionStarted || this.data.ieltsIntroLoading || this.data.ieltsIntroPlaying) return;
    const introText = String(this.data.ieltsIntroText || '').trim();
    if (!introText) return;
    const requestToken = ++this.ieltsIntroPlaybackRequestToken;
    this.setData({ ieltsIntroLoading: true, errorText: '' });
    try {
      let result;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        result = await store.synthesizeIeltsPromptAudio({
          itemId: this.data.ieltsItemId,
          promptType: 'intro',
          text: introText
        });
        if (!result.generating) break;
        await new Promise((resolve) => setTimeout(resolve, Math.max(500, Number(result.retryAfterMs || 1500))));
        if (requestToken !== this.ieltsIntroPlaybackRequestToken) return;
      }
      if (result && result.generating) throw new Error('ielts-intro-audio-generating');
      if (requestToken !== this.ieltsIntroPlaybackRequestToken) return;
      const src = result.audioUrl || (result.audioFileId ? await store.getTempFileURL(result.audioFileId) : '');
      if (requestToken !== this.ieltsIntroPlaybackRequestToken) return;
      if (!src) throw new Error('empty-ielts-intro-audio');
      this.ieltsIntroAudioContext.stop();
      this.ieltsIntroAudioContext.src = src;
      this.ieltsIntroAudioContext.play();
    } catch (error) {
      if (requestToken !== this.ieltsIntroPlaybackRequestToken) return;
      this.setData({
        ieltsIntroLoading: false,
        ieltsIntroPlaying: false,
        errorText: text('ieltsIntroFailed', '考试开场播放失败，请稍后重试。')
      });
    }
  },

  startIeltsSession() {
    if (this.data.ieltsSessionStarted || !this.data.activeIeltsQuestion) return;
    this.ieltsIntroPlaybackRequestToken += 1;
    if (this.ieltsIntroAudioContext) this.ieltsIntroAudioContext.stop();
    this.setData({
      ieltsSessionStarted: true,
      ieltsIntroPlaying: false,
      ieltsIntroLoading: false,
      ieltsPromptReady: false,
      ieltsQuestionRevealed: false,
      errorText: ''
    }, () => this.queueQuestionAutoPlay());
  },

  moveIeltsQuestion(step) {
    if (this.data.recording || this.data.submitting) return;
    const sequence = this.data.ieltsQuestionSequence || [];
    const nextIndex = this.data.ieltsQuestionIndex + Number(step || 0);
    if (nextIndex < 0 || nextIndex >= sequence.length) return;
    this.activateIeltsQuestion(sequence[nextIndex], true);
  },

  previousIeltsQuestion() {
    this.moveIeltsQuestion(-1);
  },

  nextIeltsQuestion() {
    this.moveIeltsQuestion(1);
  },

  selectIeltsQuestion(event) {
    const viewKey = String(event.currentTarget.dataset.viewKey || event.currentTarget.dataset.exerciseId || '');
    if (viewKey && viewKey === this.data.activeId) {
      if (/-part-2-/i.test(viewKey)) {
        this.setData({ ieltsPromptReady: false });
        this.replayQuestion();
        return;
      }
      this.setData({ ieltsQuestionRevealed: !this.data.ieltsQuestionRevealed });
      return;
    }
    this.activateIeltsQuestion(event.currentTarget.dataset, true);
  },

  activateIeltsQuestion(dataset, autoPlay, onReady) {
    if (this.data.recording || this.data.submitting) return false;
    const source = dataset || {};
    const exerciseId = String(source.exerciseId || '');
    const viewKey = String(source.viewKey || exerciseId);
    const prompt = String(source.prompt || '').trim();
    const base = (this.data.exercises || []).find((exercise) => exercise.id === exerciseId);
    if (!base || !prompt) return false;
    const sequence = this.data.ieltsQuestionSequence || [];
    const questionIndex = sequence.findIndex((item) => item.viewKey === viewKey);
    const activeIeltsQuestion = questionIndex >= 0 ? sequence[questionIndex] : this.data.activeIeltsQuestion;
    if (this.questionAudioContext) {
      this.questionPlaybackRequestToken += 1;
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
    }
    this.setData({
      activeId: viewKey,
      activeExercise: Object.assign({}, base, { prompt }),
      activeIeltsQuestion,
      ieltsQuestionIndex: questionIndex >= 0 ? questionIndex : this.data.ieltsQuestionIndex,
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      ieltsPromptReady: false,
      ieltsQuestionRevealed: false,
      questionPlaying: false,
      questionLoading: false,
      ieltsCueLineIndex: -1,
      errorText: ''
    }, () => {
      if (autoPlay) this.queueQuestionAutoPlay();
      if (typeof onReady === 'function') onReady();
    });
    return true;
  },

  toggleIeltsAnswer(event) {
    if (this.data.submitting || this.data.questionLoading || this.data.questionPlaying) return;
    const dataset = event.currentTarget.dataset || {};
    const viewKey = String(dataset.viewKey || dataset.exerciseId || '');
    if (this.data.activeId !== viewKey || !this.data.ieltsPromptReady) {
      this.activateIeltsQuestion(dataset, true);
      return;
    }
    if (this.data.recording) {
      this.stopRecord();
      return;
    }
    this.startRecord();
  },

  playIeltsQuestion(event) {
    if (this.data.recording || this.data.submitting) return;
    const dataset = event.currentTarget.dataset || {};
    const viewKey = String(dataset.viewKey || dataset.exerciseId || '');
    if (viewKey !== this.data.activeId) {
      this.activateIeltsQuestion(dataset, true);
      return;
    }
    if (this.data.questionLoading) return;
    this.replayQuestion();
  },

  syncIeltsCueLineHighlight() {
    if (!this.data.ieltsMode || !this.data.questionPlaying || !/-part-2-/i.test(this.data.activeId)) return;
    const lines = String(this.data.activeExercise && this.data.activeExercise.prompt || '')
      .split('\n')
      .map((line) => line.replace(/^\s*[•*-]\s*/, '').trim())
      .filter(Boolean);
    const duration = Number(this.questionAudioContext && this.questionAudioContext.duration || 0);
    const currentTime = Number(this.questionAudioContext && this.questionAudioContext.currentTime || 0);
    if (!lines.length || duration <= 0) return;
    const weights = lines.map((line) => Math.max(4, line.replace(/[^A-Za-z0-9]+/g, '').length));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const position = Math.min(0.999, Math.max(0, currentTime / duration)) * total;
    let cumulative = 0;
    let lineIndex = weights.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      cumulative += weights[index];
      if (position < cumulative) {
        lineIndex = index;
        break;
      }
    }
    if (lineIndex !== this.data.ieltsCueLineIndex) this.setData({ ieltsCueLineIndex: lineIndex });
  },

  scoreIeltsAnswer() {
    if (!this.data.recording && !this.data.submitting && this.data.tempFilePath) {
      this.submitIeltsSpeaking();
    }
  },

  toggleIeltsSource() {
    this.setData({ ieltsSourceExpanded: !this.data.ieltsSourceExpanded });
  },

  previewIeltsSource(event) {
    const urls = (this.data.ieltsSourceImages || []).map((item) => item.src).filter(Boolean);
    if (!urls.length) return;
    wx.previewImage({ current: String(event.currentTarget.dataset.src || urls[0]), urls });
  },

  selectExercise(event) {
    if (this.data.recording || (this.data.ieltsMode && this.data.submitting)) return;
    this.stopAnswerPlayback();
    const id = event.currentTarget.dataset.id;
    const exercises = this.data.exercises || [];
    const activeExercise = exercises.find((item) => item.id === id) || exercises[0];
    const session = this.repeatPracticeSessions && this.repeatPracticeSessions[activeExercise.id] || {};
    if (this.questionAudioContext) {
      this.questionPlaybackRequestToken += 1;
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
    }
    this.setData({
      activeId: activeExercise.id,
      activeExercise,
      tempFilePath: session.tempFilePath || '',
      recordDurationMs: Number(session.recordDurationMs || 0),
      recordDurationText: session.recordDurationText || '',
      result: session.result || null,
      repeatScoring: Boolean(session.scoring || activeExercise.repeatScoring),
      questionPlaying: false,
      questionLoading: false,
      repeatPromptReady: false,
      errorText: session.errorText || ''
    });
    this.queueQuestionAutoPlay();
  },

  queueQuestionAutoPlay() {
    if (this.questionAutoPlayTimer) clearTimeout(this.questionAutoPlayTimer);
    this.questionAutoPlayTimer = setTimeout(() => {
      this.questionAutoPlayTimer = null;
      if (this.data.viewMode === 'practice' && this.data.activeExercise && !this.data.recording && !this.data.submitting) {
        this.replayQuestion();
      }
    }, 120);
  },

  replayQuestion() {
    if (!this.questionAudioContext || this.data.recording || this.data.submitting) return;
    this.questionPlaybackRequestToken += 1;
    this.pendingQuestionClip = null;
    this.questionAudioContext.stop();
    this.setData({
      questionPlaying: false,
      questionLoading: false,
      repeatPromptReady: this.data.ieltsMode ? this.data.repeatPromptReady : false,
      ieltsCueLineIndex: -1,
      errorText: ''
    });
    this.playQuestion();
  },

  startPendingQuestionClip(fromSeek) {
    const clip = this.pendingQuestionClip;
    if (!clip || clip.started || !this.questionAudioContext) return;
    if (!fromSeek && !clip.seekRequested) {
      clip.seekRequested = true;
      this.questionAudioContext.seek(clip.startSec);
      if (this.questionClipSeekTimer) clearTimeout(this.questionClipSeekTimer);
      this.questionClipSeekTimer = setTimeout(() => {
        this.questionClipSeekTimer = null;
        this.startPendingQuestionClip(true);
      }, 300);
      return;
    }
    clip.started = true;
    if (this.questionClipSeekTimer) {
      clearTimeout(this.questionClipSeekTimer);
      this.questionClipSeekTimer = null;
    }
    this.questionAudioContext.play();
  },

  async handleQuestionAudioError(error) {
    const clip = this.pendingQuestionClip;
    const requestToken = this.questionPlaybackRequestToken;
    if (!this.data.ieltsMode && clip && !clip.fallbackTried && clip.audioFileId) {
      clip.fallbackTried = true;
      try {
        const fallbackSrc = await store.getTempFileURL(clip.audioFileId);
        if (requestToken !== this.questionPlaybackRequestToken || this.pendingQuestionClip !== clip) return;
        if (fallbackSrc && fallbackSrc !== clip.src) {
          if (this.questionClipSeekTimer) {
            clearTimeout(this.questionClipSeekTimer);
            this.questionClipSeekTimer = null;
          }
          clip.src = fallbackSrc;
          clip.seekRequested = false;
          clip.started = false;
          this.questionAudioContext.stop();
          this.pendingQuestionClip = clip;
          this.questionAudioContext.src = fallbackSrc;
          return;
        }
      } catch (fallbackError) {}
    }
    console.warn(`[speaking-original-audio] pages/speaking.questionAudioContext.onError -> temp-url-fallback: ${String(error && (error.errCode || error.errMsg) || 'unknown')}`);
    this.pendingQuestionClip = null;
    this.setData({
      questionPlaying: false,
      questionLoading: false,
      repeatPromptReady: this.data.ieltsMode ? this.data.repeatPromptReady : true,
      ieltsCueLineIndex: -1,
      ieltsPromptReady: this.data.ieltsMode ? true : this.data.ieltsPromptReady,
      ieltsQuestionRevealed: this.data.ieltsMode ? true : this.data.ieltsQuestionRevealed,
      errorText: text('playFailed', '问题播放失败，请稍后再试。')
    });
  },

  playOriginalQuestionClip(active) {
    const src = String(active && active.audioUrl || '').trim();
    if (!src) throw new Error('empty-original-audio');
    const clip = {
      src,
      startSec: Math.max(0, Number(active.audioStartSec || 0)),
      endSec: Math.max(Number(active.audioStartSec || 0) + 0.05, Number(active.audioEndSec || 0)),
      audioFileId: String(active.audioFileId || ''),
      fallbackTried: false,
      seekRequested: false,
      started: false
    };
    this.pendingQuestionClip = null;
    this.questionAudioContext.stop();
    this.pendingQuestionClip = clip;
    if (String(this.questionAudioContext.src || '') === src) {
      this.startPendingQuestionClip();
      return;
    }
    this.questionAudioContext.src = src;
  },

  async playQuestion() {
    if (!this.questionAudioContext || this.data.recording || this.data.questionLoading) {
      return;
    }
    if (this.data.questionPlaying) {
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
      return;
    }
    const active = this.data.activeExercise || {};
    const requestToken = ++this.questionPlaybackRequestToken;
    this.setData({ questionLoading: true, errorText: '' });
    try {
      if (!this.data.ieltsMode && (active.audioUrl || active.audioFileId || active.audioCloudPath)) {
        let originalAudioUrl = String(active.audioUrl || '').trim();
        if (!isHttpAudioUrl(originalAudioUrl)) {
          originalAudioUrl = buildCloudAssetUrl(active.audioCloudPath)
            || (active.audioFileId ? await store.getTempFileURL(active.audioFileId) : '')
            || (originalAudioUrl.startsWith('cloud://') ? await store.getTempFileURL(originalAudioUrl) : originalAudioUrl);
        }
        if (requestToken !== this.questionPlaybackRequestToken) return;
        if (!originalAudioUrl) throw new Error('empty-original-audio');
        this.playOriginalQuestionClip(Object.assign({}, active, { audioUrl: originalAudioUrl }));
        return;
      }
      let result;
      if (this.data.ieltsMode) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          result = await store.synthesizeIeltsPromptAudio({
            itemId: this.data.ieltsItemId,
            exerciseId: active.id,
            text: active.prompt
          });
          if (!result.generating) break;
          await new Promise((resolve) => setTimeout(resolve, Math.max(500, Number(result.retryAfterMs || 1500))));
          if (requestToken !== this.questionPlaybackRequestToken) return;
        }
        if (result && result.generating) throw new Error('ielts-question-audio-generating');
      } else {
        result = await store.synthesizeReadingAudio({ text: active.prompt, skipYoudao: true });
      }
      if (requestToken !== this.questionPlaybackRequestToken) return;
      const src = result.audioUrl || (result.fileId ? await store.getTempFileURL(result.fileId) : '');
      if (requestToken !== this.questionPlaybackRequestToken) return;
      if (!src) {
        throw new Error('empty-question-audio');
      }
      this.questionAudioContext.stop();
      this.questionAudioContext.src = src;
      this.questionAudioContext.play();
    } catch (error) {
      if (requestToken !== this.questionPlaybackRequestToken) return;
      this.setData({
        questionLoading: false,
        questionPlaying: false,
        ieltsCueLineIndex: -1,
        ieltsPromptReady: this.data.ieltsMode ? true : this.data.ieltsPromptReady,
        ieltsQuestionRevealed: this.data.ieltsMode ? true : this.data.ieltsQuestionRevealed,
        errorText: text('playFailed', '问题播放失败，请稍后再试。')
      });
    }
  },

  startRecord() {
    if (this.data.recording || this.data.submitting) {
      return;
    }
    if (this.questionAudioContext) {
      this.questionPlaybackRequestToken += 1;
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
    }
    this.stopAnswerPlayback();
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
      duration: Math.min(180000, Math.max(20000, Number(this.data.activeExercise && this.data.activeExercise.maxDurationSec || 20) * 1000)),
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

  handleRecordingStopped(res) {
    const tempFilePath = String(res && res.tempFilePath || '');
    const durationMs = Number(res && res.duration || 0) || (this.data.recordStartedAt ? Date.now() - this.data.recordStartedAt : 0);
    this.setData({
      recording: false,
      tempFilePath,
      recordDurationMs: durationMs,
      recordDurationText: formatDuration(durationMs),
      errorText: ''
    }, () => {
      if (!this.pageUnloading && !this.data.ieltsMode && tempFilePath) this.submitPronunciation();
    });
  },

  stopAnswerPlayback() {
    if (this.answerAudioContext) this.answerAudioContext.stop();
  },

  replayRepeatRecording() {
    if (!this.answerAudioContext || !this.data.tempFilePath || this.data.recording || this.data.submitting || this.data.repeatScoring) return;
    if (this.data.answerPlaying) {
      this.stopAnswerPlayback();
      return;
    }
    if (this.questionAudioContext) {
      this.questionPlaybackRequestToken += 1;
      this.pendingQuestionClip = null;
      this.questionAudioContext.stop();
    }
    this.answerAudioContext.src = this.data.tempFilePath;
    this.answerAudioContext.play();
  },

  toggleRepeatRecording() {
    if (this.data.ieltsMode || this.data.submitting || this.data.repeatScoring || this.data.questionLoading || this.data.questionPlaying) return;
    if (this.data.recording) {
      this.stopRecord();
      return;
    }
    this.startRecord();
  },

  restartRepeatRecording() {
    if (this.data.recording || this.data.submitting || this.data.repeatScoring) return;
    this.stopAnswerPlayback();
    const activeId = String(this.data.activeId || '');
    if (activeId && this.repeatPracticeSessions) delete this.repeatPracticeSessions[activeId];
    const exercises = (this.data.exercises || []).map((item) => item.id === activeId
      ? Object.assign({}, item, { repeatResult: null, repeatScoring: false, repeatScoreError: false })
      : item);
    this.setData({
      exercises,
      tempFilePath: '',
      recordDurationMs: 0,
      recordDurationText: '',
      result: null,
      repeatScoring: false,
      errorText: ''
    }, () => this.startRecord());
  },

  async submitPronunciation() {
    if (!this.data.tempFilePath) {
      return;
    }
    const active = this.data.activeExercise || {};
    const activeId = String(active.id || '');
    if (!activeId) return;
    if (!this.repeatScoringRequests) this.repeatScoringRequests = {};
    if (this.repeatScoringRequests[activeId]) return;
    this.repeatScoringRequests[activeId] = true;
    const recording = {
      tempFilePath: this.data.tempFilePath,
      recordDurationMs: this.data.recordDurationMs,
      recordDurationText: this.data.recordDurationText
    };
    const planRunType = store.getDeviceStudyRole && store.getDeviceStudyRole() === 'student' ? 'normal' : 'preview';
    if (!this.repeatPracticeSessions) this.repeatPracticeSessions = {};
    this.repeatPracticeSessions[activeId] = Object.assign({}, recording, {
      result: null,
      scoring: true,
      errorText: ''
    });
    const scoringExercises = (this.data.exercises || []).map((item) => item.id === activeId
      ? Object.assign({}, item, { repeatResult: null, repeatScoring: true, repeatScoreError: false })
      : item);
    const scoringPatch = { exercises: scoringExercises };
    if (this.data.activeId === activeId) Object.assign(scoringPatch, { repeatScoring: true, errorText: '', result: null });
    this.setData(scoringPatch);
    try {
      const upload = await store.createSpeakingUploadUrl({
        category: 'speaking',
        taskId: active.id,
        attemptType: 'standalone_sentence_repeat',
        planRunType
      });
      const fileId = await store.uploadSpeakingAudio(upload.cloudPath, recording.tempFilePath);
      const response = await store.evaluateSpeakingPronunciation({
        category: 'speaking',
        taskId: active.id,
        attemptType: 'standalone_sentence_repeat',
        answerAudioFileId: fileId,
        answerCloudPath: upload.cloudPath,
        answerDurationMs: recording.recordDurationMs,
        refText: active.prompt,
        planRunType
      });
      const pronunciation = response.pronunciation || null;
      if (pronunciation) {
        if (!this.repeatPracticeSessions) this.repeatPracticeSessions = {};
        this.repeatPracticeSessions[activeId] = {
          result: pronunciation,
          tempFilePath: recording.tempFilePath,
          recordDurationMs: recording.recordDurationMs,
          recordDurationText: recording.recordDurationText,
          scoring: false,
          errorText: ''
        };
      }
      const successPatch = {
        exercises: (this.data.exercises || []).map((item) => item.id === active.id
          ? Object.assign({}, item, { repeatResult: pronunciation, repeatScoring: false, repeatScoreError: false })
          : item)
      };
      if (this.data.activeId === activeId) Object.assign(successPatch, { result: pronunciation, repeatScoring: false, errorText: '' });
      this.setData(successPatch);
      if (pronunciation && this.data.activeId === activeId && !this.data.recording) {
        this.playScoreEffect();
      }
    } catch (error) {
      const errorText = text('scoreFailed', '评分暂时没有成功，请稍后再试。');
      this.repeatPracticeSessions[activeId] = Object.assign({}, recording, {
        result: null,
        scoring: false,
        errorText
      });
      const failurePatch = {
        exercises: (this.data.exercises || []).map((item) => item.id === activeId
          ? Object.assign({}, item, { repeatResult: null, repeatScoring: false, repeatScoreError: true })
          : item)
      };
      if (this.data.activeId === activeId) Object.assign(failurePatch, { repeatScoring: false, errorText });
      this.setData(failurePatch);
    } finally {
      delete this.repeatScoringRequests[activeId];
    }
  },
  async submitIeltsSpeaking() {
    if (!this.data.tempFilePath || this.data.submitting) return;
    const active = this.data.activeExercise;
    const planRunType = store.getDeviceStudyRole && store.getDeviceStudyRole() === 'student' ? 'normal' : 'preview';
    this.setData({ submitting: true, errorText: '', result: null });
    try {
      const upload = await store.createSpeakingUploadUrl({
        category: 'ielts-speaking',
        taskId: active.id,
        attemptType: 'ielts_speaking',
        planRunType
      });
      const fileId = await store.uploadSpeakingAudio(upload.cloudPath, this.data.tempFilePath);
      const response = await store.submitSpeakingAttempt({
        category: 'ielts-speaking',
        taskId: active.id,
        attemptType: 'ielts_speaking',
        promptText: active.prompt,
        answerAudioFileId: fileId,
        answerCloudPath: upload.cloudPath,
        answerDurationMs: this.data.recordDurationMs,
        planRunType
      });
      const attempt = response.attempt || {};
      this.setData({
        result: {
          score: Number(attempt.score || 0),
          accuracy: Number(attempt.contentGrammarScore || attempt.score || 0),
          fluency: Number(attempt.pronunciationFluencyScore || attempt.score || 0),
          completion: Number(attempt.score || 0)
        },
        tempFilePath: ''
      });
      this.playScoreEffect();
    } catch (error) {
      this.setData({ errorText: text('scoreFailed', '评分暂时没有成功，请稍后再试。') });
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
