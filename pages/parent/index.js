const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');

const MODULES = [
  { key: 'listening', label: '听力' },
  { key: 'speaking', label: '口语' },
  { key: 'reading', label: '阅读' },
  { key: 'grammar', label: '语法' },
  { key: 'writing', label: '写作' }
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
  if (type === 'speaking') return '口语';
  return '听力';
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
  });
  (completionItems || []).forEach((item) => {
    const key = item.type === 'reading-study' ? 'reading' : item.type;
    if (map[key]) {
      map[key].count += 1;
      map[key].latestTitle = item.title || item.meta || map[key].latestTitle;
    }
  });
  return stats;
}

function normalizeCompletionItems(items) {
  return (items || []).map((item) => Object.assign({}, item, {
    dateLabel: formatDateLabel(item.date),
    typeLabel: getTypeLabel(item.type),
    title: item.title || item.meta || '完成记录'
  }));
}

function buildCompletionDays(items) {
  const map = {};
  (items || []).forEach((item) => {
    const date = item.date || '';
    if (!date) return;
    if (!map[date]) {
      map[date] = {
        date,
        dateLabel: item.dateLabel,
        count: 0,
        types: {}
      };
    }
    map[date].count += 1;
    map[date].types[item.typeLabel] = true;
  });
  return Object.keys(map).sort().reverse().map((date) => {
    const item = map[date];
    return Object.assign({}, item, {
      typeText: Object.keys(item.types).join('、')
    });
  });
}

function normalizeReport(report) {
  const safeReport = report || {};
  return Object.assign({}, safeReport, {
    dateLabel: formatDateLabel(safeReport.date),
    items: (safeReport.items || []).map(labels.normalizeReportItem)
  });
}

function normalizeParentData(data) {
  const recentReports = (data.recentReports || []).map(normalizeReport);
  const completionItems = normalizeCompletionItems(data.completionItems || []);
  return Object.assign({}, data, {
    todayReport: normalizeReport(data.todayReport),
    recentReports,
    completionItems,
    completionDays: buildCompletionDays(completionItems),
    moduleStats: buildModuleStats(recentReports, completionItems)
  });
}

Page({
  data: page.createCloudPageData({
    family: {},
    child: contracts.createChildDefaults(),
    todayReport: contracts.createReportDefaults(),
    recentReports: [],
    completionItems: [],
    completionDays: [],
    moduleStats: buildModuleStats([], [])
  }),
  applyParentData(data) {
    this.setData(page.buildCloudPageData(this.data, normalizeParentData(data)));
  },
  onShow() {
    page.syncTheme(this);
    store.getParentDashboard({ days: 30 }, (fresh) => this.applyParentData(fresh)).then(async (data) => {
      let completionItems = [];
      try {
        const completions = await store.getStudyCompletions({ days: 90 });
        completionItems = completions.items || [];
      } catch (error) {
        completionItems = [];
      }
      this.applyParentData(Object.assign({}, data, { completionItems }));
    });
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
