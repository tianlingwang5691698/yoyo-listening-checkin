const monitor = require('./monitor');
const completionRecords = require('./completion-records');

function buildTaskSnapshot(task) {
  const source = task || {};
  return {
    category: source.category || '',
    categoryLabel: source.categoryLabel || '',
    taskId: source.taskId || '',
    originalTaskId: source.originalTaskId || '',
    title: source.title || '',
    displayTitle: source.displayTitle || '',
    displaySubtitle: source.displaySubtitle || '',
    audioTitle: source.audioTitle || '',
    audioCompactTitle: source.audioCompactTitle || '',
    audioUrl: source.audioUrl || '',
    audioCloudPath: source.audioCloudPath || '',
    audioFileId: source.audioFileId || '',
    audioSource: source.audioSource || '',
    durationSec: Number(source.durationSec || 0),
    repeatTarget: Number(source.repeatTarget || 3),
    playCount: Number(source.playCount || 0),
    playStepText: source.playStepText || '',
    currentPass: Number(source.currentPass || 1),
    completedToday: !!source.completedToday,
    textUnlocked: !!source.textUnlocked,
    transcriptVisible: !!source.transcriptVisible,
    transcriptTrackId: source.transcriptTrackId || '',
    transcriptStatus: source.transcriptStatus || '',
    syncGranularity: source.syncGranularity || '',
    textSource: source.textSource || null,
    coverTone: source.coverTone || '',
    coverVariant: source.coverVariant || '',
    coverBadge: source.coverBadge || '',
    coverMeta: source.coverMeta || '',
    planRunType: source.planRunType || '',
    planDayIndex: source.planDayIndex || 0,
    speakingMode: source.speakingMode || ''
  };
}

function hasTaskProgress(task) {
  const source = task || {};
  return !!source.completedToday
    || Number(source.playCount || 0) > 0
    || (Array.isArray(source.playMoments) && source.playMoments.length > 0);
}

function buildReportItem(category, task) {
  const source = task || {};
  const repeatTarget = Number(source.repeatTarget || 3);
  return {
    category,
    categoryLabel: source.categoryLabel,
    taskId: source.taskId,
    originalTaskId: source.originalTaskId || '',
    title: source.audioCompactTitle || source.displayTitle || source.title,
    audioUrl: source.audioUrl || '',
    audioCloudPath: source.audioCloudPath || '',
    audioFileId: source.audioFileId || '',
    audioSource: source.audioSource || '',
    taskSnapshot: buildTaskSnapshot(source),
    playCount: Number(source.playCount || 0),
    playMoments: Array.isArray(source.playMoments) ? source.playMoments : [],
    repeatTarget,
    completedToday: !!source.completedToday,
    completionEvidence: hasTaskProgress(source) ? 'dailyTaskProgress' : 'dailyPlanSnapshot',
    updatedAt: source.updatedAt || ''
  };
}

