const study = require('../facades/study.facade');

const STANDALONE_LEVEL_CATEGORIES = ['littlebear', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'newconcept2', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'newconcept3', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'];
const CATALOG_BROWSE_CATEGORIES = ['song', 'littlebear', 'newconcept1', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'peppa', 'newconcept2', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'newconcept3', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'];

function normalizeTaskSnapshot(snapshot, payload) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  const taskId = String(snapshot.taskId || '').trim();
  const category = String(snapshot.category || '').trim();
  if (!taskId || !category) {
    return null;
  }
  if (payload.taskId && taskId !== String(payload.taskId || '').trim()) {
    return null;
  }
  if (payload.category && category !== String(payload.category || '').trim()) {
    return null;
  }
  return Object.assign({}, snapshot, {
    category,
    taskId
  });
}

function hasTaskAudioSource(task) {
  return !!(task && (
    task.isPendingAsset
    || task.audioUrl
    || task.audioCloudPath
    || task.audioFileId
  ));
}

function buildProgressFromTask(task) {
  const repeatTarget = Number(task.repeatTarget || 3);
  const playCount = Number(task.playCount || 0);
  return {
    playCount,
    playStepText: task.playStepText || `${playCount}/${repeatTarget}`,
    currentPass: Number(task.currentPass || Math.min(playCount + 1, repeatTarget) || 1),
    repeatTarget,
    textUnlocked: !!task.textUnlocked,
    transcriptVisible: !!task.transcriptVisible,
    completedToday: !!task.completedToday
  };
}

async function getTaskDetail(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getTaskDetail'
  }));
  const payload = (event && event.payload) || {};
  const view = String(payload.view || '').trim();
  const isLessonView = view === 'lesson';
  let planRunType = String(payload.planRunType || 'normal');
  let targetDate = String(payload.targetDate || today).slice(0, 10);
  const snapshotTask = isLessonView ? normalizeTaskSnapshot(payload.taskSnapshot, payload) : null;
  if (snapshotTask && hasTaskAudioSource(snapshotTask)) {
    let hydratedTask = snapshotTask;
    let dailyQueueTasks = [hydratedTask];
    let planDayIndex = Number(payload.planDayIndex || snapshotTask.planDayIndex || 0);
    if (snapshotTask.catalogSummary) {
      const canonicalTasks = await study.resolveStandaloneCategoryTasks(snapshotTask.category, '', today);
      const canonicalTask = canonicalTasks.find((item) => item.taskId === snapshotTask.taskId);
      if (canonicalTask && hasTaskAudioSource(canonicalTask)) {
        hydratedTask = study.decorateTask(Object.assign({}, canonicalTask, {
          planRunType: 'preview',
          planDayIndex: 1
        }), study.buildEmptyProgress(), snapshotTask.category);
        dailyQueueTasks = [hydratedTask];
        planDayIndex = 1;
      }
    }
    if (planRunType === 'normal' && String(payload.source || '') !== 'catalog') {
      try {
        const dashboard = await study.getDashboardData(ctx, {
          includeDailyTasks: true,
          includeHomeTaskGroups: false,
          includeCategorySummaries: false,
          includeCatchupState: false,
          includePlanDebug: false,
          includeTaskProgressSummary: false,
          includeUser: false,
          includeFamily: false,
          includeStats: false
        });
        const canonicalTask = (dashboard.dailyTasks || []).find((item) => (
          item.category === snapshotTask.category && item.taskId === snapshotTask.taskId
        ));
        if (canonicalTask && hasTaskAudioSource(canonicalTask)) {
          hydratedTask = canonicalTask;
          dailyQueueTasks = dashboard.dailyTasks || [canonicalTask];
          planDayIndex = Number(dashboard.planDayIndex || canonicalTask.planDayIndex || planDayIndex || 0);
        }
      } catch (error) {
        // The playable snapshot remains the fallback when today's plan cannot hydrate it.
      }
    }
    return Object.assign({
      showCloudDebug: false,
      syncDebug: null,
      currentMember: ctx.member,
      child: ctx.child,
      task: hydratedTask,
      progress: buildProgressFromTask(hydratedTask),
      categoryTasks: [hydratedTask],
      dailyQueueTasks,
      categoryTaskCount: 1,
      categoryCompletedCount: hydratedTask.completedToday ? 1 : 0,
      planDayIndex,
      planPhaseLabel: hydratedTask.planPhaseLabel || '',
      planRunType,
      targetDate,
      scriptSource: hydratedTask.textSource || null,
      transcriptTrack: null,
      transcriptLines: [],
      transcriptPendingLoad: true,
      todayRecord: null,
      history: [],
      studyWriteAllowed: planRunType !== 'preview' && study.isStudyWriteAllowed(ctx),
      studyWriteMessage: planRunType === 'preview' ? '预览模式，不计入打卡' : (study.isStudyWriteAllowed(ctx) ? '' : '家长模式，不计入打卡'),
      checkinReady: false
    });
  }
  const isPreview = planRunType === 'preview';
  const isCatalogBrowse = isPreview && String(payload.source || '') === 'catalog' && CATALOG_BROWSE_CATEGORIES.includes(payload.category);
  const dashboard = await study.getDashboardData(ctx, isPreview ? {
    includeDailyTasks: false,
    includeHomeTaskGroups: false,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: false,
    includeUser: false,
    includeFamily: false,
    includeStats: false
  } : undefined);
  if (planRunType === 'catchup' && (!dashboard.catchupState.canCatchup || targetDate !== dashboard.catchupState.missedDate)) {
    planRunType = 'normal';
    targetDate = today;
  }
  const targetPlanDayIndex = isPreview
    ? (Number(payload.planDayIndex || 0) || dashboard.planDayIndex)
    : planRunType === 'catchup'
    ? Number(payload.planDayIndex || 0) || dashboard.catchupState.planDayIndex || dashboard.planDayIndex
    : dashboard.planDayIndex;
  const progressRecords = await study.getChildProgressRecords(study.getUserScope(ctx));
  const scope = study.getUserScope(ctx);
  const checkins = await study.getCheckins(scope);
  const targetPlan = (planRunType === 'catchup' || (isPreview && !isCatalogBrowse))
    ? study.buildPlanForDay(targetPlanDayIndex, study.getPeppaReviewPlanOptions(progressRecords, checkins, ctx.child.childId, targetDate))
    : null;
  const categoryTasks = isCatalogBrowse
    ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, payload.category, targetDate, await study.resolveStandaloneCategoryTasks(payload.category, ctx.child.childId, targetDate), {
      planRunType: 'preview',
      targetDate,
      planDayIndex: 1
    })
    : dashboard.planSource === 'custom-listening' && planRunType === 'normal'
      ? dashboard.dailyTasks.filter((item) => item.category === payload.category)
      : STANDALONE_LEVEL_CATEGORIES.includes(payload.category)
    ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, payload.category, targetDate, await study.resolveStandaloneCategoryTasks(payload.category, ctx.child.childId, targetDate), {
      planRunType: 'level',
      targetDate,
      planDayIndex: 1
    })
    : (planRunType === 'catchup' || isPreview)
      ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, payload.category, targetDate, targetPlan.byCategory[payload.category] || [], {
        planRunType,
        targetDate,
        planDayIndex: targetPlan.dayIndex
      })
      : dashboard.dailyTasks.filter((item) => item.category === payload.category);
  const task = categoryTasks.find((item) => item.taskId === payload.taskId)
    || categoryTasks.find((item) => !item.completedToday)
    || categoryTasks[0]
    || study.decorateTask(null, study.buildEmptyProgress(), payload.category);
  const history = isLessonView ? [] : progressRecords
    .filter((item) => item.category === payload.category && item.completedToday)
    .map((item) => ({
      date: item.date,
      taskTitle: item.taskId,
      playCount: item.playCount
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayRecord = isPreview ? null : (checkins.find((item) => item.date === today) || null);
  const checkinReady = study.normalizeStudyRole(ctx.member) === 'student'
    && planRunType === 'normal'
    && targetDate === today
    && dashboard.allDailyDone
    && !todayRecord;
  const result = {
    currentMember: ctx.member,
    child: ctx.child,
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
    dailyQueueTasks: planRunType === 'normal' && Array.isArray(dashboard.dailyTasks) && dashboard.dailyTasks.length
      ? dashboard.dailyTasks
      : categoryTasks,
    categoryTaskCount: categoryTasks.length,
    categoryCompletedCount: categoryTasks.filter((item) => item.completedToday).length,
    planDayIndex: targetPlanDayIndex,
    planPhaseLabel: targetPlan ? (targetPlan.phase.label || dashboard.planPhaseLabel) : dashboard.planPhaseLabel,
    planRunType,
    targetDate,
    scriptSource: task.textSource || null,
    transcriptTrack: null,
    transcriptLines: [],
    transcriptPendingLoad: true,
    todayRecord,
    history,
    studyWriteAllowed: !isPreview && study.isStudyWriteAllowed(ctx),
    studyWriteMessage: isPreview ? '预览模式，不计入打卡' : (study.isStudyWriteAllowed(ctx) ? '' : '家长模式，不计入打卡'),
    checkinReady
  };
  if (!isLessonView) {
    result.user = ctx.user;
    result.currentUser = ctx.user;
    result.stats = dashboard.stats;
  }
  return result;
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
  if (STANDALONE_LEVEL_CATEGORIES.includes(requestedCategory)) {
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
  if (planRunType === 'preview') {
    return Object.assign(
      await getTaskDetail({ payload: { category, taskId: payload.taskId, planRunType, targetDate, planDayIndex: payload.planDayIndex } }),
      {
        studyWriteAllowed: false,
        studyWriteMessage: '预览模式，不计入打卡'
      }
    );
  }
  if (!study.isStudyWriteAllowed(ctx)) {
    return Object.assign(
      await getTaskDetail({ payload: { category, taskId: payload.taskId, planRunType, targetDate, planDayIndex: payload.planDayIndex } }),
      {
        studyWriteAllowed: false,
        studyWriteMessage: '家长模式，不计入打卡'
      }
    );
  }
  if (planRunType === 'catchup') {
    const normalPlan = study.buildPlanForDay(
      study.getNextPlanDayIndexForDate(checkins, today),
      study.getPeppaReviewPlanOptions(progressRecords, checkins, ctx.child.childId, today)
    );
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
  const activeListeningPlan = planRunType === 'normal'
    ? await study.getActiveListeningPlan(ctx)
    : null;
  const useCustomListeningPlan = !!(activeListeningPlan && activeListeningPlan.active !== false);
  const todayPlan = useCustomListeningPlan
    ? study.buildListeningPlanForDay(
      activeListeningPlan,
      study.getCustomPlanDayIndex(progressRecords, targetDate, activeListeningPlan),
      { date: targetDate, progressRecords }
    )
    : (planRunType === 'normal' && study.isYoyoChild(ctx.child)
      ? study.buildFixedPlanBySlots(progressRecords, ctx.child.childId, targetDate, study.getPeppaReviewPlanOptions(progressRecords, checkins, ctx.child.childId, targetDate))
      : study.buildPlanForDay(
        Number(payload.planDayIndex || 0) || study.getPlanDayIndexForDate(checkins, targetDate),
        study.getPeppaReviewPlanOptions(progressRecords, checkins, ctx.child.childId, targetDate)
      ));
  const categoryTasks = useCustomListeningPlan
    ? study.decorateListeningPlanTasks(progressRecords, ctx.child.childId, targetDate, todayPlan, {
      planRunType,
      targetDate,
      listeningPlanId: activeListeningPlan.planId || activeListeningPlan._id || ''
    }).filter((item) => item.category === category)
    : STANDALONE_LEVEL_CATEGORIES.includes(category)
    ? study.decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, await study.resolveStandaloneCategoryTasks(category, ctx.child.childId, targetDate), {
      planRunType: 'level',
      targetDate,
      planDayIndex: 1
    })
    : (planRunType === 'normal' && study.isYoyoChild(ctx.child)
      ? study.decorateFixedSlotPlanTasks(progressRecords, ctx.child.childId, targetDate, todayPlan, { planRunType })
        .filter((item) => item.category === category)
      : study.decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, todayPlan.byCategory[category] || [], {
        planRunType,
        targetDate,
        planDayIndex: todayPlan.dayIndex
      }));
  const task = categoryTasks.find((item) => item.taskId === payload.taskId)
    || categoryTasks.find((item) => !item.completedToday)
    || categoryTasks[0];
  if (!task || task.isPendingAsset || task.completedToday) {
    if (task && task.completedToday && planRunType === 'normal' && study.isYoyoChild(ctx.child) && Number(task.planSlotIndex || 0) > 0) {
      await study.syncFixedPlanProgressSummary(scope, task);
    }
    return getTaskDetail({ payload: { category, taskId: payload.taskId, planRunType, targetDate, planDayIndex: todayPlan.dayIndex } });
  }
  const completeOnListen = payload.completeOnListen === true;
  const nextPlayCount = completeOnListen
    ? task.repeatTarget
    : Math.min((task.playCount || 0) + 1, task.repeatTarget);
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
    originalTaskId: task.originalTaskId || '',
    playCount: nextPlayCount,
    playMoments,
    repeatTarget: task.repeatTarget,
    durationSec: Math.max(0, Number(task.durationSec || 0)),
    textUnlocked: nextPlayCount >= task.repeatTarget - 1,
    completedToday: nextPlayCount >= task.repeatTarget,
    planDayIndex: todayPlan.dayIndex,
    planSlotIndex: Number(task.planSlotIndex || 0),
    planSlotCount: Number(task.planSlotCount || 0),
    planSource: useCustomListeningPlan ? 'custom-listening' : 'fixed-yoyo',
    listeningPlanId: useCustomListeningPlan ? (activeListeningPlan.planId || activeListeningPlan._id || '') : '',
    planRunType,
    targetDate,
    makeupForDate: planRunType === 'catchup' ? targetDate : '',
    updatedAt: now
  };
  await study.saveProgressRecord(record);
  if (record.planSource === 'fixed-yoyo' && record.planRunType === 'normal' && record.planSlotIndex > 0) {
    await study.syncFixedPlanProgressSummary(scope, record);
  }
  let nextProgressRecords = null;
  if ((planRunType === 'normal' || planRunType === 'catchup') && study.normalizeStudyRole(ctx.member) === 'student') {
    await study.upsertDailyReport(scope, targetDate);
  }
  if ((planRunType === 'normal' || planRunType === 'catchup') && study.normalizeStudyRole(ctx.member) === 'student') {
    nextProgressRecords = await study.getChildProgressRecords(scope);
    await study.maybeCreateCheckin(scope, nextProgressRecords, targetDate, {
      planRunType,
      planDayIndex: todayPlan.dayIndex,
      todayPlan: useCustomListeningPlan || study.isYoyoChild(ctx.child) ? todayPlan : undefined,
      planSource: useCustomListeningPlan ? 'custom-listening' : 'fixed-yoyo',
      listeningPlanId: useCustomListeningPlan ? (activeListeningPlan.planId || activeListeningPlan._id || '') : ''
    });
  }
  if (payload.continuousQueueV1 === true) {
    nextProgressRecords = nextProgressRecords || await study.getChildProgressRecords(scope);
    const dailyQueueTasks = useCustomListeningPlan
      ? study.decorateListeningPlanTasks(nextProgressRecords, ctx.child.childId, targetDate, todayPlan, {
        planRunType,
        targetDate,
        listeningPlanId: activeListeningPlan.planId || activeListeningPlan._id || ''
      })
      : study.decoratePlanTasks(nextProgressRecords, ctx.child.childId, targetDate, todayPlan, {
        planRunType,
        targetDate
      });
    const updatedTask = dailyQueueTasks.find((item) => item.category === category && item.taskId === task.taskId)
      || Object.assign({}, task, record);
    const updatedCategoryTasks = dailyQueueTasks.filter((item) => item.category === category);
    const nextCheckins = await study.getCheckins(scope);
    return {
      currentMember: ctx.member,
      child: ctx.child,
      task: updatedTask,
      progress: buildProgressFromTask(updatedTask),
      categoryTasks: updatedCategoryTasks,
      dailyQueueTasks,
      categoryTaskCount: updatedCategoryTasks.length,
      categoryCompletedCount: updatedCategoryTasks.filter((item) => item.completedToday).length,
      planDayIndex: todayPlan.dayIndex,
      planPhaseLabel: todayPlan.phase ? todayPlan.phase.label || '' : '',
      planRunType,
      targetDate,
      scriptSource: updatedTask.textSource || null,
      transcriptTrack: null,
      transcriptLines: [],
      transcriptPendingLoad: true,
      todayRecord: nextCheckins.find((item) => item.date === targetDate) || null,
      history: [],
      studyWriteAllowed: study.isStudyWriteAllowed(ctx),
      studyWriteMessage: '',
      checkinReady: false
    };
  }
  return getTaskDetail({ payload: {
    category,
    taskId: '',
    planRunType,
    targetDate,
    planDayIndex: todayPlan.dayIndex
  } });
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
  const activeListeningPlan = await study.getActiveListeningPlan(ctx);
  const useCustomListeningPlan = !!(activeListeningPlan && activeListeningPlan.active !== false);
  const planDayIndex = useCustomListeningPlan
    ? study.getCustomPlanDayIndex(progressRecords, today, activeListeningPlan)
    : (study.isYoyoChild(ctx.child) ? 86 : study.getNextPlanDayIndexForDate(checkins, today));
  const todayPlan = useCustomListeningPlan
    ? study.buildListeningPlanForDay(activeListeningPlan, planDayIndex, { date: today, progressRecords })
    : (study.isYoyoChild(ctx.child)
      ? study.buildFixedPlanBySlots(progressRecords, ctx.child.childId, today)
      : undefined);
  const checkin = await study.maybeCreateCheckin(scope, progressRecords, today, {
    planRunType: 'normal',
    planDayIndex,
    todayPlan,
    planSource: useCustomListeningPlan ? 'custom-listening' : 'fixed-yoyo',
    listeningPlanId: useCustomListeningPlan ? (activeListeningPlan.planId || activeListeningPlan._id || '') : ''
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

async function completeGrammarPlanTask(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'completeGrammarPlanTask'
  }));
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
    throw new Error('家长模式不计入打卡');
  }
  if (!study.isYoyoChild(ctx.child)) {
    throw new Error('grammar-fixed-plan-yoyo-only');
  }
  const scope = study.getUserScope(ctx);
  const checkins = await study.getCheckins(scope);
  const progressBefore = await study.getChildProgressRecords(scope);
  const todayPlan = study.buildFixedPlanBySlots(progressBefore, ctx.child.childId, today);
  const planDayIndex = todayPlan.dayIndex;
  const taskId = String(payload.taskId || '').trim();
  const task = (todayPlan.byCategory.grammar || []).find((item) => item.taskId === taskId);
  if (!task) {
    throw new Error(`grammar-plan-task-invalid:${taskId || 'missing'}`);
  }
  const narrationDuration = Math.max(0, Number(payload.narrationDuration || 0));
  const narrationListenedSec = Math.max(0, Number(payload.narrationListenedSec || 0));
  const correctQuestionCount = Math.max(0, Number(payload.correctQuestionCount || 0));
  const totalQuestionCount = Math.max(0, Number(payload.totalQuestionCount || 0));
  if (!narrationDuration || narrationListenedSec < narrationDuration * 0.95) {
    throw new Error('grammar-plan-audio-below-95-percent');
  }
  if (!totalQuestionCount || correctQuestionCount !== totalQuestionCount) {
    throw new Error('grammar-plan-exercises-incomplete');
  }
  const now = new Date().toISOString();
  await study.saveProgressRecord({
    progressId: `${scope.familyId}_${scope.childId}_${today}_grammar_${task.taskId}`,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    category: 'grammar',
    date: today,
    taskId: task.taskId,
    playCount: 1,
    playMoments: [now],
    repeatTarget: 1,
    durationSec: 0,
    narrationDuration,
    narrationListenedSec,
    correctQuestionCount,
    totalQuestionCount,
    textUnlocked: true,
    completedToday: true,
    planDayIndex,
    planSlotIndex: Number(task.planSlotIndex || 0),
    planSlotCount: Number(task.planSlotCount || 0),
    planSource: 'fixed-yoyo',
    planRunType: 'normal',
    targetDate: today,
    updatedAt: now
  });
  await study.syncFixedPlanProgressSummary(scope, {
    category: 'grammar',
    planSlotIndex: Number(task.planSlotIndex || 0)
  });
  const progressRecords = await study.getChildProgressRecords(scope);
  await study.upsertDailyReport(scope, today);
  const checkin = await study.maybeCreateCheckin(scope, progressRecords, today, {
    planRunType: 'normal',
    planDayIndex,
    todayPlan,
    planSource: 'fixed-yoyo'
  });
  return { saved: true, taskId, checkin: checkin || null };
}

module.exports = {
  getTaskDetail,
  getTaskTranscript,
  markTaskListened,
  completeGrammarPlanTask,
  completeTodayCheckin
};
