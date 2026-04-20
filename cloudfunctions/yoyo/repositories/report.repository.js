const { collection } = require('../adapters/db.adapter');

function dailyReports() {
  return collection('dailyReports');
}

async function findByScopeAndDate(scope, date) {
  const res = await dailyReports().where({
    familyId: scope.familyId,
    childId: scope.childId,
    date
  }).limit(1).get();
  return res.data[0] || null;
}

async function upsert(scope, date, report) {
  const existing = await findByScopeAndDate(scope, date);
  if (existing) {
    await dailyReports().doc(existing._id).update({ data: report });
    return existing._id;
  }
  const created = await dailyReports().add({ data: report });
  return created && created._id ? created._id : '';
}

module.exports = {
  dailyReports,
  findByScopeAndDate,
  upsert
};
