const { collection, db } = require('../adapters/db.adapter');

function taskAttempts() {
  return collection('taskAttempts');
}

async function add(record) {
  const created = await taskAttempts().add({ data: record });
  return created && created._id ? created._id : '';
}

async function findById(id) {
  if (!id) {
    return null;
  }
  const res = await taskAttempts().doc(id).get();
  return res && res.data ? res.data : null;
}

async function update(id, data) {
  if (!id) {
    return null;
  }
  await taskAttempts().doc(id).update({ data });
  return Object.assign({ _id: id }, data || {});
}

async function findByTask(scope, filters) {
  const where = {
    familyId: scope.familyId,
    childId: scope.childId,
    date: filters.date,
    category: filters.category,
    taskId: filters.taskId
  };
  if (filters.attemptType) {
    where.attemptType = filters.attemptType;
  }
  const res = await taskAttempts().where(where).orderBy('createdAt', 'asc').limit(200).get();
  return res.data || [];
}

async function findIeltsByTest(scope, itemId) {
  const escapedItemId = String(itemId || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const where = {
    familyId: scope.familyId,
    childId: scope.childId,
    category: 'ielts-speaking',
    attemptType: 'ielts_speaking',
    taskId: db.RegExp({
      regexp: `^${escapedItemId}(?:$|-part-)`,
      options: 'i'
    })
  };
  const res = await taskAttempts().where(where).limit(500).get();
  return (res.data || []).sort((left, right) => (
    String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  ));
}

async function findByDate(scope, date) {
  const res = await taskAttempts().where({
    familyId: scope.familyId,
    childId: scope.childId,
    date
  }).orderBy('createdAt', 'asc').limit(300).get();
  return res.data || [];
}

async function findSpeakingHistory(scope, limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 100));
  const categories = ['speaking', 'ielts-speaking'];
  const results = await Promise.all(categories.map(async (category) => {
    const res = await taskAttempts().where({
      familyId: scope.familyId,
      childId: scope.childId,
      category
    }).orderBy('createdAt', 'desc').limit(safeLimit).get();
    return res.data || [];
  }));
  return results
    .reduce((items, group) => items.concat(group), [])
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, safeLimit);
}

async function findRecentByTask(scope, filters, limit = 3) {
  const items = await findByTask(scope, filters);
  return items.slice(-limit);
}

async function findBestAndLatestByTask(scope, filters) {
  const items = await findByTask(scope, filters);
  const latest = items[items.length - 1] || null;
  if (!latest) {
    return [];
  }
  const previous = items.slice(0, -1).filter((item) => (
    (item.status === 'scored' || item.status === 'scored-local') && Number(item.score || 0) > 0
  ));
  const bestPrevious = previous.reduce((best, item) => (
    !best || Number(item.score || 0) > Number(best.score || 0) ? item : best
  ), null);
  return bestPrevious ? [Object.assign({}, bestPrevious, { resultRole: '历史最佳' }), Object.assign({}, latest, { resultRole: '最新' })] : [Object.assign({}, latest, { resultRole: '最新' })];
}

module.exports = {
  taskAttempts,
  add,
  findById,
  update,
  findByDate,
  findSpeakingHistory,
  findByTask,
  findIeltsByTest,
  findRecentByTask,
  findBestAndLatestByTask
};
