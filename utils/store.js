const cloud = require('../domain/cloud/index');
const contracts = require('./contracts');
const monitor = require('./monitor');
const inflightCloudRequests = {};

/**
 * @typedef {import('./contracts').DashboardData} DashboardData
 * @typedef {import('./contracts').TaskDetailData} TaskDetailData
 * @typedef {import('./contracts').FamilyPageData} FamilyPageData
 * @typedef {import('./contracts').ReportData} ReportData
 */

function formatCloudReason(error) {
  if (!error) {
    return 'unknown';
  }
  if (error.errMsg) {
    return error.errMsg;
  }
  if (error.message) {
    return error.message;
  }
  return String(error);
}

function buildResourceDebugLines(resourceDebug) {
  if (!resourceDebug) {
    return [];
  }
  const lines = [];
  if (resourceDebug.storageScanMode) {
    lines.push(`资源扫描：${resourceDebug.storageScanMode}`);
  }
  if (resourceDebug.unlock1Root || resourceDebug.unlock1AudioCount) {
    lines.push(`Unlock1：${resourceDebug.unlock1AudioCount || 0} 个音频，目录 ${resourceDebug.unlock1Root || '未识别'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolReady === 'boolean') {
    if (resourceDebug.unlock1ListMode === 'training-pool') {
      lines.push(`Unlock1 训练池已启用，eligible ${resourceDebug.unlock1TrainingPoolEligibleCount || 0} 条`);
    } else {
      lines.push(`Unlock1 训练池未就绪，当前回退原始目录`);
    }
  }
  if (typeof resourceDebug.unlock1TrainingPoolCollectionReady === 'boolean') {
    lines.push(`Unlock1 训练池集合：${resourceDebug.unlock1TrainingPoolCollectionReady ? 'ready' : 'not-ready'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolEligibleReady === 'boolean') {
    lines.push(`Unlock1 eligible 就绪：${resourceDebug.unlock1TrainingPoolEligibleReady ? 'yes' : 'no'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolTotalCount === 'number') {
    lines.push(`Unlock1 训练池总记录：${resourceDebug.unlock1TrainingPoolTotalCount} 条`);
  }
  if (typeof resourceDebug.unlock1MinDurationRule === 'number') {
    lines.push(`Unlock1 回退过滤阈值：${resourceDebug.unlock1MinDurationRule} 秒`);
  }
  if (typeof resourceDebug.unlock1RawAudioCount === 'number') {
    lines.push(`Unlock1 原始扫描数量：${resourceDebug.unlock1RawAudioCount} 条`);
  }
  if (typeof resourceDebug.unlock1FilteredAudioCount === 'number') {
    lines.push(`Unlock1 进入训练列表：${resourceDebug.unlock1FilteredAudioCount} 条`);
  }
  if (typeof resourceDebug.unlock1ExcludedShortCount === 'number') {
    lines.push(`Unlock1 被排除短音频：${resourceDebug.unlock1ExcludedShortCount} 条`);
  }
  if (resourceDebug.unlock1TrainingPoolError) {
    lines.push(`Unlock1 训练池告警：${resourceDebug.unlock1TrainingPoolError}`);
  }
  if (resourceDebug.unlock1BootstrapResult) {
    lines.push(`Unlock1 自动补建：${resourceDebug.unlock1BootstrapResult}`);
  }
  if (resourceDebug.unlock1BootstrapMode) {
    lines.push(`Unlock1 自动补建模式：${resourceDebug.unlock1BootstrapMode}`);
  }
  if (resourceDebug.unlock1BootstrapError) {
    lines.push(`Unlock1 自动补建错误：${resourceDebug.unlock1BootstrapError}`);
  }
  if (resourceDebug.unlock1BootstrapFinishedAt) {
    lines.push(`Unlock1 最近补建：${new Date(resourceDebug.unlock1BootstrapFinishedAt).toLocaleString('zh-CN', { hour12: false })}`);
  }
  if (resourceDebug.unlock1SamplePath) {
    lines.push(`Unlock1 样例：${resourceDebug.unlock1SamplePath}`);
  }
  if (resourceDebug.songRoot || resourceDebug.songAudioCount) {
    lines.push(`Song：${resourceDebug.songAudioCount || 0} 个音频，目录 ${resourceDebug.songRoot || '未识别'}`);
  }
  if (resourceDebug.songSamplePath) {
    lines.push(`Song 样例：${resourceDebug.songSamplePath}`);
  }
  if (resourceDebug.storageScanError) {
    lines.push(`扫描告警：${resourceDebug.storageScanError}`);
  }
  if (resourceDebug.rawStorageShape) {
    lines.push(`SDK 字段：${resourceDebug.rawStorageShape}`);
  }
  return lines;
}

function buildSyncMeta(mode, error, resourceDebug) {
  const envId = cloud.getCloudEnvId();
  const reason = mode === 'cloud-error' ? formatCloudReason(error) : '';
  const publicReason = mode === 'cloud-error'
    ? '云端服务暂时不可用，请稍后再试。'
    : '';
  const releaseStage = cloud.getReleaseStage();
  const resourceLines = buildResourceDebugLines(resourceDebug);
  return {
    syncMode: mode,
    releaseStage,
    isReviewBuild: cloud.isReviewBuild(),
    showCloudDebug: cloud.shouldShowCloudDebug(),
    syncDebug: {
      mode,
      envId,
      show: cloud.shouldShowCloudDebug(),
      reason,
      publicReason,
      resourceDebug: resourceDebug || null,
      resourceLines,
      text: mode === 'cloud'
        ? `云环境已连接：${envId}`
        : `云端调用失败，目标云环境：${envId}${reason ? `，失败原因：${reason}` : ''}`
    }
  };
}

function buildCloudErrorPayload(action, error, defaults) {
  const resourceDebug = null;
  return Object.assign({}, defaults || {}, buildSyncMeta('cloud-error', error, resourceDebug), {
    cloudError: {
      action,
      message: formatCloudReason(error)
    }
  });
}

async function callCloud(action, payload, defaults) {
  const inflightKey = action === 'getDashboard'
    ? `${action}:${JSON.stringify(payload || {})}`
    : '';
  if (inflightKey && inflightCloudRequests[inflightKey]) {
    return inflightCloudRequests[inflightKey];
  }
  const request = (async () => {
    try {
      const result = await cloud.callYoyo(action, payload);
      return Object.assign(buildSyncMeta('cloud', null, result.resourceDebug), result);
    } catch (error) {
      monitor.logError('store', action, error, { reason: formatCloudReason(error) });
      return buildCloudErrorPayload(action, error, defaults);
    } finally {
      if (inflightKey) {
        delete inflightCloudRequests[inflightKey];
      }
    }
  })();
  if (inflightKey) {
    inflightCloudRequests[inflightKey] = request;
  }
  return request;
}

async function ensureState() {
  cloud.initCloud();
  return callCloud('bootstrap', {}, {
    family: null,
    child: contracts.createChildDefaults()
  });
}

/**
 * @param {Object=} options
 * @returns {Promise<DashboardData>}
 */
async function getDashboard(options) {
  return callCloud('getDashboard', Object.assign({}, options || {}), contracts.createDashboardDefaults());
}

async function getLevelOverview() {
  return callCloud('getLevelOverview', {}, {
    user: {},
    currentUser: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    child: null,
    level: null,
    stats: contracts.createStatsDefaults(),
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    categories: [],
    a2Categories: [],
    b1Categories: [],
    b2Categories: []
  });
}

/**
 * @param {string} category
 * @param {string} taskId
 * @param {Object=} options
 * @returns {Promise<TaskDetailData>}
 */
async function getTaskDetail(category, taskId, options) {
  return callCloud('getTaskDetail', Object.assign({ category, taskId }, options || {}), contracts.createTaskDetailDefaults());
}

async function getTaskTranscript(category, taskId, options) {
  return callCloud('getTaskTranscript', Object.assign({ category, taskId }, options || {}), {
    task: null,
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    transcriptPendingLoad: false
  });
}

async function getTempFileURL(fileId) {
  try {
    return await cloud.getTempFileURL(fileId);
  } catch (error) {
    monitor.logError('store', 'getTempFileURL', error, { fileId: fileId ? 'set' : 'empty' });
    throw error;
  }
}

async function markTaskListened(options) {
  return callCloud('markTaskListened', options, contracts.createTaskDetailDefaults());
}

async function completeTodayCheckin() {
  return callCloud('completeTodayCheckin', {}, {
    child: null,
    stats: contracts.createStatsDefaults(),
    todayRecord: null,
    checkinReady: false
  });
}

async function getProfileData() {
  return callCloud('getProfileData', {}, {
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    level: null,
    familyReady: false,
    family: null,
    members: [],
    user: {},
    currentUser: {},
    currentMember: {},
    subscriptionPreference: null
  });
}

async function getHeatmap(days) {
  return callCloud('getHeatmap', { days }, {
    heatmap: [],
    catchupState: contracts.createCatchupStateDefaults(),
    catchupTasks: []
  });
}

async function getMonthHeatmap(year, month) {
  return callCloud('getMonthHeatmap', { year, month }, {
    year,
    month,
    heatmap: [],
    catchupState: contracts.createCatchupStateDefaults()
  });
}

/**
 * @param {string} date
 * @returns {Promise<{report: ReportData}>}
 */
async function getDailyReportByDate(date) {
  return callCloud('getDailyReportByDate', { date }, {
    report: contracts.createReportDefaults(date)
  });
}

async function getParentDashboard() {
  return callCloud('getParentDashboard', {}, {
    family: null,
    child: null,
    stats: contracts.createStatsDefaults(),
    todayReport: contracts.createReportDefaults(),
    recentReports: [],
    user: {},
    currentUser: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    members: [],
    subscriptionPreference: null
  });
}

/**
 * @returns {Promise<FamilyPageData>}
 */
async function getFamilyPageData() {
  return callCloud('getFamilyPage', {}, contracts.createFamilyPageDefaults());
}

async function refreshInviteCode() {
  return callCloud('refreshInviteCode', {}, contracts.createFamilyPageDefaults());
}

async function joinFamily(inviteCode, displayName) {
  return callCloud('joinFamily', { inviteCode, displayName }, contracts.createFamilyPageDefaults());
}

async function joinFamilyByChildCode(childLoginCode, displayName) {
  return callCloud('joinFamilyByChildCode', { childLoginCode, displayName }, contracts.createFamilyPageDefaults());
}

async function leaveFamily() {
  return callCloud('leaveFamily', {}, contracts.createFamilyPageDefaults());
}

async function setStudyRole(studyRole) {
  return callCloud('setStudyRole', { studyRole }, contracts.createFamilyPageDefaults());
}

async function undoLastListened() {
  return callCloud('undoLastListened', {}, Object.assign({}, contracts.createFamilyPageDefaults(), {
    cleared: null
  }));
}

async function updateSubscription(enabled) {
  return callCloud('updateSubscription', { enabled }, contracts.createFamilyPageDefaults());
}

async function updateChildProfile(nickname) {
  return callCloud('updateChildProfile', { nickname }, contracts.createFamilyPageDefaults());
}

module.exports = {
  ensureState,
  getDashboard,
  getHeatmap,
  getMonthHeatmap,
  getDailyReportByDate,
  getLevelOverview,
  getProfileData,
  getTaskDetail,
  getTaskTranscript,
  getTempFileURL,
  markTaskListened,
  completeTodayCheckin,
  getParentDashboard,
  getFamilyPageData,
  refreshInviteCode,
  joinFamily,
  joinFamilyByChildCode,
  leaveFamily,
  setStudyRole,
  undoLastListened,
  updateSubscription,
  updateChildProfile
};
