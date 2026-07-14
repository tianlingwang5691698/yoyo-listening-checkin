const ACTIVE_LISTENING_LESSON_SNAPSHOT_PREFIX = 'activeListeningLessonV1';
const ACTIVE_LISTENING_LESSON_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getListeningOwnerId(target = {}) {
  return String(target.targetChildId || target.childLoginCode || 'self').trim() || 'self';
}

function getActiveListeningLessonKey(target) {
  return `${ACTIVE_LISTENING_LESSON_SNAPSHOT_PREFIX}:${getListeningOwnerId(target)}`;
}

function findListeningContinueTask(groups, activeLesson) {
  const availableTasks = (groups || []).flatMap((group) => (group.tasks || [])
    .filter((task) => task && !task.isPendingAsset)
    .map((task) => Object.assign({}, task, {
      category: task.category || group.category || ''
    })));
  if (!availableTasks.length) return null;
  const pendingTasks = availableTasks.filter((task) => !task.completedToday);
  const activeCategory = String((activeLesson && activeLesson.category) || '');
  const activeTaskId = String((activeLesson && activeLesson.taskId) || '');
  return availableTasks.find((task) => (
    String(task.category || '') === activeCategory
    && String(task.taskId || '') === activeTaskId
  )) || pendingTasks[0] || availableTasks[0];
}

module.exports = {
  ACTIVE_LISTENING_LESSON_MAX_AGE_MS,
  getListeningOwnerId,
  getActiveListeningLessonKey,
  findListeningContinueTask
};
