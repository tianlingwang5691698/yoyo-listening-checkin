const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    level: null,
    stats: {},
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    categories: []
  }),
  async onShow() {
    const data = await store.getLevelOverview();
    this.setData(page.buildCloudPageData(this.data, data));
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
