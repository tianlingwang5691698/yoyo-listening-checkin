const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');

const COLLECTION = 'studyCompletedItems';

async function recordStudyCompletion(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'recordStudyCompletion'
  }));
  if (study.normalizeStudyRole(ctx.member) !== 'student') {
    return { saved: false, reason: 'preview-role' };
  }
  const type = String(payload.type || '').trim();
  const targetId = String(payload.targetId || payload.passageId || payload.topicId || '').trim();
  if (!type || !targetId) {
    return { saved: false, reason: 'missing-target' };
  }
  const date = String(payload.date || today);
  const section = String(payload.section || '');
  const recordId = [
    ctx.family.familyId,
    ctx.child.childId,
    date,
    type,
    targetId,
    section
  ].filter(Boolean).join('_');
  const now = new Date().toISOString();
  const record = {
    recordId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    memberId: ctx.member.memberId,
    date,
    type,
    targetId,
    passageId: String(payload.passageId || ''),
    topicId: String(payload.topicId || ''),
    section,
    title: String(payload.title || ''),
    meta: String(payload.meta || ''),
    progressText: String(payload.progressText || ''),
    latestAttempt: payload.latestAttempt || null,
    completedToday: true,
    updatedAt: now
  };
  const result = await dbAdapter.collection(COLLECTION).where({
    familyId: record.familyId,
    childId: record.childId,
    recordId
  }).limit(1).get();
  const current = result && result.data && result.data[0];
  if (current && current._id) {
    await dbAdapter.collection(COLLECTION).doc(current._id).update({ data: record });
    return { saved: true, updated: true, item: record };
  }
  await dbAdapter.collection(COLLECTION).add({ data: Object.assign({}, record, { createdAt: now }) });
  return { saved: true, updated: false, item: record };
}

async function getStudyCompletions(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getStudyCompletions'
  }));
  const date = String(payload.date || today);
  const result = await dbAdapter.collection(COLLECTION).where({
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    date
  }).limit(100).get();
  return {
    date,
    items: (result && result.data ? result.data : []).map((item) => Object.assign({}, item, {
      id: item.recordId || item._id || ''
    }))
  };
}

module.exports = {
  recordStudyCompletion,
  getStudyCompletions
};
