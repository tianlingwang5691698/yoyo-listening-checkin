const shared = require('../services/shared.service');
const familyContext = require('./family-context.facade');

function buildFamilyContextPayload(ctx) {
  return {
    user: ctx.user,
    currentUser: ctx.user,
    family: ctx.family,
    currentMember: ctx.member,
    members: ctx.members,
    child: ctx.child,
    subscriptionPreference: ctx.subscriptionPreference
  };
}

function buildProfilePayload(ctx, dashboard) {
  return Object.assign({}, buildFamilyContextPayload(ctx), {
    child: Object.assign({}, ctx.child, (dashboard && dashboard.stats) || {}),
    level: module.exports.level,
    familyReady: true
  });
}

async function reloadFamilyContext(openId) {
  const nextCtx = await module.exports.ensureBootstrap(openId);
  return buildFamilyContextPayload(nextCtx);
}

module.exports = {
  prepareRequestContext: shared.prepareRequestContext,
  ensureBootstrap: familyContext.ensureBootstrap,
  updateChildProfile: familyContext.updateChildProfile,
  setExclusiveStudyRole: familyContext.setExclusiveStudyRole,
  upsertFamilyMemberForFamily: familyContext.upsertFamilyMemberForFamily,
  leaveCurrentFamily: familyContext.leaveCurrentFamily,
  normalizeStudyRole: familyContext.normalizeStudyRole,
  clearTodayUnconfirmedListens: shared.clearTodayUnconfirmedListens,
  buildFamilyContextPayload,
  buildProfilePayload,
  reloadFamilyContext,
  getDashboardData: (ctx, options) => shared.getDashboardData(ctx, options),
  level: shared.level
};
