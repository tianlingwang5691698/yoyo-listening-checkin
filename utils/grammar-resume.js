const ACTIVE_GRAMMAR_TASK_PREFIX = 'activeGrammarPlanTaskV1';
const ACTIVE_GRAMMAR_TASK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getGrammarOwnerId(target = {}) {
  return String(target.targetChildId || target.childLoginCode || 'self').trim() || 'self';
}

function getActiveGrammarTaskKey(target) {
  return `${ACTIVE_GRAMMAR_TASK_PREFIX}:${getGrammarOwnerId(target)}`;
}

function findGrammarContinueTask(groups, activeTask) {
  const activeTaskId = String(activeTask && activeTask.taskId || '');
  if (!activeTaskId) return null;
  const tasks = (groups || [])
    .filter((group) => group && group.category === 'grammar')
    .flatMap((group) => (group.tasks || []).filter((task) => task && !task.isPendingAsset));
  if (!tasks.length) return null;
  return tasks.find((task) => String(task.taskId || '') === activeTaskId)
    || tasks.find((task) => !task.completedToday)
    || tasks[0];
}

module.exports = {
  ACTIVE_GRAMMAR_TASK_MAX_AGE_MS,
  getGrammarOwnerId,
  getActiveGrammarTaskKey,
  findGrammarContinueTask
};
