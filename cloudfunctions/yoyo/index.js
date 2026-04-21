const dashboardService = require('./services/dashboard.service');
const levelService = require('./services/level.service');
const taskService = require('./services/task.service');
const familyService = require('./services/family.service');
const reportService = require('./services/report.service');
const identityService = require('./services/identity.service');
const catalogService = require('./services/catalog.service');
const monitor = require('./lib/monitor');

const actionMap = {
  bootstrap: identityService.bootstrap,
  getDashboard: dashboardService.getDashboard,
  getLevelOverview: levelService.getLevelOverview,
  getTaskDetail: taskService.getTaskDetail,
  getTaskTranscript: taskService.getTaskTranscript,
  markTaskListened: taskService.markTaskListened,
  completeTodayCheckin: taskService.completeTodayCheckin,
  getProfileData: familyService.getProfileData,
  getFamilyPage: familyService.getFamilyPage,
  refreshInviteCode: familyService.refreshInviteCode,
  joinFamily: familyService.joinFamily,
  joinFamilyByChildCode: familyService.joinFamilyByChildCode,
  leaveFamily: familyService.leaveFamily,
  updateChildProfile: familyService.updateChildProfile,
  setStudyRole: identityService.setStudyRole,
  undoLastListened: identityService.undoLastListened,
  updateSubscription: familyService.updateSubscription,
  getHeatmap: reportService.getHeatmap,
  getMonthHeatmap: reportService.getMonthHeatmap,
  getDailyReportByDate: reportService.getDailyReportByDate,
  getParentDashboard: reportService.getParentDashboard
};

const MONITORED_ACTIONS = new Set([
  'getDashboard',
  'getTaskDetail',
  'getTaskTranscript',
  'markTaskListened',
  'completeTodayCheckin',
  'getProfileData',
  'getFamilyPage',
  'joinFamilyByChildCode',
  'leaveFamily',
  'setStudyRole',
  'getMonthHeatmap',
  'getDailyReportByDate',
  'getParentDashboard'
]);

exports.main = async (event, context) => {
  const action = String((event && event.action) || '').trim();
  const handler = actionMap[action];
  if (!handler) {
    throw new Error(`unsupported action: ${action}`);
  }

  const startedAt = Date.now();
  let result;
  try {
    result = await handler(event || {}, context || {});
  } catch (error) {
    monitor.logError('cloudfn', action, error, {
      duration: `${Date.now() - startedAt}ms`
    });
    throw error;
  }
  const durationMs = Date.now() - startedAt;

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    if (MONITORED_ACTIONS.has(action)) {
      monitor.logPerf('cloudfn', action, durationMs, { shape: 'primitive' });
    }
    return result;
  }

  const finalResult = Object.assign({}, result, {
    resourceDebug: result.resourceDebug || catalogService.getResourceDebugSnapshot()
  });
  if (MONITORED_ACTIONS.has(action)) {
    const payloadSize = Buffer.byteLength(JSON.stringify(finalResult), 'utf8');
    monitor.logPerf('cloudfn', action, durationMs, { payload: `${payloadSize}B` });
  }
  return finalResult;
};
