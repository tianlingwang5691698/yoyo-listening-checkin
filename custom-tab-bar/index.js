const theme = require('../utils/theme');
const i18n = require('../utils/i18n');

function buildTabList() {
  const texts = i18n.getCommonTexts();
  return [
    { pagePath: '/pages/home/index', text: texts.tabToday },
    { pagePath: '/pages/level/index', text: texts.tabAudio },
    { pagePath: '/pages/record/index', text: texts.tabGrowth },
    { pagePath: '/pages/profile/index', text: texts.tabProfile }
  ];
}

Component({
  data: {
    selected: 0,
    hidden: false,
    theme: 'dragon',
    themeClass: 'theme-dragon',
    list: buildTabList()
  },
  lifetimes: {
    attached() {
      this.syncState();
    }
  },
  methods: {
    syncState() {
      const themeData = theme.buildThemeData();
      const nextData = {};
      const list = buildTabList();
      if (JSON.stringify(this.data.list) !== JSON.stringify(list)) {
        nextData.list = list;
      }
      if (this.data.theme !== themeData.theme) {
        Object.assign(nextData, themeData);
      }
      const pages = getCurrentPages();
      const currentRoute = pages.length ? `/${pages[pages.length - 1].route}` : '';
      const currentIndex = this.data.list.findIndex((item) => item.pagePath === currentRoute);
      if (currentIndex >= 0 && currentIndex !== this.data.selected) {
        nextData.selected = currentIndex;
      }
      if (Object.keys(nextData).length) {
        this.setData(nextData);
      }
    },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index || 0);
      const target = this.data.list[index];
      if (!target || index === this.data.selected || this.switching) {
        return;
      }
      if (index !== 0) {
        const app = getApp();
        if (!app || !app.globalData || !app.globalData.identityConfirmed) {
          wx.showToast({
            title: i18n.getText('chooseIdentity'),
            icon: 'none'
          });
          return;
        }
      }
      const previousSelected = this.data.selected;
      this.switching = true;
      this.setData({ selected: index });
      wx.switchTab({
        url: target.pagePath,
        fail: () => {
          this.setData({ selected: previousSelected });
        },
        complete: () => {
          this.switching = false;
        }
      });
    }
  }
});
