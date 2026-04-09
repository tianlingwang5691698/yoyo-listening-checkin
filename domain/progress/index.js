const { childProfiles, levels } = require('../../data/catalog');
const { addDays, diffInDays, getTodayString, getWeekLabel } = require('../../utils/date');
const tasks = require('../tasks/index');

const STORAGE_KEY = 'yoyo-listening-state-v4';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultState() {
  return {
    currentChildId: childProfiles[0].childId,
    childProfiles: clone(childProfiles),
    checkinRecords: [],
    categoryProgressRecords: [],
    categoryCursors: {
      peppa: 0,
      unlock1: 0,
      song: 0
    }
  };
}

function ensureState() {
  const existing = wx.getStorageSync(STORAGE_KEY);
  if (!existing) {
    wx.setStorageSync(STORAGE_KEY, getDefaultState());
  }
}

function loadState() {
  ensureState();
  return wx.getStorageSync(STORAGE_KEY) || getDefaultState();
}

function saveState(state) {
  wx.setStorageSync(STORAGE_KEY, state);
}

function getChild(state, childId) {
  const targetId = childId || state.currentChildId;
  return state.childProfiles.find((item) => item.childId === targetId) || state.childProfiles[0];
}

function getChildCheckinRecords(state, childId) {
  return state.checkinRecords
    .filter((item) => item.childId === childId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.localeCompare(a.completedAt));
}

function getChildCategoryProgress(state, childId) {
  return (state.categoryProgressRecords || [])
    .filter((item) => item.childId === childId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getUniqueDates(records) {
  return Array.from(new Set(records.map((item) => item.date))).sort((a, b) => b.localeCompare(a));
}

function computeStreak(records) {
  const uniqueDates = getUniqueDates(records);
  if (!uniqueDates.length) {
    return 0;
  }

  const today = getTodayString();
  if (uniqueDates[0] !== today && diffInDays(today, uniqueDates[0]) > 1) {
    return 0;
  }

  let streak = uniqueDates[0] === today ? 1 : 0;
  let cursor = uniqueDates[0] === today ? today : addDays(today, -1);

  if (uniqueDates[0] !== today && uniqueDates[0] === addDays(today, -1)) {
    streak = 1;
    cursor = uniqueDates[0];
  }

  for (let i = 1; i < uniqueDates.length; i += 1) {
    const expected = addDays(cursor, -1);
    if (uniqueDates[i] === expected) {
      streak += 1;
      cursor = uniqueDates[i];
    } else {
      break;
    }
  }

  return streak;
}

function getTodayProgressKey(childId, category, date) {
  return `${childId}-${category}-${date}`;
}

function getTodayProgress(state, childId, category) {
  const progressId = getTodayProgressKey(childId, category, getTodayString());
  return (state.categoryProgressRecords || []).find((item) => item.progressId === progressId) || null;
}

function getDefaultProgress(childId, category, task) {
  return {
    progressId: getTodayProgressKey(childId, category, getTodayString()),
    date: getTodayString(),
    childId,
    category,
    taskId: task ? task.taskId : '',
    playCount: 0,
    repeatTarget: task ? task.repeatTarget : 3,
    textUnlocked: false,
    completedToday: false
  };
}

function saveCategoryProgress(state, nextProgress) {
  if (!state.categoryProgressRecords) {
    state.categoryProgressRecords = [];
  }
  const index = state.categoryProgressRecords.findIndex((item) => item.progressId === nextProgress.progressId);
  if (index >= 0) {
    state.categoryProgressRecords.splice(index, 1, nextProgress);
  } else {
    state.categoryProgressRecords.push(nextProgress);
  }
}

function getCursorIndex(state, category) {
  return state.categoryCursors && Number.isInteger(state.categoryCursors[category]) ? state.categoryCursors[category] : 0;
}

function advanceCursor(state, category, tasksLength) {
  if (!tasksLength) {
    return;
  }
  if (!state.categoryCursors) {
    state.categoryCursors = {};
  }
  const currentIndex = getCursorIndex(state, category);
  state.categoryCursors[category] = (currentIndex + 1) % tasksLength;
}

function getSelectedTask(state, childId, category) {
  const catalog = tasks.getCatalog(category);
  if (!catalog.length) {
    return null;
  }
  const todayProgress = getTodayProgress(state, childId, category);
  if (todayProgress && todayProgress.taskId) {
    return tasks.getTaskById(category, todayProgress.taskId) || catalog[0];
  }
  return catalog[getCursorIndex(state, category) % catalog.length];
}

function getTodayTaskSummary(state, childId, category) {
  const task = getSelectedTask(state, childId, category);
  if (!task) {
    return tasks.createPendingTask(category);
  }
  const progress = getTodayProgress(state, childId, category) || getDefaultProgress(childId, category, task);
  return tasks.decorateTask(task, progress, category);
}

function getDailyCategoryProgressSummary(state, childId) {
  return tasks.CATEGORY_ORDER.map((category) => getTodayTaskSummary(state, childId, category));
}

function ensureDailyCheckin(state, childId) {
  const activeCategories = tasks.getActiveCategories();
  if (!activeCategories.length) {
    return null;
  }

  const today = getTodayString();
  const allDone = activeCategories.every((category) => {
    const progress = getTodayProgress(state, childId, category);
    return progress && progress.completedToday;
  });
  if (!allDone) {
    return null;
  }

  const recordId = `${childId}-${today}`;
  const existingIndex = state.checkinRecords.findIndex((item) => item.recordId === recordId);
  const snapshotRecords = getChildCheckinRecords(state, childId).filter((item) => item.recordId !== recordId);
  const streakBefore = computeStreak(snapshotRecords);
  const existingTodayDates = getUniqueDates(snapshotRecords.filter((item) => item.date === today));
  const streakAfter = existingTodayDates.length ? streakBefore : Math.max(streakBefore, 0) + 1;
  const record = {
    recordId,
    childId,
    date: today,
    completedAt: new Date().toISOString(),
    streakSnapshot: streakAfter,
    completedCategories: activeCategories
  };

  if (existingIndex >= 0) {
    state.checkinRecords.splice(existingIndex, 1, record);
  } else {
    state.checkinRecords.push(record);
  }
  return record;
}

function getStats(state, childId) {
  const checkins = getChildCheckinRecords(state, childId);
  const progressRecords = getChildCategoryProgress(state, childId).filter((item) => item.completedToday);
  const totalMinutes = progressRecords.reduce((sum, item) => {
    const task = tasks.getTaskById(item.category, item.taskId);
    if (!task) {
      return sum;
    }
    return sum + Math.round((task.durationSec * task.repeatTarget) / 60);
  }, 0);

  return {
    streakDays: computeStreak(checkins),
    completedLessons: checkins.length,
    completedDays: checkins.length,
    completedTasks: progressRecords.length,
    totalMinutes
  };
}

function getDashboardData() {
  const state = loadState();
  const child = getChild(state);
  const stats = getStats(state, child.childId);
  const dailyTasks = getDailyCategoryProgressSummary(state, child.childId);
  const activeTaskCount = dailyTasks.filter((item) => !item.isPendingAsset).length;
  const completedTaskCountToday = dailyTasks.filter((item) => !item.isPendingAsset && item.completedToday).length;

  return {
    child: Object.assign({}, child, {
      totalCompleted: stats.completedDays,
      streakDays: stats.streakDays
    }),
    stats,
    peppaTask: dailyTasks.find((item) => item.category === 'peppa'),
    unlockTask: dailyTasks.find((item) => item.category === 'unlock1'),
    songTask: dailyTasks.find((item) => item.category === 'song'),
    dailyTasks,
    activeTaskCount,
    completedTaskCountToday,
    allDailyDone: activeTaskCount > 0 && completedTaskCountToday === activeTaskCount
  };
}

function getLevelOverviewData() {
  const state = loadState();
  const child = getChild(state);
  const stats = getStats(state, child.childId);
  const categories = tasks.CATEGORY_ORDER.map((category) => {
    const catalog = tasks.getCatalog(category);
    const todayTask = getTodayTaskSummary(state, child.childId, category);
    const completedCount = getChildCategoryProgress(state, child.childId)
      .filter((item) => item.category === category && item.completedToday).length;

    return {
      category,
      categoryLabel: tasks.getCategoryLabel(category),
      totalCount: catalog.length,
      completedCount,
      todayTask,
      isPendingAsset: todayTask.isPendingAsset
    };
  });

  return {
    child,
    level: levels[0],
    stats,
    categories
  };
}

function getHeatmap(days) {
  const totalDays = days || 28;
  const state = loadState();
  const child = getChild(state);
  const records = getChildCheckinRecords(state, child.childId);
  const counts = {};
  records.forEach((item) => {
    counts[item.date] = (counts[item.date] || 0) + 1;
  });

  const today = getTodayString();
  const result = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const count = counts[date] || 0;
    result.push({
      date,
      label: getWeekLabel(date),
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3)
    });
  }
  return result;
}

