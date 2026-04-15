const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    planTaskCount: 0,
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
    const taskId = event.currentTarget.dataset.taskId;
    if (!category) {
      return;
    }
    const query = taskId
      ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
      : `/pages/lesson/index?category=${category}`;
    wx.navigateTo({
      url: query
    });
  }
});
