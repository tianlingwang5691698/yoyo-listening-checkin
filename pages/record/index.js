const store = require('../../utils/store');

Page({
  data: {
    child: null,
    stats: {},
    heatmap: [],
    syncMode: 'local',
    isReviewBuild: false,
    showCloudDebug: false,
    syncDebug: null
  },
  async onShow() {
    const dashboard = await store.getDashboard();
    const heatmapData = await store.getHeatmap(28);
    this.setData({
      child: dashboard.child,
      stats: dashboard.stats,
      heatmap: heatmapData.heatmap,
      syncMode: dashboard.syncMode || 'local',
      isReviewBuild: !!dashboard.isReviewBuild,
      showCloudDebug: !!dashboard.showCloudDebug,
      syncDebug: dashboard.syncDebug || null
    });
  }
});
