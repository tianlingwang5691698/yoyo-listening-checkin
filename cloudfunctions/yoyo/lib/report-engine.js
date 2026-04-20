async function upsertDailyReport(scope, date, deps) {
  const startedAt = Date.now();
  const progressRecords = await deps.getChildProgressRecords(scope);
  const checkins = await deps.getCheckins(scope);
  const todayPlan = deps.buildPlanForDay(deps.getPlanDayIndexForDate(checkins, date));
  const groupedTasks = deps.getPlanCategoryOrder(todayPlan.dayIndex).map((category) => ({
    category,
    tasks: deps.decoratePlannedTasks(progressRecords, scope.childId, category, date, todayPlan.byCategory[category] || [], {
      planRunType: 'normal',
      targetDate: date,
      planDayIndex: todayPlan.dayIndex
    })
  }));
  const items = groupedTasks.flatMap((group) => group.tasks.map((task) => ({
    category: group.category,
    categoryLabel: task.categoryLabel,
    taskId: task.taskId,
    title: task.audioCompactTitle || task.displayTitle || task.title,
    playCount: task.playCount || 0,
    playMoments: Array.isArray(task.playMoments) ? task.playMoments : [],
    repeatTarget: task.repeatTarget || 3,
    completedToday: !!task.completedToday,
    updatedAt: task.updatedAt || ''
  })));
  const report = {
    reportId: `${scope.familyId}_${scope.childId}_${date}`,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    date,
    completedCategories: Array.from(new Set(items.filter((item) => item.completedToday).map((item) => item.category))),
    totalMinutes: items.reduce((sum, item) => {
      if (!item.completedToday) {
        return sum;
      }
      const task = deps.getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
      return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
    }, 0),
    streakSnapshot: (checkins.find((item) => item.date === date) || {}).streakSnapshot || 0,
    planDayIndex: todayPlan.dayIndex,
    planPhase: todayPlan.phase.key,
    items,
    pushStatus: 'in-app-ready',
    inAppVisible: true,
    updatedAt: new Date().toISOString()
  };
  const subscribers = (await deps.findFamilyMembersByFamilyId(scope.familyId))
    .filter((item) => item.subscriptionEnabled);
  if (subscribers.length) {
    report.pushStatus = 'subscription-ready';
  }
  await deps.upsertReport(scope, date, report);
  console.log(`[perf] upsertDailyReport ${Date.now() - startedAt}ms date=${date}`);
  return report;
}

module.exports = {
  upsertDailyReport
};
