const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

function normalizeParentData(data) {
  return Object.assign({}, data, {
    todayReport: data.todayReport ? Object.assign({}, data.todayReport, {
      items: (data.todayReport.items || []).map(labels.normalizeReportItem)
    }) : data.todayReport
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
  }
});
