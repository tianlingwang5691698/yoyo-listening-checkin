const appConfig = require('../../app-config');
const monitor = require('../../utils/monitor');

let cloudInited = false;

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label || 'cloud'}-timeout`)), timeoutMs);
    promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

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

function normalizeCloudPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
}

function buildCloudFileId(fileId) {
  const value = String(fileId || '').trim();
  if (!value || /^cloud:\/\//.test(value) || /^https?:\/\//.test(value)) {
    return value;
  }
  const envId = getCloudEnvId();
  const bucket = appConfig.cloudBucket || '';
  const normalizedPath = normalizeCloudPath(value);
  if (!envId || !bucket || !normalizedPath) {
    return value;
  }
  return `cloud://${envId}.${bucket}/${normalizedPath}`;
}

function getSyncMode() {
  return initCloud() ? 'cloud' : 'cloud-error';
}

async function getTempFileURL(fileId) {
  if (!initCloud() || !fileId) {
    throw new Error('cloud-unavailable');
  }
  const startedAt = Date.now();
  let response;
  try {
    response = await wx.cloud.getTempFileURL({
      fileList: [buildCloudFileId(fileId)]
    });
  } catch (error) {
    monitor.logError('cloud', 'getTempFileURL', error, {
      duration: `${Date.now() - startedAt}ms`
    });
    throw error;
  }
  const item = ((response || {}).fileList || [])[0] || null;
  monitor.logPerf('cloud', 'getTempFileURL', Date.now() - startedAt, {
    hit: item && item.tempFileURL ? 'yes' : 'no'
  });
  return item && item.tempFileURL ? item.tempFileURL : '';
}

async function callYoyo(action, payload) {
  if (!initCloud()) {
    throw new Error('cloud-unavailable');
  }
  const startedAt = Date.now();
  let response;
  try {
    let timeoutMs = 12000;
    if (action === 'analyzeWritingTranslation' || action === 'submitWritingAttempt' || action === 'gradeWritingAttempt' || action === 'generateWritingBandSample' || action === 'generateWritingReportPdf' || action === 'generateReadingReportPdf' || action === 'generateListeningReportPdf' || action === 'getWritingAttemptDetail') {
      timeoutMs = 320000;
    } else if (action === 'getReadingStudyPack' || action === 'getListeningStudyPack' || action === 'getGrammarNarrationAudio' || action === 'synthesizeIeltsPromptAudio') {
      timeoutMs = 180000;
    } else if (action === 'submitSpeakingAttempt') {
      timeoutMs = 320000;
    } else if (action === 'evaluateSpeakingPronunciation') {
      timeoutMs = 240000;
    } else if (action === 'submitReadingAttempt' || action === 'explainGrammarQuestion') {
      timeoutMs = 70000;
    } else if (action === 'getDashboard' || action === 'getMonthHeatmap') {
      timeoutMs = 30000;
    } else if (action === 'synthesizeReadingAudio' || action === 'getGrammarTopic' || action === 'addDictionaryBook' || action === 'getDictionaryBook') {
      timeoutMs = 30000;
    }
    const functionName = action === 'getDictionaryBook' ? 'dictionary-book' : 'yoyo';
    response = await withTimeout(wx.cloud.callFunction({
      name: functionName,
      data: {
        action,
        payload: payload || {}
      }
    }), timeoutMs, action);
  } catch (error) {
    monitor.logError('cloud', action, error, {
      duration: `${Date.now() - startedAt}ms`
    });
    throw error;
  }
  const result = response.result || {};
  if (['getDashboard', 'getTaskDetail', 'getParentDashboard'].includes(action)) {
    let payloadSize = 0;
    try {
      payloadSize = JSON.stringify(result).length;
    } catch (error) {
      payloadSize = -1;
    }
    monitor.logPerf('cloud', action, Date.now() - startedAt, { payload: `${payloadSize}B` });
  }
  return result;
}

async function uploadFile(cloudPath, filePath) {
  if (!initCloud() || !cloudPath || !filePath) {
    throw new Error('cloud-upload-unavailable');
  }
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath
  });
  return result.fileID || result.fileId || '';
}

module.exports = {
  initCloud,
  getSyncMode,
  getCloudEnvId,
  getReleaseStage,
  shouldShowCloudDebug,
  isReviewBuild,
  getTempFileURL,
  uploadFile,
  callYoyo
};
