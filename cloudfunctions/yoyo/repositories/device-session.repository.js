const { collection } = require('../adapters/db.adapter');
const { isMissingCollectionError } = require('../lib/errors');

function deviceStudySessions() {
  return collection('deviceStudySessions');
}

function normalizeDeviceId(deviceId) {
  return String(deviceId || '').trim().slice(0, 80);
}

function normalizeStudyRole(studyRole) {
  return String(studyRole || '').trim() === 'student' ? 'student' : 'parent';
}

async function findByDevice(openId, deviceId, familyId, childId) {
  const safeDeviceId = normalizeDeviceId(deviceId);
  if (!openId || !safeDeviceId) {
    return null;
  }
  try {
    const res = await deviceStudySessions().where({
      openId,
      deviceId: safeDeviceId,
      familyId,
      childId
    }).orderBy('updatedAt', 'desc').limit(1).get();
    return (res.data || [])[0] || null;
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return null;
    }
    throw error;
  }
}

async function upsertDeviceRole(scope, deviceId, studyRole) {
  const safeDeviceId = normalizeDeviceId(deviceId);
  if (!safeDeviceId) {
    return null;
  }
  const now = new Date().toISOString();
  const existing = await findByDevice(scope.openId, safeDeviceId, scope.familyId, scope.childId);
  const next = {
    openId: scope.openId,
    userId: scope.userId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    deviceId: safeDeviceId,
    studyRole: normalizeStudyRole(studyRole),
    updatedAt: now
  };
  if (existing && existing._id) {
    await deviceStudySessions().doc(existing._id).update({ data: next });
    return Object.assign({}, existing, next);
  }
  const created = await deviceStudySessions().add({
    data: Object.assign({}, next, {
      createdAt: now
    })
  });
  return Object.assign({}, next, { _id: created && created._id ? created._id : '' });
}

module.exports = {
  findByDevice,
  upsertDeviceRole,
  normalizeDeviceId,
  normalizeStudyRole
};
