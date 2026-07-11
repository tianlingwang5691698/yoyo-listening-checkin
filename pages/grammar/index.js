const page = require('../../utils/page');
const store = require('../../utils/store');
const completed = require('../../utils/completed');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('grammar', key, undefined, fallback);

const GRAMMAR_TOPIC_SNAPSHOT_KEY = 'grammarTopicSnapshotV1';
const GRAMMAR_HOME_SNAPSHOT_KEY = 'grammarHomeSnapshotV1';
const GRAMMAR_HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function canUseDictionaryVoice(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 60 || /[.!?;:]/.test(value)) return false;
  const words = value.split(' ').filter(Boolean);
  return words.length >= 1
    && words.length <= 6
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

function buildDictionaryVoiceUrl(text) {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

function buildTopics(grammarData) {
  const source = grammarData || {};
  const questionsByTopic = (source.byTopic || []).reduce((map, group) => {
    map[group.topicId] = group.questions || [];
    return map;
  }, {});
  return (source.topicTypes || []).map((topic) => ({
    topicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: (topic.children || []).map((child) => ({
      topicId: child.topicId,
      topic: child.topic,
      count: child.count,
      questions: questionsByTopic[child.topicId] || []
    })),
    questions: questionsByTopic[topic.topicId] || []
  }));
}

function buildWrongTopics(wrongData) {
  return ((wrongData && wrongData.topicTypes) || []).map((topic) => ({
    topicId: `wrong:${topic.topicId}`,
    sourceTopicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: (topic.children || []).map((child) => ({
      topicId: `wrong:${child.topicId}`,
      sourceTopicId: child.topicId,
      topic: child.topic,
      count: child.count,
      questions: child.questions || []
    }))
  }));
}

function buildExams(em2Topics, em1Topics) {
  em2Topics = em2Topics || [];
  em1Topics = em1Topics || [];
  const em2Count = em2Topics.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const em1Count = em1Topics.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return [
    {
      examId: 'em2',
      exam: text('em2', '二模'),
      count: em2Count,
      topics: em2Topics
    },
    {
      examId: 'em1',
      exam: text('em1', '一模'),
      count: em1Count,
      topics: em1Topics
    }
  ];
}

function buildStages(em2Topics, em1Topics) {
  em2Topics = em2Topics || [];
  em1Topics = em1Topics || [];
  const juniorCount = em2Topics.concat(em1Topics).reduce((sum, item) => sum + Number(item.count || 0), 0);
  return [
    {
      stageId: 'junior',
      stage: text('junior', '初中'),
      count: juniorCount,
      exams: buildExams(em2Topics, em1Topics)
    },
    {
      stageId: 'senior',
      stage: text('senior', '高中'),
      count: 0,
      exams: []
    }
  ];
}

function buildQuestion(item, index) {
  const answer = String(item.answer || '').trim().toUpperCase();
  const optionsList = ['A', 'B', 'C', 'D'].filter((key) => item.options && item.options[key]).map((key) => ({
    key,
    text: item.options[key],
    tokens: tokenizeText(item.options[key]),
    selected: false,
    correct: false,
    wrong: false
  }));
  return Object.assign({}, item, {
    answer,
    sequenceNumber: Number(index || 0) + 1,
    promptTokens: tokenizeText(item.prompt || ''),
    selectedAnswer: '',
    isAnswered: false,
    isCorrect: false,
    explaining: false,
    explanationError: '',
    explanation: null,
    optionsList
  });
}

function tokenizeText(text) {
  return String(text || '').split(/([A-Za-z][A-Za-z'-]*)/g).filter((part) => part !== '').map((part, index) => ({
    id: index,
    text: part,
    word: /^[A-Za-z][A-Za-z'-]*$/.test(part) ? part : ''
  }));
}

function serializeAnsweredQuestions(questions) {
  return (questions || []).filter((question) => question.isAnswered).map((question) => ({
    _id: question._id || '',
    number: question.sequenceNumber || question.number || 0,
    selectedAnswer: question.selectedAnswer || '',
    answer: question.answer || '',
    isCorrect: !!question.isCorrect,
    explanation: question.explanation || null
  }));
}

function restoreAnsweredQuestions(questions, savedQuestions) {
  const savedById = (savedQuestions || []).reduce((map, question) => {
    const key = String(question && question._id || '');
    if (key) map[key] = question;
    return map;
  }, {});
  return (questions || []).map((question) => {
    const saved = savedById[String(question._id || '')];
    if (!saved) return question;
    const selectedAnswer = String(saved.selectedAnswer || '').toUpperCase();
    const answer = String(saved.answer || question.answer || '').toUpperCase();
    return Object.assign({}, question, {
      selectedAnswer,
      answer,
      isAnswered: true,
      isCorrect: saved.isCorrect === true || (!!selectedAnswer && selectedAnswer === answer),
      explanation: saved.explanation || null,
      optionsList: (question.optionsList || []).map((entry) => Object.assign({}, entry, {
        selected: entry.key === selectedAnswer,
        correct: entry.key === answer,
        wrong: entry.key === selectedAnswer && selectedAnswer !== answer
      }))
    });
  });
}

function recordGrammarCompleted(state, answeredCount) {
  const topic = state.selectedTopic || state.selectedCategory || state.selectedExam || {};
  const topicId = state.selectedTopicId || state.selectedCategoryId || state.selectedExamId || '';
  if (!topicId) return;
  const answeredQuestions = (state.selectedQuestions || []).filter((question) => question.isAnswered).map((question) => ({
    _id: question._id || '',
    number: question.sequenceNumber || question.number || 0,
    prompt: question.prompt || question.question || '',
    options: question.options || {},
    selectedAnswer: question.selectedAnswer || '',
    answer: question.answer || '',
    isCorrect: !!question.isCorrect,
    explanation: question.explanation || null
  }));
  const item = {
    id: `grammar:${state.selectedExamId || 'grammar'}:${topicId}`,
    type: 'grammar',
    targetId: topicId,
    title: `${text('navTitle', '语法')}: ${topic.topic || topic.exam || text('topics', '练习')}`,
    meta: state.selectedExam ? state.selectedExam.exam : text('navTitle', '语法'),
    topicId,
    progressText: `${answeredCount || 1}${text('questionUnit', ' 题')}`,
    latestAttempt: {
      answeredCount: answeredCount || answeredQuestions.length,
      totalCount: (state.selectedQuestions || []).length,
      questions: answeredQuestions
    }
  };
  completed.addCompletedItem(item);
  store.recordStudyCompletion(item);
}

Page({
  data: page.createCloudPageData({
    stages: [],
    topics: [],
    selectedStageId: '',
    selectedStage: null,
    exams: [],
    selectedExamId: '',
    selectedExam: null,
    selectedCategoryId: '',
    selectedCategory: null,
    selectedTopicId: '',
    selectedTopic: null,
    selectedQuestions: [],
    selectedTopicOffset: 0,
    wrongTopics: [],
    em2Topics: [],
    em1Topics: [],
    em1Loaded: false,
    em1Loading: false,
    mode: 'topics',
    expandedQuestionId: '',
    answeredCount: 0,
    dictionaryVisible: false,
    dictionaryLoading: false,
    dictionaryAudioLoading: false,
    dictionaryAdding: false,
    dictionaryWord: '',
    dictionaryEntry: null
  }),
  onUnload() {
    if (this.grammarProgressTimer) {
      clearTimeout(this.grammarProgressTimer);
      this.grammarProgressTimer = null;
    }
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    if (this.grammarAudioContext) {
      this.grammarAudioContext.destroy();
      this.grammarAudioContext = null;
    }
  },
  flushGrammarCompletion() {
    if (!this.data.selectedTopicId || !this.data.answeredCount) return;
    recordGrammarCompleted(this.data, this.data.answeredCount);
  },
  flushGrammarProgress() {
    if (this.grammarProgressTimer) {
      clearTimeout(this.grammarProgressTimer);
      this.grammarProgressTimer = null;
    }
    const progress = this.pendingGrammarProgress || null;
    if (!progress || !progress.topicId) return;
    this.pendingGrammarProgress = null;
    store.recordGrammarProgress(progress.topicId, progress.nextIndex, progress.answeredQuestions).catch(() => {});
  },
  queueGrammarProgress(topicId, nextIndex, answeredQuestions) {
    if (!topicId) return;
    this.pendingGrammarProgress = { topicId, nextIndex, answeredQuestions };
    if (this.grammarProgressTimer) clearTimeout(this.grammarProgressTimer);
    this.grammarProgressTimer = setTimeout(() => this.flushGrammarProgress(), 600);
  },
  queueCurrentGrammarProgress() {
    if (this.data.mode === 'wrong') return;
    const questions = this.data.selectedQuestions || [];
    let lastAnsweredIndex = -1;
    questions.forEach((question, index) => {
      if (question.isAnswered) lastAnsweredIndex = index;
    });
    if (lastAnsweredIndex < 0) return;
    const reference = questions[lastAnsweredIndex] || {};
    this.queueGrammarProgress(
      `${this.data.selectedExamId}:${reference.subtopicId || this.data.selectedTopicId}`,
      lastAnsweredIndex + 1,
      serializeAnsweredQuestions(questions)
    );
  },
  scrollToResumeQuestion(index) {
    if (!index || index < 0) return;
    setTimeout(() => {
      wx.pageScrollTo({
        selector: `#grammar-question-${index}`,
        offsetTop: -80,
        duration: 280
      });
    }, 120);
  },
  async onLoad() {
    this.grammarPerf = page.startPagePerf('grammar');
    const snapshot = snapshotStore.read(GRAMMAR_HOME_SNAPSHOT_KEY, {
      id: 'home',
      maxAgeMs: GRAMMAR_HOME_SNAPSHOT_MAX_AGE_MS
    });
    let em2Topics = [];
    let em1Topics = [];
    let readyReported = false;
    const reportReady = (source) => {
      if (readyReported || !this.grammarPerf) return;
      readyReported = true;
      this.grammarPerf.ready('pageReady', {
        source,
        cacheHit: source === 'snapshot' || source.endsWith('-cache'),
        stages: (this.data.stages || []).length
      });
    };
    const applyHomeTopics = (source) => {
      const stages = buildStages(em2Topics, em1Topics);
      if (stages.length) {
        snapshotStore.write(GRAMMAR_HOME_SNAPSHOT_KEY, 'home', {
          stages,
          em2Topics,
          em1Topics
        }, { source: 'grammar-home' });
      }
      const selectedStage = this.data.selectedStageId
        ? stages.find((item) => item.stageId === this.data.selectedStageId) || null
        : this.data.selectedStage;
      this.setData({
        stages,
        em2Topics,
        em1Topics,
        em1Loaded: !!em1Topics.length,
        em1Loading: false,
        selectedStage,
        exams: selectedStage ? (selectedStage.exams || []) : this.data.exams
      });
      reportReady(source);
    };
    if (snapshot && Array.isArray(snapshot.stages)) {
      em2Topics = snapshot.em2Topics || [];
      em1Topics = snapshot.em1Topics || [];
      this.setData({
        stages: snapshot.stages,
        em2Topics,
        em1Topics,
        em1Loaded: true,
        em1Loading: false
      });
      reportReady('snapshot');
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      reportReady('fallback');
    }
    Promise.all([
      store.getGrammarHome({ examId: 'em2' }, (fresh) => {
        em2Topics = buildTopics(fresh);
        applyHomeTopics('em2-refresh');
        if (this.grammarPerf) {
          this.grammarPerf.mark('cloudRefresh', { examId: 'em2', topics: em2Topics.length });
        }
      }).then((data) => {
        em2Topics = buildTopics(data);
        applyHomeTopics(data && data.__cacheHit ? 'em2-cache' : 'em2-cloud');
      }).catch(() => {}),
      store.getGrammarHome({ examId: 'em1' }, (fresh) => {
        em1Topics = buildTopics(fresh);
        applyHomeTopics('em1-refresh');
        if (this.grammarPerf) {
          this.grammarPerf.mark('cloudRefresh', { examId: 'em1', topics: em1Topics.length });
        }
      }).then((data) => {
        em1Topics = buildTopics(data);
        applyHomeTopics(data && data.__cacheHit ? 'em1-cache' : 'em1-cloud');
      }).catch(() => {})
    ]).then(() => reportReady('empty')).catch(() => reportReady('empty'));
  },
  onShow() {
    page.syncTheme(this);
    this.setData({
      stages: (this.data.stages || []).map((item) => Object.assign({}, item, {
        stage: item.stageId === 'senior' ? text('senior', '高中') : text('junior', '初中')
      })),
      stageCategories: (this.data.stageCategories || []).map((item) => Object.assign({}, item, {
        exam: item.examId === 'em1' ? text('em1', '一模') : text('em2', '二模')
      }))
    });
  },
  openPracticeHistory() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    wx.navigateTo({
      url: '/pages/practice-history/index?type=grammar'
    });
  },
  async openWrongBook() {
    let wrongTopics = [];
    try {
      wrongTopics = buildWrongTopics(await store.getGrammarWrongBook());
    } catch (error) {
      wrongTopics = [];
    }
    this.setData({
      mode: 'wrong',
      stages: buildStages(wrongTopics, []),
      topics: [],
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async openTopicBook() {
    let em2Topics = this.data.em2Topics || [];
    if (!em2Topics.length) {
      const em2Data = await store.getGrammarHome({ examId: 'em2' });
      em2Topics = buildTopics(em2Data);
    }
    this.setData({
      mode: 'topics',
      stages: buildStages(em2Topics, this.data.em1Topics || []),
      em2Topics,
      topics: [],
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async ensureExamLoaded(examId) {
    if (examId !== 'em1' || this.data.em1Loaded || this.data.em1Loading) {
      return;
    }
    this.setData({ em1Loading: true });
    try {
      const em1Data = await store.getGrammarHome({ examId: 'em1' });
      const em1Topics = buildTopics(em1Data);
      const stages = buildStages(this.data.em2Topics || [], em1Topics);
      const selectedStage = stages.find((item) => item.stageId === this.data.selectedStageId) || null;
      this.setData({
        stages,
        em1Topics,
        em1Loaded: true,
        em1Loading: false,
        selectedStage,
        exams: selectedStage ? (selectedStage.exams || []) : []
      });
    } catch (error) {
      this.setData({ em1Loading: false });
      wx.showToast({ title: text('em1Failed', '一模语法加载失败'), icon: 'none' });
    }
  },
  selectStage(event) {
    const stageId = event.currentTarget.dataset.stageId;
    const selectedStage = (this.data.stages || []).find((item) => item.stageId === stageId) || null;
    this.setData({
      selectedStageId: stageId,
      selectedStage,
      exams: selectedStage ? (selectedStage.exams || []) : [],
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectExam(event) {
    const examId = event.currentTarget.dataset.examId;
    await this.ensureExamLoaded(examId);
    const selectedExam = (this.data.exams || []).find((item) => item.examId === examId) || null;
    this.setData({
      selectedExamId: examId,
      selectedExam,
      topics: selectedExam ? (selectedExam.topics || []) : [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectTopic(event) {
    const topicPerf = page.startPagePerf('grammar-topic');
    const topicId = event.currentTarget.dataset.topicId;
    const selectedTopic = ((this.data.selectedCategory && this.data.selectedCategory.children) || this.data.topics)
      .find((item) => item.topicId === topicId) || null;
    if (selectedTopic && selectedTopic.children && selectedTopic.children.length) {
      this.setData({
        selectedCategoryId: topicId,
        selectedCategory: selectedTopic,
        selectedTopicId: '',
        selectedTopic: null,
        selectedQuestions: [],
        selectedTopicOffset: 0,
        expandedQuestionId: '',
        answeredCount: 0
      });
      return;
    }
    let topicQuestions = selectedTopic ? (selectedTopic.questions || []) : [];
    const sourceTopicId = selectedTopic ? (selectedTopic.sourceTopicId || topicId) : topicId;
    const snapshotId = `${this.data.selectedExamId || 'grammar'}:${sourceTopicId}`;
    const topicSnapshot = !topicQuestions.length ? snapshotStore.read(GRAMMAR_TOPIC_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: 10 * 60 * 1000
    }) : null;
    if (!topicQuestions.length && topicSnapshot && Array.isArray(topicSnapshot.questions)) {
      topicQuestions = topicSnapshot.questions;
    }
    const shouldLoadRemote = selectedTopic && !topicQuestions.length && this.data.mode !== 'wrong';
    const shouldLoadProgress = selectedTopic && this.data.mode !== 'wrong';
    if (topicQuestions.length) {
      this.setData({
        selectedTopicId: topicId,
        selectedTopic,
        selectedQuestions: topicQuestions.map((item, index) => buildQuestion(item, index)),
        selectedTopicOffset: 0,
        expandedQuestionId: '',
        answeredCount: 0
      });
    }
    const [topicResult, progressResult] = await Promise.all([
      shouldLoadRemote
        ? store.getGrammarTopic(sourceTopicId, { examId: this.data.selectedExamId }).catch(() => null)
        : Promise.resolve(null),
      shouldLoadProgress
        ? store.getGrammarProgress(`${this.data.selectedExamId}:${sourceTopicId}`).catch(() => null)
        : Promise.resolve(null)
    ]);
    if (topicResult) {
      topicQuestions = topicResult.questions || [];
      snapshotStore.write(GRAMMAR_TOPIC_SNAPSHOT_KEY, snapshotId, {
        questions: topicQuestions
      }, { source: 'grammar-topic' });
    }
    let nextIndex = 0;
    if (progressResult) {
      nextIndex = Math.min(Math.max(Number(progressResult.nextIndex || 0), 0), topicQuestions.length);
    }
    const restoredQuestions = restoreAnsweredQuestions(
      topicQuestions.map((item, index) => buildQuestion(item, index)),
      (progressResult && progressResult.answeredQuestions) || []
    );
    const answeredCount = restoredQuestions.filter((question) => question.isAnswered).length;
    const firstUnansweredIndex = restoredQuestions.findIndex((question) => !question.isAnswered);
    const resumeCandidate = answeredCount > 0 && firstUnansweredIndex >= 0 ? firstUnansweredIndex : nextIndex;
    const resumeIndex = resumeCandidate > 0 && resumeCandidate < restoredQuestions.length ? resumeCandidate : 0;
    this.setData({
      selectedTopicId: topicId,
      selectedTopic,
      selectedQuestions: restoredQuestions,
      selectedTopicOffset: resumeIndex,
      expandedQuestionId: '',
      answeredCount
    }, () => {
      if (resumeIndex > 0) this.scrollToResumeQuestion(resumeIndex);
    });
    topicPerf.ready('topicReady', {
      remote: !!topicResult,
      progress: !!progressResult,
      questions: restoredQuestions.length,
      resumedAt: resumeIndex,
      restoredAnswers: answeredCount
    });
  },
  backToTopics() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToStageCategories() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToExamCategories() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToCategory() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectOption(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const option = String(event.currentTarget.dataset.option || '').toUpperCase();
    const currentQuestion = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!currentQuestion || currentQuestion.isAnswered) {
      return;
    }
    const answeredCount = (this.data.selectedQuestions || []).filter((item) => item.isAnswered).length + 1;
    const nextQuestions = (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
      selectedAnswer: item._id === questionId ? option : item.selectedAnswer,
      isAnswered: item._id === questionId ? true : item.isAnswered,
      isCorrect: item._id === questionId && item.answer ? option === item.answer : item.isCorrect,
      explaining: item._id === questionId ? false : item.explaining,
      optionsList: (item.optionsList || []).map((entry) => Object.assign({}, entry, {
        selected: item._id === questionId ? entry.key === option : entry.selected,
        correct: item._id === questionId ? entry.key === item.answer : entry.correct,
        wrong: item._id === questionId ? entry.key === option && option !== item.answer : entry.wrong
      }))
    }));
    this.setData({
      expandedQuestionId: questionId,
      selectedQuestions: nextQuestions
    }, () => {
      this.setData({ answeredCount });
      recordGrammarCompleted(this.data, answeredCount);
      this.loadExplanationById(questionId);
    });
    try {
      const questionIndex = nextQuestions.findIndex((item) => item._id === questionId);
      const nextIndex = questionIndex + 1;
      if (this.data.mode !== 'wrong') {
        this.queueGrammarProgress(
          `${this.data.selectedExamId}:${currentQuestion.subtopicId || this.data.selectedTopicId}`,
          nextIndex,
          serializeAnsweredQuestions(nextQuestions)
        );
      }
      if (currentQuestion && currentQuestion.answer && option !== currentQuestion.answer) {
        store.recordGrammarWrong(currentQuestion, option);
      }
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? {
            answer: currentQuestion.answer || '',
            topic: currentQuestion.topic || currentQuestion.subtopic || '语法',
            explanation: text('explainUnavailable', '讲解暂不可用，请稍后再试。'),
            elimination: ''
          } : item.explanation
        }))
      });
    }
  }
  ,
  loadExplanation(event) {
    const questionId = event && event.currentTarget ? event.currentTarget.dataset.questionId : '';
    return this.loadExplanationById(questionId);
  },
  async loadExplanationById(questionId, options = {}) {
    const force = !!options.force;
    const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!question || question.explaining || (!force && question.explanation)) {
      return;
    }
    this.setData({
      selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
        explaining: item._id === questionId ? true : item.explaining,
        explanationError: item._id === questionId ? '' : item.explanationError
      }))
    });
    try {
      const result = await store.explainGrammarQuestion(question, {
        force,
        personalOnly: !!options.personalOnly
      });
      const explanation = result && result.explanation;
      const source = String((result && result.source) || (explanation && explanation.source) || '');
      if (!explanation || !String(explanation.explanation || '').trim() || source === 'fallback' || (result && (result.error || result.cloudError))) {
        throw new Error((result && result.error) || (result && result.cloudError && result.cloudError.message) || 'grammar-explanation-unavailable');
      }
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanationError: item._id === questionId ? '' : item.explanationError,
          explanation: item._id === questionId ? explanation : item.explanation
        }))
      }, () => {
        recordGrammarCompleted(this.data, this.data.answeredCount);
        this.queueCurrentGrammarProgress();
      });
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanationError: item._id === questionId ? text('explainUnavailable', '讲解暂不可用，请稍后再试。') : item.explanationError
        }))
      });
    }
  },
  regenerateExplanation(event) {
    const questionId = event && event.currentTarget ? event.currentTarget.dataset.questionId : '';
    return this.loadExplanationById(questionId, { force: true, personalOnly: true });
  },
  async openDictionaryWord(event) {
    const word = String(event.currentTarget.dataset.word || '').trim();
    const questionId = String(event.currentTarget.dataset.questionId || '');
    if (questionId) {
      const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
      if (!question || !question.isAnswered) return;
    }
    if (!word) return;
    this.setData({
      dictionaryVisible: true,
      dictionaryLoading: true,
      dictionaryWord: word,
      dictionaryEntry: null
    });
    try {
      const entry = await store.lookupWord(word);
      this.setData({
        dictionaryLoading: false,
        dictionaryEntry: entry || { word, definitions: [] }
      });
    } catch (error) {
      this.setData({
        dictionaryLoading: false,
        dictionaryEntry: { word, definitions: [] }
      });
      wx.showToast({ title: text('dictionaryUnavailable', '词典暂不可用'), icon: 'none' });
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
      await store.addDictionaryWord(Object.assign({}, entry, { word }));
      wx.showToast({ title: text('addSuccess', '已加入词库'), icon: 'none' });
    } catch (error) {
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
      if (!this.grammarAudioContext) {
        this.grammarAudioContext = wx.createInnerAudioContext();
        this.grammarAudioContext.obeyMuteSwitch = false;
        this.grammarAudioContext.onEnded(() => {
          this.setData({ dictionaryAudioLoading: false });
        });
        this.grammarAudioContext.onError(() => {
          this.setData({ dictionaryAudioLoading: false });
          wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
        });
      }
      this.grammarAudioContext.stop();
      this.grammarAudioContext.src = url;
      this.setData({ dictionaryAudioLoading: true });
      this.grammarAudioContext.play();
    };
    try {
      let url = canUseDictionaryVoice(word) ? buildDictionaryVoiceUrl(word) : '';
      if (!url) {
        url = entry.audioUrl || '';
      }
      if (!url && entry.audioFileId) {
        url = await store.getTempFileURL(entry.audioFileId);
        if (url) {
          this.setData({ dictionaryEntry: Object.assign({}, entry, { audioUrl: url }) });
        }
      }
      if (!url) {
        url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
      }
      playUrl(url);
    } catch (error) {
      this.setData({ dictionaryAudioLoading: false });
      if (canUseDictionaryVoice(word)) {
        playUrl(buildDictionaryVoiceUrl(word));
      }
    }
  }
});