async function upsertDailyReport(scope, date, deps, options = {}) {
  const startedAt = Date.now();
  const progressRecords = await deps.getChildProgressRecords(scope);
  const checkins = await deps.getCheckins(scope);
  const activeListeningPlan = deps.getActiveListeningPlanByScope
    ? await deps.getActiveListeningPlanByScope(scope)
    : null;
  const useCustomListeningPlan = !!(activeListeningPlan && activeListeningPlan.active !== false);
  const useFixedSlotPlan = !useCustomListeningPlan && progressRecords.some((item) => (
    String(item.planSource || '') === 'fixed-yoyo'
      && Number(item.planSlotIndex || 0) > 0
  ));
  const planOptions = deps.getPeppaReviewPlanOptions
    ? deps.getPeppaReviewPlanOptions(progressRecords, checkins, scope.childId, date)
    : {};
  const planDayIndex = useCustomListeningPlan
    ? deps.getCustomPlanDayIndex(progressRecords, date, activeListeningPlan)
    : (useFixedSlotPlan ? 86 : deps.getPlanDayIndexForDate(checkins, date));
  const todayPlan = useCustomListeningPlan
    ? deps.buildListeningPlanForDay(activeListeningPlan, planDayIndex, { date, progressRecords })
    : (useFixedSlotPlan && deps.buildFixedPlanBySlots
      ? deps.buildFixedPlanBySlots(progressRecords, scope.childId, date, planOptions)
      : deps.buildPlanForDay(planDayIndex, planOptions));
  const checkin = checkins.find((item) => item.date === date) || null;
  const categoryOrder = useCustomListeningPlan
    ? (todayPlan.categoryOrder || Object.keys(todayPlan.byCategory || {}))
    : deps.getPlanCategoryOrder(todayPlan.dayIndex);
  const groupedTasks = categoryOrder.map((category) => ({
    category,
    tasks: useCustomListeningPlan
      ? deps.decorateListeningPlanTasks(progressRecords, scope.childId, date, todayPlan, {
        planRunType: 'normal',
        listeningPlanId: activeListeningPlan.planId || activeListeningPlan._id || ''
      }).filter((item) => item.category === category)
      : (useFixedSlotPlan && deps.decorateFixedSlotPlanTasks
        ? deps.decorateFixedSlotPlanTasks(progressRecords, scope.childId, date, todayPlan, { planRunType: 'normal' })
          .filter((item) => item.category === category)
        : deps.decoratePlannedTasks(progressRecords, scope.childId, category, date, todayPlan.byCategory[category] || [], {
          planRunType: 'normal',
          targetDate: date,
          planDayIndex: todayPlan.dayIndex
        }))
  }));
  const includePlannedTasks = options.includePlannedTasks !== false;
  const items = groupedTasks.flatMap((group) => group.tasks
    .filter((task) => includePlannedTasks || hasTaskProgress(task))
    .map((task) => buildReportItem(group.category, task)));
  const attempts = deps.findAttemptsByDate ? await deps.findAttemptsByDate(scope, date) : [];
  const completionItems = completionRecords.dedupeCompletionItems(
    deps.findCompletionItemsByDate ? await deps.findCompletionItemsByDate(scope, date) : []
  );
  const speakingAttempts = attempts.map((item) => ({
    attemptId: item._id || item.attemptId || '',
    category: item.category || '',
    taskId: item.taskId || '',
    attemptType: item.attemptType || '',
    attemptIndex: Number(item.attemptIndex || 0),
    sentenceIndex: Number(item.sentenceIndex || 0),
    questionText: item.questionText || item.promptText || '',
    studentTranscript: item.studentTranscript || '',
    score: Number(item.score || 0),
    pronunciationAccuracyScore: Number(item.pronunciationAccuracyScore || 0),
    pronunciationFluencyScore: Number(item.pronunciationFluencyScore || 0),
    pronunciationCompletionScore: Number(item.pronunciationCompletionScore || 0),
    contentGrammarScore: Number(item.contentGrammarScore || 0),
    ieltsPart: Number(item.ieltsPart || 0),
    ieltsOverallBand: Number(item.ieltsOverallBand || 0),
    ieltsFluencyCoherenceBand: Number(item.ieltsFluencyCoherenceBand || 0),
    ieltsLexicalResourceBand: Number(item.ieltsLexicalResourceBand || 0),
    ieltsGrammaticalRangeAccuracyBand: Number(item.ieltsGrammaticalRangeAccuracyBand || 0),
    ieltsPronunciationBand: Number(item.ieltsPronunciationBand || 0),
    ieltsAssessmentScope: item.ieltsAssessmentScope || '',
    feedback: item.feedback || '',
    status: item.status || '',
    scoreErrorType: item.scoreErrorType || '',
    answerAudioFileId: item.answerAudioFileId || '',
    answerCloudPath: item.answerCloudPath || '',
    feedbackAudioFileId: item.feedbackAudioFileId || '',
    feedbackAudioCloudPath: item.feedbackAudioCloudPath || '',
    answerDurationMs: Number(item.answerDurationMs || 0),
    createdAt: item.createdAt || ''
  }));
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
      const taskId = item.originalTaskId || item.taskId;
      const task = deps.getCatalog(item.category).find((entry) => entry.taskId === taskId);
      const durationSec = Number(
        (item.taskSnapshot && item.taskSnapshot.durationSec)
        || (task && task.durationSec)
        || 0
      );
      return durationSec > 0
        ? sum + Math.round((durationSec * Math.min(item.playCount, item.repeatTarget)) / 60)
        : sum;
    }, 0),
    streakSnapshot: (checkin || {}).streakSnapshot || 0,
    planDayIndex: todayPlan.dayIndex,
    planPhase: todayPlan.phase.key,
    planSource: useCustomListeningPlan ? 'custom-listening' : 'fixed-yoyo',
    listeningPlanId: useCustomListeningPlan ? (activeListeningPlan.planId || activeListeningPlan._id || '') : '',
    recordSourceVersion: includePlannedTasks ? 'daily-plan-snapshot-v2' : 'daily-progress-v1',
    planSnapshotCaptured: includePlannedTasks,
    items,
    speakingAttempts,
    completionItems: completionItems.map((item) => Object.assign({}, item, {
      id: item.recordId || item._id || ''
    })),
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
  monitor.logPerf('cloudfn', 'upsertDailyReport', Date.now() - startedAt, { date });
  return report;
}

module.exports = {
  upsertDailyReport,
  buildTaskSnapshot,
  buildReportItem,
  hasTaskProgress
};
