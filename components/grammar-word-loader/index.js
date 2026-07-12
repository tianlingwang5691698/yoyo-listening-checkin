const wordCourses = require('../../data/grammar-classroom/word-courses');

Component({
  properties: {
    topic: { type: String, value: '' },
    language: { type: String, value: 'zh-CN' }
  },
  observers: {
    'topic, language': function loadWordCourse(topic, language) {
      if (topic !== 'noun' && topic !== 'pronoun') return;
      try {
        const english = language === 'en';
        const bundle = topic === 'pronoun'
          ? wordCourses.buildPronounCourse(english)
          : wordCourses.buildNounCourse(english);
        this.triggerEvent('loaded', { topic, bundle });
      } catch (error) {
        this.triggerEvent('loaderror', { topic, message: error && error.message ? error.message : 'unknown' });
      }
    }
  }
});
