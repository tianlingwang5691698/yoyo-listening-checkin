const shared = require('../services/shared.service');
const familyContext = require('./family-context.facade');

function isDefaultChildNickname(child) {
  const next = child || {};
  const value = String(next.nickname || '').trim();
  const childLoginCode = String(next.childLoginCode || '').trim();
  return !value || ['同学', '我'].includes(value) || (value === '佑佑' && childLoginCode !== '317613');
}

function decorateChild(child) {
  const next = Object.assign({}, child || {});
  return Object.assign(next, {
    nicknameRequired: isDefaultChildNickname(next)
  });
}

function buildFamilyContextPayload(ctx) {
  return {
    user: ctx.user,
    currentUser: ctx.user,
    family: ctx.family,
    currentMember: ctx.member,
    members: ctx.members,
    child: decorateChild(ctx.child),
    studentLinks: ctx.studentLinks || [],
    subscriptionPreference: ctx.subscriptionPreference
  };
}

function buildProfilePayload(ctx, dashboard) {
  return Object.assign({}, buildFamilyContextPayload(ctx), {
    child: Object.assign({}, decorateChild(ctx.child), (dashboard && dashboard.stats) || {}),
    level: module.exports.level,
    familyReady: true
  });
}

async function reloadFamilyContext(openId, target) {
  const nextCtx = await module.exports.ensureBootstrap(openId, target);
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
  saveDeviceStudyRole: shared.saveDeviceStudyRole,
  buildFamilyContextPayload,
  buildProfilePayload,
  reloadFamilyContext,
  getDashboardData: (ctx, options) => shared.getDashboardData(ctx, options),
  level: shared.level
};
