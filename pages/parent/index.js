const store = require('../../utils/store');
const appConfig = require('../../data/app-config');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

function getTemplateIds() {
  return (appConfig && appConfig.subscriptionTemplateIds) || [];
}

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
    stats: {},
    todayReport: {
      totalMinutes: 0,
      completedCategories: [],
      items: []
    },
    recentReports: [],
    members: [],
    subscriptionPreference: {
      dailyReportEnabled: false
    }
  }),
  onShow() {
    store.getParentDashboard().then((data) => {
      this.setData(page.buildCloudPageData(this.data, normalizeParentData(data)));
    });
  },
  handleSubscribe() {
    const enabled = !(this.data.subscriptionPreference && this.data.subscriptionPreference.dailyReportEnabled);
    const subscriptionTemplateIds = getTemplateIds();
    const requestPromise = enabled && subscriptionTemplateIds.length
      ? new Promise((resolve) => {
        wx.requestSubscribeMessage({
          tmplIds: subscriptionTemplateIds,
          complete: resolve
        });
      })
      : Promise.resolve();

    requestPromise.then(() => {
      return store.updateSubscription(enabled).then((nextData) => {
        return store.getParentDashboard().then((parentData) => {
          this.setData(page.buildCloudPageData(this.data, Object.assign({}, normalizeParentData(parentData), {
            subscriptionPreference: nextData.subscriptionPreference || parentData.subscriptionPreference
          })));
          wx.showToast({
            title: enabled ? (subscriptionTemplateIds.length ? '已开启日报提醒' : '已记录订阅偏好') : '已关闭日报提醒',
            icon: 'none'
          });
        });
      });
    });
  }
});
