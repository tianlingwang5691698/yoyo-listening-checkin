const appConfig = require('../../data/app-config');

let cloudInited = false;

function getCloudEnvId() {
  return appConfig.cloudEnvId || wx.cloud.DYNAMIC_CURRENT_ENV || '';
}

function getReleaseStage() {
  return String(appConfig.releaseStage || 'internal').trim().toLowerCase() || 'internal';
}

function shouldShowCloudDebug() {
  if (appConfig.showCloudDebug === false) {
    return false;
  }
  return getReleaseStage() !== 'review';
}

function isReviewBuild() {
  return getReleaseStage() === 'review';
}

function initCloud() {
  if (cloudInited) {
    return true;
  }
  if (!wx.cloud) {
    return false;
  }
  wx.cloud.init({
    env: getCloudEnvId(),
    traceUser: true
  });
  cloudInited = true;
  return true;
}

function getSyncMode() {
  return initCloud() ? 'cloud' : 'cloud-error';
}

async function getTempFileURL(fileId) {
  if (!initCloud() || !fileId) {
    throw new Error('cloud-unavailable');
  }
  const response = await wx.cloud.getTempFileURL({
    fileList: [fileId]
  });
  const item = ((response || {}).fileList || [])[0] || null;
  return item && item.tempFileURL ? item.tempFileURL : '';
}

async function callYoyo(action, payload) {
  if (!initCloud()) {
    throw new Error('cloud-unavailable');
  }
  const startedAt = Date.now();
  const response = await wx.cloud.callFunction({
    name: 'yoyo',
    data: {
      action,
      payload: payload || {}
    }
  });
  const result = response.result || {};
  if (['getDashboard', 'getTaskDetail', 'getParentDashboard'].includes(action)) {
    let payloadSize = 0;
    try {
      payloadSize = JSON.stringify(result).length;
    } catch (error) {
      payloadSize = -1;
    }
    console.log(`[perf][cloud] ${action} ${Date.now() - startedAt}ms payload=${payloadSize}B`);
  }
  return result;
}

module.exports = {
  initCloud,
  getSyncMode,
  getCloudEnvId,
  getReleaseStage,
  shouldShowCloudDebug,
  isReviewBuild,
  getTempFileURL,
  callYoyo
};
