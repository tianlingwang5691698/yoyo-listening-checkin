const { collection } = require('../adapters/db.adapter');
const { isMissingCollectionError } = require('../lib/errors');

function listeningPlans() {
  return collection('listeningPlans');
}

function omitDocumentId(record) {
  const next = Object.assign({}, record || {});
  delete next._id;
  return next;
}

async function findActiveByScope(scope) {
  try {
    const res = await listeningPlans().where({
      familyId: scope.familyId,
      childId: scope.childId,
      active: true
    }).orderBy('updatedAt', 'desc').limit(1).get();
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
  const next = Object.assign({}, omitDocumentId(existing), omitDocumentId(record), {
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

async function deactivateActive(scope) {
  const existing = await findActiveByScope(scope);
  if (!existing || !existing._id) {
    return null;
  }
  const next = Object.assign({}, omitDocumentId(existing), {
    active: false,
    materials: [],
    updatedAt: new Date().toISOString()
  });
  await listeningPlans().doc(existing._id).update({ data: next });
  return Object.assign({}, next, { _id: existing._id });
}

module.exports = {
  findActiveByScope,
  upsertActive,
  deactivateActive
};
