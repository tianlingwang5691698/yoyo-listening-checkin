async function maybeCreateCheckin(scope, progressRecords, date, options = {}, deps) {
  const checkins = await deps.getCheckins(scope);
  const planRunType = options.planRunType || 'normal';
  const planDayIndex = Number(options.planDayIndex || 0) || deps.getPlanDayIndex(checkins);
  const todayPlan = deps.buildPlanForDay(planDayIndex);
  const plannedTasks = todayPlan.flatTasks;
  const activeTasks = plannedTasks.filter((task) => !task.isPendingAsset);
  const allDone = activeTasks.every((task, index) => {
    const progress = deps.getTaskProgressForDate(
      progressRecords,
      scope.childId,
      task.category,
      date,
      task.taskId,
      { allowLegacyRecord: activeTasks.length === 1 && index === 0 }
    );
    return !!progress.completedToday;
  });
  if (!allDone) {
    return null;
  }
  const recordId = `${scope.familyId}_${scope.childId}_${date}`;
  const existing = checkins.find((item) => item.recordId === recordId || item.date === date);
  const streakSnapshot = deps.computeStreak(checkins.filter((item) => item.recordId !== recordId), date) + (existing ? 0 : 1);
  const next = {
    recordId,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    date,
    completedAt: new Date().toISOString(),
    streakSnapshot,
    completedCategories: Array.from(new Set(activeTasks.map((task) => task.category))),
    planDayIndex: todayPlan.dayIndex,
    planPhase: todayPlan.phase.key,
    planRunType,
    makeupForDate: planRunType === 'catchup' ? date : ''
  };
  await deps.upsertCheckin(existing, next);
  await deps.upsertDailyReport(scope, date);
  return next;
}

module.exports = {
  maybeCreateCheckin
};
