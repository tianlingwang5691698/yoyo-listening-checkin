Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/home/index',
        text: '今日'
      },
      {
        pagePath: '/pages/level/index',
        text: '音频'
      },
      {
        pagePath: '/pages/record/index',
        text: '成长'
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的'
      }
    ]
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index || 0);
      const target = this.data.list[index];
      if (!target) {
        return;
      }
      if (index !== 0) {
        const app = getApp();
        if (!app || !app.globalData || !app.globalData.identityConfirmed) {
          wx.showToast({
            title: '先选择身份',
            icon: 'none'
          });
          return;
        }
      }
      wx.switchTab({
        url: target.pagePath
      });
    }
  }
});
