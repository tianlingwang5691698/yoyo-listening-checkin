function buildCategorySummariesFromDailyTasks(dailyTasks, planDayIndex, deps, categoryOrder) {
  return (categoryOrder || deps.getPlanCategoryOrder(planDayIndex)).map((category) => {
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
    taskId: task.taskId,
    title: task.title || '',
    displayTitle: task.displayTitle || '',
    isPendingAsset: !!task.isPendingAsset,
    completedToday: !!task.completedToday,
    textType: getHomeTextType(task),
    durationSec: Number(task.durationSec || 0),
    repeatTarget,
    audioUrl: task.audioUrl || '',
    audioCloudPath: task.audioCloudPath || '',
    audioFileId: task.audioFileId || '',
    audioSource: task.audioSource || '',
    progressText: `${task.playCount || 0}/${repeatTarget} 遍`
  };
}

function applyCheckinCompletion(dailyTasks, checkins, today) {
  const hasTodayCheckin = (checkins || []).some((item) => item.date === today && String(item.planRunType || 'normal') === 'normal');
  if (!hasTodayCheckin) {
    return dailyTasks || [];
  }
  return (dailyTasks || []).map((task) => {
    if (task.isPendingAsset) {
      return task;
    }
    const repeatTarget = task.repeatTarget || 3;
    return Object.assign({}, task, {
      playCount: Math.max(task.playCount || 0, repeatTarget),
      completedToday: true,
      textUnlocked: true
    });
  });
}

function appendTodayPeppaReviewProgress(dailyTasks, progressRecords, childId, today, deps) {
  if (!deps.decorateTask) {
    return dailyTasks || [];
  }
  const existingTaskIds = new Set((dailyTasks || []).map((item) => item.taskId).filter(Boolean));
  const catalog = deps.getCatalog('peppa') || [];
  const reviewTasks = (progressRecords || []).filter((item) => (
    item.childId === childId
      && item.category === 'peppa'
      && item.date === today
      && String(item.taskId || '').includes('__review_')
      && !existingTaskIds.has(item.taskId)
  )).map((progress) => {
    const sourceTask = catalog.find((item) => item.taskId === (progress.originalTaskId || progress.taskId)) || {};
    return deps.decorateTask(Object.assign({}, sourceTask, {
      category: 'peppa',
      taskId: progress.taskId,
      originalTaskId: progress.originalTaskId || sourceTask.taskId || '',
      isReviewTask: true,
      reviewType: 'peppa-old-listening',
      repeatTarget: Number(progress.repeatTarget || 1),
      transcriptTrackId: null,
      textSource: null,
      syncGranularity: 'none',
      title: sourceTask.title || progress.taskId
    }), progress, 'peppa');
  });
  return (dailyTasks || []).concat(reviewTasks);
}

function buildHomeTaskGroups(dailyTasks, planDayIndex, deps, categoryOrder) {
  return (categoryOrder || deps.getPlanCategoryOrder(planDayIndex)).map((category) => {
    const categoryTasks = (dailyTasks || []).filter((item) => item.category === category).map(decorateHomeTask);
    if (!categoryTasks.length) {
      return null;
    }
    const activeTasks = categoryTasks.filter((item) => !item.isPendingAsset);
    const completedCount = activeTasks.filter((item) => item.completedToday).length;
    const totalCount = activeTasks.length || categoryTasks.length;
    const durationSec = activeTasks.reduce((sum, item) => (
      sum + (Number(item.durationSec || 0) * Number(item.repeatTarget || 1))
    ), 0);
    const nextTask = categoryTasks.find((item) => !item.isPendingAsset && !item.completedToday) || categoryTasks[0];
    const allDone = completedCount === totalCount;
    const pending = nextTask && nextTask.isPendingAsset;
    return {
      category,
      categoryLabel: deps.getCategoryLabel(category),
      completedCount,
      totalCount,
      progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      durationSec,
      minutes: durationSec ? Math.max(1, Math.round(durationSec / 60)) : 0,
      nextTask,
      programSubtitle: allDone
        ? '今日完成'
        : pending
          ? '等待音频'
          : (nextTask.displayTitle || nextTask.title || ''),
      programStateText: allDone ? '完成' : pending ? '等待' : '›',
      textType: nextTask ? nextTask.textType : '待准备',
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
  const includeUser = options.includeUser !== false;
  const includeFamily = options.includeFamily !== false;
  const includeStats = options.includeStats !== false;
  const includeChildStats = options.includeChildStats !== false;
  const today = deps.getTodayString();
  const scope = deps.getUserScope(ctx);
  let [progressRecords, checkins] = await Promise.all([
    deps.getChildProgressRecords(scope),
    deps.getCheckins(scope)
  ]);
  if (options.reconcileCheckins !== false && deps.reconcileCheckins) {
    const reconciled = await deps.reconcileCheckins(scope, progressRecords, checkins, today);
    if (reconciled) {
      progressRecords = reconciled.progressRecords || progressRecords;
      checkins = reconciled.checkins || checkins;
    }
  }
  const activeListeningPlan = deps.getActiveListeningPlan
    ? await deps.getActiveListeningPlan(ctx)
    : null;
  const useCustomListeningPlan = !!(activeListeningPlan && activeListeningPlan.active !== false);
  const useFixedYoyoPlan = !useCustomListeningPlan && !!(deps.isYoyoChild && deps.isYoyoChild(ctx.child));
  const hasListeningPlan = useCustomListeningPlan || useFixedYoyoPlan;
  const getActivePlanDayIndex = deps.getNextPlanDayIndexForDate || deps.getPlanDayIndexForDate;
  const planDayIndex = useCustomListeningPlan
    ? deps.getCustomPlanDayIndex(checkins, today, activeListeningPlan)
    : useFixedYoyoPlan
      ? getActivePlanDayIndex(checkins, today)
      : 1;
  const peppaReviewPlanOptions = deps.getPeppaReviewPlanOptions
    ? deps.getPeppaReviewPlanOptions(progressRecords, checkins, ctx.child.childId, today)
    : {};
  const todayPlan = useCustomListeningPlan
    ? deps.buildListeningPlanForDay(activeListeningPlan, planDayIndex)
    : useFixedYoyoPlan
      ? deps.buildPlanForDay(
        planDayIndex,
        peppaReviewPlanOptions
      )
      : {
        dayIndex: 1,
        phase: { key: 'none', label: '未设置' },
        byCategory: {},
        flatTasks: [],
        categoryOrder: []
      };
  const planCategoryOrder = useCustomListeningPlan
    ? (todayPlan.categoryOrder || Object.keys(todayPlan.byCategory || {}))
    : useFixedYoyoPlan
      ? deps.getPlanCategoryOrder(planDayIndex)
      : [];
  const shouldBuildDailyTasks = includeDailyTasks || includeCategorySummaries || includeCatchupState || includeTaskProgressSummary;
  const baseDailyTasks = shouldBuildDailyTasks
    ? (useCustomListeningPlan
      ? deps.decorateListeningPlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
        planRunType: 'normal',
        listeningPlanId: activeListeningPlan.planId || activeListeningPlan._id || ''
      })
      : useFixedYoyoPlan
        ? deps.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
          planRunType: 'normal'
        })
        : [])
    : [];
  const dailyTasks = useCustomListeningPlan
    ? baseDailyTasks
    : useFixedYoyoPlan
      ? appendTodayPeppaReviewProgress(applyCheckinCompletion(baseDailyTasks, checkins, today), progressRecords, ctx.child.childId, today, deps)
      : baseDailyTasks;
  const categorySummaries = includeCategorySummaries
    ? buildCategorySummariesFromDailyTasks(dailyTasks, planDayIndex, deps, planCategoryOrder)
    : [];
  const stats = (includeStats || includeChildStats)
    ? deps.buildStats(progressRecords, checkins, ctx.child.childId)
    : { streakDays: 0 };
  const activeTaskCount = includeTaskProgressSummary || includeCatchupState
    ? dailyTasks.filter((item) => !item.isPendingAsset).length
    : 0;
  const completedTaskCountToday = includeTaskProgressSummary || includeCatchupState
    ? dailyTasks.filter((item) => item.completedToday).length
    : 0;
  const todayDone = (includeTaskProgressSummary || includeCatchupState)
    ? (activeTaskCount > 0 && activeTaskCount === completedTaskCountToday)
    : false;
  const catchupState = includeCatchupState && !useCustomListeningPlan
    && useFixedYoyoPlan
    ? deps.buildCatchupState(checkins, today, deps.getPlanStartDate(ctx, today, checkins), todayDone)
    : undefined;
  const result = {
    currentMember: ctx.member,
    child: Object.assign({}, ctx.child, {
      totalCompleted: includeChildStats ? checkins.length : Number(ctx.child.totalCompleted || 0),
      streakDays: includeChildStats ? stats.streakDays : Number(ctx.child.streakDays || 0)
    }),
    planDayIndex,
    planPhase: todayPlan.phase.key,
    planPhaseLabel: todayPlan.phase.label,
    planSource: useCustomListeningPlan ? 'custom-listening' : (useFixedYoyoPlan ? 'fixed-yoyo' : 'none'),
    listeningPlan: activeListeningPlan || null,
    hasListeningPlan,
    needsListeningPlanSetup: !hasListeningPlan,
    isYoyoFixedPlan: useFixedYoyoPlan
  };
  if (includeUser) {
    result.user = ctx.user;
    result.currentUser = ctx.user;
  }
  if (includeFamily) {
    result.family = ctx.family;
  }
  if (includeStats) {
    result.stats = stats;
  }
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
    result.groupedDailyTasks = buildHomeTaskGroups(dailyTasks, planDayIndex, deps, planCategoryOrder);
  }
  if (includeCategorySummaries) {
    result.categorySummaries = categorySummaries;
    result.peppaTask = categorySummaries.find((item) => item.category === 'peppa');
    result.unlockTask = categorySummaries.find((item) => item.category === 'unlock1');
    result.songTask = categorySummaries.find((item) => item.category === 'song');
  }
  if (includePlanDebug) {
    result.planDebug = {
      day1Categories: planCategoryOrder,
      planSource: result.planSource,
      catalogCounts: {
        newconcept1: deps.getCatalog('newconcept1').length,
        peppa: deps.getCatalog('peppa').length,
        unlock1: deps.getCatalog('unlock1').length,
        song: deps.getCatalog('song').length
      },
      todayTaskCounts: planCategoryOrder.reduce((acc, category) => {
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
