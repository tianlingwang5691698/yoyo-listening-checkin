const page = require('../../../utils/page');

function normalizeItems(items) {
  return (items || []).map((item, index) => Object.assign({}, item, {
    index: index + 1,
    typeLabel: item.type === 'reading' ? '阅读' : '听力',
    actionText: item.type === 'reading' ? '查看解析' : '查看任务'
  }));
}

Page({
  data: page.createCloudPageData({
    items: []
  }),
  onShow() {
    page.syncTheme(this);
    let items = [];
    try {
      items = wx.getStorageSync('todayCompletedItemsV1') || [];
    } catch (error) {
      items = [];
    }
    this.setData({
      items: normalizeItems(items)
    });
  },
  openItem(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const item = this.data.items[index];
    if (!item) return;
    if (item.type === 'reading' && item.passageId) {
      wx.navigateTo({
        url: `/pages/reading/detail/index?passageId=${item.passageId}`
      });
      return;
    }
    if (item.category && item.taskId) {
      wx.navigateTo({
        url: `/pages/lesson/index?category=${item.category}&taskId=${item.taskId}`
      });
      return;
    }
    wx.showToast({ title: '暂无详情', icon: 'none' });
  }
});
