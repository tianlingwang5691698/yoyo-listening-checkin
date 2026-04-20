const shared = require('../services/shared.service');

module.exports = {
  prepareRequestContext: shared.prepareRequestContext,
  getDashboardData: (ctx, options) => shared.getDashboardData(ctx, options),
  getUserScope: shared.getUserScope,
  getChildProgressRecords: shared.getChildProgressRecords,
  getCheckins: shared.getCheckins,
  getPlanDayIndexForDate: shared.getPlanDayIndexForDate,
  buildPlanForDay: shared.buildPlanForDay,
  decoratePlannedTasks: shared.decoratePlannedTasks,
  decoratePlanTasks: shared.decoratePlanTasks,
  resolveStandaloneCategoryTasks: shared.resolveStandaloneCategoryTasks,
  buildCategorySummary: shared.buildCategorySummary,
  getPlanCatalog: shared.getPlanCatalog,
  addDays: shared.addDays,
  getTodayString: shared.getTodayString,
  buildEmptyProgress: shared.buildEmptyProgress,
  decorateTask: shared.decorateTask,
  getTranscriptBundle: shared.getTranscriptBundle,
  upsertDailyReport: shared.upsertDailyReport,
  buildCatchupState: shared.buildCatchupState,
  getPlanStartDate: shared.getPlanStartDate,
  normalizeStudyRole: shared.normalizeStudyRole,
  maybeCreateCheckin: shared.maybeCreateCheckin,
  saveProgressRecord: shared.saveProgressRecord,
  level: shared.level
};
