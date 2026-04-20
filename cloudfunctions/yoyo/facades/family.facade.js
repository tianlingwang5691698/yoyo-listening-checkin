const shared = require('../services/shared.service');

module.exports = {
  prepareRequestContext: shared.prepareRequestContext,
  ensureBootstrap: shared.ensureBootstrap,
  updateChildProfile: shared.updateChildProfile,
  setExclusiveStudyRole: shared.setExclusiveStudyRole,
  upsertFamilyMemberForFamily: shared.upsertFamilyMemberForFamily,
  normalizeStudyRole: shared.normalizeStudyRole,
  clearTodayUnconfirmedListens: shared.clearTodayUnconfirmedListens,
  getDashboardData: shared.getDashboardData,
  level: shared.level
};
