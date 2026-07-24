const page = require('../../utils/page');
const store = require('../../utils/store');
const i18n = require('../../utils/i18n');
const appConfig = require('../../app-config');
const { normalizeWritingReview } = require('../../utils/writing-report');
const { openWritingReportPdf } = require('../../utils/writing-report-download');
const { openReadingReportPdf } = require('../../utils/reading-report-download');
const { openListeningReportPdf } = require('../../utils/listening-report-download');

const text = (key, fallback) => i18n.getPageText('practiceHistory', key, undefined, fallback);

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) return '';
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  if (!total) return '';
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? `${minutes}${text('minuteUnit', '分')}${rest}${text('secondUnit', '秒')}` : `${rest}${text('secondUnit', '秒')}`;
}

function vocabularyModeLabel(mode) {
  if (mode === 'word-meaning') return text('wordMeaning', '看词选义');
  if (mode === 'audio-meaning') return text('audioMeaning', '听音选义');
  if (mode === 'wrong-dictation') return text('wrongDictation', '错词听写');
  return text('vocabularyEyebrow', '听音写词');
}

function buildTexts() {
  const catalog = require('../../utils/i18n-catalog-learning').practiceHistory['zh-CN'];
  return Object.keys(catalog).reduce((texts, key) => {
    texts[key] = text(key);
    return texts;
  }, {});
}

const MODULES = {
  reading: {
    title: text('readingTitle', '阅读记录'),
    eyebrow: text('readingEyebrow', '中考阅读'),
    copy: text('readingCopy', '回看做过的文章和逐题解析。'),
    empty: text('noReading', '还没有阅读记录')
  },
  listening: {
    title: text('listeningTitle', '听力记录'),
    eyebrow: text('listeningEyebrow', '听力套题'),
    copy: text('listeningCopy', '回看原题、原文、答案、解析和学习卡。'),
    empty: text('noListening', '还没有听力套题记录')
  },
  grammar: {
    title: text('grammarTitle', '语法记录'),
    eyebrow: text('grammarEyebrow', '英语语法'),
    copy: text('grammarCopy', '回看做过的考点和答案。'),
    empty: text('noGrammar', '还没有语法记录')
  },
  writing: {
    title: text('writingTitle', '写作记录'),
    eyebrow: text('writingEyebrow', '英语写作'),
    copy: text('writingCopy', '回看作文、批改和参考改写。'),
    empty: text('noWriting', '还没有写作记录')
  },
  vocabulary: {
    title: text('vocabularyTitle', '词汇听写记录'),
    eyebrow: text('vocabularyEyebrow', '听音写词'),
    copy: text('vocabularyCopy', '回看每次听写、错词和订正结果。'),
    empty: text('noVocabulary', '还没有词汇听写记录')
  },
  speaking: {
    title: text('speakingTitle', '口语练习记录'),
    eyebrow: text('speakingEyebrow', '口语练习'),
    copy: text('speakingCopy', '回听录音，查看跟读分数和雅思练习结果。'),
    empty: text('noSpeaking', '还没有口语练习记录')
  }
};

function cleanDate(value, fallback) {
  const raw = String(value || fallback || '').trim();
  const matched = raw.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0].replace(/-/g, '.') : text('unknownDate', '日期未知');
}

function buildOptions(options, selected, answer) {
  const source = options && typeof options === 'object' ? options : {};
  return Object.keys(source).map((key) => ({
    key,
    text: source[key],
    isSelected: String(key) === String(selected || ''),
    isAnswer: String(key) === String(answer || '')
  }));
}

function buildAcademicFilter(values) {
  const source = (Array.isArray(values) ? values : [values]).filter(Boolean).join(' ').toLowerCase();
  if (/ielts|雅思/.test(source)) return { filterKey: 'ielts', filterLabel: 'IELTS', filterOrder: 30 };
  if (/高中|高考|春考|秋考|senior|spring|autumn/.test(source)) return { filterKey: 'senior', filterLabel: text('filterSenior', '高中'), filterOrder: 20 };
  if (/初中|中考|一模|二模|junior|em1|em2/.test(source)) return { filterKey: 'junior', filterLabel: text('filterJunior', '初中'), filterOrder: 10 };
  return { filterKey: 'other', filterLabel: text('filterOther', '其他'), filterOrder: 90 };
}

function buildGrammarFilter(item) {
  if (item.section === 'micro-lesson') {
    return { filterKey: 'micro-lesson', filterLabel: text('microLesson', '词法微课'), filterOrder: 30 };
  }
  const stage = buildAcademicFilter([item.targetId, item.topicId, item.title, item.meta, item.category]);
  return ['junior', 'senior'].includes(stage.filterKey)
    ? stage
    : { filterKey: 'other-grammar', filterLabel: text('filterOtherGrammar', '其他语法'), filterOrder: 90 };
}

function buildRecordFilterOptions(records) {
  const groups = new Map();
  (records || []).forEach((record) => {
    if (!record.filterKey || !record.filterLabel) return;
    const current = groups.get(record.filterKey) || {
      key: record.filterKey,
      label: record.filterLabel,
      count: 0,
      order: Number(record.filterOrder || 90)
    };
    current.count += 1;
    groups.set(record.filterKey, current);
  });
  if (groups.size <= 1) return [];
  return [{
    key: 'all',
    label: text('filterAllRecords', '全部记录'),
    count: (records || []).length,
    order: 0
  }].concat(Array.from(groups.values()).sort((left, right) => (
    left.order - right.order || left.label.localeCompare(right.label, 'zh-CN')
  )));
}

function normalizeReading(item, index) {
  const attempt = item.latestAttempt || {};
  const correctCount = Number(attempt.correctCount || 0);
  const totalCount = Number(attempt.totalCount || (attempt.questionResults || []).length || 0);
  return Object.assign({
    id: String(item.id || item.recordId || attempt._id || `reading-${index}`),
    targetId: String(item.passageId || item.targetId || attempt.passageId || ''),
    title: item.title || attempt.title || '阅读练习',
    meta: item.meta || text('readingEyebrow', '阅读'),
    dateLabel: cleanDate(item.date, attempt.createdAt),
    summary: totalCount ? `${correctCount}/${totalCount}${text('questionSuffix', ' 题')}` : (item.progressText || text('completed', '已完成')),
    attempt,
    detailReady: false,
    detailLoading: false,
    passageText: '',
    manualMarkItems: [],
    detailQuestions: [],
    aiAnalysisLoaded: false,
    aiAnalysisLoading: false,
    aiAnalysisStatus: '',
    pdfGenerating: false
  }, buildAcademicFilter([item.targetId, item.passageId, item.title, item.meta, item.category, item.taskId]));
}

