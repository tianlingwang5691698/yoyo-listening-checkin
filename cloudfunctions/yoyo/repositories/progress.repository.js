const { collection } = require('../adapters/db.adapter');

function dailyTaskProgress() {
  return collection('dailyTaskProgress');
}

const HOME_PROGRESS_FIELDS = {
  progressId: true,
  childId: true,
  category: true,
  date: true,
  taskId: true,
  originalTaskId: true,
  planSource: true,
  planRunType: true,
  planSlotIndex: true,
  listeningPlanId: true,
  playCount: true,
  repeatTarget: true,
  completedToday: true,
  textUnlocked: true,
  durationSec: true,
  updatedAt: true
};

function fixedPlanQuery(scope) {
  return dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId
  }).field(HOME_PROGRESS_FIELDS);
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
  const query = fixedPlanQuery(scope);
  if (scope.includeHistory) {
    const res = await query.limit(1000).get();
    return res.data || [];
  }
  const [todayRecords, peppaRecords] = await Promise.all([
    dailyTaskProgress().where({
      familyId: scope.familyId,
      childId: scope.childId,
      date
    }).field(HOME_PROGRESS_FIELDS).limit(1000).get().then((res) => res.data || []),
    dailyTaskProgress().where({
      familyId: scope.familyId,
      childId: scope.childId,
      category: 'peppa'
    }).field(HOME_PROGRESS_FIELDS).limit(1000).get().then((res) => res.data || [])
  ]);
  const byId = {};
  todayRecords.concat(peppaRecords).forEach((item) => {
    const key = item._id || item.progressId || `${item.date}:${item.category}:${item.taskId}`;
    byId[key] = item;
  });
  return Object.values(byId);
}

async function findForHomeDate(scope, date) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    date
  }).field(HOME_PROGRESS_FIELDS).limit(1000).get();
  return res.data || [];
}

async function findFixedPlanRecords(scope) {
  const res = await fixedPlanQuery(scope).limit(1000).get();
  return res.data || [];
}

async function findFixedPlanSlotRecords(scope, category, planSlotIndex) {
  const res = await dailyTaskProgress().where({
    familyId: scope.familyId,
    childId: scope.childId,
    category,
    planSlotIndex: Number(planSlotIndex || 0)
  }).field(HOME_PROGRESS_FIELDS).limit(1000).get();
  return res.data || [];
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
  findForHomeDate,
  findFixedPlanRecords,
  findFixedPlanSlotRecords,
  countCompletedByScope,
  findByProgressId,
  upsert,
  bulkResetByIds
};
