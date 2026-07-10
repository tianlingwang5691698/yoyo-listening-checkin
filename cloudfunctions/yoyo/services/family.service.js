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

function buildBindingDisplayName(selfChildNickname, relationName) {
  const selfName = String(selfChildNickname || '').trim();
  const relation = String(relationName || '').trim();
  return relation ? `${selfName} · ${relation}` : selfName;
}

async function assertNotBindingOwnChild(openId, targetFamilyId) {
  const currentMembers = await familyRepository.findMembersByOpenId(openId);
  const existingMember = (currentMembers || []).find((member) => (
    String(member && member.familyId || '') === String(targetFamilyId || '')
  ));
  if (existingMember && (existingMember.role === 'owner' || !existingMember.role)) {
    throw new Error('不能绑定自己的学号，请让另一个微信账号绑定');
  }
}

async function joinFamilyByChildCode(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'joinFamilyByChildCode'
  }));
  const payload = (event && event.payload) || {};
  const childLoginCode = String(payload.childLoginCode || '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(childLoginCode)) {
    throw new Error('请输入 6 位学号');
  }
  const targetChild = await childRepository.findByLoginCode(childLoginCode);
  if (!targetChild || !targetChild.familyId) {
    throw new Error('没有找到这个学号');
  }
  await assertNotBindingOwnChild(ctx.user.openId, targetChild.familyId);
  const targetStudyRole = String(payload.studyRole || '').trim() === 'student' ? 'student' : 'parent';
  let relationName = String(payload.displayName || payload.relationName || '').trim();
  const selfChildNickname = await getSelfChildNickname(ctx.user.openId);
  if (!selfChildNickname) {
    throw new Error('请先选择我是学生并设置昵称，再绑定学号');
  }
  if (!relationName && targetStudyRole === 'student') {
    relationName = '学生';
  }
  if (!relationName) {
    throw new Error('请输入和孩子的关系，例如 妈妈 / 爸爸 / 老师');
  }
  const displayName = buildBindingDisplayName(selfChildNickname, relationName);
  await familyFacade.upsertFamilyMemberForFamily(ctx.user.openId, ctx.user.userId, targetChild.familyId, displayName, {
    selfChildNickname,
    relationName
  });
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

async function updateBindingProfile(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'updateBindingProfile'
  }));
  const member = ctx.member || {};
  if (!member._id || member.role === 'owner') {
    throw new Error('当前没有需要补齐的绑定关系');
  }
  const payload = (event && event.payload) || {};
  const selfChildNickname = String(payload.selfChildNickname || payload.nickname || '').trim();
  const relationName = String(payload.relationName || payload.displayName || '').trim();
  if (!selfChildNickname || ['同学', '我'].includes(selfChildNickname)) {
    throw new Error('请先填写你的昵称');
  }
  if (!relationName) {
    throw new Error('请输入和孩子的关系，例如 妈妈 / 爸爸 / 老师');
  }
  const selfCtx = await familyFacade.ensureBootstrap(ctx.user.openId, { forceSelf: true });
  await familyFacade.updateChildProfile(selfCtx.family.familyId, { nickname: selfChildNickname });
  await familyRepository.updateMemberById(member._id, {
    displayName: buildBindingDisplayName(selfChildNickname, relationName),
    selfChildNickname,
    relationName,
    updatedAt: new Date().toISOString()
  });
  return familyFacade.reloadFamilyContext(ctx.user.openId, {
    targetFamilyId: member.familyId,
    targetChildId: (ctx.child && ctx.child.childId) || ''
  });
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
  updateBindingProfile,
  updateChildProfile,
  updateSubscription,
  leaveFamily
};
