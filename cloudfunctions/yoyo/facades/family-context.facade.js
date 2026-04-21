const userRepository = require('../repositories/user.repository');
const familyRepository = require('../repositories/family.repository');
const childRepository = require('../repositories/child.repository');
const subscriptionRepository = require('../repositories/subscription.repository');
const identityLib = require('../lib/identity');
const familyEngine = require('../lib/family-engine');
const bootstrapEngine = require('../lib/bootstrap-engine');

const childTemplate = {
  childId: 'child-yoyo',
  nickname: '佑佑',
  avatarText: 'YY',
  currentLevel: 'A1',
  ageLabel: '启蒙阶段',
  welcomeLine: '今天听三遍，小耳朵慢慢就会越来越灵。'
};

function makeInviteCode() {
  return identityLib.makeInviteCode();
}

function makeChildLoginCode() {
  return identityLib.makeChildLoginCode();
}

async function makeUniqueChildLoginCode() {
  for (let i = 0; i < 12; i += 1) {
    const childLoginCode = makeChildLoginCode();
    const existing = await childRepository.findByLoginCode(childLoginCode);
    if (!existing) {
      return childLoginCode;
    }
  }
  throw new Error('孩子 ID 生成失败，请稍后再试');
}

function buildAvatarTextFromNickname(nickname) {
  return identityLib.buildAvatarTextFromNickname(nickname);
}

async function getMember(openId) {
  return familyRepository.findMemberByOpenId(openId);
}

function normalizeAndDedupeMembers(members) {
  return identityLib.normalizeAndDedupeMembers(members);
}

function buildUserId(openId) {
  return identityLib.buildUserId(openId);
}

async function getFamily(familyId) {
  return familyRepository.getFamilyById(familyId);
}

async function getChild(familyId) {
  return bootstrapEngine.getChild(familyId, {
    findChildByFamilyId: (nextFamilyId) => childRepository.findByFamilyId(nextFamilyId),
    updateChildById: (id, data) => childRepository.updateById(id, data),
    makeUniqueChildLoginCode,
    buildAvatarTextFromNickname
  });
}

function normalizeStudyRole(member) {
  return identityLib.normalizeStudyRole(member);
}

async function ensureBootstrap(openId) {
  return bootstrapEngine.ensureBootstrap(openId, {
    findUserByOpenId: (nextOpenId) => userRepository.findByOpenId(nextOpenId),
    updateUserById: (id, data) => userRepository.updateById(id, data),
    createUser: (user) => userRepository.create(user),
    buildUserId,
    getMember,
    createFamily: (familyId, data) => familyRepository.createFamily(familyId, data),
    createMember: (data) => familyRepository.createMember(data),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data),
    createChild: (data) => childRepository.create(data),
    makeInviteCode,
    makeUniqueChildLoginCode,
    buildAvatarTextFromNickname,
    childTemplate,
    normalizeStudyRole,
    getFamily,
    findChildByFamilyId: (familyId) => childRepository.findByFamilyId(familyId),
    updateChildById: (id, data) => childRepository.updateById(id, data),
    normalizeAndDedupeMembers,
    findMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId)
  });
}

async function updateChildProfile(familyId, payload) {
  return familyEngine.updateChildProfile(familyId, payload, {
    getChild,
    updateChildById: (id, data) => childRepository.updateById(id, data),
    buildAvatarTextFromNickname
  });
}

async function setExclusiveStudyRole(member, studyRole) {
  return familyEngine.setExclusiveStudyRole(member, studyRole, {
    findMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data)
  });
}

async function upsertFamilyMemberForFamily(openId, userId, familyId, displayName) {
  return familyEngine.upsertFamilyMemberForFamily(openId, userId, familyId, displayName, {
    findMembersByOpenId: (nextOpenId) => familyRepository.findMembersByOpenId(nextOpenId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    createMember: (data) => familyRepository.createMember(data),
    normalizeStudyRole,
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId),
    updateSubscriptionById: (id, data) => subscriptionRepository.updateById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data)
  });
}

async function leaveCurrentFamily(ctx) {
  return familyEngine.leaveCurrentFamily(ctx, {
    findFamilyByOwnerOpenId: (ownerOpenId) => familyRepository.findFamilyByOwnerOpenId(ownerOpenId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    deleteMemberById: (id) => familyRepository.deleteMemberById(id),
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId),
    updateSubscriptionById: (id, data) => subscriptionRepository.updateById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data),
    deleteSubscriptionById: (id) => subscriptionRepository.deleteById(id)
  });
}

module.exports = {
  ensureBootstrap,
  updateChildProfile,
  setExclusiveStudyRole,
  upsertFamilyMemberForFamily,
  leaveCurrentFamily,
  normalizeStudyRole
};
