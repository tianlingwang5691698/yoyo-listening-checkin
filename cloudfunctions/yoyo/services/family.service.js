const familyFacade = require('../facades/family.facade');
const familyRepository = require('../repositories/family.repository');
const childRepository = require('../repositories/child.repository');
const subscriptionRepository = require('../repositories/subscription.repository');

async function getProfileData(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'getProfileData'
  }));
  return familyFacade.buildProfilePayload(ctx, null);
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
  return familyFacade.reloadFamilyContext(ctx.user.openId, { targetFamilyId: target.familyId });
}

function isDefaultNickname(child) {
  const nickname = String(child && child.nickname || '').trim();
  const childLoginCode = String(child && child.childLoginCode || '').trim();
  return !nickname || ['同学', '我'].includes(nickname) || (nickname === '佑佑' && childLoginCode !== '317613');
}

async function getSelfChildNickname(openId) {
  const ownFamily = await familyRepository.findFamilyByOwnerOpenId(openId);
  if (!ownFamily || !ownFamily.familyId) return '';
  const ownChild = await childRepository.findByFamilyId(ownFamily.familyId);
  if (isDefaultNickname(ownChild)) return '';
  return String(ownChild && ownChild.nickname || '').trim();
}

async function assertNotBindingOwnChild(openId, targetFamilyId) {
  const currentMembers = await familyRepository.findMembersByOpenId(openId);
  const alreadyInTargetFamily = (currentMembers || []).some((member) => (
    String(member && member.familyId || '') === String(targetFamilyId || '')
  ));
  if (alreadyInTargetFamily) {
    throw new Error('不能绑定自己的孩子 ID，请让另一个微信账号绑定');
  }
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
  await assertNotBindingOwnChild(ctx.user.openId, targetChild.familyId);
  const targetStudyRole = String(payload.studyRole || '').trim() === 'student' ? 'student' : 'parent';
  let displayName = String(payload.displayName || '').trim();
  if (!displayName && targetStudyRole === 'parent') {
    displayName = await getSelfChildNickname(ctx.user.openId);
    if (!displayName) {
      throw new Error('请先设置本机学生昵称，再绑定孩子 ID');
    }
  }
  if (!displayName) {
    displayName = '学生设备';
  }
  await familyFacade.upsertFamilyMemberForFamily(ctx.user.openId, ctx.user.userId, targetChild.familyId, displayName);
  if (targetStudyRole === 'student') {
    const joinedCtx = await familyFacade.ensureBootstrap(ctx.user.openId, {
      targetFamilyId: targetChild.familyId,
      targetChildId: targetChild.childId || ''
    });
    await familyFacade.setExclusiveStudyRole(joinedCtx.member, 'student');
  }
  return familyFacade.reloadFamilyContext(ctx.user.openId, {
    targetFamilyId: targetChild.familyId,
    targetChildId: targetChild.childId || ''
  });
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
