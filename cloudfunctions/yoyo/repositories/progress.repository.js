const { collection } = require('../adapters/db.adapter');

function dailyTaskProgress() {
  return collection('dailyTaskProgress');
}

async function findByScope(scope) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId
  }).get();
  return res.data || [];
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
  findByProgressId,
  upsert,
  bulkResetByIds
};
