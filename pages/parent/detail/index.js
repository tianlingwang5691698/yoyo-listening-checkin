const store = require('../../../utils/store');
const page = require('../../../utils/page');
const labels = require('../../../utils/labels');
const appConfig = require('../../../data/app-config');
const snapshotStore = require('../../../utils/snapshot');
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LESSON_STUDY_PACK_SNAPSHOT_KEY = 'lessonStudyPackSnapshotV1';

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

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

function getCompletionTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return '阅读';
  if (type === 'listening' || type === 'listening-study') return '听力';
  if (type === 'grammar') return '语法';
  if (type === 'writing') return '写作';
  return '完成';
}

function isListeningStudyCompletion(item) {
  const source = item || {};
  const id = String(source.id || source.recordId || '').trim();
  return source.type === 'listening-study'
    || id.indexOf('listening-study:') === 0
    || source.title === '听力学习包';
}

function parseListeningStudyTarget(item) {
  const source = item || {};
  const rawId = String(source.id || source.recordId || '').replace(/^listening-study:/, '');
  const targetId = String(source.targetId || rawId || '').trim();
  const parts = targetId.split(':').filter(Boolean);
  return {
    category: source.category || parts[0] || '',
    taskId: source.taskId || parts[1] || ''
  };
}

function writeListeningStudySnapshot(item) {
  const source = item || {};
  const category = String(source.category || '').trim();
  const taskId = String(source.taskId || '').trim();
  if (!category || !taskId) return false;
  const task = Object.assign({}, source.taskSnapshot || {}, {
    category,
    taskId,
    title: source.meta || source.title || source.targetId || '听力课程',
    displayTitle: source.meta || source.title || source.targetId || '听力课程',
    audioTitle: source.meta || source.title || source.targetId || '听力课程',
    completedToday: true,
    playCount: 1,
    repeatTarget: 1,
    currentPass: 1,
    textUnlocked: true,
    transcriptVisible: true
  });
  return snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
    category,
    taskId,
    task
  }, { source: 'parent-detail-listening-study' });
}

function hasStudyPackCards(studyPack) {
  return studyPack
    && ((studyPack.vocabularyCards || []).length
      || (studyPack.phraseCards || []).length
      || (studyPack.sentencePatternCards || []).length);
}

