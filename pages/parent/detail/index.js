const store = require('../../../utils/store');
const page = require('../../../utils/page');
const labels = require('../../../utils/labels');

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? `${month}月${day}日` : '日报详情';
}

function formatClock(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimeLines(item) {
  const playMoments = Array.isArray(item.playMoments) ? item.playMoments : [];
  const lines = playMoments
    .map((value, index) => ({
      key: `${item.category}-${item.taskId || 'task'}-${index}`,
      label: `第 ${index + 1} 遍`,
      timeText: formatClock(value)
    }))
    .filter((entry) => entry.timeText);
  if (lines.length) {
    return lines;
  }
  if ((item.playCount || 0) > 0 && item.updatedAt) {
    const timeText = formatClock(item.updatedAt);
    if (timeText) {
      return [{
        key: `${item.category}-${item.taskId || 'task'}-latest`,
        label: '最近一次',
        timeText
      }];
    }
  }
  return [];
}

function normalizeReport(report) {
  const safeReport = report || {};
  const items = (safeReport.items || []).map((item) => Object.assign({}, labels.normalizeReportItem(item), {
    timeLines: buildTimeLines(item)
  }));
  const completedCount = items.filter((item) => item.completedToday).length;
  return {
    date: safeReport.date || '',
    dateLabel: formatDateLabel(safeReport.date),
    totalMinutes: safeReport.totalMinutes || 0,
    completedCount,
    totalCount: items.length,
    items
  };
}

Page({
  data: page.createCloudPageData({
    date: '',
    report: {
      date: '',
      dateLabel: '',
      totalMinutes: 0,
      completedCount: 0,
      totalCount: 0,
      items: []
    }
  }),
  onLoad(options) {
    const date = String((options && options.date) || '').slice(0, 10) || getTodayKey();
    this.setData({ date });
    wx.setNavigationBarTitle({
      title: formatDateLabel(date)
    });
  },
  onShow() {
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    store.getDailyReportByDate(this.data.date).then((data) => {
      this.setData(page.buildCloudPageData(this.data, {
        date: this.data.date,
        report: normalizeReport(data.report)
      }));
    });
  }
});
