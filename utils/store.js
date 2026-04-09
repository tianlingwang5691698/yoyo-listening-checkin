const progress = require('../domain/progress/index');
const tasks = require('../domain/tasks/index');
const transcript = require('../domain/transcript/index');
const cloud = require('../domain/cloud/index');
const family = require('../domain/family/index');
const reports = require('../domain/reports/index');
const { getTodayString } = require('./date');

function formatFallbackReason(error) {
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

function buildSyncMeta(mode, error) {
  const envId = cloud.getCloudEnvId();
  const reason = mode === 'local' ? formatFallbackReason(error) : '';
  return {
    syncMode: mode,
    syncDebug: {
      mode,
      envId,
      show: cloud.shouldShowCloudDebug(),
      reason,
      text: mode === 'cloud'
        ? `云环境已连接：${envId}`
        : `当前使用本地回退，目标云环境：${envId}${reason ? `，失败原因：${reason}` : ''}`
    }
  };
}

async function callWithFallback(action, payload, fallback) {
  try {
    const result = await cloud.callYoyo(action, payload);
    return Object.assign(buildSyncMeta('cloud'), result);
  } catch (error) {
    return Object.assign(buildSyncMeta('local', error), fallback(error));
  }
}

function getLocalTaskDetail(category) {
  const state = progress.loadState();
  const child = progress.getChild(state);
  const stats = progress.getStats(state, child.childId);
  const task = progress.getTodayTaskSummary(state, child.childId, category);
  const transcriptBundle = transcript.getTranscriptBundle(task);
  const todayRecord = progress.getChildCheckinRecords(state, child.childId)
    .find((item) => item.date === getTodayString()) || null;
  const history = progress.getChildCategoryProgress(state, child.childId)
    .filter((item) => item.category === category && item.completedToday)
    .map((item) => ({
      date: item.date,
      taskTitle: tasks.formatHistoryTaskTitle(tasks.getTaskById(item.category, item.taskId)) || item.taskId,
      playCount: item.playCount
    }));

  return {
    child,
    stats,
    task,
    progress: {
      playCount: task.playCount,
      playStepText: task.playStepText,
      currentPass: task.currentPass,
      repeatTarget: task.repeatTarget,
      textUnlocked: task.textUnlocked,
      completedToday: task.completedToday
    },
    transcriptTrack: transcriptBundle.transcriptTrack,
    transcriptLines: transcriptBundle.transcriptLines,
    scriptSource: task.textSource || null,
    todayRecord,
    history
  };
}

async function ensureState() {
  progress.ensureState();
  family.ensureLocalFamilyState();
  cloud.initCloud();
  return callWithFallback('bootstrap', {}, () => ({
    family: family.getFamilyPageData().family,
    child: family.getFamilyPageData().child
  }));
}

async function getDashboard() {
  return callWithFallback('getDashboard', {}, () => progress.getDashboardData());
}

async function getLevelOverview() {
  return callWithFallback('getLevelOverview', {}, () => progress.getLevelOverviewData());
}

async function getTaskDetail(category) {
  const result = await callWithFallback('getTaskDetail', { category }, () => getLocalTaskDetail(category));
  if (result.task && !result.transcriptTrack) {
    const transcriptBundle = transcript.getTranscriptBundle(result.task);
    result.transcriptTrack = transcriptBundle.transcriptTrack;
    result.transcriptLines = transcriptBundle.transcriptLines;
    result.scriptSource = result.scriptSource || result.task.textSource || null;
  }
  return result;
}

async function markTaskListened(options) {
  const result = await callWithFallback('markTaskListened', options, () => {
    progress.markTaskListened(options);
    return getLocalTaskDetail(options.category);
  });
  if (result.task && !result.transcriptTrack) {
    const transcriptBundle = transcript.getTranscriptBundle(result.task);
    result.transcriptTrack = transcriptBundle.transcriptTrack;
    result.transcriptLines = transcriptBundle.transcriptLines;
    result.scriptSource = result.scriptSource || result.task.textSource || null;
  }
  return result;
}

async function getProfileData() {
  return callWithFallback('getProfileData', {}, () => {
    const profile = progress.getProfileData();
    const familyData = family.getFamilyPageData();
    return Object.assign({}, profile, {
      family: familyData.family,
      members: familyData.members,
      currentMember: familyData.currentMember,
      subscriptionPreference: familyData.subscriptionPreference
    });
  });
}

async function getHeatmap(days) {
  return callWithFallback('getHeatmap', { days }, () => ({
    heatmap: progress.getHeatmap(days || 28)
  }));
}

async function getParentDashboard() {
  return callWithFallback('getParentDashboard', {}, () => reports.getParentDashboardData());
}

async function getFamilyPageData() {
  return callWithFallback('getFamilyPage', {}, () => family.getFamilyPageData());
}

async function refreshInviteCode() {
  return callWithFallback('refreshInviteCode', {}, () => family.refreshInviteCode());
}

async function joinFamily(inviteCode, displayName) {
  return callWithFallback('joinFamily', { inviteCode, displayName }, () => family.joinFamily(inviteCode, displayName));
}

async function updateSubscription(enabled) {
  return callWithFallback('updateSubscription', { enabled }, () => family.toggleSubscription(enabled));
}

module.exports = {
  ensureState,
  getDashboard,
  getHeatmap,
  getLevelOverview,
  getProfileData,
  getTaskDetail,
  markTaskListened,
  getParentDashboard,
  getFamilyPageData,
  refreshInviteCode,
  joinFamily,
  updateSubscription
};
