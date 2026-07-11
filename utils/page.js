const theme = require('./theme');
const monitor = require('./monitor');
const i18n = require('./i18n');

const CLOUD_PAGE_DEFAULTS = {
  syncMode: 'cloud-error',
  isReviewBuild: false,
  showCloudDebug: false,
  syncDebug: null,
  theme: 'warm',
  themeClass: 'theme-warm',
  themeOptions: theme.getThemeOptions(),
  currentThemeLabel: '雾蓝玻璃',
  language: i18n.getLanguage(),
  texts: i18n.getCommonTexts()
};
const IDENTITY_CONFIRMED_KEY = 'yoyoIdentityConfirmedV1';
const IDENTITY_CONFIRMED_V2_KEY = 'yoyoIdentityConfirmedV2';

function createCloudPageData(defaults) {
  return Object.assign({}, CLOUD_PAGE_DEFAULTS, theme.buildThemeData(), defaults || {});
}

function normalizeCloudPageData(data) {
  const nextData = Object.assign({}, data || {});
  nextData.syncMode = nextData.syncMode || 'cloud-error';
  nextData.isReviewBuild = !!nextData.isReviewBuild;
  nextData.showCloudDebug = !!nextData.showCloudDebug;
  nextData.syncDebug = nextData.syncDebug || null;
  return nextData;
}

function buildCloudPageData(defaults, data) {
  return Object.assign({}, createCloudPageData(defaults), normalizeCloudPageData(data), theme.buildThemeData());
}

function getChangedThemeData(target, themeData) {
  const currentData = (target && target.data) || {};
  return Object.keys(themeData).reduce((changed, key) => {
    const currentValue = currentData[key];
    const nextValue = themeData[key];
    const equal = (currentValue === nextValue)
      || (Array.isArray(currentValue) && Array.isArray(nextValue)
        && JSON.stringify(currentValue) === JSON.stringify(nextValue))
      || (currentValue && nextValue && typeof currentValue === 'object' && typeof nextValue === 'object'
        && JSON.stringify(currentValue) === JSON.stringify(nextValue));
    if (!equal) changed[key] = nextValue;
    return changed;
  }, {});
}

function syncTheme(target, options = {}) {
  const themeData = theme.buildThemeData();
  const languageData = i18n.buildPageLanguageData(i18n.getPageScope(target));
  const pageData = Object.assign({}, themeData, languageData);
  const windowColors = typeof options.windowColors === 'function'
    ? options.windowColors(themeData.theme)
    : options.windowColors;
  const windowThemeKey = JSON.stringify({ theme: themeData.theme, windowColors: windowColors || null });
  if (target && target.__windowThemeKey !== windowThemeKey) {
    theme.applyWindowTheme(themeData.theme, windowColors);
    target.__windowThemeKey = windowThemeKey;
  }
  if (target && target.setData) {
    const changedPageData = getChangedThemeData(target, pageData);
    if (Object.keys(changedPageData).length) {
      target.setData(changedPageData);
    }
  }
  const navTitle = languageData.texts && languageData.texts.navTitle;
  if (navTitle && target && target.__i18nNavTitle !== navTitle) {
    wx.setNavigationBarTitle({ title: navTitle });
    target.__i18nNavTitle = navTitle;
  }
  const tabBar = target && target.getTabBar && target.getTabBar();
  if (tabBar && tabBar.setData) {
    const changedTabThemeData = getChangedThemeData(tabBar, themeData);
    if (Object.keys(changedTabThemeData).length) {
      tabBar.setData(changedTabThemeData);
    }
    if (typeof tabBar.syncState === 'function') {
      tabBar.syncState();
    }
  }
  return pageData;
}

function setIdentityConfirmed(confirmed) {
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.identityConfirmed = !!confirmed;
  }
  try {
    if (confirmed) {
      wx.setStorageSync(IDENTITY_CONFIRMED_KEY, 'yes');
      wx.setStorageSync(IDENTITY_CONFIRMED_V2_KEY, 'yes');
    } else {
      wx.removeStorageSync(IDENTITY_CONFIRMED_KEY);
      wx.removeStorageSync(IDENTITY_CONFIRMED_V2_KEY);
    }
  } catch (error) {}
}

function isIdentityConfirmed() {
  try {
    return wx.getStorageSync(IDENTITY_CONFIRMED_V2_KEY) === 'yes';
  } catch (error) {
    return false;
  }
}

function requireIdentityConfirmed() {
  if (isIdentityConfirmed()) {
    return true;
  }
  wx.showToast({
    title: '先选择身份',
    icon: 'none'
  });
  return false;
}

function bumpHeatmapRefreshToken() {
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.heatmapRefreshToken = Number(app.globalData.heatmapRefreshToken || 0) + 1;
    return app.globalData.heatmapRefreshToken;
  }
  return 0;
}

function getHeatmapRefreshToken() {
  const app = getApp();
  return Number((app && app.globalData && app.globalData.heatmapRefreshToken) || 0);
}

function startPagePerf(scope) {
  const startedAt = Date.now();
  let readyLogged = false;
  return {
    ready(name, meta) {
      if (readyLogged) return;
      readyLogged = true;
      const durationMs = Date.now() - startedAt;
      const metricName = name || 'pageReady';
      const readyMeta = Object.assign({}, meta || {});
      if (metricName === 'pageReady') {
        readyMeta.preferredMs = readyMeta.cacheHit ? 200 : 600;
        readyMeta.targetMs = readyMeta.cacheHit ? 200 : 800;
        readyMeta.withinTarget = durationMs < readyMeta.targetMs;
      }
      monitor.logPerf(scope, metricName, durationMs, readyMeta);
    },
    mark(name, meta) {
      monitor.logPerf(scope, name, Date.now() - startedAt, meta || {});
    }
  };
}

module.exports = {
  createCloudPageData,
  buildCloudPageData,
  syncTheme,
  setIdentityConfirmed,
  isIdentityConfirmed,
  requireIdentityConfirmed,
  bumpHeatmapRefreshToken,
  getHeatmapRefreshToken,
  startPagePerf
};
