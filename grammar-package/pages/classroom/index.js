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
  const domains = english ? [
    ['morphology', 'Word Grammar', 'Parts of speech, word forms and word building', 'M'],
    ['syntax', 'Sentence Grammar', 'Sentence elements, patterns, predicates and special structures', 'S'],
    ['clauses', 'Clauses & Complex Sentences', 'Coordination, noun, relative and adverbial clauses', 'C'],
    ['discourse', 'Usage & Punctuation', 'Cohesion, information order, punctuation and expression', 'U']
  ] : [
    ['morphology', '词法', '词性、词形变化与构词规律', '词'],
    ['syntax', '句法', '句子成分、基本句型、谓语系统与特殊结构', '句'],
    ['clauses', '从句与复合句', '并列句、名词性从句、定语从句与状语从句', '从'],
    ['discourse', '表达与标点', '衔接、信息顺序、标点与中英表达差异', '用']
  ];
  const domainMaps = english ? {
    morphology: [
      ['parts-of-speech', '10 Parts of Speech', 'Nouns, pronouns, verbs and the other word classes', '10 classes', true],
      ['word-formation', 'Word Formation', 'Prefixes, suffixes, conversion and compounds', '18 lessons', true]
    ],
    syntax: [
      ['sentence-elements', 'Sentence Elements', 'Subject, predicate, object, complement, attribute and adverbial', 'Planned', false],
      ['basic-patterns', 'Basic Sentence Patterns', 'Five basic patterns and there-be structures', 'Planned', false],
      ['predicate-system', 'Predicate System', 'Agreement, tense, voice, auxiliaries and modals', 'Planned', false],
      ['nonfinite-system', 'Non-finite Structures', 'Infinitives, gerunds and participles', 'Planned', false],
      ['special-structures', 'Special Structures', 'Inversion, emphasis, ellipsis and imperatives', 'Planned', false]
    ],
    clauses: [
      ['coordination', 'Coordination', 'and, but, or, so and parallel clauses', 'Planned', false],
      ['noun-clauses', 'Noun Clauses', 'Object, subject and predicative clauses', 'Planned', false],
      ['relative-clauses', 'Relative Clauses', 'Relative words, antecedents and clause structure', 'Planned', false],
      ['adverbial-clauses', 'Adverbial Clauses', 'Time, condition, reason, purpose, result and concession', 'Planned', false],
      ['reported-speech', 'Reported Speech', 'Tense, person, time and word-order changes', 'Planned', false]
    ],
    discourse: [
      ['cohesion-reference', 'Cohesion & Reference', 'Pronoun reference, substitution and logical links', 'Planned', false],
      ['information-order', 'Information Order', 'English focus, end-weight and Chinese-English order differences', 'Planned', false],
      ['punctuation', 'Punctuation & Capitals', 'Sentence boundaries, commas, apostrophes and capitals', 'Planned', false],
      ['common-expression', 'Common Expression Differences', 'Frequent Chinese-to-English structural differences', 'Planned', false]
    ]
  } : {
    morphology: [
      ['parts-of-speech', '十大词性', '名词、代词、动词及其他词类的作用与变化', '10 类 · 已开放', true],
      ['word-formation', '构词法', '前缀、后缀、转化与合成词', '18 节 · 已开放', true]
    ],
    syntax: [
      ['sentence-elements', '句子成分', '主语、谓语、宾语、表语、定语、状语与补语', '规划中', false],
      ['basic-patterns', '基本句型', '五大基本句型与 there be 结构', '规划中', false],
      ['predicate-system', '谓语系统', '主谓一致、时态、语态、助动词与情态动词', '规划中', false],
      ['nonfinite-system', '非谓语结构', '不定式、动名词和分词', '规划中', false],
      ['special-structures', '特殊句式', '倒装、强调、省略与祈使句', '规划中', false]
    ],
    clauses: [
      ['coordination', '并列句', 'and、but、or、so 与平行分句', '规划中', false],
      ['noun-clauses', '名词性从句', '宾语从句、主语从句与表语从句', '规划中', false],
      ['relative-clauses', '定语从句', '关系词、先行词与从句结构', '规划中', false],
      ['adverbial-clauses', '状语从句', '时间、条件、原因、目的、结果与让步', '规划中', false],
      ['reported-speech', '直接引语与间接引语', '时态、人称、时间和语序变化', '规划中', false]
    ],
    discourse: [
      ['cohesion-reference', '衔接与指代', '代词指代、替代与逻辑连接', '规划中', false],
      ['information-order', '信息顺序', '英语焦点、尾重原则与中英语序差异', '规划中', false],
      ['punctuation', '标点与大小写', '句界、逗号、撇号和大写规则', '规划中', false],
      ['common-expression', '中英表达差异', '常见中文思维到英文结构的转换', '规划中', false]
    ]
  };
  return {
    eyebrow: english ? 'ENGLISH GRAMMAR' : '英语语法',
    title: english ? 'See how every sentence works' : '把一句话讲明白',
    copy: english ? 'Learn a rule from examples, then prove it with a short challenge.' : '从例句看清规则，再用小挑战真正掌握。',
    systemTitle: english ? 'Grammar System' : '语法体系',
    systemCopy: english ? 'Start from word grammar, sentence grammar, clauses or usage.' : '先选择词法、句法、从句或表达规则，再进入具体课程。',
    domains: domains.map((item) => ({ id: item[0], title: item[1], meta: item[2], code: item[3] })),
    domainMaps: Object.keys(domainMaps).reduce((result, key) => Object.assign(result, { [key]: domainMaps[key].map((item) => ({ id: item[0], title: item[1], meta: item[2], status: item[3], ready: item[4] })) }), {}),
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
    backSystem: english ? '‹ Grammar System' : '‹ 语法体系',
    backMorphology: english ? '‹ Word Grammar' : '‹ 词法',
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
    loadError: english ? 'The course could not be opened. Return and try again.' : '课程暂时无法打开，请返回后重试。',
    planned: english ? 'Course in progress' : '课程正在建设'
  };
}

