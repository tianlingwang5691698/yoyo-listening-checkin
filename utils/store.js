const cloud = require('../domain/cloud/index');

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
  try {
    const result = await cloud.callYoyo(action, payload);
    return Object.assign(buildSyncMeta('cloud', null, result.resourceDebug), result);
  } catch (error) {
    console.error('[callCloud]', action, formatCloudReason(error), error);
    return buildCloudErrorPayload(action, error, defaults);
  }
}

async function ensureState() {
  cloud.initCloud();
  return callCloud('bootstrap', {}, {
    family: null,
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    }
  });
}

async function getDashboard() {
  return callCloud('getDashboard', {}, {
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: '',
      welcomeLine: '云端数据暂时不可用，请稍后重试。'
    },
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    planTaskCount: 0,
    dailyTasks: [],
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false
  });
}

async function getLevelOverview() {
  return callCloud('getLevelOverview', {}, {
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    child: null,
    level: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    categories: [],
    a2Categories: [],
    b1Categories: [],
    b2Categories: []
  });
}

async function getTaskDetail(category, taskId, options) {
  return callCloud('getTaskDetail', Object.assign({ category, taskId }, options || {}), {
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    child: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    task: null,
    progress: {
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      repeatTarget: 3,
      textUnlocked: false,
      transcriptVisible: true,
      completedToday: false
    },
    categoryTasks: [],
    categoryTaskCount: 0,
    categoryCompletedCount: 0,
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    planRunType: 'normal',
    targetDate: '',
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    todayRecord: null,
    history: [],
    studyWriteAllowed: false,
    studyWriteMessage: '',
    checkinReady: false,
    transcriptPendingLoad: false
  });
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

async function markTaskListened(options) {
  return callCloud('markTaskListened', options, {
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    child: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    task: null,
    progress: {
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      repeatTarget: 3,
      textUnlocked: false,
      transcriptVisible: true,
      completedToday: false
    },
    categoryTasks: [],
    categoryTaskCount: 0,
    categoryCompletedCount: 0,
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    planRunType: 'normal',
    targetDate: '',
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    todayRecord: null,
    history: [],
    checkinReady: false,
    transcriptPendingLoad: false
  });
}

async function completeTodayCheckin() {
  return callCloud('completeTodayCheckin', {}, {
    child: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
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
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0,
      usedToday: false,
      reason: ''
    },
    catchupTasks: []
  });
}

async function getMonthHeatmap(year, month) {
  return callCloud('getMonthHeatmap', { year, month }, {
    year,
    month,
    heatmap: [],
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0,
      usedToday: false,
      reason: ''
    }
  });
}

async function getDailyReportByDate(date) {
  return callCloud('getDailyReportByDate', { date }, {
    report: {
      date,
      totalMinutes: 0,
      completedCategories: [],
      items: []
    }
  });
}

async function getParentDashboard() {
  return callCloud('getParentDashboard', {}, {
    family: null,
    child: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    todayReport: null,
    recentReports: [],
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    members: [],
    subscriptionPreference: null
  });
}

async function getFamilyPageData() {
  return callCloud('getFamilyPage', {}, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function refreshInviteCode() {
  return callCloud('refreshInviteCode', {}, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {},
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function joinFamily(inviteCode, displayName) {
  return callCloud('joinFamily', { inviteCode, displayName }, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {},
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function joinFamilyByChildCode(childLoginCode, displayName) {
  return callCloud('joinFamilyByChildCode', { childLoginCode, displayName }, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {},
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function setStudyRole(studyRole) {
  return callCloud('setStudyRole', { studyRole }, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function undoLastListened() {
  return callCloud('undoLastListened', {}, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {
      studyRole: 'parent'
    },
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null,
    cleared: null
  });
}

async function updateSubscription(enabled) {
  return callCloud('updateSubscription', { enabled }, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {},
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
}

async function updateChildProfile(nickname) {
  return callCloud('updateChildProfile', { nickname }, {
    family: null,
    user: {},
    currentUser: {},
    currentMember: {},
    members: [],
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    subscriptionPreference: null
  });
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
  markTaskListened,
  completeTodayCheckin,
  getParentDashboard,
  getFamilyPageData,
  refreshInviteCode,
  joinFamily,
  joinFamilyByChildCode,
  setStudyRole,
  undoLastListened,
  updateSubscription,
  updateChildProfile
};
