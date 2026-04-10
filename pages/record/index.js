const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    heatmap: []
  }),
  async onShow() {
    const [dashboard, heatmapData] = await Promise.all([
      store.getDashboard(),
      store.getHeatmap(28)
    ]);
    this.setData(page.buildCloudPageData(this.data, {
      child: dashboard.child,
      stats: dashboard.stats,
      heatmap: heatmapData.heatmap
    }));
  }
});
