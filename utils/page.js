const theme = require('./theme');
const monitor = require('./monitor');

const CLOUD_PAGE_DEFAULTS = {
  syncMode: 'cloud-error',
  isReviewBuild: false,
  showCloudDebug: false,
  syncDebug: null,
  theme: 'warm',
  themeClass: 'theme-warm',
  themeOptions: theme.getThemeOptions(),
  currentThemeLabel: '雾蓝玻璃'
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

function syncTheme(target) {
  const themeData = theme.buildThemeData();
  theme.applyWindowTheme(themeData.theme);
  if (target && target.setData) {
    target.setData(themeData);
  }
  const tabBar = target && target.getTabBar && target.getTabBar();
  if (tabBar && tabBar.setData) {
    tabBar.setData(themeData);
  }
  return themeData;
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
        readyMeta.targetMs = readyMeta.cacheHit ? 300 : 1200;
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
