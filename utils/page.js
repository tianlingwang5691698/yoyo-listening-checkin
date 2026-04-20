const CLOUD_PAGE_DEFAULTS = {
  syncMode: 'cloud-error',
  isReviewBuild: false,
  showCloudDebug: false,
  syncDebug: null
};

function createCloudPageData(defaults) {
  return Object.assign({}, CLOUD_PAGE_DEFAULTS, defaults || {});
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
  return Object.assign({}, createCloudPageData(defaults), normalizeCloudPageData(data));
}

function setIdentityConfirmed(confirmed) {
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.identityConfirmed = !!confirmed;
  }
}

function isIdentityConfirmed() {
  const app = getApp();
  return !!(app && app.globalData && app.globalData.identityConfirmed);
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

module.exports = {
  createCloudPageData,
  buildCloudPageData,
  setIdentityConfirmed,
  isIdentityConfirmed,
  requireIdentityConfirmed,
  bumpHeatmapRefreshToken,
  getHeatmapRefreshToken
};
