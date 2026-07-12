const courses = require('../../domain/grammar-classroom/sentence-elements-courses');

Component({
  properties: { topic: { type: String, value: '' }, language: { type: String, value: 'zh-CN' } },
  observers: { 'topic, language': function onPropertyChanged(topic, language) { if (this._ready) this.load(topic, language); } },
  lifetimes: { ready() { this._ready = true; this.load(this.data.topic, this.data.language); } },
  methods: {
    load(topic, language) {
      if (topic !== 'sentence-elements') return;
      const key = `${topic}:${language}`;
      if (this._loadedKey === key) return;
      try {
        const bundle = courses.buildSentenceElementsCourse(language === 'en');
        this._loadedKey = key;
        this.triggerEvent('loaded', { topic, bundle });
      } catch (error) {
        this.triggerEvent('loaderror', { topic, message: error && error.message ? error.message : 'unknown' });
      }
    }
  }
});
