const courses = require('../../domain/grammar-classroom/basic-sentence-patterns-courses');

Component({
  properties: { topic: { type: String, value: '' }, language: { type: String, value: 'zh-CN' } },
  observers: { 'topic, language': function onPropertyChanged(topic, language) { if (this._ready) this.load(topic, language); } },
  lifetimes: { ready() { this._ready = true; this.load(this.data.topic, this.data.language); } },
  methods: {
    load(topic, language) {
      if (topic !== 'basic-patterns') return;
      const key = `${topic}:${language}`;
      if (this._loadedKey === key) return;
      try {
        const bundle = courses.buildBasicSentencePatternsCourse(language === 'en');
        this._loadedKey = key;
        this.triggerEvent('loaded', { topic, bundle });
      } catch (error) {
        this.triggerEvent('loaderror', { topic, message: error && error.message ? error.message : 'unknown' });
      }
    }
  }
});