function loaderFor(topic) {
  if (topic === 'noun' || topic === 'pronoun') return 'word';
  if (topic === 'word-formation') return 'word-formation';
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
    screen: 'system',
    selectedDomain: '',
    domainTitle: '',
    domainCopy: '',
    domainItems: [],
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
      this.createSelectorQuery().select('.domain-item').boundingClientRect((rect) => {
        if (!rect) {
          this.setData({ debugMessage: 'DEBUG: grammar-package/pages/classroom.onReady -> system.render -> .domain-item: missing' });
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
    const languageChanged = this.data.language !== language && this.data.screen !== 'system';
    this.setData({ theme, language, ui: uiText(language === 'en') });
    if (languageChanged) this.backToSystem();
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

  selectDomain(event) {
    const domain = String(event.currentTarget.dataset.domain || '');
    const ui = this.data.ui;
    const selected = ui.domains.find((item) => item.id === domain);
    if (!selected) return;
    this.setData({ screen: 'domain-map', selectedDomain: domain, domainTitle: selected.title, domainCopy: selected.meta, domainItems: ui.domainMaps[domain] || [], debugMessage: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  selectDomainItem(event) {
    const item = String(event.currentTarget.dataset.item || '');
    if (item === 'parts-of-speech') {
      this.setData({ screen: 'directory', debugMessage: '' });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      return;
    }
    if (item === 'word-formation') return this.loadCourse('word-formation');
    wx.showToast({ title: this.data.ui.planned, icon: 'none', duration: 2200 });
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
    if (this.data.selectedTopic === 'word-formation') return this.backToDomainMap();
    this.backToDirectory();
  },

  backToDirectory() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.fullCourse = [];
    this.setData({ screen: 'directory', selectedTopic: '', loaderKind: '', course: [], groups: [], courseTitle: '', courseCopy: '', activeLesson: null, debugMessage: '' });
  },

  backToDomainMap() {
    const domain = this.data.selectedDomain || 'morphology';
    const ui = this.data.ui;
    const selected = ui.domains.find((item) => item.id === domain) || ui.domains[0];
    this.fullCourse = [];
    this.setData({ screen: 'domain-map', selectedDomain: selected.id, domainTitle: selected.title, domainCopy: selected.meta, domainItems: ui.domainMaps[selected.id] || [], selectedTopic: '', loaderKind: '', course: [], groups: [], activeLesson: null, debugMessage: '' });
  },

  backToSystem() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.fullCourse = [];
    this.setData({ screen: 'system', selectedDomain: '', domainTitle: '', domainCopy: '', domainItems: [], selectedTopic: '', loaderKind: '', course: [], groups: [], activeLesson: null, debugMessage: '' });
  },

  handleTopBack() {
    if (this.data.screen === 'lesson') return this.backToCourseMap();
    if (this.data.screen === 'course-map') return this.backFromCourseMap();
    if (this.data.screen === 'directory') return this.backToDomainMap();
    if (this.data.screen === 'domain-map') return this.backToSystem();
    this.closePage();
  },

  closePage() {
    wx.navigateBack({ delta: 1, fail: () => this.backToSystem() });
  }
});
