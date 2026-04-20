const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? `${month}月${day}日` : dateKey || '';
}

function normalizeReport(report) {
  const safeReport = report || {};
  return Object.assign({}, safeReport, {
    dateLabel: formatDateLabel(safeReport.date),
    items: (safeReport.items || []).map(labels.normalizeReportItem)
  });
}

function normalizeParentData(data) {
  return Object.assign({}, data, {
    todayReport: normalizeReport(data.todayReport),
    recentReports: (data.recentReports || []).map(normalizeReport)
  });
}

Page({
  data: page.createCloudPageData({
    family: {},
    child: {},
    todayReport: {
      totalMinutes: 0,
      completedCategories: [],
      items: []
    },
    recentReports: []
  }),
  onShow() {
    store.getParentDashboard().then((data) => {
      this.setData(page.buildCloudPageData(this.data, normalizeParentData(data)));
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
