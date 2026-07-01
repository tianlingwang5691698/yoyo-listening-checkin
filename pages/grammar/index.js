const page = require('../../utils/page');
const store = require('../../utils/store');
const completed = require('../../utils/completed');

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
      exam: '二模',
      count: em2Count,
      topics: em2Topics
    },
    {
      examId: 'em1',
      exam: '一模',
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
      stage: '初中',
      count: juniorCount,
      exams: buildExams(em2Topics, em1Topics)
    },
    {
      stageId: 'senior',
      stage: '高中',
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
    title: `语法：${topic.topic || topic.exam || '练习'}`,
    meta: state.selectedExam ? state.selectedExam.exam : '语法',
    topicId,
    progressText: `今日已做 ${answeredCount || 1} 题`,
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
    if (this.grammarAudioContext) {
      this.grammarAudioContext.destroy();
      this.grammarAudioContext = null;
    }
  },
  async onLoad() {
    let em2Data = null;
    let em1Data = null;
    try {
      [em2Data, em1Data] = await Promise.all([
        store.getGrammarHome({ examId: 'em2' }),
        store.getGrammarHome({ examId: 'em1' })
      ]);
    } catch (error) {
      em2Data = null;
      em1Data = null;
    }
    const stages = buildStages(buildTopics(em2Data), buildTopics(em1Data));
    this.setData({
      stages,
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
      selectedTopicOffset: 0
    });
  },
  onShow() {
    page.syncTheme(this);
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
    const [em2Data, em1Data] = await Promise.all([
      store.getGrammarHome({ examId: 'em2' }),
      store.getGrammarHome({ examId: 'em1' })
    ]);
    this.setData({
      mode: 'topics',
      stages: buildStages(buildTopics(em2Data), buildTopics(em1Data)),
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
  selectExam(event) {
    const examId = event.currentTarget.dataset.examId;
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
    if (selectedTopic && !topicQuestions.length && this.data.mode !== 'wrong') {
      try {
        const result = await store.getGrammarTopic(selectedTopic.sourceTopicId || topicId, { examId: this.data.selectedExamId });
        topicQuestions = (result && result.questions) || [];
      } catch (error) {
        topicQuestions = [];
      }
    }
    const sourceTopicId = selectedTopic ? (selectedTopic.sourceTopicId || topicId) : topicId;
    let nextIndex = 0;
    if (selectedTopic && this.data.mode !== 'wrong') {
      try {
        const progress = await store.getGrammarProgress(`${this.data.selectedExamId}:${sourceTopicId}`);
        nextIndex = Math.min(Math.max(Number((progress && progress.nextIndex) || 0), 0), topicQuestions.length);
      } catch (error) {
        nextIndex = 0;
      }
    }
    const selectedQuestions = topicQuestions.slice(nextIndex).map((item, index) => buildQuestion(item, nextIndex + index));
    this.setData({
      selectedTopicId: topicId,
      selectedTopic,
      selectedQuestions,
      selectedTopicOffset: nextIndex,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToTopics() {
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
    let answeredCount = 0;
    this.setData({
      expandedQuestionId: questionId,
      selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
        selectedAnswer: item._id === questionId ? option : item.selectedAnswer,
        isAnswered: item._id === questionId ? true : item.isAnswered,
        isCorrect: item._id === questionId && item.answer ? option === item.answer : item.isCorrect,
        explaining: item._id === questionId ? false : item.explaining,
        optionsList: (item.optionsList || []).map((entry) => Object.assign({}, entry, {
          selected: item._id === questionId ? entry.key === option : entry.selected,
          correct: item._id === questionId ? entry.key === item.answer : entry.correct,
          wrong: item._id === questionId ? entry.key === option && option !== item.answer : entry.wrong
        }))
      }))
    }, () => {
      answeredCount = (this.data.selectedQuestions || []).filter((item) => item.isAnswered).length;
      this.setData({ answeredCount });
      recordGrammarCompleted(this.data, answeredCount);
    });
    try {
      const questionIndex = (this.data.selectedQuestions || []).findIndex((item) => item._id === questionId);
      const nextIndex = Math.max(0, Number(this.data.selectedTopicOffset || 0)) + questionIndex + 1;
      if (this.data.mode !== 'wrong') {
        store.recordGrammarProgress(`${this.data.selectedExamId}:${currentQuestion.subtopicId || this.data.selectedTopicId}`, nextIndex);
      }
      if (currentQuestion && currentQuestion.answer && option !== currentQuestion.answer) {
        store.recordGrammarWrong(currentQuestion, option);
      }
      this.loadExplanation({ currentTarget: { dataset: { questionId } } });
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining
        }))
      });
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? {
            answer: currentQuestion.answer || '',
            topic: currentQuestion.topic || currentQuestion.subtopic || '语法',
            explanation: '讲解暂不可用，请稍后再试。',
            elimination: ''
          } : item.explanation
        }))
      });
    }
  }
  ,
  async loadExplanation(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!question || question.explanation) {
      return;
    }
    this.setData({
      selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
        explaining: item._id === questionId ? true : item.explaining
      }))
    });
    try {
      const result = await store.explainGrammarQuestion(question);
      const explanation = result && result.explanation ? result.explanation : {
        answer: question.answer || '',
        topic: question.topic || question.subtopic || '语法',
        explanation: result && result.cloudError ? `讲解暂不可用：${result.cloudError.message}` : '讲解暂不可用，请稍后再试。',
        elimination: ''
      };
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? explanation : item.explanation
        }))
      }, () => {
        recordGrammarCompleted(this.data, this.data.answeredCount);
      });
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? {
            answer: question.answer || '',
            topic: question.topic || question.subtopic || '语法',
            explanation: '讲解暂不可用，请稍后再试。',
            elimination: ''
          } : item.explanation
        }))
      });
    }
  },
  async regenerateExplanation(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!question) {
      return;
    }
    this.setData({
      selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
        explaining: item._id === questionId ? true : item.explaining
      }))
    });
    try {
      const result = await store.explainGrammarQuestion(question, { force: true });
      const explanation = result && result.explanation ? result.explanation : question.explanation;
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? explanation : item.explanation
        }))
      });
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining
        }))
      });
    }
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
      wx.showToast({ title: '词典暂不可用', icon: 'none' });
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
      wx.showToast({ title: '已加入词库', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '加入失败', icon: 'none' });
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
          wx.showToast({ title: '播放失败，稍后再试', icon: 'none' });
        });
      }
      this.grammarAudioContext.stop();
      this.grammarAudioContext.src = url;
      this.setData({ dictionaryAudioLoading: true });
      this.grammarAudioContext.play();
    };
    try {
      let url = entry.audioUrl || '';
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
      playUrl(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`);
    }
  }
});
