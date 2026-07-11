const test = require('node:test');
const assert = require('node:assert/strict');

global.wx = {
  store: {},
  getStorageSync(key) {
    return this.store[key];
  },
  setStorageSync(key, value) {
    this.store[key] = value;
  }
};
global.getApp = () => ({ globalData: {} });

const i18n = require('../utils/i18n');

test('language persists zh-CN and en', () => {
  assert.equal(i18n.setLanguage('en'), 'en');
  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.getText('settings.title'), 'Settings');

  assert.equal(i18n.setLanguage('zh-CN'), 'zh-CN');
  assert.equal(i18n.getText('settings.title'), '设置');
});

test('unsupported language falls back to simplified Chinese', () => {
  assert.equal(i18n.normalizeLanguage('fr'), 'zh-CN');
  assert.equal(i18n.getText('settings.languageTitle', 'fr'), '语言');
});
