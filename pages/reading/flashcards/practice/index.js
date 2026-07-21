const page = require('../../../../utils/page');
const i18n = require('../../../../utils/i18n');

function getNavLayout() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = Number(systemInfo.statusBarHeight || 0);
    const navBarHeight = menu && menu.height ? (menu.top - statusBarHeight) * 2 + menu.height : 44;
    const navHeight = statusBarHeight + navBarHeight;
    return { navStyle: `height:${navHeight}px;padding-top:${statusBarHeight}px;`, pageTopStyle: `padding-top:${navHeight + 16}px;` };
  } catch (error) {
    return { navStyle: 'height:88px;padding-top:44px;', pageTopStyle: 'padding-top:112px;' };
  }
}

Page({
  data: page.createCloudPageData({
    level: '',
    sourceTitle: '',
    navStyle: '',
    pageTopStyle: ''
  }),
  onLoad(options) {
    this.perf = page.startPagePerf('vocabulary-practice');
    page.syncTheme(this);
    this.setData(Object.assign({}, getNavLayout(), {
      level: decodeURIComponent(String(options.level || '')),
      sourceTitle: decodeURIComponent(String(options.title || ''))
    }), () => this.perf.ready('pageReady', { cacheHit: true, mode: 'menu' }));
  },
  onShow() {
    page.syncTheme(this);
  },
  chooseMode(event) {
    const practiceMode = String(event.currentTarget.dataset.mode || '');
    if (!practiceMode) return;
    const query = `practiceMode=${encodeURIComponent(practiceMode)}`;
    if (!this.data.level) {
      wx.navigateTo({ url: `/pages/reading/flashcards/dictation/library/index?${query}` });
      return;
    }
    const source = `level=${encodeURIComponent(this.data.level)}&title=${encodeURIComponent(this.data.sourceTitle)}`;
    const url = practiceMode === 'dictation'
      ? `/pages/reading/flashcards/dictation/index?${source}`
      : `/pages/reading/flashcards/recognition/index?${source}&${query}`;
    wx.navigateTo({ url });
  },
  handleBack() {
    wx.navigateBack({ delta: 1 });
  }
});
