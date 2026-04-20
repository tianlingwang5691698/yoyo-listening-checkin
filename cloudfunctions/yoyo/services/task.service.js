const study = require('../facades/study.facade');

async function getTaskDetail(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getTaskDetail'
  }));
  const payload = (event && event.payload) || {};
  const dashboard = await study.getDashboardData(ctx);
  let planRunType = String(payload.planRunType || 'normal');
  let targetDate = String(payload.targetDate || today).slice(0, 10);
  if (planRunType === 'catchup' && (!dashboard.catchupState.canCatchup || targetDate !== dashboard.catchupState.missedDate)) {
    planRunType = 'normal';
    targetDate = today;
  }
  const targetPlanDayIndex = planRunType === 'catchup'
    ? Number(payload.planDayIndex || 0) || dashboard.catchupState.planDayIndex || dashboard.planDayIndex
    : dashboard.planDayIndex;
  const targetPlan = planRunType === 'catchup' ? study.buildPlanForDay(targetPlanDayIndex) : null;
  const progressRecords = await study.getChildProgressRecords(study.getUserScope(ctx));
  const categoryTasks = ['newconcept2', 'newconcept3', 'newconcept4'].includes(payload.category)
    ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, payload.category, targetDate, await study.resolveStandaloneCategoryTasks(payload.category, ctx.child.childId, targetDate), {
      planRunType: 'level',
      targetDate,
      planDayIndex: 1
    })
    : planRunType === 'catchup'
      ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, payload.category, targetDate, targetPlan.byCategory[payload.category] || [], {
        planRunType: 'catchup',
        targetDate,
        planDayIndex: targetPlan.dayIndex
      })
      : dashboard.dailyTasks.filter((item) => item.category === payload.category);
  const task = categoryTasks.find((item) => item.taskId === payload.taskId)
    || categoryTasks.find((item) => !item.completedToday)
    || categoryTasks[0]
    || study.decorateTask(null, study.buildEmptyProgress(), payload.category);
  const scope = study.getUserScope(ctx);
  const history = progressRecords
    .filter((item) => item.category === payload.category && item.completedToday)
    .map((item) => ({
      date: item.date,
      taskTitle: item.taskId,
      playCount: item.playCount
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayRecord = (await study.getCheckins(scope)).find((item) => item.date === today) || null;
  const checkinReady = study.normalizeStudyRole(ctx.member) === 'student'
    && planRunType === 'normal'
    && targetDate === today
    && dashboard.allDailyDone
    && !todayRecord;
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    child: ctx.child,
    stats: dashboard.stats,
    task,
    progress: {
      playCount: task.playCount,
      playStepText: task.playStepText,
      currentPass: task.currentPass,
      repeatTarget: task.repeatTarget,
      textUnlocked: task.textUnlocked,
      transcriptVisible: task.transcriptVisible,
      completedToday: task.completedToday
    },
    categoryTasks,
    categoryTaskCount: categoryTasks.length,
    categoryCompletedCount: categoryTasks.filter((item) => item.completedToday).length,
    planDayIndex: targetPlanDayIndex,
    planPhaseLabel: planRunType === 'catchup' ? (targetPlan.phase.label || dashboard.planPhaseLabel) : dashboard.planPhaseLabel,
    planRunType,
    targetDate,
    scriptSource: task.textSource || null,
    transcriptTrack: null,
    transcriptLines: [],
    transcriptPendingLoad: true,
    todayRecord,
    history,
    studyWriteAllowed: study.normalizeStudyRole(ctx.member) === 'student',
    studyWriteMessage: study.normalizeStudyRole(ctx.member) === 'student' ? '' : '家长模式，不计入打卡',
    checkinReady
  };
}

async function getTaskTranscript(event) {
  const { ctx, requestedCategory, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getTaskTranscript'
  }));
  const payload = (event && event.payload) || {};
  let task = Object.assign({}, payload.taskSnapshot || {}, {
    category: requestedCategory || ((payload.taskSnapshot && payload.taskSnapshot.category) || ''),
    taskId: String(payload.taskId || ((payload.taskSnapshot && payload.taskSnapshot.taskId) || '')).trim()
  });
  if (['newconcept2', 'newconcept3', 'newconcept4'].includes(requestedCategory)) {
    const standaloneTasks = await study.resolveStandaloneCategoryTasks(requestedCategory, ctx.child.childId, today);
    task = standaloneTasks.find((item) => item.taskId === task.taskId) || standaloneTasks[0] || task;
  }
  task = task.taskId ? task : study.decorateTask(null, study.buildEmptyProgress(), requestedCategory);
  const transcriptBundle = await study.getTranscriptBundle(task);
  return {
    task,
    scriptSource: task.textSource || null,
    transcriptTrack: transcriptBundle.transcriptTrack,
    transcriptLines: transcriptBundle.transcriptLines,
    transcriptPendingLoad: false
  };
}

