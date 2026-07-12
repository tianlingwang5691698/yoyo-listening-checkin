const THEME_KEY = 'uiTheme';
const LANGUAGE_KEY = 'yoyoLanguageV1';

function uiText(english) {
  const topics = english ? [
    ['noun', 'Nouns', 'Countability · Plurals · Possessives', 9],
    ['pronoun', 'Pronouns', 'Person · Case · Reference', 9],
    ['numeral', 'Numerals', 'Cardinals · Ordinals · Fractions', 7],
    ['article', 'Articles', 'a/an · the · Zero article', 8],
    ['verb', 'Verbs', 'Jobs · Forms · Tense · Voice', 36],
    ['adjective', 'Adjectives', 'Position · Comparison · Order', 9],
    ['adverb', 'Adverbs', 'Types · Position · Comparison', 8],
    ['preposition', 'Prepositions', 'Time · Place · Direction', 8],
    ['conjunction', 'Conjunctions', 'Coordination · Subordination', 8],
    ['interjection', 'Interjections', 'Emotion · Response · Punctuation', 5]
  ] : [
    ['noun', '名词', '可数 · 单复数 · 所有格', 9],
    ['pronoun', '代词', '人称 · 格 · 指代', 9],
    ['numeral', '数词', '基数 · 序数 · 分数', 7],
    ['article', '冠词', 'a/an · the · 零冠词', 8],
    ['verb', '动词', '作用 · 形式 · 时态 · 语态', 36],
    ['adjective', '形容词', '位置 · 比较级 · 顺序', 9],
    ['adverb', '副词', '种类 · 位置 · 比较级', 8],
    ['preposition', '介词', '时间 · 地点 · 方向', 8],
    ['conjunction', '连词', '并列 · 从属 · 逻辑', 8],
    ['interjection', '感叹词', '情绪 · 应答 · 标点', 5]
  ];
  return {
    eyebrow: english ? 'ENGLISH GRAMMAR' : '英语语法',
    title: english ? 'See how every sentence works' : '把一句话讲明白',
    copy: english ? 'Learn a rule from examples, then prove it with a short challenge.' : '从例句看清规则，再用小挑战真正掌握。',
    directory: english ? '10 Parts of Speech' : '十大词性',
    directoryCopy: english ? 'Choose one word class to begin.' : '选择一种词性开始学习。',
    topics: topics.map((item) => ({ id: item[0], title: item[1], meta: item[2], count: item[3], countText: english ? `${item[3]} lessons` : `${item[3]} 节微课` })),
    verbMap: english ? 'Verb Map' : '动词地图',
    verbMapCopy: english ? 'First see the whole verb system, then enter its course map.' : '先看动词完整体系，再进入课程地图。',
    completeVerb: english ? 'Complete verb course' : '动词完整课程',
    completeVerbCopy: english ? 'Meaning, objects, forms, tense, voice and non-finite verbs' : '作用、宾语、形式、时态、语态与非谓语',
    thirdPerson: english ? 'Third-person singular' : '第三人称单数',
    thirdPersonCopy: english ? 'Subjects, spelling, negatives, questions and pronunciation' : '主语判断、拼写、否定、疑问与发音',
    core: english ? 'Core rules' : '语法本质',
    back: english ? 'Back' : '返回',
    backDirectory: english ? '‹ Parts of Speech' : '‹ 十大词性',
    backVerbMap: english ? '‹ Verb Map' : '‹ 动词地图',
    backVerbCourse: english ? '‹ Complete verb course' : '‹ 动词完整课程',
    backCourse: english ? '‹ Course Map' : '‹ 课程地图',
    nextQuestion: english ? 'Next question' : '下一题',
    nextLesson: english ? 'Next lesson' : '继续下一小节',
    finish: english ? 'Finish and return' : '完成并返回',
    answerFirst: english ? 'Answer correctly to continue' : '答对后继续',
    retry: english ? 'Try again' : '再试一次',
    lessonUnit: english ? 'lessons' : '节微课',
    loadError: english ? 'The course could not be opened. Return and try again.' : '课程暂时无法打开，请返回后重试。'
  };
}

