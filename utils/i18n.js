const LANGUAGE_STORAGE_KEY = 'yoyoLanguageV1';
const DEFAULT_LANGUAGE = 'zh-CN';

const PAGE_SCOPE_BY_ROUTE = {
  'pages/home/index': 'home',
  'pages/home/completed/index': 'completed',
  'pages/level/index': 'level',
  'pages/level-stage/index': 'levelStage',
  'pages/listening-plan/index': 'listeningPlan',
  'pages/listening-material/index': 'listeningMaterial',
  'pages/lesson/index': 'lesson',
  'pages/material/index': 'material',
  'pages/material/detail/index': 'materialDetail',
  'pages/reading/index': 'reading',
  'pages/reading/detail/index': 'readingDetail',
  'pages/reading/flashcards/index': 'flashcards',
  'pages/grammar/index': 'grammar',
  'pages/writing/detail/index': 'writing',
  'pages/speaking/index': 'speaking',
  'pages/practice-history/index': 'practiceHistory',
  'pages/profile/index': 'profile',
  'pages/settings/index': 'settings',
  'pages/family/index': 'family',
  'pages/identity/index': 'identity',
  'pages/parent/index': 'parent',
  'pages/parent/detail/index': 'parentDetail',
  'pages/record/index': 'record',
  'pages/admin/index': 'admin'
};

const LANGUAGE_ALIASES = {
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh_cn': 'zh-CN',
  en: 'en',
  'en-us': 'en',
  'en_us': 'en',
  'en-gb': 'en',
  'en_gb': 'en'
};

const TEXTS = {
  'zh-CN': {
    'settings.title': '设置',
    'settings.subtitle': '管理你的账号与使用偏好',
    'settings.accountSection': '账号',
    'settings.preferenceSection': '偏好设置',
    'settings.familyTitle': '家庭与账号',
    'settings.familyDescription': '管理家庭成员与账号',
    'settings.appearanceTitle': '外观主题',
    'settings.appearanceDescription': '选择你喜欢的界面风格',
    'settings.languageTitle': '语言',
    'settings.languageDescription': '选择界面显示语言',
    'settings.adminTitle': '后台管理',
    'settings.adminDescription': '管理应用内容与家庭',
    'settings.adminBadge': '管理员',
    'settings.warmTheme': '雾蓝玻璃',
    'settings.libraryTheme': '图书馆静谧',
    'settings.zhHans': '中文简体',
    'settings.english': '英文',
    profileTitle: '我的',
    tabToday: '今日',
    tabAudio: '音频',
    tabGrowth: '成长',
    tabProfile: '我的',
    chooseIdentity: '先选择身份',
    settings: '设置',
    settingsDescription: '家庭与账号 · 外观主题 · 语言',
    familyAndAccount: '家庭与账号',
    familyAndAccountDescription: '管理家庭成员与账号',
    appearanceTheme: '外观主题',
    appearanceThemeDescription: '选择你喜欢的界面风格',
    language: '语言',
    languageDescription: '选择界面显示语言',
    simplifiedChinese: '中文简体',
    english: '英文',
    adminPanel: '后台管理',
    adminPanelDescription: '管理应用内容与家庭',
    dailyReport: '日报',
    dailyReportDescription: '查看打卡',
    nickname: '昵称',
    required: '（必填）',
    save: '保存',
    nicknamePlaceholder: '写下常用称呼',
    changeNickname: '请更换其他名字后继续使用。',
    studentId: '学号',
    student: '学生',
    parent: '家长',
    readerCard: '读者证',
    myBookplate: '我的藏书票',
    signature: '签名栏',
    document: '档案',
    letter: '信笺',
    current: '当前',
    cancel: '取消',
    confirm: '确定'
  },
  en: {
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and preferences',
    'settings.accountSection': 'Account',
    'settings.preferenceSection': 'Preferences',
    'settings.familyTitle': 'Family & Account',
    'settings.familyDescription': 'Manage family members and account',
    'settings.appearanceTitle': 'Appearance',
    'settings.appearanceDescription': 'Choose your preferred interface style',
    'settings.languageTitle': 'Language',
    'settings.languageDescription': 'Choose the display language',
    'settings.adminTitle': 'Admin Panel',
    'settings.adminDescription': 'Manage app content and families',
    'settings.adminBadge': 'Admin',
    'settings.warmTheme': 'Mist Blue Glass',
    'settings.libraryTheme': 'Quiet Library',
    'settings.zhHans': 'Simplified Chinese',
    'settings.english': 'English',
    profileTitle: 'Me',
    tabToday: 'Today',
    tabAudio: 'Audio',
    tabGrowth: 'Growth',
    tabProfile: 'Me',
    chooseIdentity: 'Choose an identity first',
    settings: 'Settings',
    settingsDescription: 'Family & Account · Appearance · Language',
    familyAndAccount: 'Family & Account',
    familyAndAccountDescription: 'Manage family members and account',
    appearanceTheme: 'Appearance',
    appearanceThemeDescription: 'Choose your preferred interface style',
    language: 'Language',
    languageDescription: 'Choose the display language',
    simplifiedChinese: 'Simplified Chinese',
    english: 'English',
    adminPanel: 'Admin Panel',
    adminPanelDescription: 'Manage app content and families',
    dailyReport: 'Daily Report',
    dailyReportDescription: 'View check-ins',
    nickname: 'Nickname',
    required: ' (Required)',
    save: 'Save',
    nicknamePlaceholder: 'Your preferred name',
    changeNickname: 'Choose another name to continue.',
    studentId: 'Student ID',
    student: 'Student',
    parent: 'Parent',
    readerCard: 'Reader Card',
    myBookplate: 'My Bookplate',
    signature: 'Signature',
    document: 'File',
    letter: 'Letter',
    current: 'Current',
    cancel: 'Cancel',
    confirm: 'Confirm'
  }
};

