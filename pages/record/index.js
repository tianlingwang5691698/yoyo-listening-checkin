const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    heatmap: [],
    currentMember: {},
    currentUser: {},
    lastCheckinText: '暂无记录'
  }),
  async onShow() {
    const [dashboard, heatmapData] = await Promise.all([
      store.getDashboard(),
      store.getHeatmap(28)
    ]);
    this.setData(page.buildCloudPageData(this.data, {
      child: dashboard.child,
      stats: dashboard.stats,
      heatmap: heatmapData.heatmap,
      currentMember: dashboard.currentMember,
      currentUser: dashboard.currentUser,
      lastCheckinText: dashboard.stats && dashboard.stats.lastCheckinDate ? dashboard.stats.lastCheckinDate : '暂无记录'
    }));
  }
});
