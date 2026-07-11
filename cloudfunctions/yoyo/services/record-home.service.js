const { getWXContext } = require('../adapters/wx-context.adapter');
const familyContext = require('../facades/family-context.facade');
const checkinRepository = require('../repositories/checkin.repository');
const progressRepository = require('../repositories/progress.repository');
const reportRepository = require('../repositories/report.repository');
const listeningPlanRepository = require('../repositories/listening-plan.repository');
const deviceSessionRepository = require('../repositories/device-session.repository');
const dateLib = require('../lib/china-date');
const planRuntime = require('../lib/plan-runtime');

function getScope(ctx) {
  return {
    userId: ctx.user.userId,
    openId: ctx.user.openId,
    memberId: ctx.member.memberId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId
  };
}

async function applyDeviceRole(ctx, payload) {
  const deviceId = deviceSessionRepository.normalizeDeviceId(payload && payload.deviceId);
  if (!deviceId || !ctx || !ctx.user || !ctx.member) return ctx;
  const session = await deviceSessionRepository.findByDevice(
    ctx.user.openId,
    deviceId,
    ctx.family.familyId,
    ctx.child.childId
  );
  const studyRole = session && session.studyRole
    ? deviceSessionRepository.normalizeStudyRole(session.studyRole)
    : String(ctx.member.studyRole || ctx.member.role || 'parent');
  return Object.assign({}, ctx, {
    member: Object.assign({}, ctx.member, {
      studyRole,
      deviceStudyRole: studyRole,
      deviceId
    }),
    deviceSession: session || null
  });
}

async function prepareContext(event) {
  const payload = (event && event.payload) || {};
  const { OPENID } = getWXContext();
  const target = {
    targetFamilyId: String(payload.targetFamilyId || '').trim(),
    targetChildId: String(payload.targetChildId || '').trim(),
    forceSelf: !!payload.forceSelf
  };
  let ctx = await familyContext.getLightweightContext(OPENID, target);
  if (!ctx) ctx = await familyContext.ensureBootstrap(OPENID, target);
  ctx = await applyDeviceRole(ctx, payload);
  return { ctx, today: dateLib.getTodayString() };
}

function buildRecordStats(checkins, completedTasks, totalMinutes, today) {
  const latest = (checkins || []).slice().sort((left, right) => (
    String(right.completedAt || right.date || '').localeCompare(String(left.completedAt || left.date || ''))
  ))[0] || null;
  return {
    streakDays: dateLib.computeStreak(checkins, today),
    completedDays: (checkins || []).length,
    completedLessons: (checkins || []).length,
    completedTasks: Number(completedTasks || 0),
    totalMinutes: Math.max(0, Number(totalMinutes || 0)),
    lastCheckinAt: latest ? latest.completedAt || '' : '',
    lastCheckinDate: latest ? latest.date || '' : ''
  };
}

async function getRecordDashboard(event) {
  const startedAt = Date.now();
  const { ctx, today } = await prepareContext(event);
  const scope = getScope(ctx);
  const queryStartedAt = Date.now();
  const [checkins, completedTasks, totalMinutes] = await Promise.all([
    checkinRepository.findByScope(scope),
    progressRepository.countCompletedByScope(scope),
    reportRepository.getCumulativeMinutes(scope)
  ]);
  const stats = buildRecordStats(checkins, completedTasks, totalMinutes, today);
  const result = {
    currentMember: ctx.member,
    child: Object.assign({}, ctx.child, {
      totalCompleted: checkins.length,
      streakDays: stats.streakDays
    }),
    planDayIndex: 1,
    planPhase: 'none',
    planPhaseLabel: '未设置',
    planSource: 'stats-only',
    listeningPlan: null,
    hasListeningPlan: false,
    needsListeningPlanSetup: false,
    isYoyoFixedPlan: false,
    stats
  };
  if (event && event.payload && event.payload.debug) {
    result.perfDebug = {
      action: 'getDashboard',
      view: 'record',
      familyId: scope.familyId,
      childId: scope.childId,
      totalMs: Date.now() - startedAt,
      stages: { records: Date.now() - queryStartedAt, activePlan: 0, stats: 0 },
      progressRecordCount: completedTasks,
      checkinCount: checkins.length,
      stats
    };
  }
  return result;
}

function isTodayComplete(checkins, today, activePlan) {
  const todayCheckin = (checkins || []).filter((item) => (
    item.date === today && String(item.planRunType || 'normal') === 'normal'
  )).sort((left, right) => (
    String(right.completedAt || '').localeCompare(String(left.completedAt || ''))
  ))[0] || null;
  if (!todayCheckin) return false;
  if (!activePlan) return true;
  const planUpdatedAt = Date.parse(activePlan.updatedAt || activePlan.createdAt || '');
  const checkinCompletedAt = Date.parse(todayCheckin.completedAt || '');
  if (!Number.isFinite(planUpdatedAt) || !Number.isFinite(checkinCompletedAt)) return true;
  return checkinCompletedAt >= planUpdatedAt;
}

function buildFixedHeatmap(checkins, today, year, month, activePlan) {
  const monthText = `${year}-${String(month).padStart(2, '0')}`;
  const counts = {};
  checkins.forEach((item) => {
    if (String(item.date || '').slice(0, 7) === monthText) {
      counts[item.date] = (counts[item.date] || 0) + 1;
    }
  });
  const todayDone = isTodayComplete(checkins, today, activePlan);
  const planStartDate = planRuntime.getPlanStartDate(null, today, checkins);
  const catchupState = planRuntime.buildCatchupState(checkins, today, planStartDate, todayDone);
  const daysInMonth = new Date(year, month, 0).getDate();
  const heatmap = Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${monthText}-${String(index + 1).padStart(2, '0')}`;
    const count = date === today && activePlan && !todayDone ? 0 : (counts[date] || 0);
    return {
      date,
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3),
      completed: count > 0,
      isToday: date === today,
      isCatchupTarget: catchupState.missedDate === date
    };
  });
  return { year, month, heatmap, catchupState };
}

async function getMonthHeatmap(event) {
  const { ctx, today } = await prepareContext(event);
  const payload = (event && event.payload) || {};
  const scope = getScope(ctx);
  const year = Number(payload.year || today.slice(0, 4));
  const month = Number(payload.month || today.slice(5, 7));
  const [checkins, activePlan] = await Promise.all([
    checkinRepository.findByScope(scope),
    listeningPlanRepository.findActiveByScope(scope)
  ]);
  return buildFixedHeatmap(checkins, today, year, month, activePlan);
}

module.exports = {
  getRecordDashboard,
  getMonthHeatmap,
  buildRecordStats,
  buildFixedHeatmap,
  isTodayComplete
};
