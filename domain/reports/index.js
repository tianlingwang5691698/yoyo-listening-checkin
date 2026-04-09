const progress = require('../progress/index');
const tasks = require('../tasks/index');
const family = require('../family/index');
const { addDays, getTodayString } = require('../../utils/date');

function buildReportItems(state, childId, date) {
  return tasks.CATEGORY_ORDER.map((category) => {
    const task = progress.getTodayTaskSummary(state, childId, category);
    const record = progress.getChildCategoryProgress(state, childId)
      .find((item) => item.category === category && item.date === date) || null;
    return {
      category,
      categoryLabel: tasks.getCategoryLabel(category),
      title: task.audioCompactTitle || task.displayTitle || task.title,
      playCount: record ? record.playCount : 0,
      repeatTarget: task.repeatTarget,
      completedToday: record ? record.completedToday : false
    };
  });
}

function buildDailyReport(state, childId, date) {
  const items = buildReportItems(state, childId, date);
  const completedCategories = items.filter((item) => item.completedToday).map((item) => item.category);
  const completedTaskRefs = progress.getChildCategoryProgress(state, childId)
    .filter((item) => item.date === date && item.completedToday);
  const totalMinutes = completedTaskRefs.reduce((sum, item) => {
    const task = tasks.getTaskById(item.category, item.taskId);
    return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
  }, 0);
  const streakSnapshot = (progress.getChildCheckinRecords(state, childId).find((item) => item.date === date) || {}).streakSnapshot || 0;
  return {
    reportId: `${childId}-${date}`,
    date,
    completedCategories,
    totalMinutes,
    streakSnapshot,
    inAppVisible: true,
    pushStatus: 'pending',
    items
  };
}

function getParentDashboardData() {
  const state = progress.loadState();
  const child = progress.getChild(state);
  const stats = progress.getStats(state, child.childId);
  const familyData = family.getFamilyPageData();
  const today = getTodayString();
  const todayReport = buildDailyReport(state, child.childId, today);
  const recentReports = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, -i);
    recentReports.push(buildDailyReport(state, child.childId, date));
  }
  return {
    syncMode: 'local',
    family: familyData.family,
    child,
    stats,
    todayReport,
    recentReports,
    members: familyData.members,
    subscriptionPreference: familyData.subscriptionPreference
  };
}

module.exports = {
  getParentDashboardData,
  buildDailyReport
};
