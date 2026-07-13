function getTaskQueueKey(task) {
  const target = task || {};
  return `${String(target.category || '')}:${String(target.taskId || '')}`;
}

function buildListeningQueue(tasks, currentTask) {
  const queue = [];
  const seen = new Set();
  (tasks || []).forEach((task) => {
    const key = getTaskQueueKey(task);
    if (!task || task.isPendingAsset || !task.taskId || seen.has(key)) return;
    seen.add(key);
    queue.push(task);
  });
  const currentKey = getTaskQueueKey(currentTask);
  if (currentTask && currentTask.taskId && !currentTask.isPendingAsset && !seen.has(currentKey)) {
    queue.push(currentTask);
  }
  return queue;
}

function getQueueTaskIndex(queue, task) {
  const key = getTaskQueueKey(task);
  return Math.max(0, (queue || []).findIndex((item) => getTaskQueueKey(item) === key));
}

function mergeListeningQueue(currentQueue, updatedTasks, currentTask) {
  const current = buildListeningQueue(currentQueue, currentTask);
  const updated = buildListeningQueue(updatedTasks, currentTask);
  const updatedMap = new Map(updated.map((task) => [getTaskQueueKey(task), task]));
  const merged = current.map((task) => updatedMap.get(getTaskQueueKey(task)) || task);
  const seen = new Set(merged.map(getTaskQueueKey));
  updated.forEach((task) => {
    const key = getTaskQueueKey(task);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(task);
    }
  });
  return merged;
}

function getNextQueueTask(queue, task) {
  const items = queue || [];
  if (!items.length) return null;
  const index = getQueueTaskIndex(items, task);
  return items[(index + 1) % items.length] || null;
}

function getInitialQueuePass(task) {
  const target = task || {};
  if (target.completedToday) return 0;
  const repeatTarget = Math.max(1, Number(target.repeatTarget || 1));
  return Math.max(0, Math.min(Number(target.playCount || 0), repeatTarget - 1));
}

module.exports = {
  getTaskQueueKey,
  buildListeningQueue,
  mergeListeningQueue,
  getQueueTaskIndex,
  getNextQueueTask,
  getInitialQueuePass
};
