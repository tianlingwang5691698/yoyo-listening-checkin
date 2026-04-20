const { collection } = require('../adapters/db.adapter');

function families() {
  return collection('families');
}

function familyMembers() {
  return collection('familyMembers');
}

async function getFamilyById(familyId) {
  const res = await families().doc(familyId).get().catch(() => ({ data: null }));
  return res.data || null;
}

async function createFamily(familyId, data) {
  return families().doc(familyId).set({ data });
}

async function updateFamilyById(familyId, data) {
  return families().doc(familyId).update({ data });
}

async function findFamilyByInviteCode(inviteCode) {
  const res = await families().where({ inviteCode }).limit(1).get();
  return res.data[0] || null;
}

async function findMemberByOpenId(openId) {
  const res = await familyMembers().where({ openId }).limit(1).get();
  return res.data[0] || null;
}

async function findMembersByOpenId(openId) {
  const res = await familyMembers().where({ openId }).get();
  return res.data || [];
}

async function findMembersByFamilyId(familyId) {
  const res = await familyMembers().where({ familyId }).get();
  return res.data || [];
}

async function createMember(data) {
  return familyMembers().add({ data });
}

async function updateMemberById(id, data) {
  return familyMembers().doc(id).update({ data });
}

module.exports = {
  families,
  familyMembers,
  getFamilyById,
  createFamily,
  updateFamilyById,
  findFamilyByInviteCode,
  findMemberByOpenId,
  findMembersByOpenId,
  findMembersByFamilyId,
  createMember,
  updateMemberById
};
