const coordinationCourses = require('../../domain/grammar-classroom/coordination-courses');

Component({
  properties: {
    topic: { type: String, value: '' },
    language: { type: String, value: 'zh-CN' }
  },
  observers: {
    'topic, language': function onCoursePropertyChanged(topic, language) {
      if (this._componentReady) this.loadCourse(topic, language);
    }
  },
  lifetimes: {
    ready() {
      this._componentReady = true;
      this.loadCourse(this.data.topic, this.data.language);
    }
  },
  methods: {
    loadCourse(topic, language) {
      if (topic !== 'coordination') return;
      const loadKey = `${topic}:${language}`;
      if (this._lastLoadedKey === loadKey) return;
      try {
        const bundle = coordinationCourses.buildCoordinationCourse(language === 'en');
        this._lastLoadedKey = loadKey;
        this.triggerEvent('loaded', { topic, bundle });
      } catch (error) {
        this.triggerEvent('loaderror', {
          topic,
          message: error && error.message ? error.message : 'unknown'
        });
      }
    }
  }
});
