const theme = require('../utils/theme');

Component({
  data: {
    selected: 0,
    theme: 'warm',
    themeClass: 'theme-warm',
    list: [
      {
        pagePath: '/pages/home/index',
        text: '首页',
        icon: '⌂'
      },
      {
        pagePath: '/pages/level/index',
        text: '自学',
        icon: '▣'
      },
      {
        pagePath: '/pages/record/index',
        text: '记录',
        icon: '▤'
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的',
        icon: '◉'
      }
    ]
  },
  lifetimes: {
    attached() {
      this.syncTheme();
    }
  },
  methods: {
    syncTheme() {
      this.setData(theme.buildThemeData());
    },
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
