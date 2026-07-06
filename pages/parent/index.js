const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');

const MODULES = [
  { key: 'listening', label: '听力' },
  { key: 'speaking', label: '口语' },
  { key: 'reading', label: '阅读' },
  { key: 'grammar', label: '语法' },
  { key: 'writing', label: '写作' },
  { key: 'vocabulary', label: '词汇' }
];
function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? `${month}月${day}日` : dateKey || '';
}

function getTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return '阅读';
  if (type === 'grammar') return '语法';
  if (type === 'writing') return '写作';
  if (type === 'vocabulary') return '词汇';
  if (type === 'speaking') return '口语';
  return '听力';
}

function getModuleKey(type) {
  if (type === 'reading-study') return 'reading';
  if (type === 'vocabulary') return 'vocabulary';
  return type;
}

function buildModuleStats(reports, completionItems) {
  const stats = MODULES.map((item) => Object.assign({}, item, {
    count: 0,
    latestTitle: '暂无记录'
  }));
  const map = stats.reduce((next, item) => {
    next[item.key] = item;
    return next;
  }, {});
  const applySummaryStats = (summaryStats) => {
    Object.keys(summaryStats || {}).forEach((key) => {
      if (!map[key]) return;
      map[key].count += Number((summaryStats[key] && summaryStats[key].count) || 0);
      if (summaryStats[key] && summaryStats[key].latestTitle && summaryStats[key].latestTitle !== '暂无记录') {
        map[key].latestTitle = summaryStats[key].latestTitle;
      }
    });
  };
  if ((reports || []).some((report) => report && report.moduleStats)) {
    (reports || []).forEach((report) => applySummaryStats(report && report.moduleStats));
    return stats;
  }
  const countedCompletionIds = {};
  const appendCompletion = (item) => {
    const key = getModuleKey(item.type);
    const id = item.id || item.recordId || `${item.date || ''}:${item.type || ''}:${item.targetId || ''}`;
    if (!map[key] || countedCompletionIds[id]) return;
    countedCompletionIds[id] = true;
    map[key].count += 1;
    map[key].latestTitle = item.title || item.meta || map[key].latestTitle;
  };
  (reports || []).forEach((report) => {
    (report.items || []).forEach((item) => {
      if (item.completedToday && map.listening) {
        map.listening.count += 1;
        map.listening.latestTitle = item.title || item.categoryLabel || map.listening.latestTitle;
      }
    });
    (report.speakingAttempts || []).forEach((item) => {
      if (map.speaking) {
        map.speaking.count += 1;
        map.speaking.latestTitle = item.questionText || '录音评分';
      }
    });
    (report.completionItems || []).forEach(appendCompletion);
  });
  (completionItems || []).forEach(appendCompletion);
  return stats;
}

function normalizeCompletionItems(items) {
  return (items || []).map((item) => Object.assign({}, item, {
    dateLabel: formatDateLabel(item.date),
    typeLabel: getTypeLabel(item.type),
    title: item.title || item.meta || '完成记录'
  }));
}

function normalizeReport(report) {
  const safeReport = report || {};
  const completionItems = normalizeCompletionItems(safeReport.completionItems || []);
  const completedCategories = safeReport.completedCategories || [];
  return Object.assign({}, safeReport, {
    dateLabel: formatDateLabel(safeReport.date),
    items: (safeReport.items || []).map(labels.normalizeReportItem),
    completionItems,
    completedCategories,
    completedContentCount: completionItems.length,
    totalCompletedCount: completedCategories.length + completionItems.length
  });
}

function summarizeReport(report) {
  const raw = report || {};
  const safeReport = normalizeReport(report);
  return Object.assign({}, safeReport, {
    items: [],
    speakingAttempts: [],
    completionItems: [],
    completedContentCount: Number(raw.completedContentCount || safeReport.completedContentCount || 0),
    speakingAttemptCount: Number(raw.speakingAttemptCount || (safeReport.speakingAttempts || []).length || 0),
    totalCompletedCount: Number(raw.totalCompletedCount || safeReport.totalCompletedCount || 0)
  });
}

function normalizeParentData(data) {
  const recentReports = (data.recentReports || []).map(summarizeReport);
  const completionItems = [];
  const studentLinks = data.studentLinks || [];
  const selectedStudentIndex = Math.max(0, studentLinks.findIndex((item) => item && item.isCurrent));
  return Object.assign({}, data, {
    todayReport: summarizeReport(data.todayReport),
    recentReports,
    completionItems,
    moduleStats: data.moduleStats ? buildModuleStats([{ moduleStats: data.moduleStats }], []) : buildModuleStats(recentReports, completionItems),
    studentLinks,
    selectedStudentIndex,
    studentNames: studentLinks.map((item) => item.nickname || item.childLoginCode || '学生')
  });
}

Page({
  data: page.createCloudPageData({
    family: {},
    child: contracts.createChildDefaults(),
    todayReport: contracts.createReportDefaults(),
    recentReports: [],
    completionItems: [],
    moduleStats: buildModuleStats([], []),
    studentLinks: [],
    studentNames: [],
    selectedStudentIndex: 0
  }),
  applyParentData(data) {
    this.setData(page.buildCloudPageData(this.data, normalizeParentData(data)));
  },
  onShow() {
    page.syncTheme(this);
    this.loadParentData();
  },
  loadParentData() {
    store.getParentDashboard({ days: 7, summaryOnly: true }, (fresh) => this.applyParentData(fresh)).then((data) => {
      this.applyParentData(data);
    });
  },
  handleStudentChange(event) {
    const index = Number(event.detail && event.detail.value) || 0;
    const target = this.data.studentLinks[index];
    if (!target) {
      return;
    }
    store.setSelectedStudentTarget(target);
    store.setLastParentStudentTarget(target);
    this.setData({
      selectedStudentIndex: index,
      completionItems: []
    });
    this.loadParentData();
  },
  openDailyDetail(event) {
    const date = event.currentTarget.dataset.date;
    if (!date) {
      return;
    }
    wx.navigateTo({
      url: `/pages/parent/detail/index?date=${date}`
    });
  }
});
