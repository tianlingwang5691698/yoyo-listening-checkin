const appConfig = require('../../data/app-config');

let cloudInited = false;

function initCloud() {
  if (cloudInited) {
    return true;
  }
  if (!wx.cloud) {
    return false;
  }
  wx.cloud.init({
    env: appConfig.cloudEnvId || wx.cloud.DYNAMIC_CURRENT_ENV,
    traceUser: true
  });
  cloudInited = true;
  return true;
}

function getSyncMode() {
  return initCloud() ? 'cloud' : 'local';
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
  callYoyo
};
