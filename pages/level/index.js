const store = require('../../utils/store');

Page({
  data: {
    child: null,
    level: null,
    stats: {},
    categories: [],
    syncMode: 'local',
    isReviewBuild: false,
    showCloudDebug: false,
    syncDebug: null
  },
  async onShow() {
    const data = await store.getLevelOverview();
    this.setData(data);
  },
  openCategory(event) {
    const category = event.currentTarget.dataset.category;
    if (!category) {
      return;
    }
    wx.navigateTo({
      url: `/pages/lesson/index?category=${category}`
    });
  }
});