function loaderFor(topic) {
  if (topic === 'noun' || topic === 'pronoun') return 'word';
  if (topic === 'third-person') return 'third-person';
  if (topic === 'verb' || topic === 'numeral' || topic === 'article') return 'vna';
  if (topic === 'adjective' || topic === 'adverb') return 'modifier';
  return 'relation';
}

Page({
  data: {
    theme: 'warm',
    language: 'zh-CN',
    ui: uiText(false),
    screen: 'directory',
    selectedTopic: '',
    loaderKind: '',
    course: [],
    groups: [],
    courseTitle: '',
    courseCopy: '',
    activeLesson: null,
    lessonIndex: -1,
    questionIndex: 0,
    activeQuestion: null,
    answer: '',
    result: '',
    isLastQuestion: false,
    isLastLesson: false,
    debugMessage: ''
  },

  onLoad() {
    this.pageStartedAt = Date.now();
    this.syncPreferences();
  },

  onShow() {
    this.syncPreferences();
  },

  onReady() {
    wx.nextTick(() => {
      this.createSelectorQuery().select('.topic-item').boundingClientRect((rect) => {
        if (!rect) {
          this.setData({ debugMessage: 'DEBUG: grammar-package/pages/classroom.onReady -> directory.render -> .topic-item: missing' });
          return;
        }
        this.pageReadyReported = true;
        this.reportPerformance(2101, Date.now() - (this.pageStartedAt || Date.now()));
      }).exec();
    });
  },

  onUnload() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
  },

  syncPreferences() {
    const storedTheme = wx.getStorageSync(THEME_KEY);
    const storedLanguage = wx.getStorageSync(LANGUAGE_KEY);
    const theme = storedTheme === 'library' ? 'library' : 'warm';
    const language = storedLanguage === 'en' ? 'en' : 'zh-CN';
    const languageChanged = this.data.language !== language && !!this.data.selectedTopic;
    this.setData({ theme, language, ui: uiText(language === 'en') });
    if (languageChanged) this.backToDirectory();
    wx.setNavigationBarTitle({ title: language === 'en' ? 'Grammar Classroom' : '语法课堂' });
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: theme === 'library' ? '#FAF5EA' : '#F6FBFD' });
  },

  reportPerformance(id, value) {
    try {
      if (wx.reportPerformance) wx.reportPerformance(id, Math.max(0, Number(value || 0)), 'grammar-classroom');
    } catch (error) {}
  },

  selectTopic(event) {
    const topic = String(event.currentTarget.dataset.topic || '');
    if (!topic) return;
    this.loadCourse(topic);
  },

  selectVerbCourse() {
    this.loadCourse('verb');
  },

  selectThirdPersonCourse() {
    this.loadCourse('third-person');
  },

  loadCourse(topic) {
    this.loadStartedAt = Date.now();
    const requestId = (this.loadRequestId || 0) + 1;
    this.loadRequestId = requestId;
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.setData({ selectedTopic: topic, loaderKind: loaderFor(topic), debugMessage: '' });
    this.loadTimer = setTimeout(() => {
      if (this.loadRequestId === requestId && this.data.selectedTopic === topic && this.data.loaderKind) {
        this.setData({ debugMessage: `DEBUG: grammar-package/pages/classroom.loadCourse -> ${this.data.loaderKind}-loader.loaded -> bundle: missing; topic=${topic}` });
      }
    }, 1500);
  },

  onCourseLoaded(event) {
    const detail = event.detail || {};
    if (!detail.bundle || detail.topic !== this.data.selectedTopic) return;
    if (this.loadTimer) clearTimeout(this.loadTimer);
    const bundle = detail.bundle;
    const course = bundle.course || [];
    this.fullCourse = course;
    const courseSummaries = course.map(({ id, no, level, title, meta }) => ({ id, no, level, title, meta }));
    const summaryById = courseSummaries.reduce((map, lesson) => Object.assign(map, { [lesson.id]: lesson }), {});
    const groups = bundle.groups && bundle.groups.length
      ? bundle.groups.map((group) => Object.assign({}, group, { lessons: (group.lessons || []).map((lesson) => summaryById[lesson.id]).filter(Boolean) }))
      : [{ id: 'course', title: bundle.title || '', copy: bundle.copy || '', lessons: courseSummaries }];
    this.setData({
      screen: 'course-map',
      loaderKind: '',
      course: courseSummaries,
      groups,
      courseTitle: bundle.title || '',
      courseCopy: bundle.copy || '',
      activeLesson: null,
      lessonIndex: -1,
      questionIndex: 0,
      activeQuestion: null,
      answer: '',
      result: '',
      debugMessage: ''
    }, () => this.reportPerformance(2102, Date.now() - (this.loadStartedAt || Date.now())));
  },

  onCourseLoadError(event) {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    const detail = event.detail || {};
    this.setData({
      loaderKind: '',
      debugMessage: `DEBUG: grammar-package/pages/classroom.onCourseLoadError -> course-loader.load -> ${detail.topic || 'unknown'}: ${detail.message || 'missing'}`
    });
  },

  openLesson(event) {
    const id = String(event.currentTarget.dataset.lesson || '');
    const course = this.fullCourse || [];
    const index = course.findIndex((lesson) => lesson.id === id);
    const lesson = index >= 0 ? course[index] : null;
    if (!lesson || !lesson.questions || !lesson.questions.length) return;
    const startedAt = Date.now();
    this.setData({
      screen: 'lesson',
      activeLesson: lesson,
      lessonIndex: index,
      questionIndex: 0,
      activeQuestion: lesson.questions[0],
      answer: '',
      result: '',
      isLastQuestion: lesson.questions.length === 1,
      isLastLesson: index === this.data.course.length - 1
    }, () => {
      this.reportPerformance(2103, Date.now() - startedAt);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    });
  },

  chooseAnswer(event) {
    if (this.data.answer || !this.data.activeQuestion) return;
    const answer = String(event.currentTarget.dataset.answer || '');
    this.setData({ answer, result: answer === this.data.activeQuestion.answer ? 'correct' : 'wrong' });
  },

  retry() {
    this.setData({ answer: '', result: '' });
  },

  continueLesson() {
    if (this.data.result !== 'correct') return;
    const lesson = this.data.activeLesson;
    if (!this.data.isLastQuestion) {
      const questionIndex = this.data.questionIndex + 1;
      this.setData({
        questionIndex,
        activeQuestion: lesson.questions[questionIndex],
        answer: '',
        result: '',
        isLastQuestion: questionIndex === lesson.questions.length - 1
      });
      return;
    }
    if (this.data.isLastLesson) {
      this.backToCourseMap();
      return;
    }
    const lessonIndex = this.data.lessonIndex + 1;
    const nextLesson = (this.fullCourse || [])[lessonIndex];
    this.setData({
      activeLesson: nextLesson,
      lessonIndex,
      questionIndex: 0,
      activeQuestion: nextLesson.questions[0],
      answer: '',
      result: '',
      isLastQuestion: nextLesson.questions.length === 1,
      isLastLesson: lessonIndex === this.data.course.length - 1
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  backToCourseMap() {
    this.setData({ screen: 'course-map', activeLesson: null, lessonIndex: -1, activeQuestion: null, answer: '', result: '' });
  },

  backFromCourseMap() {
    if (this.data.selectedTopic === 'third-person') return this.loadCourse('verb');
    this.backToDirectory();
  },

  backToDirectory() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.fullCourse = [];
    this.setData({ screen: 'directory', selectedTopic: '', loaderKind: '', course: [], groups: [], courseTitle: '', courseCopy: '', activeLesson: null, debugMessage: '' });
  },

  closePage() {
    wx.navigateBack({ delta: 1, fail: () => this.backToDirectory() });
  }
});
