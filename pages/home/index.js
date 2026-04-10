const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    dailyTasks: [],
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false
  }),
  async onShow() {
    const data = await store.getDashboard();
    this.setData(page.buildCloudPageData(this.data, data));
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
