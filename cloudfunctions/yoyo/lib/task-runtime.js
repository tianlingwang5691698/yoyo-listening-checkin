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

function normalizeProgressRecord(record) {
  if (!record) {
    return buildEmptyProgress();
  }
  const repeatTarget = Number(record.repeatTarget || 3);
  const playCount = Number(record.playCount || 0);
  return Object.assign({}, record, {
    repeatTarget,
    playCount,
    textUnlocked: typeof record.textUnlocked === 'boolean'
      ? record.textUnlocked
      : playCount >= Math.max(repeatTarget - 1, 1),
    completedToday: typeof record.completedToday === 'boolean'
      ? record.completedToday
      : playCount >= repeatTarget
  });
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  const exact = (progressRecords || []).find((item) => (
    item.childId === childId
      && item.category === category
      && item.date === date
      && item.taskId === taskId
  ));
  if (exact) {
    return normalizeProgressRecord(exact);
  }
  if (options.allowLegacyRecord) {
    const legacy = (progressRecords || []).find((item) => (
      item.childId === childId
        && item.category === category
        && item.date === date
        && !item.taskId
    ));
    if (legacy) {
      return normalizeProgressRecord(legacy);
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
      planDayIndex: plannedTask.planDayIndex,
      planSource: options.planSource || plannedTask.planSource || '',
      listeningPlanId: options.listeningPlanId || plannedTask.listeningPlanId || ''
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

function buildDurationLookup(records, deps) {
  const { getCatalog } = deps;
  const categories = Array.from(new Set((records || []).map((item) => item.category).filter(Boolean)));
  return categories.reduce((lookup, category) => {
    lookup[category] = (getCatalog(category) || []).reduce((map, task) => {
      map[task.taskId] = task;
      return map;
    }, {});
    return lookup;
  }, {});
}

function getProgressDurationMinutes(item, durationLookup) {
  const lookup = durationLookup && durationLookup.getCatalog
    ? buildDurationLookup([item], durationLookup)
    : durationLookup;
  const taskId = item.originalTaskId || item.taskId;
  const task = lookup && lookup[item.category] ? lookup[item.category][taskId] : null;
  const repeatTarget = Number(item.repeatTarget || (task && task.repeatTarget) || 3);
  const durationSec = Number(item.durationSec || (task && task.durationSec) || 0);
  return durationSec ? Math.round((durationSec * repeatTarget) / 60) : 0;
}

function buildStats(progressRecords, checkins, childId, deps) {
  const { getCatalog, computeStreak } = deps;
  const completedProgress = (progressRecords || [])
    .filter((item) => item.childId === childId)
    .map(normalizeProgressRecord)
    .filter((item) => item.completedToday || Number(item.playCount || 0) >= Number(item.repeatTarget || 3));
  const durationLookup = buildDurationLookup(completedProgress, deps);
  const totalMinutes = completedProgress.reduce((sum, item) => sum + getProgressDurationMinutes(item, durationLookup), 0);
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
  normalizeProgressRecord,
  getTaskProgressForDate,
  decoratePlannedTasks,
  buildCategorySummary,
  getProgressDurationMinutes,
  buildStats
};
