const appConfig = require('../../data/app-config');

let cloudInited = false;

function getCloudEnvId() {
  return appConfig.cloudEnvId || wx.cloud.DYNAMIC_CURRENT_ENV || '';
}

function getAccountEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    return (((info || {}).miniProgram || {}).envVersion || '').trim();
  } catch (error) {
    return '';
  }
}

function shouldShowCloudDebug() {
  const envVersion = getAccountEnvVersion();
  return envVersion !== 'release';
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
  return initCloud() ? 'cloud' : 'local';
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
  const response = await wx.cloud.callFunction({
    name: 'yoyo',
    data: {
      action,
      payload: payload || {}
    }
  });
  return response.result || {};
}

module.exports = {
  initCloud,
  getSyncMode,
  getCloudEnvId,
  shouldShowCloudDebug,
  getTempFileURL,
  callYoyo
};