function normalizeListening(item, index) {
  const attempt = item.latestAttempt || {};
  const totalCount = Number(attempt.totalCount || attempt.answeredCount || 0);
  const correctCount = Number(attempt.correctCount || 0);
  return Object.assign({
    id: String(item.id || item.recordId || `listening-${index}`),
    targetId: String(item.targetId || ''),
    title: item.title || '听力套题',
    meta: item.meta || text('listeningEyebrow', '听力套题'),
    dateLabel: cleanDate(item.date, item.updatedAt),
    summary: totalCount ? `${correctCount}/${totalCount}${text('questionSuffix', ' 题')}` : (item.progressText || text('completed', '已完成')),
    attempt,
    detailReady: false,
    detailLoading: false,
    transcript: '',
    sourceImages: [],
    detailQuestions: [],
    vocabularyCards: [],
    phraseCards: [],
    sentencePatternCards: [],
    pdfGenerating: false
  }, buildAcademicFilter([item.targetId, item.title, item.meta, item.category, item.taskId]));
}

function normalizeGrammar(item, index) {
  const attempt = item.latestAttempt || {};
  const isMicroLesson = item.section === 'micro-lesson';
  const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
  const correctCount = questions.length
    ? questions.filter((question) => question.isCorrect).length
    : Number(attempt.correctCount || 0);
  return Object.assign({
    id: String(item.id || item.recordId || `grammar-${index}`),
    targetId: String(item.topicId || item.targetId || ''),
    title: String(item.title || '语法练习').replace(/^语法：/, ''),
    meta: isMicroLesson ? text('microLesson', '词法微课') : (item.meta || text('grammarEyebrow', '语法')),
    dateLabel: cleanDate(item.date, item.updatedAt),
    summary: isMicroLesson
      ? (item.progressText || text('microLessonCompleted', '完成 1 节微课'))
      : `${correctCount}/${questions.length || Number(attempt.answeredCount || 0)}${text('questionSuffix', ' 题')}`,
    attempt,
    isMicroLesson,
    detailReady: questions.length > 0,
    detailLoading: false,
    manualMarkItems: (attempt.manualMarks && attempt.manualMarks.items) || [],
    detailQuestions: buildGrammarDetailQuestions(questions, item)
  }, buildGrammarFilter(item));
}

function normalizeVocabulary(item, index) {
  const totalCount = Number(item.totalCount || 0);
  const correctCount = Number(item.correctCount || 0);
  const meta = vocabularyModeLabel(item.practiceMode);
  return {
    id: String(item.recordId || item.id || `vocabulary-${index}`),
    title: item.sourceTitle || text('vocabularyTitle', '词汇听写'),
    meta,
    durationText: formatDuration(item.durationSec),
    dateLabel: cleanDate(item.date, item.updatedAt),
    summary: `${correctCount}/${totalCount}${text('wordUnit', ' 词')}`,
    attempt: item,
    detailReady: false,
    detailLoading: false,
    detailQuestions: []
  };
}

function buildIeltsSpeakingTitle(attempt) {
  const matched = String(attempt.ieltsItemId || attempt.taskId || '').match(/ielts-academic-(\d+)-test-(\d+)-speaking/i);
  const testLabel = matched ? `IELTS ${matched[1]} Test ${matched[2]}` : 'IELTS Speaking';
  return attempt.ieltsPart ? `${testLabel} · Part ${attempt.ieltsPart}` : testLabel;
}

function normalizeSpeaking(attempt, index) {
  const isIelts = attempt.category === 'ielts-speaking' || attempt.attemptType === 'ielts_speaking';
  const prompt = attempt.promptText || attempt.questionText || text('speakingPromptFallback', '口语练习');
  const score = Number(attempt.score || 0);
  const overallBand = Number(attempt.ieltsOverallBand || 0);
  return Object.assign({
    id: String(attempt.attemptId || attempt._id || `speaking-${index}`),
    title: isIelts ? buildIeltsSpeakingTitle(attempt) : prompt,
    meta: isIelts ? text('speakingIelts', '雅思口语') : text('speakingRepeat', '分级跟读'),
    dateLabel: cleanDate(attempt.date, attempt.createdAt),
    durationText: formatDuration(Number(attempt.answerDurationMs || attempt.recordDurationMs || 0) / 1000),
    summary: isIelts
      ? (overallBand ? `Band ${overallBand}` : text('speakingResultIncomplete', '暂无完整结果'))
      : (score ? `${score}${text('scoreUnit', ' 分')}` : text('speakingResultIncomplete', '暂无完整结果')),
    attempt,
    isIelts,
    prompt,
    hasRecording: !!(attempt.answerAudioFileId || attempt.answerCloudPath),
    detailReady: true,
    detailLoading: false
  }, {
    filterKey: isIelts ? 'ielts-speaking' : 'graded-repeat',
    filterLabel: isIelts ? text('speakingIelts', '雅思口语') : text('speakingRepeat', '分级跟读'),
    filterOrder: isIelts ? 20 : 10
  });
}

function buildGrammarDetailQuestions(questions, item) {
  return (questions || []).map((question, questionIndex) => {
    const explanation = question.explanation || null;
    const hasCloudExplanation = explanation && explanation.source !== 'fallback';
    return {
      questionId: String(question._id || `${item.targetId || item.topicId || 'grammar'}:${question.number || questionIndex + 1}`),
      number: question.number || questionIndex + 1,
      prompt: question.prompt || '',
      options: question.options || {},
      selected: question.selectedAnswer || '',
      answer: question.answer || '',
      correct: !!question.isCorrect,
      optionsList: buildOptions(question.options, question.selectedAnswer, question.answer),
      analysis: hasCloudExplanation && (explanation.explanation || explanation.elimination)
        ? [explanation.explanation, explanation.elimination].filter(Boolean).join('\n')
        : ''
    };
  });
}

function normalizeWrongItem(item, index) {
  const question = item.question || item;
  const selected = question.selectedAnswer || item.selectedAnswer || '';
  const answer = question.answer || item.answer || '';
  const questionId = String(item.questionId || question._id || `wrong-${index}`);
  return {
    id: `wrong:${item._id || questionId}`,
    targetId: String(item.sourceTargetId || ''),
    title: item.sourceTitle || question.subtopic || question.topic || (item.sourceType === 'reading' ? '阅读错题' : '语法错题'),
    meta: item.sourceMeta || (item.sourceType === 'reading' ? text('readingEyebrow', '阅读') : text('grammarEyebrow', '语法')),
    dateLabel: cleanDate(item.addedAt || item.wrongAt, item.updatedAt),
    summary: `1${text('questionSuffix', ' 题')}`,
    detailReady: true,
    detailLoading: false,
    passageText: item.sourceType === 'reading' ? String(item.sourcePassage || '') : '',
    detailQuestions: [{
      questionId,
      number: question.number || '',
      prompt: question.prompt || '',
      options: question.options || {},
      selected,
      answer,
      correct: question.correct === true || (!!selected && selected === answer),
      optionsList: buildOptions(question.options, selected, answer),
      analysis: question.analysis || '',
      inWrongBook: true
    }]
  };
}

