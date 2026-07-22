const page = require('../../utils/page');
const store = require('../../utils/store');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('practiceHistory', key, undefined, fallback);

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

const MODULES = {
  reading: {
    title: text('readingTitle', '阅读记录'),
    eyebrow: text('readingEyebrow', '中考阅读'),
    copy: text('readingCopy', '回看做过的文章和逐题解析。'),
    empty: text('noReading', '还没有阅读记录')
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

function normalizeReading(item, index) {
  const attempt = item.latestAttempt || {};
  const correctCount = Number(attempt.correctCount || 0);
  const totalCount = Number(attempt.totalCount || (attempt.questionResults || []).length || 0);
  return {
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
    detailQuestions: [],
    aiAnalysisLoaded: false,
    aiAnalysisLoading: false,
    aiAnalysisStatus: ''
  };
}

function normalizeGrammar(item, index) {
  const attempt = item.latestAttempt || {};
  const isMicroLesson = item.section === 'micro-lesson';
  const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
  const correctCount = questions.length
    ? questions.filter((question) => question.isCorrect).length
    : Number(attempt.correctCount || 0);
  return {
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
    detailQuestions: buildGrammarDetailQuestions(questions, item)
  };
}

function normalizeVocabulary(item, index) {
  const totalCount = Number(item.totalCount || 0);
  const correctCount = Number(item.correctCount || 0);
  return {
    id: String(item.recordId || item.id || `vocabulary-${index}`),
    title: item.sourceTitle || text('vocabularyTitle', '词汇听写'),
    meta: vocabularyModeLabel(item.practiceMode),
    durationText: formatDuration(item.durationSec),
    dateLabel: cleanDate(item.date, item.updatedAt),
    summary: `${correctCount}/${totalCount}${text('wordUnit', ' 词')}`,
    attempt: item,
    detailReady: false,
    detailLoading: false,
    detailQuestions: []
  };
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
  const pending = attempt.status === 'grading-pending' || attempt.status === 'grading';
  return {
    id: String(attempt.attemptId || `writing-${index}`),
    targetId: String(attempt.promptId || ''),
    title: attempt.title || '写作练习',
    meta: [attempt.promptMeta && attempt.promptMeta.year, attempt.promptMeta && attempt.promptMeta.district, attempt.promptMeta && attempt.promptMeta.examType].filter(Boolean).join(' · ') || text('writingEyebrow', '写作'),
    dateLabel: cleanDate(attempt.date, attempt.createdAt),
    summary: pending ? text('grading', '批改中') : `${Number(attempt.score || review.score || 0)}/${totalScore}`,
    attempt: Object.assign({}, attempt, {
      review: Object.assign({
        problems: [],
        suggestions: [],
        grammarCorrections: []
      }, review)
    }),
    detailReady: false,
    detailLoading: false
  };
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
    debugLines: []
  }),
  onLoad(options) {
    this.historyPerf = page.startPagePerf('practice-history');
    const type = MODULES[options && options.type] ? options.type : 'reading';
    const config = MODULES[type];
    this.setData({ type, config });
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
    const type = this.data.type;
    const config = type === 'grammar'
      ? { title: text('grammarTitle'), eyebrow: text('grammarEyebrow'), copy: text('grammarCopy'), empty: text('noGrammar') }
      : type === 'writing'
        ? { title: text('writingTitle'), eyebrow: text('writingEyebrow'), copy: text('writingCopy'), empty: text('noWriting') }
        : type === 'vocabulary'
          ? { title: text('vocabularyTitle'), eyebrow: text('vocabularyEyebrow'), copy: text('vocabularyCopy'), empty: text('noVocabulary') }
        : { title: text('readingTitle'), eyebrow: text('readingEyebrow'), copy: text('readingCopy'), empty: text('noReading') };
    this.setData({ config });
  },
  onUnload() {
    Object.keys(this.readingDebugTimers || {}).forEach((key) => clearTimeout(this.readingDebugTimers[key]));
    this.readingDebugTimers = {};
    Object.keys(this.writingResumeTimers || {}).forEach((key) => clearTimeout(this.writingResumeTimers[key]));
    this.writingResumeTimers = {};
  },
  async loadHistory() {
    this.setData({ loading: true, debugLines: [] });
    if (!page.requireIdentityConfirmed()) {
      this.setData({ loading: false });
      return;
    }
    if (this.data.type === 'writing') {
      const result = await store.getWritingAttempts({ limit: 50, summaryOnly: true });
      const debugLines = buildDebugLines(result, 'getWritingAttempts');
      this.setData({
        loading: false,
        records: debugLines.length ? [] : (result.attempts || []).map(normalizeWriting),
        debugLines
      });
      if (this.historyPerf) {
        this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
      }
      return;
    }
    if (this.data.type === 'vocabulary') {
      const result = await store.getVocabularyDictationHistory();
      const debugLines = buildDebugLines(result, 'getVocabularyDictationHistory');
      this.setData({ loading: false, records: debugLines.length ? [] : (result.attempts || []).map(normalizeVocabulary), debugLines });
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
    this.setData({
      loading: false,
      records: debugLines.length
        ? []
        : applyWrongStatus((result.items || []).filter((item) => item.type === this.data.type).map(normalize), this.wrongItems),
      debugLines
    });
    if (this.historyPerf) {
      this.historyPerf.mark('cloudRefresh', { type: this.data.type, records: (this.data.records || []).length });
    }
  },
  openHistory() {
    if (this.data.viewMode === 'history') return;
    this.setData({ viewMode: 'history', expandedId: '' });
    this.loadHistory();
  },
  async openWrongBook() {
    if (this.data.type === 'writing' || this.data.viewMode === 'wrong') return;
    this.setData({ viewMode: 'wrong', loading: true, expandedId: '', debugLines: [] });
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
      return;
    }
    this.setData({ expandedId: id });
    const record = (this.data.records || []).find((item) => item.id === id);
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
      const latest = (this.data.records || []).find((item) => item.id === record.id);
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
      aiAnalysisStatus: analysesReady ? text('analysisLoaded', '已从云端加载 AI 解析') : text('noAnalysis', '这篇阅读尚未生成 AI 解析'),
      passageText: (passage && passage.passage) || '',
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
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const questionId = String(event.currentTarget.dataset.questionId || '');
    const record = (this.data.records || []).find((item) => item.id === recordId);
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
    const record = (this.data.records || []).find((item) => item.id === recordId);
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
        aiAnalysisStatus: text('noAnalysis', '这篇阅读尚未生成 AI 解析')
      });
      this.setData({
        debugLines: buildReadingAnalysisDebugLines(record, result, result && result.cacheMiss ? 'cache-miss' : 'cached-pack-incomplete', 0)
      });
      return;
    }
    this.updateRecord(recordId, {
      aiAnalysisLoading: false,
      aiAnalysisLoaded: true,
      aiAnalysisStatus: text('analysisLoaded', '已从云端加载 AI 解析'),
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
      this.setData({ debugLines: buildDebugLines(result, 'getWritingAttemptDetail') });
      return;
    }
    if (!result || !result.attempt) {
      this.updateRecord(record.id, { detailLoading: false });
      return;
    }
    const normalized = normalizeWriting(result.attempt, 0);
    this.updateRecord(record.id, {
      detailLoading: false,
      detailReady: true,
      attempt: normalized.attempt
    });
    if (['grading-pending', 'grading', 'grading-failed'].includes(normalized.attempt.status)) {
      this.writingResumeTimers = this.writingResumeTimers || {};
      clearTimeout(this.writingResumeTimers[record.id]);
      this.writingResumeTimers[record.id] = setTimeout(() => {
        const latest = (this.data.records || []).find((item) => item.id === record.id);
        if (!latest || this.data.expandedId !== record.id) return;
        this.loadWritingDetail(Object.assign({}, latest, { detailLoading: false }));
      }, 3000);
    }
  },
  async loadGrammarExplanation(event) {
    const recordId = String(event.currentTarget.dataset.recordId || '');
    const questionId = String(event.currentTarget.dataset.questionId || '');
    const record = (this.data.records || []).find((item) => item.id === recordId);
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
    this.setData({
      records: (this.data.records || []).map((record) => (
        record.id !== recordId ? record : Object.assign({}, record, {
          detailQuestions: (record.detailQuestions || []).map((question) => (
            question.questionId === questionId ? Object.assign({}, question, patch) : question
          ))
        })
      ))
    });
  },
  updateRecord(id, patch) {
    this.setData({
      records: (this.data.records || []).map((item) => (
        item.id === id ? Object.assign({}, item, patch) : item
      ))
    });
  }
});
