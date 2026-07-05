const { collection } = require('../adapters/db.adapter');
const { isMissingCollectionError } = require('../lib/errors');

function listeningPlans() {
  return collection('listeningPlans');
}

async function findActiveByScope(scope) {
  try {
    const res = await listeningPlans().where({
      familyId: scope.familyId,
      childId: scope.childId,
      active: true
    }).limit(1).get();
    return (res.data || [])[0] || null;
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return null;
    }
    throw error;
  }
}

async function upsertActive(scope, record) {
  const existing = await findActiveByScope(scope);
  const next = Object.assign({}, existing || {}, record, {
    familyId: scope.familyId,
    childId: scope.childId,
    active: true,
    updatedAt: new Date().toISOString()
  });
  if (existing && existing._id) {
    await listeningPlans().doc(existing._id).update({ data: next });
    return Object.assign({}, next, { _id: existing._id });
  }
  const created = await listeningPlans().add({
    data: Object.assign({}, next, {
      createdAt: next.createdAt || new Date().toISOString()
    })
  });
  return Object.assign({}, next, { _id: created && created._id ? created._id : '' });
}

module.exports = {
  findActiveByScope,
  upsertActive
};
