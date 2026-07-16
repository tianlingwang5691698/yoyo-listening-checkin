const store = require('../../../utils/store');
const page = require('../../../utils/page');
const { getActiveGrammarTaskKey } = require('../../../utils/grammar-resume');

const THEME_KEY = 'uiTheme';
const LANGUAGE_KEY = 'yoyoLanguageV1';
const PLANNED_RESUME_PREFIX = 'grammarPlannedResumeV1:';
const PLANNED_AUDIO_COMPLETE_RATIO = 0.95;

function uiText(english) {
  const topics = english ? [
    ['noun', 'Nouns', 'Definition · Number · Relations', 10],
    ['pronoun', 'Pronouns', 'Person · Case · Reference', 15],
    ['numeral', 'Numerals', 'Quantity · Order · Proportion · Labels', 12],
    ['article', 'Articles', 'Reference · a/an · the · Zero article', 15],
    ['verb', 'Verbs', 'Jobs · Forms · Tense · Voice', 36],
    ['adjective', 'Adjectives', 'Core meaning · Complements · Comparison', 15],
    ['adverb', 'Adverbs', 'Scope · Position · Linking', 16],
    ['preposition', 'Prepositions', 'Definition · Relations · Syntax', 25],
    ['conjunction', 'Conjunctions', 'Core meaning · Logic · Boundaries', 14],
    ['interjection', 'Interjections', 'Core meaning · Context · Register', 10]
  ] : [
    ['noun', '名词', '定义 · 数量 · 关系', 10],
    ['pronoun', '代词', '人称 · 格 · 指代', 15],
    ['numeral', '数词', '数量 · 顺序 · 比例 · 编号', 12],
    ['article', '冠词', '指称本质 · a/an · the · 零冠词', 15],
    ['verb', '动词', '作用 · 形式 · 时态 · 语态', 36],
    ['adjective', '形容词', '本质 · 补足关系 · 比较系统', 15],
    ['adverb', '副词', '本质 · 范围 · 位置 · 连接', 16],
    ['preposition', '介词', '定义 · 关系 · 句法', 25],
    ['conjunction', '连词', '本质 · 并列 · 从属 · 边界', 14],
    ['interjection', '感叹词', '本质 · 语境 · 交际 · 语体', 10]
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
      ['sentence-elements', 'Sentence Elements', 'Subject, predicate, object, complement, attribute and adverbial', '23 lessons', true],
      ['basic-patterns', 'Basic Sentence Patterns', 'Five patterns, existential clauses and transformations', '16 lessons', true],
      ['predicate-system', 'Predicate System', 'Agreement, tense, voice, auxiliaries and modals', '20 lessons', true],
      ['nonfinite-system', 'Non-finite Structures', 'Infinitives, gerunds and participles', '19 lessons', true],
      ['special-structures', 'Special Structures', 'Questions, inversion, emphasis, ellipsis and imperatives', '28 lessons', true]
    ],
    clauses: [
      ['coordination', 'Coordination', 'Coordinators, punctuation, logic and parallel clauses', '22 lessons', true],
      ['noun-clauses', 'Noun Clauses', 'Subject, object, predicative and appositive clauses', '22 lessons', true],
      ['relative-clauses', 'Relative Clauses', 'Relative words, antecedents and clause structure', '21 lessons', true],
      ['adverbial-clauses', 'Adverbial Clauses', 'Time, condition, reason, purpose, result and concession', '20 lessons', true],
      ['reported-speech', 'Reported Speech', 'Tense, person, time and word-order changes', '21 lessons', true]
    ],
    discourse: [
      ['cohesion-reference', 'Cohesion & Reference', 'Pronoun reference, substitution and logical links', '22 lessons', true],
      ['information-order', 'Information Order', 'English focus, end-weight and Chinese-English order differences', '22 lessons', true],
      ['punctuation', 'Punctuation & Capitals', 'Sentence boundaries, commas, apostrophes and capitals', '21 lessons', true],
      ['common-expression', 'Common Expression Differences', 'Frequent Chinese-to-English structural differences', '21 lessons', true]
    ]
  } : {
    morphology: [
      ['parts-of-speech', '十大词性', '名词、代词、动词及其他词类的作用与变化', '10 类 · 已开放', true],
      ['word-formation', '构词法', '前缀、后缀、转化与合成词', '18 节 · 已开放', true]
    ],
    syntax: [
      ['sentence-elements', '句子成分', '主语、谓语、宾语、表语、定语、状语与补语', '23 节 · 已开放', true],
      ['basic-patterns', '基本句型', '五大句型、存在句与结构转换', '16 节 · 已开放', true],
      ['predicate-system', '谓语系统', '主谓一致、时态、语态、助动词与情态动词', '20 节 · 已开放', true],
      ['nonfinite-system', '非谓语结构', '不定式、动名词和分词', '19 节 · 已开放', true],
      ['special-structures', '特殊句式', '疑问、倒装、强调、省略与祈使句', '28 节 · 已开放', true]
    ],
    clauses: [
      ['coordination', '并列句', '连接词、标点、逻辑关系与平行分句', '22 节 · 已开放', true],
      ['noun-clauses', '名词性从句', '主语、宾语、表语与同位语从句', '22 节 · 已开放', true],
      ['relative-clauses', '定语从句', '关系词、先行词与从句结构', '21 节 · 已开放', true],
      ['adverbial-clauses', '状语从句', '时间、条件、原因、目的、结果与让步', '20 节 · 已开放', true],
      ['reported-speech', '直接引语与间接引语', '时态、人称、时间和语序变化', '21 节 · 已开放', true]
    ],
    discourse: [
      ['cohesion-reference', '衔接与指代', '代词指代、替代与逻辑连接', '22 节 · 已开放', true],
      ['information-order', '信息顺序', '英语焦点、尾重原则与中英语序差异', '22 节 · 已开放', true],
      ['punctuation', '标点与大小写', '句界、逗号、撇号和大写规则', '21 节 · 已开放', true],
      ['common-expression', '中英表达差异', '常见中文思维到英文结构的转换', '21 节 · 已开放', true]
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
    core: english ? 'Core rules' : '语法本质',
    back: english ? 'Back' : '返回',
    backSystem: english ? '‹ Grammar System' : '‹ 语法体系',
    backMorphology: english ? '‹ Word Grammar' : '‹ 词法',
    backDirectory: english ? '‹ Parts of Speech' : '‹ 十大词性',
    backSections: english ? '‹ Category Map' : '‹ 类别地图',
    backVerbMap: english ? '‹ Verb Map' : '‹ 动词地图',
    backVerbCourse: english ? '‹ Complete verb course' : '‹ 动词完整课程',
    backCourse: english ? '‹ Course Map' : '‹ 课程地图',
    nextQuestion: english ? 'Next question' : '下一题',
    nextLesson: english ? 'Next lesson' : '继续下一小节',
    finish: english ? 'Finish and return' : '完成并返回',
    answerFirst: english ? 'Answer correctly to continue' : '答对后继续',
    retry: english ? 'Try again' : '再试一次',
    lessonUnit: english ? 'lessons' : '节微课',
    coreLevel: english ? 'Core' : '核心',
    advancedLevel: english ? 'Advanced' : '进阶',
    loadError: english ? 'The course could not be opened. Return and try again.' : '课程暂时无法打开，请返回后重试。',
    cachedCourse: english ? 'Showing the saved course. Cloud sync is temporarily unavailable.' : '已打开设备缓存，云端同步暂时失败。',
    loadingCourse: english ? 'Loading course…' : '正在加载课程…',
    retryCourse: english ? 'Retry' : '重新加载',
    planned: english ? 'Course in progress' : '课程正在建设',
    listenNarration: english ? 'Play' : '播放讲解',
    resumeNarration: english ? 'Resume' : '继续播放',
    loadingNarration: english ? 'Preparing…' : '准备中…',
    pauseNarration: english ? 'Pause' : '暂停',
    replayNarration: english ? 'Replay' : '重新播放',
    restartNarration: english ? 'Play from start' : '从头播放',
    rewindNarration: '-15s',
    forwardNarration: '+15s',
    narrationUnavailable: english ? 'Audio is temporarily unavailable.' : '讲解语音暂时不可用'
  };
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
    domainBackText: '',
    domainItems: [],
    selectedTopic: '',
    courseLoading: false,
    courseLoadFallback: false,
    course: [],
    groups: [],
    sections: [],
    hasSectionMap: false,
    activeSectionId: '',
    activeSectionTitle: '',
    activeSectionCopy: '',
    courseTitle: '',
    courseCopy: '',
    activeLesson: null,
    lessonIndex: -1,
    lessonPosition: 0,
    questionIndex: 0,
    activeQuestion: null,
    answer: '',
    result: '',
    isLastQuestion: false,
    isLastLesson: false,
    narrationLoading: false,
    narrationPlaying: false,
    narrationReady: false,
    narrationEnded: false,
    narrationProgress: 0,
    narrationCurrentTime: 0,
    narrationDuration: 0,
    narrationTimeText: '00:00 / 00:00',
    debugMessage: ''
  },

  onLoad(options = {}) {
    this.pageStartedAt = Date.now();
    this.classroomPerf = page.startPagePerf('grammar-classroom');
    this.plannedEntry = {
      topic: String(options.topic || ''),
      lessonNumber: Math.max(1, Number(options.lessonNumber || 1)),
      taskId: String(options.taskId || '')
    };
    this.plannedResume = this.readPlannedResume();
    this.plannedCorrectQuestionIndexes = new Set(
      Array.isArray(this.plannedResume.correctQuestionIndexes)
        ? this.plannedResume.correctQuestionIndexes.map((item) => Number(item))
        : Array.from({ length: Number(this.plannedResume.questionIndex || 0) }, (_, index) => index)
    );
    if (this.plannedResume.result === 'correct') {
      this.plannedCorrectQuestionIndexes.add(Number(this.plannedResume.questionIndex || 0));
    }
    this.plannedNarrationListenedSec = Number(this.plannedResume.listenedSec || 0);
    this.plannedNarrationResumePosition = Number(this.plannedResume.audioPosition || 0);
    this.plannedNarrationLastTime = null;
    this.rememberActivePlannedTask();
    this.syncPreferences();
    if (this.plannedEntry.topic) {
      this.loadCourse(this.plannedEntry.topic);
    }
  },

  onShow() {
    this.syncPreferences();
  },

  onReady() {
    if (this.plannedEntry && this.plannedEntry.topic) return;
    wx.nextTick(() => {
      this.createSelectorQuery().select('.domain-item').boundingClientRect((rect) => {
        if (!rect) {
          this.setData({ debugMessage: 'DEBUG: grammar-package/pages/classroom.onReady -> system.render -> .domain-item: missing' });
          return;
        }
        this.reportPageReady('directory', true);
      }).exec();
    });
  },

  onUnload() {
    this.persistPlannedResume();
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadRequestId = (this.loadRequestId || 0) + 1;
    if (this.narrationPollTimer) clearTimeout(this.narrationPollTimer);
    if (this.narrationSeekFallbackTimer) clearTimeout(this.narrationSeekFallbackTimer);
    this.narrationRequestKey = '';
    if (this.narrationAudioContext) {
      this.narrationAudioContext.destroy();
      this.narrationAudioContext = null;
    }
  },

  getPlannedResumeKey() {
    return this.plannedEntry && this.plannedEntry.taskId
      ? `${PLANNED_RESUME_PREFIX}${this.plannedEntry.taskId}`
      : '';
  },

  rememberActivePlannedTask() {
    if (!this.plannedEntry || !this.plannedEntry.taskId) return;
    try {
      const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
      wx.setStorageSync(getActiveGrammarTaskKey(target), Object.assign({}, this.plannedEntry, {
        updatedAt: Date.now()
      }));
    } catch (error) {}
  },

  readPlannedResume() {
    const key = this.getPlannedResumeKey();
    if (!key) return {};
    try {
      const value = wx.getStorageSync(key);
      return value && typeof value === 'object' ? value : {};
    } catch (error) {
      return {};
    }
  },

  persistPlannedResume() {
    const key = this.getPlannedResumeKey();
    if (!key || !this.data.activeLesson) return;
    try {
      wx.setStorageSync(key, {
        topic: this.plannedEntry.topic,
        lessonNumber: this.plannedEntry.lessonNumber,
        taskId: this.plannedEntry.taskId,
        lessonId: this.data.activeLesson.id || '',
        questionIndex: Number(this.data.questionIndex || 0),
        answer: this.data.answer || '',
        result: this.data.result || '',
        correctQuestionIndexes: Array.from(this.plannedCorrectQuestionIndexes || []).sort((left, right) => left - right),
        listenedSec: Number(this.plannedNarrationListenedSec || 0),
        audioPosition: Number(this.data.narrationCurrentTime || 0),
        updatedAt: Date.now()
      });
    } catch (error) {}
  },

  clearPlannedResume(taskId) {
    try {
      wx.removeStorageSync(`${PLANNED_RESUME_PREFIX}${taskId}`);
    } catch (error) {}
  },

  recordPlannedNarrationProgress(currentTime, duration) {
    if (!this.plannedEntry || !this.plannedEntry.taskId || this.narrationSeeking || !this.data.narrationPlaying) {
      this.plannedNarrationLastTime = Number(currentTime || 0);
      return;
    }
    const current = Math.max(0, Number(currentTime || 0));
    const last = Number(this.plannedNarrationLastTime);
    const delta = Number.isFinite(last) ? current - last : 0;
    if (delta > 0 && delta <= 1.5) {
      const safeDuration = Math.max(0, Number(duration || 0));
      this.plannedNarrationListenedSec = Math.min(
        safeDuration || Infinity,
        Number(this.plannedNarrationListenedSec || 0) + delta
      );
    }
    this.plannedNarrationLastTime = current;
    const now = Date.now();
    if (!this.plannedResumeSavedAt || now - this.plannedResumeSavedAt >= 5000) {
      this.plannedResumeSavedAt = now;
      this.persistPlannedResume();
    }
  },

  hasCompletedPlannedNarration() {
    const duration = Number(this.data.narrationDuration || 0);
    return duration > 0 && Number(this.plannedNarrationListenedSec || 0) >= duration * PLANNED_AUDIO_COMPLETE_RATIO;
  },

  hasCompletedPlannedQuestions() {
    const questions = this.data.activeLesson && this.data.activeLesson.questions || [];
    return questions.length > 0 && questions.every((_question, index) => (
      this.plannedCorrectQuestionIndexes && this.plannedCorrectQuestionIndexes.has(index)
    ));
  },

  syncPreferences() {
    const storedTheme = wx.getStorageSync(THEME_KEY);
    const storedLanguage = wx.getStorageSync(LANGUAGE_KEY);
    const theme = storedTheme === 'library' ? 'library' : 'warm';
    const language = storedLanguage === 'en' ? 'en' : 'zh-CN';
    const languageChanged = this.data.language !== language && this.data.screen !== 'system';
    this.setData({ theme, language, ui: uiText(language === 'en') });
    if (languageChanged) this.backToSystem();
    wx.setNavigationBarTitle({ title: language === 'en' ? 'Grammar Micro-Lessons' : '语法微课堂' });
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: theme === 'library' ? '#FAF5EA' : '#F6FBFD' });
  },

  reportPerformance(id, value) {
    try {
      if (wx.reportPerformance) wx.reportPerformance(id, Math.max(0, Number(value || 0)), 'grammar-classroom');
    } catch (error) {}
  },

  reportPageReady(source, cacheHit) {
    if (this.pageReadyReported) return;
    this.pageReadyReported = true;
    if (this.classroomPerf) this.classroomPerf.ready('pageReady', { source, cacheHit: Boolean(cacheHit) });
    this.reportPerformance(2101, Date.now() - (this.pageStartedAt || Date.now()));
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
    this.setData({ screen: 'domain-map', selectedDomain: domain, domainTitle: selected.title, domainCopy: selected.meta, domainBackText: `‹ ${selected.title}`, domainItems: ui.domainMaps[domain] || [], debugMessage: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  selectDomainItem(event) {
    const item = String(event.currentTarget.dataset.item || '');
    if (item === 'parts-of-speech') {
      this.setData({ screen: 'directory', debugMessage: '' });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      return;
    }
    if (item === 'word-formation' || item === 'sentence-elements' || item === 'basic-patterns' || item === 'predicate-system' || item === 'nonfinite-system' || item === 'special-structures' || item === 'coordination' || item === 'noun-clauses' || item === 'relative-clauses' || item === 'adverbial-clauses' || item === 'reported-speech' || item === 'cohesion-reference' || item === 'information-order' || item === 'punctuation' || item === 'common-expression') return this.loadCourse(item);
    wx.showToast({ title: this.data.ui.planned, icon: 'none', duration: 2200 });
  },

  selectVerbCourse() {
    this.loadCourse('verb');
  },

  async loadCourse(topic) {
    this.loadStartedAt = Date.now();
    const requestId = (this.loadRequestId || 0) + 1;
    this.loadRequestId = requestId;
    if (this.loadTimer) clearTimeout(this.loadTimer);
    const language = this.data.language === 'en' ? 'en' : 'zh-CN';
    const versionKey = `${topic}:${language}`;
    const known = this.courseVersions && this.courseVersions[versionKey] || {};
    this.setData({ selectedTopic: topic, courseLoading: true, courseLoadFallback: false, debugMessage: '' });
    this.loadTimer = setTimeout(() => {
      if (this.loadRequestId === requestId && this.data.selectedTopic === topic && this.data.courseLoading) {
        this.setData({ debugMessage: `DEBUG: grammar-package/pages/classroom.loadCourse -> store.getGrammarClassroomCourse -> cloud.getGrammarClassroomCourse -> result.course/bundle: pending; topic=${topic}; language=${language}; targetChildId=${this.getDebugTargetChildId()}` });
      }
    }, 1500);
    try {
      const result = await store.getGrammarClassroomCourse({
        topic,
        language,
        knownReleaseId: known.releaseId || '',
        knownContentVersion: known.contentVersion || ''
      }, (fresh) => this.handleCourseBackgroundRefresh(topic, language, versionKey, requestId, fresh));
      if (this.loadRequestId !== requestId || this.data.selectedTopic !== topic) return;
      if (this.loadTimer) clearTimeout(this.loadTimer);
      if (!result || !result.bundle) {
        this.showCourseLoadError(topic, language, result);
        return;
      }
      if (this.classroomPerf) {
        if (!result.staleWhileRevalidate) this.classroomPerf.mark('cloudRefresh', { topic, language, cacheHit: Boolean(result.cacheHit), cacheFallback: Boolean(result.cacheFallback) });
        this.classroomPerf.mark('dataFresh', { topic, releaseId: result.releaseId || '', contentVersion: result.contentVersion || '' });
      }
      if (result.cachePersisted !== false) {
        this.courseVersions = this.courseVersions || {};
        this.courseVersions[versionKey] = {
          releaseId: String(result.releaseId || ''),
          contentVersion: String(result.contentVersion || '')
        };
      }
      const fallbackDebug = result.cacheFallback
        ? this.buildCourseLoadDebug(topic, language, result, 'cached-fallback')
        : '';
      this.coursePageReadyCacheHit = Boolean(result.cacheHit);
      this.applyCourseBundle(result.bundle, fallbackDebug, Boolean(result.cacheFallback));
    } catch (error) {
      if (this.loadRequestId !== requestId || this.data.selectedTopic !== topic) return;
      if (this.loadTimer) clearTimeout(this.loadTimer);
      this.showCourseLoadError(topic, language, { cloudError: { message: error && error.message || 'unknown' } });
    }
  },

  handleCourseBackgroundRefresh(topic, language, versionKey, requestId, result) {
    if (this.loadRequestId !== requestId || this.data.selectedTopic !== topic || !result) return;
    if (this.classroomPerf) this.classroomPerf.mark('cloudRefresh', { topic, language, cacheHit: Boolean(result.cacheHit), cacheFallback: Boolean(result.cacheFallback) });
    if (result.cacheFallback || result.syncMode === 'cloud-error' || !result.notModified && !result.bundle) {
      this.setData({
        courseLoadFallback: true,
        debugMessage: this.buildCourseLoadDebug(topic, language, result, 'cached-fallback')
      });
      return;
    }
    this.courseVersions = this.courseVersions || {};
    this.courseVersions[versionKey] = {
      releaseId: String(result.releaseId || ''),
      contentVersion: String(result.contentVersion || '')
    };
    if (result.notModified || !result.bundle) return;
    if ((this.data.screen === 'course-map' || this.data.screen === 'section-map') && !this.data.activeSectionId) {
      this.applyCourseBundle(result.bundle, '', false);
    }
  },

  applyCourseBundle(bundle, debugMessage, courseLoadFallback) {
    const sourceCourse = bundle.course || [];
    const sourceById = sourceCourse.reduce((map, lesson) => Object.assign(map, { [lesson.id]: lesson }), {});
    const rawSections = Array.isArray(bundle.sections) ? bundle.sections : [];
    const sectionOrder = rawSections.flatMap((section) => section.lessonIds || []);
    const hasValidSections = sectionOrder.length === sourceCourse.length && new Set(sectionOrder).size === sourceCourse.length && sectionOrder.every((id) => sourceById[id]);
    const course = (hasValidSections ? sectionOrder.map((id) => sourceById[id]) : sourceCourse).map((lesson, index) => Object.assign({}, lesson, { no: String(index + 1).padStart(2, '0') }));
    this.fullCourse = course;
    this.activeCourse = course;
    const courseSummaries = course.map(({ id, no, level, title, meta }) => ({ id, no, level, title, meta }));
    const summaryById = courseSummaries.reduce((map, lesson) => Object.assign(map, { [lesson.id]: lesson }), {});
    const sections = (hasValidSections ? rawSections : []).map((section, index) => {
      const lessons = (section.lessonIds || []).map((id) => summaryById[id]).filter(Boolean);
      const coreCount = lessons.filter((lesson) => lesson.level === 'core').length;
      const advancedCount = lessons.length - coreCount;
      return {
        id: section.id || `section-${index + 1}`,
        no: String(index + 1).padStart(2, '0'),
        title: section.title || '',
        copy: section.copy || '',
        lessonIds: lessons.map((lesson) => lesson.id),
        lessonCount: lessons.length,
        countText: `${lessons.length} ${this.data.ui.lessonUnit}`,
        levelText: [coreCount ? `${this.data.ui.coreLevel} ${coreCount}` : '', advancedCount ? `${this.data.ui.advancedLevel} ${advancedCount}` : ''].filter(Boolean).join(' · ')
      };
    });
    const hasSectionMap = sections.length > 1;
    const groups = sections.length
      ? sections.map((section) => ({ id: section.id, title: section.title, copy: section.copy, lessons: section.lessonIds.map((id) => summaryById[id]).filter(Boolean) }))
      : [{ id: 'course', title: '', copy: '', lessons: courseSummaries }];
    this.courseSummaries = courseSummaries;
    this.courseSummaryById = summaryById;
    this.courseSections = sections;
    this.setData({
      screen: hasSectionMap ? 'section-map' : 'course-map',
      courseLoading: false,
      courseLoadFallback: Boolean(courseLoadFallback),
      course: courseSummaries,
      groups: hasSectionMap ? [] : groups,
      sections,
      hasSectionMap,
      activeSectionId: '',
      activeSectionTitle: '',
      activeSectionCopy: '',
      courseTitle: bundle.title || '',
      courseCopy: bundle.copy || '',
      activeLesson: null,
      lessonIndex: -1,
      lessonPosition: 0,
      questionIndex: 0,
      activeQuestion: null,
      answer: '',
      result: '',
      debugMessage: debugMessage || ''
    }, () => {
      this.reportPerformance(2102, Date.now() - (this.loadStartedAt || Date.now()));
      if (this.plannedEntry && this.plannedEntry.topic === this.data.selectedTopic) {
        const plannedLesson = course[this.plannedEntry.lessonNumber - 1];
        if (plannedLesson) this.openLessonById(plannedLesson.id);
      }
    });
  },

  getDebugTargetChildId() {
    const target = store.getSelectedStudentTarget && store.getSelectedStudentTarget() || {};
    return String(target.targetChildId || 'public-course');
  },

  buildCourseLoadDebug(topic, language, result, bundleState) {
    const cloudMessage = String(result && result.cloudError && result.cloudError.message || result && result.cacheError || 'missing');
    const syncReason = String(result && result.syncDebug && result.syncDebug.reason || '');
    const envId = String(result && result.syncDebug && result.syncDebug.envId || 'missing');
    return `DEBUG: grammar-package/pages/classroom.loadCourse -> store.getGrammarClassroomCourse -> cloud.getGrammarClassroomCourse -> result.course/bundle: ${bundleState}; topic=${topic}; language=${language}; releaseId=${result && result.releaseId || 'missing'}; contentVersion=${result && result.contentVersion || 'missing'}; cloudError.message=${cloudMessage}; syncDebug.reason=${syncReason || 'missing'}; syncDebug.envId=${envId}; targetChildId=${this.getDebugTargetChildId()}`;
  },

  showCourseLoadError(topic, language, result) {
    this.setData({
      courseLoading: false,
      courseLoadFallback: false,
      debugMessage: this.buildCourseLoadDebug(topic, language, result || {}, 'missing')
    });
  },

  retryCourse() {
    const topic = String(this.data.selectedTopic || '');
    if (topic && !this.data.courseLoading) this.loadCourse(topic);
  },

  openSection(event) {
    const id = String(event.currentTarget.dataset.section || '');
    const section = (this.courseSections || []).find((item) => item.id === id);
    if (!section) return;
    const course = section.lessonIds.map((lessonId) => (this.fullCourse || []).find((lesson) => lesson.id === lessonId)).filter(Boolean);
    const summaries = section.lessonIds.map((lessonId) => this.courseSummaryById[lessonId]).filter(Boolean);
    this.activeCourse = course;
    this.setData({
      screen: 'course-map',
      course: summaries,
      groups: [{ id: section.id, title: '', copy: '', lessons: summaries }],
      activeSectionId: section.id,
      activeSectionTitle: section.title,
      activeSectionCopy: section.copy,
      activeLesson: null,
      lessonIndex: -1,
      lessonPosition: 0
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  stopNarrationAudio(cancelRequest = true) {
    if (cancelRequest) this.narrationRequestKey = '';
    if (this.narrationPollTimer) {
      clearTimeout(this.narrationPollTimer);
      this.narrationPollTimer = null;
    }
    if (this.narrationSeekFallbackTimer) {
      clearTimeout(this.narrationSeekFallbackTimer);
      this.narrationSeekFallbackTimer = null;
    }
    if (this.narrationAudioContext) {
      try { this.narrationAudioContext.stop(); } catch (error) {}
    }
    this.narrationLoadedKey = '';
    this.narrationSeeking = false;
    this.setData({
      narrationLoading: false,
      narrationPlaying: false,
      narrationReady: false,
      narrationEnded: false,
      narrationProgress: 0,
      narrationCurrentTime: 0,
      narrationDuration: 0,
      narrationTimeText: '00:00 / 00:00'
    });
  },

  formatNarrationTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  syncNarrationTime(currentTime, duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    const safeCurrent = Math.min(safeDuration || Infinity, Math.max(0, Number(currentTime) || 0));
    this.setData({
      narrationCurrentTime: safeCurrent,
      narrationDuration: safeDuration,
      narrationProgress: safeDuration ? Math.min(100, safeCurrent / safeDuration * 100) : 0,
      narrationTimeText: `${this.formatNarrationTime(safeCurrent)} / ${this.formatNarrationTime(safeDuration)}`
    });
  },

  ensureNarrationAudioContext() {
    if (this.narrationAudioContext) return this.narrationAudioContext;
    const context = wx.createInnerAudioContext();
    context.obeyMuteSwitch = false;
    context.onCanplay(() => {
      const duration = Number(context.duration) || this.data.narrationDuration;
      this.setData({ narrationReady: true });
      this.syncNarrationTime(Number(context.currentTime) || 0, duration);
      if (this.plannedNarrationResumePosition > 0 && this.plannedNarrationResumePosition < duration) {
        const resumePosition = this.plannedNarrationResumePosition;
        this.plannedNarrationResumePosition = 0;
        this.seekNarrationTo(resumePosition);
      }
    });
    context.onTimeUpdate(() => {
      if (this.narrationSeeking) return;
      this.recordPlannedNarrationProgress(context.currentTime, context.duration);
      this.syncNarrationTime(context.currentTime, context.duration);
    });
    if (typeof context.onSeeked === 'function') {
      context.onSeeked(() => this.finalizeNarrationSeek(context.currentTime));
    }
    context.onPlay(() => {
      this.plannedNarrationLastTime = Number(context.currentTime || 0);
      this.setData({ narrationLoading: false, narrationPlaying: true, narrationReady: true, narrationEnded: false });
    });
    context.onPause(() => {
      this.persistPlannedResume();
      this.setData({ narrationPlaying: false });
    });
    context.onStop(() => {
      this.persistPlannedResume();
      this.setData({ narrationPlaying: false });
    });
    context.onEnded(() => {
      const duration = Number(context.duration) || this.data.narrationDuration;
      this.syncNarrationTime(duration, duration);
      this.setData({ narrationPlaying: false, narrationEnded: true });
      this.persistPlannedResume();
    });
    context.onError((error) => {
      if (this.data.screen !== 'lesson') return;
      this.narrationLoadedKey = '';
      this.setData({
        narrationLoading: false,
        narrationPlaying: false,
        narrationReady: false,
        debugMessage: `DEBUG: grammar-package/pages/classroom.playNarration -> InnerAudioContext.play -> audioUrl: ${error && (error.errMsg || error.errCode) || 'failed'}`
      });
    });
    this.narrationAudioContext = context;
    return context;
  },

  async playNarration() {
    const narration = this.data.activeLesson && this.data.activeLesson.narration;
    if (!narration || this.data.narrationLoading) return;
    if (this.data.narrationPlaying) {
      if (this.narrationAudioContext) this.narrationAudioContext.pause();
      return;
    }
    const language = 'zh-CN';
    const requestKey = `${narration.id}:${narration.version}:shared-zh-CN`;
    this.narrationRequestKey = requestKey;
    this.narrationAudioCache = this.narrationAudioCache || {};
    const playUrl = (url) => {
      const context = this.ensureNarrationAudioContext();
      if (this.narrationLoadedKey !== requestKey) {
        this.narrationLoadedKey = requestKey;
        context.src = url;
        this.syncNarrationTime(0, 0);
        this.setData({ narrationReady: false, narrationEnded: false });
      } else if (this.data.narrationEnded) {
        context.seek(0);
        this.syncNarrationTime(0, this.data.narrationDuration);
      }
      context.play();
    };
    if (this.narrationLoadedKey === requestKey && this.narrationAudioContext) {
      playUrl(this.narrationAudioCache[requestKey] || '');
      return;
    }
    if (this.narrationAudioCache[requestKey]) {
      playUrl(this.narrationAudioCache[requestKey]);
      return;
    }
    this.setData({ narrationLoading: true, narrationPlaying: false, debugMessage: '' });
    const requestAudio = async () => {
      try {
        const result = await store.getGrammarNarrationAudio({
          narrationId: narration.id,
          version: narration.version,
          language,
          text: narration.text
        });
        if (this.narrationRequestKey !== requestKey) return;
        if (result && result.generating) {
          const retryAfterMs = Math.min(10000, Math.max(1500, Number(result.retryAfterMs) || 3000));
          this.setData({ narrationLoading: true, narrationPlaying: false, debugMessage: '' });
          if (this.narrationPollTimer) clearTimeout(this.narrationPollTimer);
          this.narrationPollTimer = setTimeout(requestAudio, retryAfterMs);
          return;
        }
        const audioUrl = String(result && result.audioUrl || '').trim();
        if (!audioUrl) {
          const reason = result && (result.error || result.cloudError && result.cloudError.message) || 'audioUrl missing';
          throw new Error(reason);
        }
        if (this.narrationPollTimer) clearTimeout(this.narrationPollTimer);
        this.narrationPollTimer = null;
        this.narrationAudioCache[requestKey] = audioUrl;
        this.setData({ narrationLoading: false });
        playUrl(audioUrl);
      } catch (error) {
        if (this.narrationRequestKey !== requestKey) return;
        if (this.narrationPollTimer) clearTimeout(this.narrationPollTimer);
        this.narrationPollTimer = null;
        this.setData({
          narrationLoading: false,
          narrationPlaying: false,
          debugMessage: `DEBUG: grammar-package/pages/classroom.playNarration -> store.getGrammarNarrationAudio -> result.audioUrl: ${error && error.message || 'missing'}`
        });
        wx.showToast({ title: this.data.ui.narrationUnavailable, icon: 'none', duration: 2200 });
      }
    };
    await requestAudio();
  },

  seekNarrationTo(seconds) {
    const context = this.narrationAudioContext;
    const duration = Number(context && context.duration) || this.data.narrationDuration;
    if (!context || !this.data.narrationReady || !duration) return;
    const target = Math.min(duration, Math.max(0, Number(seconds) || 0));
    this.narrationSeeking = true;
    if (this.narrationSeekFallbackTimer) clearTimeout(this.narrationSeekFallbackTimer);
    context.seek(target);
    this.syncNarrationTime(target, duration);
    this.setData({ narrationEnded: target >= duration - 0.1 });
    this.narrationSeekFallbackTimer = setTimeout(() => this.finalizeNarrationSeek(target), 600);
  },

  finalizeNarrationSeek(position) {
    if (this.narrationSeekFallbackTimer) {
      clearTimeout(this.narrationSeekFallbackTimer);
      this.narrationSeekFallbackTimer = null;
    }
    const context = this.narrationAudioContext;
    const duration = Number(context && context.duration) || this.data.narrationDuration;
    const current = Math.min(duration || Infinity, Math.max(0, Number(position) || 0));
    this.narrationSeeking = false;
    this.syncNarrationTime(current, duration);
    this.setData({ narrationEnded: current >= duration - 0.1 });
  },

  rewindNarration() {
    this.seekNarrationTo(this.data.narrationCurrentTime - 15);
  },

  forwardNarration() {
    this.seekNarrationTo(this.data.narrationCurrentTime + 15);
  },

  replayNarration() {
    if (!this.narrationAudioContext || !this.data.narrationReady) return;
    this.seekNarrationTo(0);
    this.narrationAudioContext.play();
  },

  previewNarrationSeek(event) {
    const duration = this.data.narrationDuration;
    if (!duration) return;
    this.narrationSeeking = true;
    this.syncNarrationTime(duration * Number(event.detail.value || 0) / 100, duration);
  },

  seekNarration(event) {
    const duration = this.data.narrationDuration;
    if (!duration) return;
    this.seekNarrationTo(duration * Number(event.detail.value || 0) / 100);
  },

  openLesson(event) {
    const id = String(event.currentTarget.dataset.lesson || '');
    this.openLessonById(id);
  },

  openLessonById(id) {
    const course = this.activeCourse || this.fullCourse || [];
    const index = course.findIndex((lesson) => lesson.id === id);
    const lesson = index >= 0 ? course[index] : null;
    if (!lesson || !lesson.questions || !lesson.questions.length) return;
    this.stopNarrationAudio();
    const startedAt = Date.now();
    const resume = this.plannedResume && this.plannedResume.lessonId === lesson.id ? this.plannedResume : {};
    const questionIndex = Math.min(Math.max(Number(resume.questionIndex || 0), 0), lesson.questions.length - 1);
    this.setData({
      screen: 'lesson',
      activeLesson: lesson,
      lessonIndex: index,
      lessonPosition: index + 1,
      questionIndex,
      activeQuestion: lesson.questions[questionIndex],
      answer: resume.answer || '',
      result: resume.result || '',
      narrationLoading: false,
      narrationPlaying: false,
      isLastQuestion: questionIndex === lesson.questions.length - 1,
      isLastLesson: index === course.length - 1
    }, () => {
      this.reportPerformance(2103, Date.now() - startedAt);
      if (this.plannedEntry && this.plannedEntry.topic) {
        this.reportPageReady('planned-lesson', this.coursePageReadyCacheHit);
      }
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    });
  },

  chooseAnswer(event) {
    if (this.data.answer || !this.data.activeQuestion) return;
    const answer = String(event.currentTarget.dataset.answer || '');
    const result = answer === this.data.activeQuestion.answer ? 'correct' : 'wrong';
    if (result === 'correct' && this.plannedCorrectQuestionIndexes) {
      this.plannedCorrectQuestionIndexes.add(Number(this.data.questionIndex || 0));
    }
    this.setData({ answer, result }, () => this.persistPlannedResume());
  },

  retry() {
    this.setData({ answer: '', result: '' });
  },

  async continueLesson() {
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
      }, () => this.persistPlannedResume());
      return;
    }
    if (this.plannedEntry && this.plannedEntry.taskId) {
      const completedTaskId = this.plannedEntry.taskId;
      if (!this.hasCompletedPlannedQuestions()) {
        wx.showToast({ title: '请先完成全部课堂练习', icon: 'none', duration: 2400 });
        this.persistPlannedResume();
        return;
      }
      if (!this.hasCompletedPlannedNarration()) {
        wx.showToast({ title: '讲解音频需播放满 95%', icon: 'none', duration: 2400 });
        this.persistPlannedResume();
        return;
      }
      try {
        const totalQuestionCount = (this.data.activeLesson && this.data.activeLesson.questions || []).length;
        await store.completeGrammarPlanTask({
          taskId: completedTaskId,
          narrationDuration: Number(this.data.narrationDuration || 0),
          narrationListenedSec: Number(this.plannedNarrationListenedSec || 0),
          correctQuestionCount: this.plannedCorrectQuestionIndexes.size,
          totalQuestionCount
        });
        this.clearPlannedResume(completedTaskId);
        this.plannedEntry = null;
        wx.showToast({ title: '微课已完成', icon: 'success' });
      } catch (error) {
        this.setData({ debugMessage: `DEBUG: grammar-package/pages/classroom.continueLesson -> store.completeGrammarPlanTask -> cloud.completeGrammarPlanTask -> saved: ${error && error.message || 'missing'}; taskId=${completedTaskId}; targetChildId=${this.getDebugTargetChildId()}` });
        return;
      }
      this.backToCourseMap();
      return;
    }
    if (this.data.isLastLesson) {
      this.backToCourseMap();
      return;
    }
    const lessonIndex = this.data.lessonIndex + 1;
    const activeCourse = this.activeCourse || this.fullCourse || [];
    const nextLesson = activeCourse[lessonIndex];
    this.stopNarrationAudio();
    this.setData({
      activeLesson: nextLesson,
      lessonIndex,
      lessonPosition: lessonIndex + 1,
      questionIndex: 0,
      activeQuestion: nextLesson.questions[0],
      answer: '',
      result: '',
      isLastQuestion: nextLesson.questions.length === 1,
      isLastLesson: lessonIndex === activeCourse.length - 1
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  backToCourseMap() {
    this.stopNarrationAudio();
    this.setData({ screen: 'course-map', activeLesson: null, lessonIndex: -1, lessonPosition: 0, activeQuestion: null, answer: '', result: '', narrationLoading: false, narrationPlaying: false });
  },

  backFromCourseMap() {
    if (this.data.hasSectionMap) return this.backToSectionMap();
    if (this.data.selectedTopic === 'word-formation' || this.data.selectedDomain !== 'morphology') return this.backToDomainMap();
    this.backToDirectory();
  },

  backToSectionMap() {
    this.activeCourse = this.fullCourse || [];
    this.setData({
      screen: 'section-map',
      course: this.courseSummaries || [],
      groups: [],
      activeSectionId: '',
      activeSectionTitle: '',
      activeSectionCopy: '',
      activeLesson: null,
      lessonIndex: -1,
      lessonPosition: 0,
      activeQuestion: null,
      answer: '',
      result: ''
    });
  },

  backFromSectionMap() {
    if (this.data.selectedTopic === 'word-formation' || this.data.selectedDomain !== 'morphology') return this.backToDomainMap();
    this.backToDirectory();
  },

  backToDirectory() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.stopNarrationAudio();
    this.fullCourse = [];
    this.activeCourse = [];
    this.setData({ screen: 'directory', selectedTopic: '', courseLoading: false, course: [], groups: [], sections: [], hasSectionMap: false, activeSectionId: '', activeSectionTitle: '', activeSectionCopy: '', courseTitle: '', courseCopy: '', activeLesson: null, debugMessage: '' });
  },

  backToDomainMap() {
    const domain = this.data.selectedDomain || 'morphology';
    const ui = this.data.ui;
    const selected = ui.domains.find((item) => item.id === domain) || ui.domains[0];
    this.stopNarrationAudio();
    this.fullCourse = [];
    this.activeCourse = [];
    this.setData({ screen: 'domain-map', selectedDomain: selected.id, domainTitle: selected.title, domainCopy: selected.meta, domainBackText: `‹ ${selected.title}`, domainItems: ui.domainMaps[selected.id] || [], selectedTopic: '', courseLoading: false, course: [], groups: [], sections: [], hasSectionMap: false, activeSectionId: '', activeSectionTitle: '', activeSectionCopy: '', activeLesson: null, debugMessage: '' });
  },

  backToSystem() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.stopNarrationAudio();
    this.fullCourse = [];
    this.activeCourse = [];
    this.setData({ screen: 'system', selectedDomain: '', domainTitle: '', domainCopy: '', domainBackText: '', domainItems: [], selectedTopic: '', courseLoading: false, course: [], groups: [], sections: [], hasSectionMap: false, activeSectionId: '', activeSectionTitle: '', activeSectionCopy: '', activeLesson: null, debugMessage: '' });
  },

  handleTopBack() {
    if (this.data.screen === 'lesson') return this.backToCourseMap();
    if (this.data.screen === 'course-map') return this.backFromCourseMap();
    if (this.data.screen === 'section-map') return this.backFromSectionMap();
    if (this.data.screen === 'directory') return this.backToDomainMap();
    if (this.data.screen === 'domain-map') return this.backToSystem();
    this.closePage();
  },

  closePage() {
    wx.navigateBack({ delta: 1, fail: () => this.backToSystem() });
  }
});