async function hydrateWrongReadingPassages(records) {
  const missingIds = Array.from(new Set((records || [])
    .filter((record) => !record.passageText && record.targetId)
    .map((record) => record.targetId)));
  if (!missingIds.length) return records;
  const passages = await Promise.all(missingIds.map(async (passageId) => {
    const result = await store.getReadingPassage({ passageId });
    return [passageId, result && result.passage && result.passage.passage || ''];
  }));
  const passageById = passages.reduce((map, entry) => {
    map[entry[0]] = entry[1];
    return map;
  }, {});
  return (records || []).map((record) => Object.assign({}, record, {
    passageText: record.passageText || passageById[record.targetId] || ''
  }));
}

function applyWrongStatus(records, wrongItems) {
  const ids = new Set((wrongItems || []).map((item) => String(item.questionId || (item.question && item.question._id) || '')));
  return (records || []).map((record) => Object.assign({}, record, {
    detailQuestions: (record.detailQuestions || []).map((question) => Object.assign({}, question, {
      inWrongBook: ids.has(String(question.questionId || ''))
    }))
  }));
}

function normalizeWriting(attempt, index) {
  const review = attempt.review || {};
  const totalScore = Number(attempt.totalScore || review.totalScore || 20);
  const pending = ['grading-pending', 'grading'].includes(attempt.status);
  const sourceMeta = [attempt.promptMeta && attempt.promptMeta.year, attempt.promptMeta && attempt.promptMeta.district, attempt.promptMeta && attempt.promptMeta.examType].filter(Boolean).join(' · ');
  const promptImages = attempt.promptMeta && Array.isArray(attempt.promptMeta.images)
    ? attempt.promptMeta.images.map((image, imageIndex) => ({
      key: String(image && (image.cloudPath || image.fileId || image.fileID) || `prompt-image-${imageIndex}`),
      fileId: String(image && (image.fileId || image.fileID) || ''),
      cloudPath: String(image && image.cloudPath || ''),
      alt: String(image && image.alt || ''),
      src: String(image && (image.src || image.url) || '')
    })).filter((image) => image.fileId || image.cloudPath || image.src)
    : [];
  return Object.assign({
    id: String(attempt.attemptId || `writing-${index}`),
    targetId: String(attempt.promptId || ''),
    title: attempt.title || '写作练习',
    meta: attempt.isPreview
      ? `家长预览${sourceMeta ? ` · ${sourceMeta}` : ''}`
      : (sourceMeta || text('writingEyebrow', '写作')),
    dateLabel: cleanDate(attempt.date, attempt.createdAt),
    summary: pending ? text('grading', '批改中') : `${Number(attempt.score || review.score || 0)}/${totalScore}`,
    attempt: Object.assign({}, attempt, {
      review: normalizeWritingReview(review, totalScore),
      promptImages
    }),
    detailReady: false,
    detailLoading: false,
    pdfGenerating: false,
    manualMarkItems: (attempt.manualMarks && attempt.manualMarks.items) || []
  }, buildAcademicFilter([
    attempt.promptId,
    attempt.title,
    attempt.promptMeta && attempt.promptMeta.stage,
    attempt.promptMeta && attempt.promptMeta.examType,
    attempt.promptMeta && attempt.promptMeta.category
  ]));
}

async function resolveWritingPromptImages(attempt) {
  const source = attempt || {};
  const images = Array.isArray(source.promptImages) ? source.promptImages : [];
  if (!images.some((image) => !image.src && (image.fileId || image.cloudPath))) return source;
  const promptImages = await Promise.all(images.map(async (image) => {
    if (image.src) return image;
    try {
      const src = await store.getTempFileURL(image.fileId || image.cloudPath);
      return Object.assign({}, image, { src });
    } catch (error) {
      return image;
    }
  }));
  return Object.assign({}, source, { promptImages });
}

async function resolveListeningImages(item) {
  const resolveImage = async (image) => {
    if (!image || image.src || image.url) return image;
    try {
      const src = await store.getTempFileURL(image.fileId || image.fileID || image.cloudPath);
      return Object.assign({}, image, { src });
    } catch (error) {
      return image;
    }
  };
  const source = item || {};
  const images = await Promise.all((source.images || []).map(resolveImage));
  const questions = await Promise.all((source.questions || []).map(async (question) => {
    const optionEntries = await Promise.all(Object.entries(question.optionImages || {}).map(async ([key, image]) => [
      key,
      await resolveImage(image)
    ]));
    return Object.assign({}, question, {
      sourceImages: await Promise.all((question.sourceImages || []).map(resolveImage)),
      optionImages: Object.fromEntries(optionEntries)
    });
  }));
  return Object.assign({}, source, { images, questions });
}

function isWritingGradingPending(attempt) {
  return ['grading-pending', 'grading', 'grading-failed'].includes(String(attempt && attempt.status || ''));
}

function buildDebugLines(result, action) {
  if (!result || result.syncMode !== 'cloud-error') return [];
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const syncDebug = result.syncDebug || {};
  const cloudError = result.cloudError || {};
  return [
    `DEBUG: pages/practice-history.loadHistory -> store.${action} -> cloud.${action} -> syncMode=${result.syncMode}`,
    `DEBUG: pages/practice-history.loadHistory -> cloudError.message=${cloudError.message || 'missing'}, syncDebug.reason=${syncDebug.reason || 'missing'}, syncDebug.envId=${syncDebug.envId || 'missing'}`,
    `DEBUG: pages/practice-history.loadHistory -> targetChildId=${target.targetChildId || 'self'}`
  ];
}

function isPendingReadingAnalysis(value) {
  const content = String(value || '').trim();
  return !content || content.includes('生成解析中');
}

function buildReadingAnalysisDebugLines(record, result, stage, elapsedMs) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const attempt = (record && record.attempt) || {};
  const studyPack = result && result.studyPack;
  const analyses = (studyPack && (studyPack.questionAnalyses || studyPack.analysis)) || [];
  return [
    `DEBUG: pages/practice-history.loadReadingDetail -> store.getReadingStudyPack -> cloud.getReadingStudyPack -> stage=${stage}`,
    `DEBUG: pages/practice-history.loadReadingDetail -> passageId=${(record && record.targetId) || 'missing'}, attemptId=${attempt.attemptId || attempt._id || 'missing'}, studyPack=${studyPack ? 'present' : 'missing'}, analyses=${analyses.length}, cacheMiss=${!!(result && result.cacheMiss)}, elapsed=${elapsedMs || 0}ms`,
    `DEBUG: pages/practice-history.loadReadingDetail -> targetChildId=${target.targetChildId || 'self'}, syncMode=${(result && result.syncMode) || 'pending'}`
  ];
}