async function markTaskListened(event, context) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'markTaskListened'
  }));
  const payload = (event && event.payload) || {};
  const category = payload.category;
  const scope = study.getUserScope(ctx);
  const progressRecords = await study.getChildProgressRecords(scope);
  const checkins = await study.getCheckins(scope);
  const planRunType = String(payload.planRunType || 'normal');
  const targetDate = String(payload.targetDate || today).slice(0, 10);
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
    return Object.assign(
      await getTaskDetail({ payload: { category, taskId: payload.taskId, planRunType, targetDate, planDayIndex: payload.planDayIndex } }),
      {
        studyWriteAllowed: false,
        studyWriteMessage: '家长模式，不计入打卡'
      }
    );
  }
  if (planRunType === 'catchup') {
    const normalPlan = study.buildPlanForDay(study.getPlanDayIndexForDate(checkins, today));
    const normalTasks = study.decoratePlanTasks(progressRecords, ctx.child.childId, today, normalPlan, {
      planRunType: 'normal'
    });
    const normalDone = normalTasks.length > 0 && normalTasks.every((item) => item.completedToday);
    const catchupState = study.buildCatchupState(checkins, today, study.getPlanStartDate(ctx, today, checkins), normalDone);
    const requestedPlanDayIndex = Number(payload.planDayIndex || 0);
    if (!catchupState.canCatchup || targetDate !== catchupState.missedDate || (requestedPlanDayIndex && requestedPlanDayIndex !== catchupState.planDayIndex)) {
      throw new Error('请先完成当前计划后，再追赶一批任务');
    }
  }
  const todayPlan = shared.buildPlanForDay(
    planRunType === 'catchup'
    ? (Number(payload.planDayIndex || 0) || study.getPlanDayIndexForDate(checkins, targetDate))
      : study.getPlanDayIndexForDate(checkins, today)
  );
  const categoryTasks = ['newconcept2', 'newconcept3', 'newconcept4'].includes(category)
    ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, await study.resolveStandaloneCategoryTasks(category, ctx.child.childId, targetDate), {
      planRunType: 'level',
      targetDate,
      planDayIndex: 1
    })
    : study.decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, todayPlan.byCategory[category] || [], {
      planRunType,
      targetDate,
      planDayIndex: todayPlan.dayIndex
    });
  const task = categoryTasks.find((item) => item.taskId === payload.taskId)
    || categoryTasks.find((item) => !item.completedToday)
    || categoryTasks[0];
  if (!task || task.isPendingAsset || task.completedToday) {
    return getTaskDetail({ payload: { category, taskId: payload.taskId, planRunType, targetDate, planDayIndex: todayPlan.dayIndex } });
  }
  const nextPlayCount = Math.min((task.playCount || 0) + 1, task.repeatTarget);
  const now = new Date().toISOString();
  const playMoments = Array.isArray(task.playMoments) ? task.playMoments.slice(0, nextPlayCount - 1) : [];
  playMoments.push(now);
  const record = {
    progressId: `${scope.familyId}_${scope.childId}_${targetDate}_${category}_${task.taskId}`,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    category,
    date: targetDate,
    taskId: task.taskId,
    playCount: nextPlayCount,
    playMoments,
    repeatTarget: task.repeatTarget,
    textUnlocked: nextPlayCount >= task.repeatTarget - 1,
    completedToday: nextPlayCount >= task.repeatTarget,
    planDayIndex: todayPlan.dayIndex,
    planRunType,
    targetDate,
    makeupForDate: planRunType === 'catchup' ? targetDate : '',
    updatedAt: now
  };
  await study.saveProgressRecord(record);
  if (planRunType === 'catchup') {
    const nextProgressRecords = await study.getChildProgressRecords(scope);
    await study.maybeCreateCheckin(scope, nextProgressRecords, targetDate, {
      planRunType,
      planDayIndex: todayPlan.dayIndex
    });
  }
  return getTaskDetail({ payload: { category, planRunType, targetDate, planDayIndex: todayPlan.dayIndex } });
}

async function completeTodayCheckin(event, context) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'completeTodayCheckin'
  }));
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
    throw new Error('家长模式不计入打卡');
  }
  const scope = study.getUserScope(ctx);
  const progressRecords = await study.getChildProgressRecords(scope);
  const checkins = await study.getCheckins(scope);
  const planDayIndex = study.getPlanDayIndexForDate(checkins, today);
  const checkin = await study.maybeCreateCheckin(scope, progressRecords, today, {
    planRunType: 'normal',
    planDayIndex
  });
  if (!checkin) {
    throw new Error('今天还没全部听完');
  }
  const dashboard = await study.getDashboardData(ctx);
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    family: ctx.family,
    child: dashboard.child,
    stats: dashboard.stats,
    todayRecord: checkin,
    dailyTasks: dashboard.dailyTasks,
    activeTaskCount: dashboard.activeTaskCount,
    completedTaskCountToday: dashboard.completedTaskCountToday,
    allDailyDone: dashboard.allDailyDone,
    checkinReady: false
  };
}

module.exports = {
  getTaskDetail,
  getTaskTranscript,
  markTaskListened,
  completeTodayCheckin
};
