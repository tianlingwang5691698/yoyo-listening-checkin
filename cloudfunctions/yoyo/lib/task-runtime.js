const { getTodayString } = require('./date');

function buildEmptyProgress() {
  return {
    playCount: 0,
    textUnlocked: false,
    completedToday: false,
    playMoments: [],
    updatedAt: ''
  };
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  const exact = (progressRecords || []).find((item) => (
    item.childId === childId
      && item.category === category
      && item.date === date
      && item.taskId === taskId
  ));
  if (exact) {
    return exact;
  }
  if (options.allowLegacyRecord) {
    const legacy = (progressRecords || []).find((item) => (
      item.childId === childId
        && item.category === category
        && item.date === date
        && !item.taskId
    ));
    if (legacy) {
      return legacy;
    }
  }
  return buildEmptyProgress();
}

function decoratePlannedTasks(progressRecords, childId, category, date, tasks, options = {}, deps) {
  const { getPlanPhase, decorateTask } = deps;
  return (tasks || []).map((task, index) => {
    const plannedTask = Object.assign({}, task, {
      planPhase: task.planPhase || (options.planDayIndex ? getPlanPhase(options.planDayIndex).key : ''),
      planPhaseLabel: task.planPhaseLabel || (options.planDayIndex ? getPlanPhase(options.planDayIndex).label : ''),
      planDayIndex: options.planDayIndex || task.planDayIndex || 0
    });
    const progress = getTaskProgressForDate(
      progressRecords,
      childId,
      category,
      date,
      plannedTask.taskId,
      { allowLegacyRecord: tasks.length === 1 && index === 0 }
    );
    return Object.assign({}, decorateTask(plannedTask, progress, category), {
      planRunType: options.planRunType || 'normal',
      targetDate: options.targetDate || date,
      planDayIndex: plannedTask.planDayIndex
    });
  });
}

function buildCategorySummary(categoryTasks, category, deps) {
  const { decorateTask } = deps;
  if (!categoryTasks.length) {
    return decorateTask(null, buildEmptyProgress(), category);
  }
  const nextTask = categoryTasks.find((item) => !item.completedToday) || categoryTasks[0];
  return Object.assign({}, nextTask, {
    plannedTaskCount: categoryTasks.length,
    completedTaskCount: categoryTasks.filter((item) => item.completedToday).length
  });
}

function buildStats(progressRecords, checkins, childId, deps) {
  const { getCatalog, computeStreak } = deps;
  const completedProgress = (progressRecords || []).filter((item) => item.childId === childId && item.completedToday);
  const totalMinutes = completedProgress.reduce((sum, item) => {
    const task = getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
    return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
  }, 0);
  const today = getTodayString();
  const latestCheckin = (checkins || []).slice().sort((a, b) => {
    const left = String(a.completedAt || a.date || '');
    const right = String(b.completedAt || b.date || '');
    return right.localeCompare(left);
  })[0] || null;
  return {
    streakDays: computeStreak(checkins, today),
    completedDays: (checkins || []).length,
    completedLessons: (checkins || []).length,
    completedTasks: completedProgress.length,
    totalMinutes,
    lastCheckinAt: latestCheckin ? latestCheckin.completedAt || '' : '',
    lastCheckinDate: latestCheckin ? latestCheckin.date || '' : ''
  };
}

module.exports = {
  buildEmptyProgress,
  getTaskProgressForDate,
  decoratePlannedTasks,
  buildCategorySummary,
  buildStats
};
