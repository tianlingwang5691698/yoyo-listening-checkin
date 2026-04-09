const store = require('../../utils/store');

Page({
  data: {
    child: null,
    stats: {},
    dailyTasks: [],
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false,
    syncMode: 'local',
    isReviewBuild: false,
    showCloudDebug: false,
    syncDebug: null
  },
  async onShow() {
    const data = await store.getDashboard();
    this.setData(data);
  },
  openTask(event) {
    const category = event.currentTarget.dataset.category;
    if (!category) {
      return;
    }
    wx.navigateTo({
      url: `/pages/lesson/index?category=${category}`
    });
  }
});
