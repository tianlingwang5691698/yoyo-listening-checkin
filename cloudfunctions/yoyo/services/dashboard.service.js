const study = require('../facades/study.facade');
const flashcardService = require('./flashcard.service');
const unlock1SpeakingPlanService = require('./unlock1-speaking-plan.service');

function resolveDashboardOptions(view) {
  if (view === 'home') {
    return {
      includeDailyTasks: false,
      includeHomeTaskGroups: true,
      includeCategorySummaries: false,
      includeCatchupState: false,
      includePlanDebug: false,
      includeTaskProgressSummary: true,
      includeUser: false,
      includeFamily: false,
      includeStats: false,
      includeChildStats: false,
      includeTodayListeningMinutes: true,
      progressScope: 'home',
      reconcileCheckins: false
    };
  }
  if (view === 'record') {
    return {
      includeDailyTasks: false,
      includeHomeTaskGroups: false,
      includeCategorySummaries: false,
      includeCatchupState: false,
      includePlanDebug: false,
      includeTaskProgressSummary: false,
      includeUser: false,
      includeFamily: false,
      statsOnly: true,
      reconcileCheckins: false
    };
  }
  return {};
}

async function getDashboard(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getDashboard'
  }));
  const view = String((((event && event.payload) || {}).view) || '').trim();
  const payload = (event && event.payload) || {};
  const options = resolveDashboardOptions(view);
  if (payload.debug) {
    options.includePerfDebug = true;
    options.perfView = view;
  }
  const scope = study.getUserScope(ctx);
  const shouldLoadCumulativeMinutes = view === 'record'
    && scope && scope.familyId && scope.childId;
  const [dashboard, cumulativeMinutes] = await Promise.all([
    study.getDashboardData(ctx, options),
    shouldLoadCumulativeMinutes ? study.getCumulativeListeningMinutes(scope) : null
  ]);
  if (view === 'record' && dashboard.stats && cumulativeMinutes !== null && cumulativeMinutes !== undefined) {
    dashboard.stats.totalMinutes = Math.max(0, Number(cumulativeMinutes || 0));
  }
  if (view === 'home' && study.isYoyoChild(dashboard.child)) {
    const today = study.getTodayString();
    const [vocabularyPlan, speakingPlan] = await Promise.all([
      flashcardService.getJuniorListPlanSummary(ctx, today),
      dashboard.planSource === 'fixed-yoyo' && dashboard.planPhase === 'round-2'
        ? unlock1SpeakingPlanService.getDailyPlanSummary(ctx, today, dashboard.planDayIndex)
        : null
    ]);
    dashboard.vocabularyPlan = vocabularyPlan;
    dashboard.speakingPlan = speakingPlan;
  }
  return dashboard;
}

module.exports = {
  getDashboard
};