Page({
  data: page.createCloudPageData({
    type: 'reading',
    config: MODULES.reading,
    loading: true,
    records: [],
    viewMode: 'history',
    expandedId: '',
    debugLines: [],
    isParentView: false,
    recordFilterOpen: false,
    activeRecordFilter: 'all',
    activeRecordFilterLabel: text('filterAllRecords', '全部记录'),
    recordFilterOptions: [],
    playingSpeakingRecordId: '',
    pausedSpeakingRecordId: '',
    loadingSpeakingRecordId: '',
    texts: buildTexts()
  }),
  onLoad(options) {
    this.historyPageActive = true;
    this.historyPerf = page.startPagePerf('practice-history');
    const type = MODULES[options && options.type] ? options.type : 'reading';
    const config = MODULES[type];
    const isParentView = store.getDeviceStudyRole && store.getDeviceStudyRole() === 'parent';
    this.setData({ type, config, isParentView, texts: buildTexts() });
    wx.setNavigationBarTitle({ title: config.title });
    wx.nextTick(() => {
      if (!this.historyPerf) return;
      this.historyPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        type,
        records: (this.data.records || []).length
      });
    });
    this.loadHistory();
  },
  onShow() {
    page.syncTheme(this);
    const isParentView = store.getDeviceStudyRole && store.getDeviceStudyRole() === 'parent';
    const type = this.data.type;
    const config = type === 'grammar'
      ? { title: text('grammarTitle'), eyebrow: text('grammarEyebrow'), copy: text('grammarCopy'), empty: text('noGrammar') }
      : type === 'writing'
        ? { title: text('writingTitle'), eyebrow: text('writingEyebrow'), copy: text('writingCopy'), empty: text('noWriting') }
        : type === 'listening'
          ? { title: text('listeningTitle'), eyebrow: text('listeningEyebrow'), copy: text('listeningCopy'), empty: text('noListening') }
        : type === 'vocabulary'
          ? { title: text('vocabularyTitle'), eyebrow: text('vocabularyEyebrow'), copy: text('vocabularyCopy'), empty: text('noVocabulary') }
          : type === 'speaking'
            ? { title: text('speakingTitle'), eyebrow: text('speakingEyebrow'), copy: text('speakingCopy'), empty: text('noSpeaking') }
        : { title: text('readingTitle'), eyebrow: text('readingEyebrow'), copy: text('readingCopy'), empty: text('noReading') };
    this.setData({ config, isParentView, texts: buildTexts() });
  },
  onUnload() {
    this.historyPageActive = false;
    Object.keys(this.readingDebugTimers || {}).forEach((key) => clearTimeout(this.readingDebugTimers[key]));
    this.readingDebugTimers = {};
    Object.keys(this.writingResumeTimers || {}).forEach((key) => clearTimeout(this.writingResumeTimers[key]));
    this.writingResumeTimers = {};
    this.writingResumeInFlight = {};
    this.writingGradeResumeStartedAt = {};
    this.allHistoryRecords = [];
    this.stopSpeakingPlayback();
  },
  onHide() {
    this.stopSpeakingPlayback();
  },
  async loadHistory() {
    this.setData({ loading: true, debugLines: [] });
    if (!page.requireIdentityConfirmed()) {
      this.setData({ loading: false });
      return;
    }
    if (this.data.type === 'speaking') {
      const result = await store.getSpeakingAttempts({ historyMode: 'recent', limit: 100 });
      const debugLines = buildDebugLines(result, 'getSpeakingAttempts');
      this.setHistoryRecords(debugLines.length ? [] : (result.attempts || []).map(normalizeSpeaking), debugLines);
      if (this.historyPerf) {
        this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
      }
      return;
    }
    if (this.data.type === 'writing') {
      const result = await store.getWritingAttempts({ limit: 50, summaryOnly: true, forceRefresh: true });
      const debugLines = buildDebugLines(result, 'getWritingAttempts');
      const records = debugLines.length ? [] : (result.attempts || []).map(normalizeWriting);
      this.setHistoryRecords(records, debugLines);
      this.resumePendingWritingAttempts(records);
      if (this.historyPerf) {
        this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
      }
      return;
    }
    if (this.data.type === 'vocabulary') {
      const result = await store.getVocabularyDictationHistory();
      const debugLines = buildDebugLines(result, 'getVocabularyDictationHistory');
      this.setHistoryRecords(debugLines.length ? [] : (result.attempts || []).map(normalizeVocabulary), debugLines);
      if (this.historyPerf) this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
      return;
    }
    if (this.data.type === 'listening') {
      const result = await store.getStudyCompletions({
        days: 3650,
        type: 'listening',
        summaryOnly: true
      });
      const debugLines = buildDebugLines(result, 'getStudyCompletions');
      this.setHistoryRecords(
        debugLines.length
          ? []
          : (result.items || []).filter((item) => item.section === 'questions').map(normalizeListening),
        debugLines
      );
      if (this.historyPerf) this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
      return;
    }
    const [result, wrongResult] = await Promise.all([
      store.getStudyCompletions({ days: 3650, summaryOnly: true }),
      store.getPracticeWrongQuestions({ type: this.data.type })
    ]);
    const debugLines = buildDebugLines(result, 'getStudyCompletions');
    const normalize = this.data.type === 'grammar' ? normalizeGrammar : normalizeReading;
    this.wrongItems = (wrongResult && wrongResult.items) || [];
    this.setHistoryRecords(
      debugLines.length
        ? []
        : applyWrongStatus((result.items || []).filter((item) => item.type === this.data.type).map(normalize), this.wrongItems),
      debugLines
    );
    if (this.historyPerf) {
      this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
    }
  },
  setHistoryRecords(records, debugLines) {
    const source = Array.isArray(records) ? records : [];
    const filterableTypes = ['reading', 'grammar', 'writing', 'listening', 'speaking'];
    const recordFilterOptions = filterableTypes.includes(this.data.type)
      ? buildRecordFilterOptions(source)
      : [];
    this.allHistoryRecords = source;
    this.setData({
      loading: false,
      records: source,
      debugLines: debugLines || [],
      recordFilterOpen: false,
      activeRecordFilter: 'all',
      activeRecordFilterLabel: text('filterAllRecords', '全部记录'),
      recordFilterOptions
    });
  },
  filterHistoryRecords(filterKey) {
    const source = this.allHistoryRecords || [];
    return filterKey === 'all'
      ? source
      : source.filter((record) => record.filterKey === filterKey);
  },
  findHistoryRecord(recordId) {
    return (this.data.records || []).find((item) => item.id === recordId)
      || (this.allHistoryRecords || []).find((item) => item.id === recordId)
      || null;
  },
  toggleRecordFilter() {
    if (!(this.data.recordFilterOptions || []).length) return;
    this.setData({ recordFilterOpen: !this.data.recordFilterOpen });
  },
  selectRecordFilter(event) {
    const filterKey = String(event.currentTarget.dataset.filterKey || 'all');
    const option = (this.data.recordFilterOptions || []).find((item) => item.key === filterKey);
    if (!option) return;
    this.setData({
      records: this.filterHistoryRecords(filterKey),
      activeRecordFilter: filterKey,
      activeRecordFilterLabel: option.label,
      recordFilterOpen: false,
      expandedId: ''
    });
  },
  resumePendingWritingAttempts(records) {
    (records || [])
      .filter((record) => isWritingGradingPending(record.attempt))
      .forEach((record) => this.resumeWritingAttempt(record));
  },
  startWritingGradeOnce(recordId) {
    const id = String(recordId || '');
    if (!id) return;
    this.writingGradeResumeStartedAt = this.writingGradeResumeStartedAt || {};
    const activeAgeMs = Date.now() - Number(this.writingGradeResumeStartedAt[id] || 0);
    if (activeAgeMs < 330000) return;
    this.writingGradeResumeStartedAt[id] = Date.now();
    store.gradeWritingAttempt(id).then(() => {
      if (!this.historyPageActive) return;
      const latest = this.findHistoryRecord(id);
      if (latest) this.resumeWritingAttempt(latest);
    }).catch(() => {});
  },
  async resumeWritingAttempt(record) {
    const recordId = String(record && record.id || '');
    if (!recordId) return;
    this.writingResumeInFlight = this.writingResumeInFlight || {};
    if (this.writingResumeInFlight[recordId]) return;
    const currentStatus = String(record && record.attempt && record.attempt.status || '');
    if (['grading-pending', 'grading-failed'].includes(currentStatus)) {
      this.startWritingGradeOnce(recordId);
    }
    this.writingResumeInFlight[recordId] = true;
    const result = await store.getWritingAttemptDetail(recordId);
    delete this.writingResumeInFlight[recordId];
    if (!this.historyPageActive) return;
    if (!result || result.syncMode === 'cloud-error' || !result.attempt) {
      this.writingResumeTimers = this.writingResumeTimers || {};
      clearTimeout(this.writingResumeTimers[recordId]);
      this.writingResumeTimers[recordId] = setTimeout(() => {
        if (!this.historyPageActive) return;
        const latest = this.findHistoryRecord(recordId);
        if (latest) this.resumeWritingAttempt(latest);
      }, 10000);
      return;
    }
    const normalized = normalizeWriting(result.attempt, 0);
    if (result.resumable) this.startWritingGradeOnce(recordId);
    const current = this.findHistoryRecord(recordId);
    if (!current) return;
    this.updateRecord(recordId, {
      summary: normalized.summary,
      attempt: normalized.attempt,
      manualMarkItems: normalized.manualMarkItems,
      detailReady: current.detailReady,
      detailLoading: false
    });
    if (isWritingGradingPending(normalized.attempt)) {
      this.writingResumeTimers = this.writingResumeTimers || {};
      clearTimeout(this.writingResumeTimers[recordId]);
      this.writingResumeTimers[recordId] = setTimeout(() => {
        if (!this.historyPageActive) return;
        const latest = this.findHistoryRecord(recordId);
        if (latest) this.resumeWritingAttempt(latest);
      }, 10000);
    }
  },
  openHistory() {
    if (this.data.viewMode === 'history') return;
    this.setData({ viewMode: 'history', expandedId: '' });
    this.loadHistory();
  },
  async openWrongBook() {
    if (this.data.type === 'writing' || this.data.viewMode === 'wrong') return;
    this.allHistoryRecords = [];
    this.setData({
      viewMode: 'wrong',
      loading: true,
      expandedId: '',
      debugLines: [],
      recordFilterOpen: false,
      activeRecordFilter: 'all',
      activeRecordFilterLabel: text('filterAllRecords', '全部记录'),
      recordFilterOptions: []
    });
    const result = await store.getPracticeWrongQuestions({ type: this.data.type });
    const debugLines = buildDebugLines(result, 'getPracticeWrongQuestions');
    this.wrongItems = (result && result.items) || [];
    const normalizedRecords = this.wrongItems.map(normalizeWrongItem);
    const records = this.data.type === 'reading'
      ? await hydrateWrongReadingPassages(normalizedRecords)
      : normalizedRecords;
    this.setData({
      loading: false,
      records: debugLines.length ? [] : records,
      debugLines
    });
  },
  toggleRecord(event) {
    const id = String(event.currentTarget.dataset.id || '');
    if (!id) return;
    if (this.data.expandedId === id) {
      this.setData({ expandedId: '' });
      if (this.data.type === 'speaking') this.stopSpeakingPlayback();
      return;
    }
    if (this.data.type === 'speaking') this.stopSpeakingPlayback();
    this.setData({ expandedId: id });
    const record = this.findHistoryRecord(id);
    if (this.data.type === 'reading' && record && !record.detailReady && !record.detailLoading) {
      this.loadReadingDetail(record);
    }
    if (this.data.type === 'writing' && record && !record.detailReady && !record.detailLoading) {
      this.loadWritingDetail(record);
    }
    if (this.data.type === 'grammar' && record && !record.detailReady && !record.detailLoading) {
      this.loadGrammarDetail(record);
    }
    if (this.data.type === 'vocabulary' && record && !record.detailReady && !record.detailLoading) {
      this.loadVocabularyDetail(record);
    }
    if (this.data.type === 'listening' && record && !record.detailReady && !record.detailLoading) {
      this.loadListeningDetail(record);
    }
  },
  stopSpeakingPlayback() {
    this.speakingPlaybackRequestId = Number(this.speakingPlaybackRequestId || 0) + 1;
    const audioContext = this.speakingAudioContext;
    this.speakingAudioContext = null;
    if (audioContext) audioContext.destroy();
    if (this.data && (
      this.data.playingSpeakingRecordId
      || this.data.pausedSpeakingRecordId
      || this.data.loadingSpeakingRecordId
    )) {
      this.setData({
        playingSpeakingRecordId: '',
        pausedSpeakingRecordId: '',
        loadingSpeakingRecordId: ''
      });
    }
  },
  async playSpeakingRecording(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const record = this.findHistoryRecord(recordId);
    if (!record || !record.hasRecording) return;
    if (this.data.playingSpeakingRecordId === recordId && this.speakingAudioContext) {
      if (this.data.pausedSpeakingRecordId === recordId) {
        this.setData({ loadingSpeakingRecordId: recordId });
        this.speakingAudioContext.play();
      } else {
        this.speakingAudioContext.pause();
      }
      return;
    }
    const fileId = String(record.attempt.answerAudioFileId || buildCloudFileId(record.attempt.answerCloudPath)).trim();
    if (!fileId) {
      wx.showToast({ title: text('speakingRecordingUnavailable', '录音暂不可播放'), icon: 'none' });
      return;
    }
    this.stopSpeakingPlayback();
    const requestId = this.speakingPlaybackRequestId;
    this.setData({ loadingSpeakingRecordId: recordId });
    try {
      const src = await store.getTempFileURL(fileId);
      if (this.speakingPlaybackRequestId !== requestId) return;
      if (!src) throw new Error('speaking-history-audio-url-empty');
      const audioContext = wx.createInnerAudioContext();
      const isCurrent = () => (
        this.speakingAudioContext === audioContext
        && this.speakingPlaybackRequestId === requestId
      );
      audioContext.obeyMuteSwitch = false;
      audioContext.onPlay(() => {
        if (!isCurrent()) return;
        this.setData({
          playingSpeakingRecordId: recordId,
          pausedSpeakingRecordId: '',
          loadingSpeakingRecordId: ''
        });
      });
      audioContext.onWaiting(() => {
        if (isCurrent()) this.setData({ loadingSpeakingRecordId: recordId });
      });
      audioContext.onPause(() => {
        if (!isCurrent()) return;
        this.setData({ pausedSpeakingRecordId: recordId, loadingSpeakingRecordId: '' });
      });
      audioContext.onEnded(() => {
        if (isCurrent()) this.stopSpeakingPlayback();
      });
      audioContext.onError(() => {
        if (!isCurrent()) return;
        this.stopSpeakingPlayback();
        wx.showToast({ title: text('speakingRecordingFailed', '录音播放失败，请稍后重试'), icon: 'none' });
      });
      this.speakingAudioContext = audioContext;
      audioContext.src = src;
      audioContext.play();
    } catch (error) {
      if (this.speakingPlaybackRequestId !== requestId) return;
      this.stopSpeakingPlayback();
      wx.showToast({ title: text('speakingRecordingFailed', '录音播放失败，请稍后重试'), icon: 'none' });
    }
  },
  async loadListeningDetail(record) {
    this.updateRecord(record.id, { detailLoading: true });
    const [completionResult, materialResult] = await Promise.all([
      store.getStudyCompletionDetail(record.id),
      store.getMaterialItem({ moduleId: 'listening', itemId: record.targetId })
    ]);
    const completion = completionResult && completionResult.item;
    const rawItem = materialResult && materialResult.item;
    if (!completion || !rawItem) {
      this.updateRecord(record.id, { detailLoading: false });
      return;
    }
    const item = await resolveListeningImages(rawItem);
    let packResult = null;
    try {
      packResult = await store.getListeningStudyPack(item, {
        includeQuestionAnalyses: true,
        useCache: false
      });
    } catch (error) {}
    const studyPack = packResult && packResult.studyPack || {};
    const attempt = completion.latestAttempt || {};
    const results = Array.isArray(attempt.questions) ? attempt.questions : [];
    const analyses = Array.isArray(studyPack.questionAnalyses) ? studyPack.questionAnalyses : [];
    const detailQuestions = (item.questions || []).map((question, index) => {
      const number = question.number === undefined || question.number === null ? index + 1 : question.number;
      const result = results.find((entry) => String(entry.number) === String(number)) || {};
      const analysis = analyses.find((entry) => String(entry.number) === String(number)) || {};
      const selected = result.selectedAnswer || '';
      const answer = question.answer || result.answer || '';
      return {
        number,
        sectionTitle: question.sectionTitle || '',
        groupTitle: question.groupTitle || '',
        groupInstruction: question.groupInstruction || '',
        formTitle: question.formTitle || '',
        givenRows: question.givenRows || [],
        questionImages: [].concat(
          question.sourceImages || [],
          Object.values(question.optionImages || {})
        ),
        prompt: question.prompt || result.prompt || '',
        optionsList: buildOptions(question.options || result.options, selected, answer),
        selected,
        answer,
        correct: result.isCorrect === true
          || (!!selected && String(selected).toLowerCase() === String(answer).toLowerCase()),
        analysis: analysis.analysis || '',
        evidence: analysis.evidence || '',
        evidenceTranslation: analysis.evidenceTranslation || ''
      };
    });
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: true,
      attempt,
      transcript: item.transcript || '',
      sourceImages: item.images || [],
      detailQuestions,
      vocabularyCards: studyPack.vocabularyCards || [],
      phraseCards: studyPack.phraseCards || [],
      sentencePatternCards: studyPack.sentencePatternCards || []
    });
  },
  async loadVocabularyDetail(record) {
    this.updateRecord(record.id, { detailLoading: true });
    const result = await store.getVocabularyDictationAttemptDetail(record.id);
    const attempt = result && result.attempt;
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: !!attempt,
      detailQuestions: (attempt && attempt.questions || []).map((item, index) => ({
        number: index + 1,
        word: item.word || '',
        input: item.input || '',
        meaning: item.meaning || '',
        answer: item.answer || item.word || '',
        phonetic: item.phonetic || '',
        correct: !!item.correct
      }))
    });
  },
  async loadReadingDetail(record) {
    const startedAt = Date.now();
    const attemptId = record.attempt && (record.attempt.attemptId || record.attempt._id) || '';
    this.updateRecord(record.id, { detailLoading: true, aiAnalysisLoading: true, aiAnalysisStatus: '' });
    this.readingDebugTimers = this.readingDebugTimers || {};
    clearTimeout(this.readingDebugTimers[record.id]);
    this.readingDebugTimers[record.id] = setTimeout(() => {
      const latest = this.findHistoryRecord(record.id);
      if (!latest || !latest.detailLoading) return;
      this.setData({
        debugLines: buildReadingAnalysisDebugLines(record, null, 'pending-over-3s', Date.now() - startedAt)
      });
    }, 3000);
    const [result, completionResult, packResult] = await Promise.all([
      store.getReadingPassage({ passageId: record.targetId, attemptId }),
      store.getStudyCompletionDetail(record.id),
      store.getReadingStudyPack({
        passageId: record.targetId,
        section: 'questions',
        cacheOnly: false,
        attemptId,
        useCache: false
      })
    ]);
    clearTimeout(this.readingDebugTimers[record.id]);
    delete this.readingDebugTimers[record.id];
    const passage = result && result.passage;
    const attempt = (completionResult && completionResult.item && completionResult.item.latestAttempt) || record.attempt || {};
    const questionResults = attempt.questionResults || [];
    const attemptAnalyses = (attempt.review && attempt.review.analysis) || [];
    const studyPack = packResult && packResult.studyPack;
    const packAnalyses = (studyPack && (studyPack.questionAnalyses || studyPack.analysis)) || [];
    const sourceQuestions = passage && Array.isArray(passage.questions) && passage.questions.length
      ? passage.questions
      : questionResults;
    const detailQuestions = sourceQuestions.map((question, index) => {
      const number = question.number || index + 1;
      const answerResult = questionResults.find((item) => String(item.number) === String(number)) || {};
      const savedAnalysis = attemptAnalyses.find((item) => String(item.number) === String(number)) || {};
      const cachedAnalysis = packAnalyses.find((item) => String(item.number) === String(number)) || {};
      const selected = answerResult.selected || savedAnalysis.selected || '';
      const answer = answerResult.answer || savedAnalysis.answer || cachedAnalysis.answer || question.answer || '';
      const analysisText = cachedAnalysis.analysis || cachedAnalysis.text || savedAnalysis.text || answerResult.analysis || question.analysis || '';
      return {
        questionId: String(question._id || `${record.targetId}:${number}`),
        number,
        prompt: question.prompt || answerResult.prompt || '',
        options: question.options || {},
        selected,
        answer,
        correct: answerResult.correct === undefined ? savedAnalysis.correct : answerResult.correct,
        optionsList: buildOptions(question.options, selected, answer),
        analysis: isPendingReadingAnalysis(analysisText) ? '' : analysisText
      };
    });
    const analysesReady = detailQuestions.length > 0
      && detailQuestions.every((question) => !isPendingReadingAnalysis(question.analysis));
    const wrongIds = new Set((this.wrongItems || []).map((item) => String(item.questionId || (item.question && item.question._id) || '')));
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: true,
      aiAnalysisLoading: false,
      aiAnalysisLoaded: analysesReady,
      aiAnalysisStatus: analysesReady ? text('analysisLoaded', '逐题解析已加载') : text('noAnalysis', '这篇阅读尚未生成逐题解析'),
      attempt,
      passageText: (passage && passage.passage) || '',
      manualMarkItems: (attempt.manualMarks && Array.isArray(attempt.manualMarks.items) ? attempt.manualMarks.items : []).filter((item) => item && item.text),
      detailQuestions: detailQuestions.map((question) => Object.assign({}, question, {
        inWrongBook: wrongIds.has(question.questionId)
      }))
    });
    if (result && result.syncMode === 'cloud-error') {
      this.setData({ debugLines: buildDebugLines(result, 'getReadingPassage') });
    } else if (completionResult && completionResult.syncMode === 'cloud-error') {
      this.setData({ debugLines: buildDebugLines(completionResult, 'getStudyCompletionDetail') });
    } else if (packResult && packResult.syncMode === 'cloud-error') {
      this.setData({ debugLines: buildDebugLines(packResult, 'getReadingStudyPack') });
    } else if (!analysesReady) {
      this.setData({
        debugLines: buildReadingAnalysisDebugLines(record, packResult, studyPack ? 'cached-pack-incomplete' : 'cache-miss', Date.now() - startedAt)
      });
    } else {
      this.setData({ debugLines: [] });
    }
  },
  async loadGrammarDetail(record) {
    this.updateRecord(record.id, { detailLoading: true });
    const result = await store.getStudyCompletionDetail(record.id);
    if (result && result.syncMode === 'cloud-error') {
      this.updateRecord(record.id, { detailLoading: false });
      this.setData({ debugLines: buildDebugLines(result, 'getStudyCompletionDetail') });
      return;
    }
    const item = result && result.item;
    const questions = (item && item.latestAttempt && item.latestAttempt.questions) || [];
    const wrongIds = new Set((this.wrongItems || []).map((wrongItem) => String(wrongItem.questionId || (wrongItem.question && wrongItem.question._id) || '')));
    const detailQuestions = buildGrammarDetailQuestions(questions, item || record).map((question) => Object.assign({}, question, {
      inWrongBook: wrongIds.has(question.questionId)
    }));
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: true,
      attempt: (item && item.latestAttempt) || record.attempt,
      manualMarkItems: (item && item.latestAttempt && item.latestAttempt.manualMarks && item.latestAttempt.manualMarks.items) || [],
      detailQuestions
    });
    this.resumeGrammarAnalyses(record.id, detailQuestions);
  },
  async resumeGrammarAnalyses(recordId, questions) {
    const pending = (questions || []).filter((question) => !question.analysis && question.questionId);
    if (!pending.length) return;
    pending.forEach((question) => this.updateQuestion(recordId, question.questionId, {
      explaining: true,
      analysisStatus: text('explanationLoading', '正在读取云端讲解……')
    }));
    await Promise.all(pending.map(async (question) => {
      const result = await store.explainGrammarQuestion({
        _id: question.questionId,
        prompt: question.prompt,
        options: question.options || {},
        answer: question.answer || ''
      }, { cacheOnly: false });
      const explanation = result && result.explanation;
      if (explanation && explanation.explanation && String(result.source || '').indexOf('fallback') !== 0) {
        this.updateQuestion(recordId, question.questionId, {
          explaining: false,
          analysisStatus: '',
          analysis: [explanation.explanation, explanation.elimination].filter(Boolean).join('\n')
        });
        return;
      }
      this.updateQuestion(recordId, question.questionId, {
        explaining: false,
        analysisStatus: text('noAnalysis', '这道题尚未生成 AI 讲解')
      });
      if (result && result.syncMode === 'cloud-error') {
        this.setData({ debugLines: buildDebugLines(result, 'explainGrammarQuestion') });
      }
    }));
  },
  async addWrongQuestion(event) {
    if (this.data.isParentView) return;
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const questionId = String(event.currentTarget.dataset.questionId || '');
    const record = this.findHistoryRecord(recordId);
    const question = record && (record.detailQuestions || []).find((item) => item.questionId === questionId);
    if (!record || !question || question.inWrongBook || question.addingWrong) return;
    this.updateQuestion(recordId, questionId, { addingWrong: true });
    const result = await store.addPracticeWrongQuestion({
      type: this.data.type,
      targetId: record.targetId,
      title: record.title,
      meta: record.meta,
      passage: this.data.type === 'reading' ? record.passageText : '',
      questionId,
      question: {
        _id: questionId,
        number: question.number,
        prompt: question.prompt,
        options: question.options || {},
        selectedAnswer: question.selected || '',
        answer: question.answer || '',
        correct: question.correct === true,
        analysis: question.analysis || ''
      }
    });
    if (result && result.saved) {
      this.updateQuestion(recordId, questionId, { addingWrong: false, inWrongBook: true });
      wx.showToast({ title: text('addSuccess', '已加入错题集'), icon: 'success' });
      return;
    }
    this.updateQuestion(recordId, questionId, { addingWrong: false });
    if (result && result.syncMode === 'cloud-error') {
      this.setData({ debugLines: buildDebugLines(result, 'addPracticeWrongQuestion') });
    }
    wx.showToast({ title: result && result.reason === 'preview-role' ? text('previewNoRecord', '家长预览不记录') : text('addFailed', '加入失败'), icon: 'none' });
  },
  async loadReadingCachedAnalysis(event) {
    const recordId = String(event.currentTarget.dataset.id || '');
    const record = this.findHistoryRecord(recordId);
    if (!record || record.aiAnalysisLoading || record.aiAnalysisLoaded) return;
    this.updateRecord(recordId, { aiAnalysisLoading: true, aiAnalysisStatus: '' });
    const result = await store.getReadingStudyPack({
      passageId: record.targetId,
      section: 'questions',
      cacheOnly: false,
      attemptId: record.attempt && (record.attempt.attemptId || record.attempt._id) || '',
      useCache: false
    });
    if (result && result.syncMode === 'cloud-error') {
      this.updateRecord(recordId, { aiAnalysisLoading: false, aiAnalysisStatus: text('analysisFailed', '云端解析加载失败') });
      this.setData({ debugLines: buildDebugLines(result, 'getReadingStudyPack') });
      return;
    }
    const studyPack = result && result.studyPack;
    const analyses = (studyPack && (studyPack.questionAnalyses || studyPack.analysis)) || [];
    if (!analyses.length) {
      this.updateRecord(recordId, {
        aiAnalysisLoading: false,
        aiAnalysisStatus: text('noAnalysis', '这篇阅读尚未生成逐题解析')
      });
      this.setData({
        debugLines: buildReadingAnalysisDebugLines(record, result, result && result.cacheMiss ? 'cache-miss' : 'cached-pack-incomplete', 0)
      });
      return;
    }
    this.updateRecord(recordId, {
      aiAnalysisLoading: false,
      aiAnalysisLoaded: true,
      aiAnalysisStatus: text('analysisLoaded', '逐题解析已加载'),
      detailQuestions: (record.detailQuestions || []).map((question) => {
        const analysis = analyses.find((item) => String(item.number) === String(question.number)) || {};
        const analysisText = analysis.analysis || analysis.text || question.analysis || '';
        return Object.assign({}, question, {
          analysis: isPendingReadingAnalysis(analysisText) ? '' : analysisText
        });
      })
    });
    this.setData({ debugLines: [] });
  },
  async loadWritingDetail(record) {
    this.updateRecord(record.id, { detailLoading: true });
    const result = await store.getWritingAttemptDetail(record.id);
    if (result && result.syncMode === 'cloud-error') {
      this.updateRecord(record.id, { detailLoading: false });
      this.writingResumeTimers = this.writingResumeTimers || {};
      clearTimeout(this.writingResumeTimers[record.id]);
      this.writingResumeTimers[record.id] = setTimeout(() => {
        const latest = this.findHistoryRecord(record.id);
        if (!latest || this.data.expandedId !== record.id) return;
        this.loadWritingDetail(Object.assign({}, latest, { detailLoading: false }));
      }, 5000);
      return;
    }
    if (!result || !result.attempt) {
      this.updateRecord(record.id, { detailLoading: false });
      return;
    }
    const normalized = normalizeWriting(result.attempt, 0);
    const attempt = await resolveWritingPromptImages(normalized.attempt);
    if (!this.historyPageActive) return;
    if (result.resumable) this.startWritingGradeOnce(record.id);
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: true,
      attempt,
      manualMarkItems: normalized.manualMarkItems
    });
    this.setData({ debugLines: [] });
    if (['grading-pending', 'grading', 'grading-failed'].includes(normalized.attempt.status)) {
      this.writingResumeTimers = this.writingResumeTimers || {};
      clearTimeout(this.writingResumeTimers[record.id]);
      this.writingResumeTimers[record.id] = setTimeout(() => {
        const latest = this.findHistoryRecord(record.id);
        if (!latest || this.data.expandedId !== record.id) return;
        this.loadWritingDetail(Object.assign({}, latest, { detailLoading: false }));
      }, 3000);
    }
  },
  previewWritingPromptImage(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const current = String(event.currentTarget.dataset.src || '');
    const record = this.findHistoryRecord(recordId);
    const urls = record && record.attempt && Array.isArray(record.attempt.promptImages)
      ? record.attempt.promptImages.map((image) => image.src).filter(Boolean)
      : [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  },
  async downloadWritingReportPdf(event) {
    const recordId = String(event.currentTarget.dataset.attemptId || '');
    const record = this.findHistoryRecord(recordId);
    if (!record || record.pdfGenerating) return;
    this.updateRecord(recordId, { pdfGenerating: true });
    try {
      const result = await store.generateWritingReportPdf(recordId);
      if (result && result.syncMode === 'cloud-error') {
        throw new Error(result.cloudError && result.cloudError.message || 'writing-report-generate-failed');
      }
      await openWritingReportPdf(result);
    } catch (error) {
      console.error('writing-history-report-pdf-failed', String(error && error.message || error || ''));
      wx.showToast({ title: text('pdfFailedToast', 'PDF 生成失败，请重试'), icon: 'none' });
    } finally {
      this.updateRecord(recordId, { pdfGenerating: false });
    }
  },
  async downloadReadingReportPdf(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const record = this.findHistoryRecord(recordId);
    if (!record || record.pdfGenerating) return;
    this.updateRecord(recordId, { pdfGenerating: true });
    try {
      const result = await store.generateReadingReportPdf({
        completionId: record.id,
        attemptId: record.attempt && (record.attempt._id || record.attempt.attemptId) || '',
        passageId: record.targetId
      });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error(result.cloudError && result.cloudError.message || 'reading-report-generate-failed');
      }
      await openReadingReportPdf(result);
    } catch (error) {
      const message = String(error && error.message || error || '');
      console.error('reading-history-report-pdf-failed', message);
      wx.showToast({
        title: message.includes('study-pack-generating')
          ? text('readingPdfPreparing', '正在补齐学习包，请稍后重试')
          : text('readingPdfFailed', 'PDF 生成失败，请重试'),
        icon: 'none'
      });
    } finally {
      this.updateRecord(recordId, { pdfGenerating: false });
    }
  },
  async downloadListeningReportPdf(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const record = this.findHistoryRecord(recordId);
    if (!record || record.pdfGenerating) return;
    this.updateRecord(recordId, { pdfGenerating: true });
    try {
      const result = await store.generateListeningReportPdf({ completionId: record.id });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error(result.cloudError && result.cloudError.message || 'listening-report-generate-failed');
      }
      await openListeningReportPdf(result);
    } catch (error) {
      const message = String(error && error.message || error || '');
      wx.showToast({
        title: message.includes('generating')
          ? text('listeningPdfPreparing', '正在补齐学习报告，请稍后重试')
          : text('listeningPdfFailed', 'PDF 生成失败，请重试'),
        icon: 'none'
      });
    } finally {
      this.updateRecord(recordId, { pdfGenerating: false });
    }
  },
  async loadGrammarExplanation(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const questionId = String(event.currentTarget.dataset.questionId || '');
    const record = this.findHistoryRecord(recordId);
    const question = record && (record.detailQuestions || []).find((item) => item.questionId === questionId);
    if (!question || question.analysis || question.explaining) return;
    this.updateQuestion(recordId, questionId, { explaining: true });
    const result = await store.explainGrammarQuestion({
      _id: questionId,
      prompt: question.prompt,
      options: question.options || {},
      answer: question.answer || ''
    }, { cacheOnly: false });
    const explanation = result && result.explanation;
    if (explanation && explanation.explanation) {
      this.updateQuestion(recordId, questionId, {
        explaining: false,
        analysis: [explanation.explanation, explanation.elimination].filter(Boolean).join('\n')
      });
      return;
    }
    this.updateQuestion(recordId, questionId, {
      explaining: false,
      analysisStatus: result && result.cacheMiss ? text('noAnalysis', '这道题尚未生成 AI 讲解') : ''
    });
    if (result && result.syncMode === 'cloud-error') {
      this.setData({ debugLines: buildDebugLines(result, 'explainGrammarQuestion') });
    }
    if (!(result && result.cacheMiss)) {
      wx.showToast({ title: text('explanationFailed', '讲解加载失败'), icon: 'none' });
    }
  },
  updateQuestion(recordId, questionId, patch) {
    const update = (records) => (records || []).map((record) => (
      record.id !== recordId ? record : Object.assign({}, record, {
        detailQuestions: (record.detailQuestions || []).map((question) => (
          question.questionId === questionId ? Object.assign({}, question, patch) : question
        ))
      })
    ));
    this.allHistoryRecords = update(this.allHistoryRecords);
    this.setData({
      records: update(this.data.records)
    });
  },
  updateRecord(id, patch) {
    const update = (records) => (records || []).map((item) => (
      item.id === id ? Object.assign({}, item, patch) : item
    ));
    this.allHistoryRecords = update(this.allHistoryRecords);
    this.setData({
      records: update(this.data.records)
    });
  }
});
