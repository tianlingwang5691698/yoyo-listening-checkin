const { collection } = require('../adapters/db.adapter');

function dailyCheckins() {
  return collection('dailyCheckins');
}

async function findByScope(scope) {
  const res = await dailyCheckins().where({
    familyId: scope.familyId,
    childId: scope.childId
  }).get();
  return res.data || [];
}

async function upsertByRecordId(existing, next) {
  if (existing) {
    await dailyCheckins().doc(existing._id).update({ data: next });
    return existing._id;
  }
  const created = await dailyCheckins().add({ data: next });
  return created && created._id ? created._id : '';
}

module.exports = {
  dailyCheckins,
  findByScope,
  upsertByRecordId
};