const PAGE_CATALOGS = [
  require('./i18n-catalog-home'),
  require('./i18n-catalog-learning'),
  require('./i18n-catalog-account')
].reduce((result, catalog) => Object.assign(result, catalog || {}), {});

function normalizeLanguage(value) {
  const raw = String(value || '').trim();
  return LANGUAGE_ALIASES[raw.toLowerCase()] || DEFAULT_LANGUAGE;
}

function getLanguage() {
  try {
    return normalizeLanguage(wx.getStorageSync(LANGUAGE_STORAGE_KEY));
  } catch (error) {
    return DEFAULT_LANGUAGE;
  }
}

function setLanguage(value) {
  const language = normalizeLanguage(value);
  try {
    wx.setStorageSync(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {}

  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.language = language;
    }
  } catch (error) {}

  return language;
}

function getText(key, language, fallback) {
  const currentLanguage = normalizeLanguage(language || getLanguage());
  const currentTexts = TEXTS[currentLanguage] || TEXTS[DEFAULT_LANGUAGE];
  const defaultTexts = TEXTS[DEFAULT_LANGUAGE];
  if (Object.prototype.hasOwnProperty.call(currentTexts, key)) {
    return currentTexts[key];
  }
  if (Object.prototype.hasOwnProperty.call(defaultTexts, key)) {
    return defaultTexts[key];
  }
  return fallback === undefined ? key : fallback;
}

function t(key, language, fallback) {
  return getText(key, language, fallback);
}

function getCommonTexts(language) {
  const currentLanguage = normalizeLanguage(language || getLanguage());
  return Object.assign({}, TEXTS[DEFAULT_LANGUAGE], TEXTS[currentLanguage]);
}

function normalizeRoute(route) {
  return String(route || '').replace(/^\//, '');
}

function getPageScope(targetOrRoute) {
  if (typeof targetOrRoute === 'string') {
    return PAGE_SCOPE_BY_ROUTE[normalizeRoute(targetOrRoute)] || '';
  }
  const target = targetOrRoute || {};
  const directRoute = normalizeRoute(target.route || target.__route__ || '');
  if (directRoute && PAGE_SCOPE_BY_ROUTE[directRoute]) {
    return PAGE_SCOPE_BY_ROUTE[directRoute];
  }
  try {
    const pages = getCurrentPages();
    const current = pages && pages.length ? pages[pages.length - 1] : null;
    const currentRoute = normalizeRoute(current && current.route);
    return PAGE_SCOPE_BY_ROUTE[currentRoute] || '';
  } catch (error) {
    return '';
  }
}

function getPageTexts(scope, language) {
  const currentLanguage = normalizeLanguage(language || getLanguage());
  const catalog = PAGE_CATALOGS[String(scope || '')] || {};
  return Object.assign(
    {},
    getCommonTexts(currentLanguage),
    catalog[DEFAULT_LANGUAGE] || {},
    catalog[currentLanguage] || {}
  );
}

function getPageText(scope, key, language, fallback) {
  const texts = getPageTexts(scope, language);
  if (Object.prototype.hasOwnProperty.call(texts, key)) {
    return texts[key];
  }
  return fallback === undefined ? '' : fallback;
}

function buildPageLanguageData(scope, language) {
  const currentLanguage = normalizeLanguage(language || getLanguage());
  return {
    language: currentLanguage,
    texts: getPageTexts(scope, currentLanguage)
  };
}

function getLanguageOptions(language) {
  const currentLanguage = normalizeLanguage(language || getLanguage());
  return [
    { key: 'zh-CN', label: getText('simplifiedChinese', currentLanguage) },
    { key: 'en', label: getText('english', currentLanguage) }
  ];
}

module.exports = {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  getLanguage,
  setLanguage,
  getText,
  t,
  getCommonTexts,
  getLanguageOptions,
  getPageScope,
  getPageTexts,
  getPageText,
  buildPageLanguageData
};