function getListeningStudyCacheIds(item) {
  const source = item || {};
  const ids = [
    source.category && source.taskId ? `lesson-${source.category}-${source.taskId}` : '',
    source.targetId,
    String(source.id || source.recordId || '').replace(/^listening-study:/, '')
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

async function writeListeningStudyPackSnapshot(item) {
  const source = item || {};
  const category = String(source.category || '').trim();
  const taskId = String(source.taskId || '').trim();
  if (!category || !taskId) return false;
  const cacheIds = getListeningStudyCacheIds(source);
  for (let index = 0; index < cacheIds.length; index += 1) {
    const cacheId = cacheIds[index];
    try {
      const result = await store.getListeningStudyPack({
        _id: cacheId,
        id: cacheId,
        title: source.meta || source.title || source.targetId || '听力课程'
      }, { cacheOnly: true, useCache: false });
      const studyPack = result && result.studyPack;
      if (hasStudyPackCards(studyPack)) {
        return snapshotStore.write(LESSON_STUDY_PACK_SNAPSHOT_KEY, `${category}:${taskId}`, {
          studyPack,
          listeningId: cacheId
        }, { source: 'parent-detail-listening-study-pack' });
      }
    } catch (error) {}
  }
  return false;
}

function normalizePhraseCards(cards) {
  return (cards || []).map((card, index) => ({
    key: card.id || card.phrase || card.text || `phrase-${index}`,
    phrase: card.phrase || card.text || '',
    meaning: card.meaning || card.translation || '',
    example: card.example || '',
    exampleMeaning: card.exampleMeaning || card.exampleTranslation || ''
  }));
}

function isPlaceholderAnalysis(value) {
  return !String(value || '').trim() || String(value || '').includes('生成解析中');
}

function mergeStudyPackIntoAttempt(attempt, studyPack) {
  const nextAttempt = Object.assign({}, attempt || {});
  const review = Object.assign({}, nextAttempt.review || {});
  const pack = studyPack || {};
  const analyses = pack.questionAnalyses || pack.analysis || [];
  const answerSentenceByNumber = analyses.reduce((map, item) => {
    if (item && item.number !== undefined && item.answerSentence) {
      map[String(item.number)] = {
        number: item.number,
        text: item.answerSentence,
        translation: item.answerSentenceTranslation || ''
      };
    }
    return map;
  }, {});
  const analysisByNumber = analyses.reduce((map, item) => {
    if (item && item.number !== undefined && item.number !== null) {
      map[String(item.number)] = item;
    }
    return map;
  }, {});
  const currentAnalysis = Array.isArray(review.analysis) ? review.analysis : [];
  review.analysis = currentAnalysis.length ? currentAnalysis.map((item) => {
    const model = analysisByNumber[String(item.number)] || {};
    return Object.assign({}, item, {
      answer: item.answer || model.answer || '',
      answerSentence: answerSentenceByNumber[String(item.number)] || item.answerSentence || null,
      text: isPlaceholderAnalysis(item.text || item.analysis || item.explanation) && model.analysis ? model.analysis : (item.text || item.analysis || item.explanation || '')
    });
  }) : analyses.map((item) => ({
    number: item.number,
    answer: item.answer || '',
    selected: item.selected || '',
    correct: item.correct,
    answerSentence: answerSentenceByNumber[String(item.number)] || null,
    text: item.analysis || ''
  }));
  review.phraseCards = pack.phraseCards || review.phraseCards || [];
  review.vocabularyCards = pack.vocabularyCards || review.vocabularyCards || [];
  review.sentencePatternCards = pack.sentencePatternCards || review.sentencePatternCards || [];
  nextAttempt.review = review;
  return nextAttempt;
}

function normalizeCompletionItem(item, index) {
  const safeItem = item || {};
  const isListeningStudyPack = isListeningStudyCompletion(safeItem);
  const listeningTarget = isListeningStudyPack ? parseListeningStudyTarget(safeItem) : {};
  const latestAttempt = safeItem.latestAttempt || {};
  const review = latestAttempt.review || {};
  const questionResults = Array.isArray(latestAttempt.questionResults) ? latestAttempt.questionResults : [];
  const correctCount = Number(latestAttempt.correctCount || 0);
  const totalCount = Number(latestAttempt.totalCount || questionResults.length || 0);
  const score = Number(latestAttempt.score || review.score || 0);
  const totalScore = Number(latestAttempt.totalScore || review.totalScore || 0);
  const reviewProblems = Array.isArray(review.problems) ? review.problems : [];
  const reviewSuggestions = Array.isArray(review.suggestions) ? review.suggestions : [];
  const grammarQuestions = Array.isArray(latestAttempt.questions) ? latestAttempt.questions : [];
  const passage = latestAttempt.passage || null;
  const phraseCards = normalizePhraseCards(review.phraseCards || review.phrases || []);
  const readingAnalysisByNumber = (Array.isArray(review.analysis) ? review.analysis : []).reduce((map, analysis) => {
    if (analysis && analysis.number !== undefined && analysis.number !== null) {
      map[String(analysis.number)] = analysis;
    }
    return map;
  }, {});
  const readingResultByNumber = questionResults.reduce((map, result) => {
    if (result && result.number !== undefined && result.number !== null) {
      map[String(result.number)] = result;
    }
    return map;
  }, {});
  const passageQuestions = passage && Array.isArray(passage.questions) ? passage.questions : [];
  const readingQuestions = (passageQuestions.length ? passageQuestions : questionResults).map((question, questionIndex) => {
    const number = question.number || questionIndex + 1;
    const result = readingResultByNumber[String(number)] || {};
    const analysis = readingAnalysisByNumber[String(number)] || result || {};
    return {
      key: `${safeItem.id || safeItem.recordId || index}-reading-${number}`,
      number,
      prompt: question.prompt || result.prompt || '',
      optionsList: Object.keys(question.options || {}).map((key) => ({
        key,
        text: question.options[key]
      })),
      selectedAnswer: result.selected || result.userAnswer || '',
      answer: result.answer || question.answer || '',
      correct: result.correct,
      analysis: analysis.text || analysis.analysis || analysis.explanation || '',
      answerSentence: analysis.answerSentence || null
    };
  });
  return Object.assign({}, safeItem, {
    key: safeItem.id || safeItem.recordId || `${safeItem.type || 'item'}-${index}`,
    typeLabel: getCompletionTypeLabel(safeItem.type),
    isListeningStudyPack,
    category: safeItem.category || listeningTarget.category || '',
    taskId: safeItem.taskId || listeningTarget.taskId || '',
    title: safeItem.title || safeItem.meta || '完成记录',
    meta: safeItem.meta || '',
    progressText: safeItem.progressText || (totalScore ? `${score}/${totalScore} 分` : '完成'),
    detailActionText: isListeningStudyPack ? '查看学习包' : '查看原题和分析',
    scoreText: totalScore ? `${score}/${totalScore} 分` : '',
    correctText: totalCount ? `${correctCount}/${totalCount} 题` : '',
    reviewSummary: review.summary || review.feedback || '',
    reviewContent: review.content || '',
    reviewLanguage: review.language || '',
    reviewStructure: review.structure || '',
    reviewSpelling: review.spelling || '',
    reviewProblems,
    reviewProblemsText: reviewProblems.join('；'),
    reviewSuggestions,
    reviewSuggestionsText: reviewSuggestions.join('；'),
    phraseCards,
    grammarCorrections: Array.isArray(review.grammarCorrections) ? review.grammarCorrections : [],
    polishedVersion: review.polishedVersion || '',
    passage,
    writingPrompt: latestAttempt.prompt || safeItem.prompt || null,
    essay: latestAttempt.essay || '',
    readingQuestions,
    grammarQuestions: grammarQuestions.map((question, questionIndex) => ({
      key: question._id || `${safeItem.id || index}-${questionIndex}`,
      number: question.number || questionIndex + 1,
      prompt: question.prompt || '',
      optionsList: Object.keys(question.options || {}).map((key) => ({
        key,
        text: question.options[key]
      })),
      selectedAnswer: question.selectedAnswer || '',
      answer: question.answer || '',
      isCorrect: !!question.isCorrect,
      explanation: question.explanation || null
    })),
    questionResults: questionResults.slice(0, 8).map((result, resultIndex) => ({
      key: `${safeItem.id || safeItem.recordId || index}-${resultIndex}`,
      number: result.number || resultIndex + 1,
      correct: !!result.correct,
      answer: result.answer || '',
      userAnswer: result.userAnswer || '',
      analysis: result.analysis || result.explanation || '',
      answerSentence: result.answerSentence || null
    }))
  });
}

async function hydrateReadingItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (item.type !== 'reading' || item.passage || !item.passageId) {
      return item;
    }
    try {
      const [passageData, packData] = await Promise.all([
        store.getReadingPassage({ passageId: item.passageId }),
        store.getReadingStudyPack({ passageId: item.passageId, section: 'questions', useCache: false })
      ]);
      const baseAttempt = item.latestAttempt || (passageData && passageData.latestAttempt) || {};
      const latestAttempt = packData && packData.studyPack
        ? mergeStudyPackIntoAttempt(baseAttempt, packData.studyPack)
        : baseAttempt;
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, latestAttempt, {
          passage: (passageData && passageData.passage) || null
        })
      }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

async function hydrateReadingStudyItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (item.type !== 'reading-study' || item.phraseCards && item.phraseCards.length || !item.passageId) {
      return item;
    }
    try {
      const section = item.section || 'phrases';
      const data = await store.getReadingStudyPack({ passageId: item.passageId, section, useCache: false });
      const latestAttempt = mergeStudyPackIntoAttempt(item.latestAttempt || {}, data.studyPack || {});
      return normalizeCompletionItem(Object.assign({}, item, { latestAttempt }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

async function hydrateGrammarItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (item.type !== 'grammar' || (item.grammarQuestions && item.grammarQuestions.length) || !item.topicId) {
      return item;
    }
    try {
      const data = await store.getGrammarTopic(item.topicId);
      const count = Number((item.latestAttempt && item.latestAttempt.answeredCount) || 3);
      const questions = (data.questions || []).slice(0, count).map((question, index) => ({
        _id: question._id || '',
        number: question.number || index + 1,
        prompt: question.prompt || '',
        options: question.options || {},
        selectedAnswer: '',
        answer: question.answer || '',
        isCorrect: false,
        explanation: null
      }));
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, item.latestAttempt || {}, {
          questions,
          totalCount: data.questions ? data.questions.length : 0
        })
      }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

function findWritingPrompt(materialIndex, promptId) {
  const all = [].concat((materialIndex || {}).writingEm2 || [], (materialIndex || {}).writingEm1 || []);
  return all.find((item) => item && item._id === promptId) || null;
}

async function hydrateWritingItems(items) {
  const needsPrompt = (items || []).some((item) => item.type === 'writing' && !item.writingPrompt && item.targetId);
  if (!needsPrompt) {
    return items;
  }
  try {
    const materialIndex = await store.getMaterialIndex({ moduleId: 'writing' });
    return (items || []).map((item) => {
      if (item.type !== 'writing' || item.writingPrompt || !item.targetId) {
        return item;
      }
      const prompt = findWritingPrompt(materialIndex, item.targetId);
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, item.latestAttempt || {}, { prompt })
      }), 0);
    });
  } catch (error) {
    return items;
  }
}