function getProfileData() {
  const state = loadState();
  const child = getChild(state);
  const stats = getStats(state, child.childId);
  return {
    child: Object.assign({}, child, stats),
    level: levels[0],
    familyReady: true
  };
}

function markTaskListened(options) {
  const state = loadState();
  const child = getChild(state, options.childId);
  const category = options.category;
  const task = getSelectedTask(state, child.childId, category);

  if (!task) {
    return { state, child };
  }

  const existingProgress = getTodayProgress(state, child.childId, category) || getDefaultProgress(child.childId, category, task);
  if (existingProgress.completedToday) {
    return { state, child };
  }

  const nextCount = Math.min(existingProgress.playCount + 1, task.repeatTarget);
  const nextProgress = Object.assign({}, existingProgress, {
    taskId: task.taskId,
    repeatTarget: task.repeatTarget,
    playCount: nextCount,
    textUnlocked: nextCount >= task.repeatTarget - 1,
    completedToday: nextCount >= task.repeatTarget
  });

  saveCategoryProgress(state, nextProgress);
  if (nextProgress.completedToday) {
    advanceCursor(state, category, tasks.getCatalog(category).length);
  }
  ensureDailyCheckin(state, child.childId);
  saveState(state);
  return { state, child };
}

module.exports = {
  STORAGE_KEY,
  ensureState,
  loadState,
  saveState,
  getChild,
  getChildCheckinRecords,
  getChildCategoryProgress,
  getTodayProgress,
  getTodayTaskSummary,
  getDashboardData,
  getLevelOverviewData,
  getProfileData,
  getHeatmap,
  getStats,
  markTaskListened
};
