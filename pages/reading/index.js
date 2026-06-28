const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    loading: true,
    passage: null,
    completedToday: false,
    latestAttempt: null
  }),
  applyReadingHome(data) {
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      passage: data.passage || null,
      completedToday: !!data.completedToday,
      latestAttempt: data.latestAttempt || null,
      dailyCount: data.dailyCount || 1,
      today: data.today || ''
    }));
  },
  async onShow() {
    page.syncTheme(this);
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    this.setData({ loading: true });
    const data = await store.getReadingHome({}, (fresh) => this.applyReadingHome(fresh));
    this.applyReadingHome(data);
  },
  openPassage() {
    if (!this.data.passage || !this.data.passage._id) {
      wx.showToast({ title: '今日阅读还在准备中', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/reading/detail/index?passageId=${this.data.passage._id}`
    });
  }
});
