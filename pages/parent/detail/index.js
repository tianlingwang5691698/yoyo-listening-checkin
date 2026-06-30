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

function getCompletionTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return '阅读';
  if (type === 'grammar') return '语法';
  if (type === 'writing') return '写作';
  return '完成';
}

function normalizeCompletionItem(item, index) {
  const safeItem = item || {};
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
    title: safeItem.title || safeItem.meta || '完成记录',
    meta: safeItem.meta || '',
    progressText: safeItem.progressText || (totalScore ? `${score}/${totalScore} 分` : '完成'),
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
    grammarCorrections: Array.isArray(review.grammarCorrections) ? review.grammarCorrections : [],
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
      const data = await store.getReadingPassage({ passageId: item.passageId });
      const latestAttempt = data.latestAttempt || item.latestAttempt || {};
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, latestAttempt, {
          passage: data.passage || null
        })
      }), 0);
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
    const materialIndex = await store.getMaterialIndex();
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
    speakingSummary,
    completionItems: []
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
    Promise.all([
      store.getDailyReportByDate(this.data.date),
      store.getStudyCompletions({ date: this.data.date })
    ]).then(([reportData, completionData]) => {
      const report = normalizeReport(reportData.report);
      const completionItems = ((completionData && completionData.items) || []).map(normalizeCompletionItem);
      this.setData(page.buildCloudPageData(this.data, {
        date: this.data.date,
        report: Object.assign({}, report, { completionItems })
      }));
      hydrateReadingItems(completionItems).then(hydrateGrammarItems).then(hydrateWritingItems).then((items) => {
        this.setData({
          report: Object.assign({}, this.data.report, { completionItems: items })
        });
      });
    }).catch(() => {});
  },
  toggleCompletionDetail(event) {
    const key = event.currentTarget.dataset.key || '';
    if (!key) return;
    const items = (this.data.report.completionItems || []).map((item) => Object.assign({}, item, {
      expanded: item.key === key ? !item.expanded : item.expanded
    }));
    this.setData({
      report: Object.assign({}, this.data.report, { completionItems: items })
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
