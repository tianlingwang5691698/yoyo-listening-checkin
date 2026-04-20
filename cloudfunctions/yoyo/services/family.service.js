const familyFacade = require('../facades/family.facade');
const familyRepository = require('../repositories/family.repository');
const childRepository = require('../repositories/child.repository');
const subscriptionRepository = require('../repositories/subscription.repository');

async function getProfileData(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'getProfileData'
  }));
  const dashboard = await familyFacade.getDashboardData(ctx);
  return {
    user: ctx.user,
    currentUser: ctx.user,
    child: Object.assign({}, ctx.child, dashboard.stats),
    level: familyFacade.level,
    familyReady: true,
    family: ctx.family,
    members: ctx.members,
    currentMember: ctx.member,
    subscriptionPreference: ctx.subscriptionPreference
  };
}

async function getFamilyPage(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'getFamilyPage'
  }));
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

async function refreshInviteCode(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'refreshInviteCode'
  }));
  const inviteCode = `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await familyRepository.updateFamilyById(ctx.family.familyId, { inviteCode });
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

async function joinFamily(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'joinFamily'
  }));
  const payload = (event && event.payload) || {};
  const inviteCode = String(payload.inviteCode || '').trim();
  const target = await familyRepository.findFamilyByInviteCode(inviteCode);
  if (!target) {
    throw new Error('邀请码不正确');
  }
  const displayName = String(payload.displayName || '').trim() || '新家长';
  await familyFacade.upsertFamilyMemberForFamily(ctx.user.openId, ctx.user.userId, target.familyId, displayName);
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

async function joinFamilyByChildCode(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'joinFamilyByChildCode'
  }));
  const payload = (event && event.payload) || {};
  const childLoginCode = String(payload.childLoginCode || '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(childLoginCode)) {
    throw new Error('请输入 6 位孩子 ID');
  }
  const targetChild = await childRepository.findByLoginCode(childLoginCode);
  if (!targetChild || !targetChild.familyId) {
    throw new Error('没有找到这个孩子 ID');
  }
  const displayName = String(payload.displayName || '').trim() || '新家长';
  await familyFacade.upsertFamilyMemberForFamily(ctx.user.openId, ctx.user.userId, targetChild.familyId, displayName);
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

async function updateChildProfile(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'updateChildProfile'
  }));
  await familyFacade.updateChildProfile(ctx.family.familyId, (event && event.payload) || {});
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

async function updateSubscription(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'updateSubscription'
  }));
  const enabled = !!(((event && event.payload) || {}).enabled);
  await familyRepository.updateMemberById(ctx.member._id, {
    subscriptionEnabled: enabled
  });
  const preference = await subscriptionRepository.findByMemberId(ctx.member.memberId);
  const prefData = {
    memberId: ctx.member.memberId,
    familyId: ctx.member.familyId,
    dailyReportEnabled: enabled,
    lastAuthorizedAt: enabled ? new Date().toISOString() : ''
  };
  if (preference) {
    await subscriptionRepository.updateById(preference._id, prefData);
  } else {
    await subscriptionRepository.create(prefData);
  }
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

async function leaveFamily(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'leaveFamily'
  }));
  await familyFacade.leaveCurrentFamily(ctx);
  const nextCtx = await familyFacade.ensureBootstrap(ctx.user.openId);
  return {
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  };
}

module.exports = {
  getProfileData,
  getFamilyPage,
  refreshInviteCode,
  joinFamily,
  joinFamilyByChildCode,
  updateChildProfile,
  updateSubscription,
  leaveFamily
};
