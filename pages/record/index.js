const store = require('../../utils/store');
const page = require('../../utils/page');

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildMonthHeatmap(heatmap) {
  const heatmapMap = {};
  (heatmap || []).forEach((item) => {
    heatmapMap[item.date] = item;
  });
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDate = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(today);
  const cells = [];
  for (let i = 0; i < firstDate.getDay(); i += 1) {
    cells.push({
      key: `blank-${i}`,
      isBlank: true
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = getDateKey(date);
    const record = heatmapMap[dateKey] || {};
    cells.push({
      key: dateKey,
      date: dateKey,
      dayText: day,
      intensity: record.intensity || 0,
      completed: !!record.completed,
      isToday: dateKey === todayKey,
      isCatchupTarget: !!record.isCatchupTarget
    });
  }
  return cells;
}

function getQuote(stats) {
  const streakDays = Number((stats && stats.streakDays) || 0);
  const completedDays = Number((stats && stats.completedDays) || 0);
  if (streakDays >= 21) {
    return '这已经不是偶尔努力了，是很稳定的家庭节奏。';
  }
  if (streakDays >= 7) {
    return '一周连续点亮，小耳朵正在变得更敏锐。';
  }
  if (completedDays >= 10) {
    return '累计的每一天，都会慢慢变成听得懂的底气。';
  }
  if (streakDays > 0) {
    return '今天这一小步，正在帮英语变得更熟悉。';
  }
  return '从今天开始，点亮第一格就很好。';
}

function buildMetric(stats, mode) {
  const safeStats = stats || {};
  if (mode === 'total') {
    return {
      heroMetricValue: safeStats.completedDays || 0,
      heroMetricLabel: '累计打卡'
    };
  }
  return {
    heroMetricValue: safeStats.streakDays || 0,
    heroMetricLabel: '连续打卡'
  };
}

function buildDerived(state, nextMode) {
  const mode = nextMode || state.metricMode || 'streak';
  return Object.assign({
    metricMode: mode,
    monthHeatmap: buildMonthHeatmap(state.heatmap),
    quoteText: getQuote(state.stats)
  }, buildMetric(state.stats, mode));
}

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    heatmap: [],
    monthHeatmap: [],
    weekLabels: WEEK_LABELS,
    metricMode: 'streak',
    heroMetricValue: 0,
    heroMetricLabel: '连续打卡',
    quoteText: '',
    planDayIndex: 1,
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
      store.getHeatmap(42)
    ]);
    const nextState = Object.assign({}, dashboard, heatmapData, {
      child: dashboard.child,
      stats: dashboard.stats,
      heatmap: heatmapData.heatmap,
      catchupState: heatmapData.catchupState,
      catchupTasks: heatmapData.catchupTasks,
      planDayIndex: dashboard.planDayIndex || 1,
      currentMember: dashboard.currentMember,
      currentUser: dashboard.currentUser,
      lastCheckinText: dashboard.stats && dashboard.stats.lastCheckinDate ? dashboard.stats.lastCheckinDate : '暂无记录'
    });
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, nextState, buildDerived(nextState))));
  },
  switchMetric(event) {
    const mode = event.currentTarget.dataset.mode || 'streak';
    this.setData(buildDerived(this.data, mode));
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
