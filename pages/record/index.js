const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    heatmap: [],
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0,
      reason: ''
    },
    catchupTasks: [],
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
      catchupState: heatmapData.catchupState,
      catchupTasks: heatmapData.catchupTasks,
      currentMember: dashboard.currentMember,
      currentUser: dashboard.currentUser,
      lastCheckinText: dashboard.stats && dashboard.stats.lastCheckinDate ? dashboard.stats.lastCheckinDate : '暂无记录'
    }));
  },
  openCatchupTask(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    if (!category || !taskId || !this.data.catchupState || !this.data.catchupState.canCatchup) {
      return;
    }
    const targetDate = this.data.catchupState.missedDate || '';
    const planDayIndex = this.data.catchupState.planDayIndex || '';
    wx.navigateTo({
      url: `/pages/lesson/index?category=${category}&taskId=${taskId}&planRunType=catchup&targetDate=${targetDate}&planDayIndex=${planDayIndex}`
    });
  }
});
