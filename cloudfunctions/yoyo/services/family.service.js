const familyFacade = require('../facades/family.facade');
const familyRepository = require('../repositories/family.repository');
const childRepository = require('../repositories/child.repository');
const subscriptionRepository = require('../repositories/subscription.repository');

async function getProfileData(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'getProfileData'
  }));
  const dashboard = await familyFacade.getDashboardData(ctx);
  return familyFacade.buildProfilePayload(ctx, dashboard);
}

async function getFamilyPage(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'getFamilyPage'
  }));
  return familyFacade.buildFamilyContextPayload(ctx);
}

async function refreshInviteCode(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'refreshInviteCode'
  }));
  const inviteCode = `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await familyRepository.updateFamilyById(ctx.family.familyId, { inviteCode });
  return familyFacade.reloadFamilyContext(ctx.user.openId);
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
  return familyFacade.reloadFamilyContext(ctx.user.openId);
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
  return familyFacade.reloadFamilyContext(ctx.user.openId);
}

async function updateChildProfile(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'updateChildProfile'
  }));
  await familyFacade.updateChildProfile(ctx.family.familyId, (event && event.payload) || {});
  return familyFacade.reloadFamilyContext(ctx.user.openId);
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
  return familyFacade.reloadFamilyContext(ctx.user.openId);
}

async function leaveFamily(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'leaveFamily'
  }));
  await familyFacade.leaveCurrentFamily(ctx);
  return familyFacade.reloadFamilyContext(ctx.user.openId);
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
