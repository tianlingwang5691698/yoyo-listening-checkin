const pronounCourses = require('../../domain/grammar-classroom/pronoun-courses');

Component({
  properties: {
    topic: { type: String, value: '' },
    language: { type: String, value: 'zh-CN' }
  },
  observers: {
    'topic, language': function onCoursePropertyChanged(topic, language) {
      if (this._componentReady) this.loadPronounCourse(topic, language);
    }
  },
  lifetimes: {
    ready() {
      this._componentReady = true;
      this.loadPronounCourse(this.data.topic, this.data.language);
    }
  },
  methods: {
    loadPronounCourse(topic, language) {
      if (topic !== 'pronoun') return;
      try {
        this.triggerEvent('loaded', { topic, bundle: pronounCourses.buildPronounCourse(language === 'en') });
      } catch (error) {
        this.triggerEvent('loaderror', { topic, message: error && error.message ? error.message : 'unknown' });
      }
    }
  }
});
