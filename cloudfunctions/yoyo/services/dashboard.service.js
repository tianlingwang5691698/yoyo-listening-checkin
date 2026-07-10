const study = require('../facades/study.facade');

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
  return study.getDashboardData(ctx, options);
}

module.exports = {
  getDashboard
};
