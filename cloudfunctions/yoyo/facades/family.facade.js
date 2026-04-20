const shared = require('../services/shared.service');

module.exports = {
  prepareRequestContext: shared.prepareRequestContext,
  ensureBootstrap: shared.ensureBootstrap,
  updateChildProfile: shared.updateChildProfile,
  setExclusiveStudyRole: shared.setExclusiveStudyRole,
  upsertFamilyMemberForFamily: shared.upsertFamilyMemberForFamily,
  leaveCurrentFamily: shared.leaveCurrentFamily,
  normalizeStudyRole: shared.normalizeStudyRole,
  clearTodayUnconfirmedListens: shared.clearTodayUnconfirmedListens,
  getDashboardData: (ctx, options) => shared.getDashboardData(ctx, options),
  level: shared.level
};
