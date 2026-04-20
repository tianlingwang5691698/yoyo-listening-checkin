const taskRuntime = require('./task-runtime');

function buildEmptyProgress() {
  return taskRuntime.buildEmptyProgress();
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  return taskRuntime.getTaskProgressForDate(progressRecords, childId, category, date, taskId, options);
}

function decoratePlannedTasks(progressRecords, childId, category, date, tasks, options = {}, deps) {
  return taskRuntime.decoratePlannedTasks(progressRecords, childId, category, date, tasks, options, deps);
}

function buildCategorySummary(categoryTasks, category, deps) {
  return taskRuntime.buildCategorySummary(categoryTasks, category, deps);
}

function buildStats(progressRecords, checkins, childId, deps) {
  return taskRuntime.buildStats(progressRecords, checkins, childId, deps);
}

module.exports = {
  buildEmptyProgress,
  getTaskProgressForDate,
  decoratePlannedTasks,
  buildCategorySummary,
  buildStats
};
