const page = require('../../utils/page');
const i18n = require('../../utils/i18n');
const wordCourses = require('../../data/grammar-classroom/word-courses');

function labels() {
  const en = i18n.getLanguage() === 'en';
  return en ? { back: 'Back', core: 'Core', retry: 'Try again', answer: 'Answer correctly to continue', nextQuestion: 'Next question', nextLesson: 'Continue', finish: 'Finish', rules: 'Key rules' } : { back: '返回', core: '核心规则', retry: '再试一次', answer: '答对后继续', nextQuestion: '下一题', nextLesson: '继续下一小节', finish: '完成并返回', rules: '核心规则' };
}

Page({
  data: page.createCloudPageData({
    topic: '', title: '', copy: '', groups: [], course: [], lesson: null,
    lessonIndex: -1, question: null, questionIndex: 0, answer: '', result: '', ui: labels(), courseDebug: ''
  }),
  onLoad(options) {
    this.coursePerf = page.startPagePerf('grammar-course');
    const topic = options && options.topic === 'pronoun' ? 'pronoun' : 'noun';
    try {
      const bundle = topic === 'pronoun'
        ? wordCourses.buildPronounCourse(i18n.getLanguage() === 'en')
        : wordCourses.buildNounCourse(i18n.getLanguage() === 'en');
      this.setData({ topic, title: bundle.title, copy: bundle.copy, groups: bundle.groups, course: bundle.course });
      wx.setNavigationBarTitle({ title: bundle.title.replace(/\s*·.*$/, '') });
      wx.nextTick(() => this.coursePerf.ready('pageReady', { source: 'local-course', cacheHit: true, topic, lessons: bundle.course.length }));
    } catch (error) {
      const courseDebug = `DEBUG: pages/grammar-course.onLoad -> wordCourses.${topic === 'pronoun' ? 'buildPronounCourse' : 'buildNounCourse'} -> course: ${error && error.message ? error.message : 'missing'}`;
      console.error(courseDebug, error);
      this.setData({ topic, courseDebug });
      wx.nextTick(() => this.coursePerf.ready('pageReady', { source: 'local-course-error', cacheHit: false, topic, lessons: 0 }));
    }
  },
  onShow() { page.syncTheme(this); },
  openLesson(event) {
    const startedAt = Date.now();
    const id = event.currentTarget.dataset.id;
    const index = this.data.course.findIndex((item) => item.id === id);
    const lesson = this.data.course[index];
    if (!lesson) return;
    this.setData({ lesson, lessonIndex: index, question: lesson.questions[0], questionIndex: 0, answer: '', result: '' });
    if (this.coursePerf) this.coursePerf.mark('actionMs', { action: 'openLesson', topic: this.data.topic, lessonId: id, actionDurationMs: Date.now() - startedAt });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  choose(event) {
    if (this.data.answer) return;
    const answer = event.currentTarget.dataset.answer;
    this.setData({ answer, result: answer === this.data.question.answer ? 'correct' : 'wrong' });
  },
  retry() { this.setData({ answer: '', result: '' }); },
  back() {
    if (this.data.lesson) this.setData({ lesson: null, lessonIndex: -1, question: null, questionIndex: 0, answer: '', result: '' });
    else wx.navigateBack();
  },
  next() {
    if (this.data.result !== 'correct') return;
    if (this.data.questionIndex < this.data.lesson.questions.length - 1) {
      const questionIndex = this.data.questionIndex + 1;
      this.setData({ questionIndex, question: this.data.lesson.questions[questionIndex], answer: '', result: '' });
      return;
    }
    if (this.data.lessonIndex >= this.data.course.length - 1) { this.back(); return; }
    const lessonIndex = this.data.lessonIndex + 1;
    const lesson = this.data.course[lessonIndex];
    this.setData({ lessonIndex, lesson, questionIndex: 0, question: lesson.questions[0], answer: '', result: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  }
});
