function buildCategorySummariesFromDailyTasks(dailyTasks, planDayIndex, deps) {
  return deps.getPlanCategoryOrder(planDayIndex).map((category) => {
    const categoryTasks = (dailyTasks || []).filter((item) => item.category === category);
    return deps.buildCategorySummary(categoryTasks, category);
  });
}

function getHomeTextType(task) {
  if (!task || task.isPendingAsset) {
    return '待准备';
  }
  if (task.transcriptTrackId) {
    return task.syncGranularity === 'line' ? '句级' : '逐词';
  }
  if (task.transcriptStatus === 'pending') {
    return '文本准备中';
  }
  return '纯听力';
}

function decorateHomeTask(task) {
  const repeatTarget = task.repeatTarget || 3;
  return {
    category: task.category,
    categoryLabel: task.categoryLabel,
    taskId: task.taskId,
    title: task.title || '',
    displayTitle: task.displayTitle || '',
    isPendingAsset: !!task.isPendingAsset,
    completedToday: !!task.completedToday,
    playCount: task.playCount || 0,
    repeatTarget,
    textType: getHomeTextType(task),
    actionText: task.isPendingAsset
      ? '等音频放入'
      : task.completedToday
        ? '查看完成'
        : task.playCount > 0
          ? '继续'
          : '开始',
    progressText: `${task.playCount || 0}/${repeatTarget} 遍`
  };
}

function buildHomeTaskGroups(dailyTasks, planDayIndex, deps) {
  return deps.getPlanCategoryOrder(planDayIndex).map((category) => {
    const categoryTasks = (dailyTasks || []).filter((item) => item.category === category).map(decorateHomeTask);
    if (!categoryTasks.length) {
      return null;
    }
    const activeTasks = categoryTasks.filter((item) => !item.isPendingAsset);
    const completedCount = activeTasks.filter((item) => item.completedToday).length;
    const totalCount = activeTasks.length || categoryTasks.length;
    const nextTask = categoryTasks.find((item) => !item.isPendingAsset && !item.completedToday) || categoryTasks[0];
    const allDone = completedCount === totalCount;
    const pending = nextTask && nextTask.isPendingAsset;
    return {
      category,
      categoryLabel: deps.getCategoryLabel(category),
      completedCount,
      totalCount,
      progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      nextTask,
      programSubtitle: allDone
        ? '今日完成'
        : pending
          ? '等待音频'
          : (nextTask.displayTitle || nextTask.title || ''),
      programStateText: allDone ? '完成' : pending ? '等待' : '›',
      textType: nextTask ? nextTask.textType : '待准备',
      actionText: nextTask ? nextTask.actionText : '待准备',
      tasks: categoryTasks
    };
  }).filter(Boolean);
}

async function getDashboardData(ctx, deps, options = {}) {
  const includeDailyTasks = options.includeDailyTasks !== false;
  const includeHomeTaskGroups = !!options.includeHomeTaskGroups;
  const includeCategorySummaries = options.includeCategorySummaries !== false;
  const includeCatchupState = options.includeCatchupState !== false;
  const includePlanDebug = options.includePlanDebug !== false;
  const includeTaskProgressSummary = options.includeTaskProgressSummary !== false;
  const today = deps.getTodayString();
  const scope = deps.getUserScope(ctx);
  const [progressRecords, checkins] = await Promise.all([
    deps.getChildProgressRecords(scope),
    deps.getCheckins(scope)
  ]);
  const planDayIndex = deps.getPlanDayIndexForDate(checkins, today);
  const todayPlan = deps.buildPlanForDay(planDayIndex);
  const shouldBuildDailyTasks = includeDailyTasks || includeCategorySummaries || includeCatchupState || includeTaskProgressSummary;
  const dailyTasks = shouldBuildDailyTasks
    ? deps.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
      planRunType: 'normal'
    })
    : [];
  const categorySummaries = includeCategorySummaries
    ? buildCategorySummariesFromDailyTasks(dailyTasks, planDayIndex, deps)
    : [];
  const stats = deps.buildStats(progressRecords, checkins, ctx.child.childId);
  const activeTaskCount = includeTaskProgressSummary || includeCatchupState
    ? dailyTasks.filter((item) => !item.isPendingAsset).length
    : 0;
  const completedTaskCountToday = includeTaskProgressSummary || includeCatchupState
    ? dailyTasks.filter((item) => item.completedToday).length
    : 0;
  const todayDone = (includeTaskProgressSummary || includeCatchupState)
    ? (activeTaskCount > 0 && activeTaskCount === completedTaskCountToday)
    : false;
  const catchupState = includeCatchupState
    ? deps.buildCatchupState(checkins, today, deps.getPlanStartDate(ctx, today, checkins), todayDone)
    : undefined;
  const result = {
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
    planPhaseLabel: todayPlan.phase.label
  };
  if (includeTaskProgressSummary) {
    result.planTaskCount = activeTaskCount;
    result.activeTaskCount = activeTaskCount;
    result.completedTaskCountToday = completedTaskCountToday;
    result.allDailyDone = todayDone;
  }
  if (includeDailyTasks) {
    result.dailyTasks = dailyTasks;
  }
  if (includeHomeTaskGroups) {
    result.groupedDailyTasks = buildHomeTaskGroups(dailyTasks, planDayIndex, deps);
  }
  if (includeCategorySummaries) {
    result.categorySummaries = categorySummaries;
    result.peppaTask = categorySummaries.find((item) => item.category === 'peppa');
    result.unlockTask = categorySummaries.find((item) => item.category === 'unlock1');
    result.songTask = categorySummaries.find((item) => item.category === 'song');
  }
  if (includePlanDebug) {
    result.planDebug = {
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
    };
  }
  if (includeCatchupState) {
    result.catchupState = catchupState;
  }
  return result;
}

module.exports = {
  getDashboardData
};
