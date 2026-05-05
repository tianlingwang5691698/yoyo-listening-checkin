const { collection } = require('../adapters/db.adapter');

function taskAttempts() {
  return collection('taskAttempts');
}

async function add(record) {
  const created = await taskAttempts().add({ data: record });
  return created && created._id ? created._id : '';
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
  findByTask,
  findRecentByTask,
  findBestAndLatestByTask
};
