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
      includeStats: false
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
      includeFamily: false
    };
  }
  return {};
}

async function getDashboard(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getDashboard'
  }));
  const view = String((((event && event.payload) || {}).view) || '').trim();
  return study.getDashboardData(ctx, resolveDashboardOptions(view));
}

module.exports = {
  getDashboard
};
