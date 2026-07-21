const store = require('../../utils/store');
const page = require('../../utils/page');
const themeStore = require('../../utils/theme');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');

const FALLBACK_TEXT = {
  'zh-CN': {
    title: '设置',
    subtitle: '管理账号、外观与显示语言',
    accountSection: '账号',
    preferenceSection: '偏好',
    familyTitle: '家庭与账号',
    familyDescription: '管理身份、学号与家庭成员',
    appearanceTitle: '外观主题',
    appearanceDescription: '选择你喜欢的界面风格',
    languageTitle: '语言',
    languageDescription: '设置界面显示语言',
    adminTitle: '后台管理',
    adminDescription: '查看用户与学习数据',
    adminBadge: '管理者',
    warmTheme: '雾蓝玻璃',
    libraryTheme: '图书馆静谧',
    voyageTheme: '伟大航路',
    dragonTheme: '龙珠修炼',
    zhHans: '中文简体',
    english: 'English'
  },
  en: {
    title: 'Settings',
    subtitle: 'Manage your account, appearance, and language',
    accountSection: 'Account',
    preferenceSection: 'Preferences',
    familyTitle: 'Family & Account',
    familyDescription: 'Manage identity, student ID, and family',
    appearanceTitle: 'Appearance',
    appearanceDescription: 'Choose your preferred interface style',
    languageTitle: 'Language',
    languageDescription: 'Set the interface language',
    adminTitle: 'Admin',
    adminDescription: 'View users and learning activity',
    adminBadge: 'ADMIN',
    warmTheme: 'Mist Glass',
    libraryTheme: 'Quiet Library',
    voyageTheme: 'Grand Voyage',
    dragonTheme: 'Dragon Training',
    zhHans: '中文简体',
    english: 'English'
  }
};

const I18N_KEYS = Object.keys(accountCatalog.settings['zh-CN']);

function normalizeLanguage(value) {
  return value === 'en' ? 'en' : 'zh-CN';
}

function buildTexts(language) {
  const currentLanguage = normalizeLanguage(language);
  const fallback = FALLBACK_TEXT[currentLanguage];
  const texts = I18N_KEYS.reduce((result, key) => {
    const translated = i18n.getPageText('settings', key);
    result[key] = translated && translated !== key ? translated : (fallback[key] || '');
    return result;
  }, {});
  return texts;
}

Page({
  data: page.createCloudPageData({
    language: normalizeLanguage(i18n.getLanguage()),
    texts: buildTexts(i18n.getLanguage()),
    adminVisible: false
  }),

  onShow() {
    this.settingsPerf = page.startPagePerf('settings');
    page.syncTheme(this);
    const language = normalizeLanguage(i18n.getLanguage());
    const texts = buildTexts(language);
    this.setData({ language, texts, adminVisible: false });
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.settingsPerf.ready('pageReady', {
      source: 'local',
      cacheHit: true
    });
    setTimeout(() => this.refreshAdminStatus(), 0);
  },

  async refreshAdminStatus() {
    try {
      const status = await store.getAdminStatus({ forceRefresh: true });
      this.setData({ adminVisible: !!(status && status.isAdmin) });
      if (this.settingsPerf) {
        this.settingsPerf.mark('adminStatusRefresh', {
          isAdmin: !!(status && status.isAdmin)
        });
      }
    } catch (error) {
      this.setData({ adminVisible: false });
    }
  },

  openFamilyPage() {
    wx.navigateTo({ url: '/pages/family/index' });
  },

  openAdminPage() {
    if (!this.data.adminVisible) return;
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  changeTheme(event) {
    const nextTheme = themeStore.setTheme(event.currentTarget.dataset.theme);
    page.syncTheme(this);
    this.setData({ theme: nextTheme });
  },

  changeLanguage(event) {
    const language = normalizeLanguage(event.currentTarget.dataset.language);
    i18n.setLanguage(language);
    const texts = buildTexts(language);
    this.setData({ language, texts });
    wx.setNavigationBarTitle({ title: texts.navTitle });
  }
});