function needsCompletionHydration(item) {
  if (!item) return false;
  if (item.type === 'reading' && !item.passage && item.passageId) return true;
  if (item.type === 'reading-study' && !(item.phraseCards && item.phraseCards.length) && item.passageId) return true;
  if (item.type === 'grammar' && !(item.grammarQuestions && item.grammarQuestions.length) && item.topicId) return true;
  if (item.type === 'writing' && !item.writingPrompt && item.targetId) return true;
  return false;
}

async function hydrateCompletionItem(item) {
  const items = await hydrateWritingItems(await hydrateGrammarItems(await hydrateReadingStudyItems(await hydrateReadingItems([item]))));
  return items[0] || item;
}

function normalizeReport(report) {
  const safeReport = report || {};
  const items = (safeReport.items || []).map((item) => Object.assign({}, labels.normalizeReportItem(item), {
    timeLines: buildTimeLines(item)
  }));
  const speakingAttempts = (safeReport.speakingAttempts || []).map(normalizeSpeakingAttempt);
  const speakingSummary = buildSpeakingSummary(speakingAttempts);
  const completedCount = items.filter((item) => item.completedToday).length;
  const completionItems = (safeReport.completionItems || []).map(normalizeCompletionItem);
  return {
    date: safeReport.date || '',
    dateLabel: formatDateLabel(safeReport.date),
    totalMinutes: safeReport.totalMinutes || 0,
    completedCount: completedCount + completionItems.length,
    totalCount: items.length + completionItems.length,
    items,
    speakingAttempts,
    speakingSummary,
    completionItems
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
      },
      completionItems: []
    },
    playingAttemptKey: '',
    pausedAttemptKey: '',
    loadingAttemptKey: '',
    completionItemsLoaded: false,
    completionItemsLoading: false
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
    store.getDailyReportByDate(this.data.date).then((reportData) => {
      const report = normalizeReport(reportData.report);
      const currentCompletionItems = this.data.report.completionItems || [];
      const completionItems = report.completionItems.length ? report.completionItems : currentCompletionItems;
      this.setData(page.buildCloudPageData(this.data, {
        date: this.data.date,
        report: Object.assign({}, report, {
          completionItems
        }),
        completionItemsLoaded: this.data.completionItemsLoaded || report.completionItems.length > 0
      }));
    }).catch(() => {});
  },
  async loadCompletionItems() {
    if (this.data.completionItemsLoading) {
      return;
    }
    this.setData({ completionItemsLoading: true });
    const applyCompletionItems = (items) => {
      const report = this.data.report || {};
      this.setData(page.buildCloudPageData(this.data, {
        completionItemsLoaded: true,
        completionItemsLoading: false,
        report: Object.assign({}, report, {
          completionItems: (items || []).map(normalizeCompletionItem)
        })
      }));
    };
    try {
      const data = await store.getStudyCompletions({ date: this.data.date }, (fresh) => applyCompletionItems(fresh.items || []));
      applyCompletionItems((data && data.items) || []);
    } catch (error) {
      this.setData({ completionItemsLoading: false });
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    }
  },
  async toggleCompletionDetail(event) {
    const key = event.currentTarget.dataset.key || '';
    if (!key) return;
    const current = (this.data.report.completionItems || []).find((item) => item.key === key);
    if (current && current.isListeningStudyPack) {
      if (!current.category || !current.taskId) {
        wx.showToast({ title: '学习包缺少任务定位', icon: 'none' });
        return;
      }
      writeListeningStudySnapshot(current);
      await writeListeningStudyPackSnapshot(current);
      wx.navigateTo({
        url: `/pages/lesson/index?category=${encodeURIComponent(current.category)}&taskId=${encodeURIComponent(current.taskId)}&focus=study&studyPackDone=1&targetDate=${encodeURIComponent(this.data.date || '')}`
      });
      return;
    }
    const willExpand = current ? !current.expanded : false;
    const shouldHydrate = willExpand && needsCompletionHydration(current);
    const items = (this.data.report.completionItems || []).map((item) => Object.assign({}, item, {
      expanded: item.key === key ? willExpand : item.expanded,
      detailLoading: item.key === key ? shouldHydrate : false
    }));
    this.setData({
      report: Object.assign({}, this.data.report, { completionItems: items })
    });
    if (!shouldHydrate) return;
    const hydrated = Object.assign({}, await hydrateCompletionItem(current), {
      expanded: true,
      detailLoading: false
    });
    const latest = (this.data.report.completionItems || []).find((item) => item.key === key);
    if (!latest || !latest.expanded) return;
    this.setData({
      report: Object.assign({}, this.data.report, {
        completionItems: (this.data.report.completionItems || []).map((item) => (
          item.key === key ? hydrated : item
        ))
      })
    });
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
    const fileId = String(attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath)).trim();
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
