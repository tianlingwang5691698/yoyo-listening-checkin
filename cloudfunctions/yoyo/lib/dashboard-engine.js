async function getDashboardData(ctx, deps) {
  const today = deps.getTodayString();
  const scope = deps.getUserScope(ctx);
  const progressRecords = await deps.getChildProgressRecords(scope);
  const checkins = await deps.getCheckins(scope);
  const planDayIndex = deps.getPlanDayIndexForDate(checkins, today);
  const todayPlan = deps.buildPlanForDay(planDayIndex);
  const categorySummaries = deps.getPlanCategoryOrder(todayPlan.dayIndex).map((category) => {
    const plannedTasks = deps.decoratePlannedTasks(progressRecords, ctx.child.childId, category, today, todayPlan.byCategory[category] || [], {
      planRunType: 'normal',
      targetDate: today,
      planDayIndex: todayPlan.dayIndex
    });
    return deps.buildCategorySummary(plannedTasks, category);
  });
  const dailyTasks = deps.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
    planRunType: 'normal'
  });
  const stats = deps.buildStats(progressRecords, checkins, ctx.child.childId);
  const activeTaskCount = dailyTasks.filter((item) => !item.isPendingAsset).length;
  const completedTaskCountToday = dailyTasks.filter((item) => item.completedToday).length;
  const todayDone = activeTaskCount > 0 && activeTaskCount === completedTaskCountToday;
  const catchupState = deps.buildCatchupState(checkins, today, deps.getPlanStartDate(ctx, today, checkins), todayDone);
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    family: ctx.family,
    child: Object.assign({}, ctx.child, {
      totalCompleted: checkins.length,
      streakDays: stats.streakDays
    }),
    stats,
    planDayIndex,
    planPhase: todayPlan.phase.key,
    planPhaseLabel: todayPlan.phase.label,
    planTaskCount: activeTaskCount,
    peppaTask: categorySummaries.find((item) => item.category === 'peppa'),
    unlockTask: categorySummaries.find((item) => item.category === 'unlock1'),
    songTask: categorySummaries.find((item) => item.category === 'song'),
    categorySummaries,
    dailyTasks,
    planDebug: {
      day1Categories: deps.getPlanCategoryOrder(planDayIndex),
      catalogCounts: {
        newconcept1: deps.getCatalog('newconcept1').length,
        peppa: deps.getCatalog('peppa').length,
        unlock1: deps.getCatalog('unlock1').length,
        song: deps.getCatalog('song').length
      },
      todayTaskCounts: deps.getPlanCategoryOrder(planDayIndex).reduce((acc, category) => {
        acc[category] = (todayPlan.byCategory[category] || []).length;
        return acc;
      }, {})
    },
    catchupState,
    activeTaskCount,
    completedTaskCountToday,
    allDailyDone: todayDone
  };
}

module.exports = {
  getDashboardData
};
