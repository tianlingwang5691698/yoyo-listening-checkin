const study = require('../facades/study.facade');
const reportRepository = require('../repositories/report.repository');

async function getHeatmap(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getHeatmap'
  }));
  const days = Number((event && event.payload && event.payload.days) || 28);
  const scope = study.getUserScope(ctx);
  let records = await study.getCheckins(scope);
  let progressRecords = await study.getChildProgressRecords(scope);
  if (study.reconcileCheckins) {
    const reconciled = await study.reconcileCheckins(scope, progressRecords, records, today);
    records = reconciled.checkins || records;
    progressRecords = reconciled.progressRecords || progressRecords;
  }
  const counts = {};
  records.forEach((item) => {
    counts[item.date] = (counts[item.date] || 0) + 1;
  });
  const todayPlan = study.buildPlanForDay(study.getPlanDayIndexForDate(records, today));
  const todayTasks = study.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
    planRunType: 'normal'
  });
  const hasTodayCheckin = records.some((item) => item.date === today && String(item.planRunType || 'normal') === 'normal');
  const todayDone = hasTodayCheckin || (todayTasks.length > 0 && todayTasks.every((item) => item.completedToday));
  const catchupState = study.buildCatchupState(records, today, study.getPlanStartDate(ctx, today, records), todayDone);
  const catchupPlan = catchupState.canCatchup ? study.buildPlanForDay(catchupState.planDayIndex) : null;
  const catchupTasks = catchupPlan
    ? study.decoratePlanTasks(progressRecords, ctx.child.childId, catchupState.missedDate, catchupPlan, {
      planRunType: 'catchup'
    })
    : [];
  const heatmap = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = study.addDays(today, -i);
    const count = counts[date] || 0;
    heatmap.push({
      date,
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3),
      completed: count > 0,
      isCatchupTarget: catchupState.missedDate === date
    });
  }
  return {
    heatmap,
    catchupState,
    catchupTasks
  };
}

async function getMonthHeatmap(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getMonthHeatmap'
  }));
  const year = Number((event && event.payload && event.payload.year) || today.slice(0, 4));
  const month = Number((event && event.payload && event.payload.month) || today.slice(5, 7));
  const monthText = `${year}-${String(month).padStart(2, '0')}`;
  const scope = study.getUserScope(ctx);
  let records = await study.getCheckins(scope);
  let progressRecords = await study.getChildProgressRecords(scope);
  if (study.reconcileCheckins) {
    const reconciled = await study.reconcileCheckins(scope, progressRecords, records, today);
    records = reconciled.checkins || records;
    progressRecords = reconciled.progressRecords || progressRecords;
  }
  const counts = {};
  records.forEach((item) => {
    if (String(item.date || '').slice(0, 7) === monthText) {
      counts[item.date] = (counts[item.date] || 0) + 1;
    }
  });
  const todayPlan = study.buildPlanForDay(study.getPlanDayIndexForDate(records, today));
  const todayTasks = study.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
    planRunType: 'normal'
  });
  const hasTodayCheckin = records.some((item) => item.date === today && String(item.planRunType || 'normal') === 'normal');
  const todayDone = hasTodayCheckin || (todayTasks.length > 0 && todayTasks.every((item) => item.completedToday));
  const catchupState = study.buildCatchupState(records, today, study.getPlanStartDate(ctx, today, records), todayDone);
  const daysInMonth = new Date(year, month, 0).getDate();
  const heatmap = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthText}-${String(day).padStart(2, '0')}`;
    const count = counts[date] || 0;
    heatmap.push({
      date,
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3),
      completed: count > 0,
      isToday: date === today,
      isCatchupTarget: catchupState.missedDate === date
    });
  }
  return {
    year,
    month,
    heatmap,
    catchupState
  };
}

async function getDailyReportByDate(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getDailyReportByDate'
  }));
  const payload = (event && event.payload) || {};
  const date = String(payload.date || today).slice(0, 10);
  const scope = study.getUserScope(ctx);
  if (date !== today && !payload.force) {
    const existing = await reportRepository.findByScopeAndDate(scope, date);
    if (existing) {
      return { report: existing };
    }
  }
  const report = await study.upsertDailyReport(scope, date);
  return { report };
}

async function getParentDashboard(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getParentDashboard'
  }));
  const days = Math.max(7, Math.min(Number((event && event.payload && event.payload.days) || 7), 30));
  const dashboard = await study.getDashboardData(ctx);
  const scope = study.getUserScope(ctx);
  const recentReports = [];
  for (let i = 0; i < days; i += 1) {
    const date = study.addDays(today, -i);
    const existing = i === 0 ? null : await reportRepository.findByScopeAndDate(scope, date);
    recentReports.push(existing || await study.upsertDailyReport(scope, date));
  }
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    family: ctx.family,
    child: ctx.child,
    stats: dashboard.stats,
    todayReport: recentReports[0],
    recentReports,
    members: ctx.members,
    studentLinks: ctx.studentLinks || [],
    subscriptionPreference: ctx.subscriptionPreference
  };
}

module.exports = {
  getHeatmap,
  getMonthHeatmap,
  getDailyReportByDate,
  getParentDashboard
};
