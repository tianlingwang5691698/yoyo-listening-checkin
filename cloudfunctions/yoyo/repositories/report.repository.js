const { collection, getCommand } = require('../adapters/db.adapter');

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

function sumCumulativeMinutes(reports) {
  const minutesByDate = {};
  (reports || []).forEach((report) => {
    const date = String((report && report.date) || '').slice(0, 10);
    if (!date) return;
    minutesByDate[date] = Math.max(
      Number(minutesByDate[date] || 0),
      Math.max(0, Number(report.totalMinutes || 0))
    );
  });
  return Object.values(minutesByDate).reduce((sum, minutes) => sum + minutes, 0);
}

async function getCumulativeMinutes(scope) {
  try {
    const aggregate = getCommand().aggregate;
    const result = await dailyReports().aggregate()
      .match({ familyId: scope.familyId, childId: scope.childId })
      .group({ _id: '$date', minutes: aggregate.max('$totalMinutes') })
      .group({ _id: null, totalMinutes: aggregate.sum('$minutes') })
      .end();
    const row = result && result.data && result.data[0];
    return row ? Math.max(0, Number(row.totalMinutes || 0)) : null;
  } catch (error) {
    // Older environments can fall back to projected pagination.
  }
  const reports = [];
  const pageSize = 100;
  for (let skip = 0; ; skip += pageSize) {
    const res = await dailyReports().where({
      familyId: scope.familyId,
      childId: scope.childId
    }).field({
      date: true,
      totalMinutes: true
    }).orderBy('_id', 'asc').skip(skip).limit(pageSize).get();
    const rows = res.data || [];
    reports.push(...rows);
    if (rows.length < pageSize) break;
  }
  return reports.length ? sumCumulativeMinutes(reports) : null;
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
  getCumulativeMinutes,
  sumCumulativeMinutes,
  upsert
};
