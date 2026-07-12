const wordCourses = require('../../domain/grammar-classroom/word-courses');

Component({
  properties: {
    topic: { type: String, value: '' },
    language: { type: String, value: 'zh-CN' }
  },
  observers: {
    'topic, language': function onCoursePropertyChanged(topic, language) {
      if (this._componentReady) this.loadWordCourse(topic, language);
    }
  },
  lifetimes: {
    ready() {
      this._componentReady = true;
      this.loadWordCourse(this.data.topic, this.data.language);
    }
  },
  methods: {
    loadWordCourse(topic, language) {
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
