const { collection } = require('../adapters/db.adapter');

function dailyTaskProgress() {
  return collection('dailyTaskProgress');
}

async function findByScope(scope) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId
  }).limit(1000).get();
  return res.data || [];
}

async function findByScopeAndDate(scope, date) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    date
  }).limit(1000).get();
  return res.data || [];
}

async function findByScopeAndCategory(scope, category) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    category
  }).limit(1000).get();
  return res.data || [];
}

async function findForHome(scope, date) {
  const [todayRecords, peppaRecords] = await Promise.all([
    findByScopeAndDate(scope, date),
    findByScopeAndCategory(scope, 'peppa')
  ]);
  const byId = {};
  todayRecords.concat(peppaRecords).forEach((item) => {
    const key = item._id || item.progressId || `${item.date}:${item.category}:${item.taskId}`;
    byId[key] = item;
  });
  return Object.values(byId);
}

async function countCompletedByScope(scope) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    completedToday: true
  }).count();
  return Number((res && res.total) || 0);
}

async function findByProgressId(progressId) {
  const res = await dailyTaskProgress().where({ progressId }).limit(1).get();
  return res.data[0] || null;
}

async function findOneByTask(scope, record) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    date: record.date,
    category: record.category,
    taskId: record.taskId
  }).limit(1).get();
  return res.data[0] || null;
}

async function upsert(scope, record) {
  const existing = await findOneByTask(scope, record);
  if (existing) {
    await dailyTaskProgress().doc(existing._id).update({ data: record });
    return existing._id;
  }
  const created = await dailyTaskProgress().add({ data: record });
  return created && created._id ? created._id : '';
}

async function bulkResetByIds(ids, data) {
  await Promise.all((ids || []).map((id) => dailyTaskProgress().doc(id).update({ data })));
}

module.exports = {
  dailyTaskProgress,
  findByScope,
  findByScopeAndDate,
  findByScopeAndCategory,
  findForHome,
  countCompletedByScope,
  findByProgressId,
  upsert,
  bulkResetByIds
};
