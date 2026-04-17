const store = require('../../utils/store');
const page = require('../../utils/page');

const CATEGORY_ORDER = ['unlock1', 'peppa', 'song'];
const PHASE_COPY = {
  '第1轮': '轻量日计划',
  '第2轮': '复习加速',
  '第3轮': '冲刺复习'
};

function getTextType(task) {
  if (task.isPendingAsset) {
    return '待准备';
  }
  if (task.transcriptTrackId) {
    return task.syncGranularity === 'line' ? '句级' : '逐词';
  }
  if (task.transcriptStatus === 'pending') {
    return '文本准备中';
  }
  return '纯听力';
}

function decorateHomeTask(task) {
  const repeatTarget = task.repeatTarget || 3;
  return Object.assign({}, task, {
    textType: getTextType(task),
    actionText: task.isPendingAsset
      ? '等音频放入'
      : task.completedToday
        ? '查看完成'
        : task.playCount > 0
          ? '继续'
          : '开始',
    progressText: `${task.playCount || 0}/${repeatTarget} 遍`
  });
}

function buildGroupedDailyTasks(tasks) {
  const groups = [];
  CATEGORY_ORDER.forEach((category) => {
    const categoryTasks = (tasks || []).filter((item) => item.category === category).map(decorateHomeTask);
    if (!categoryTasks.length) {
      return;
    }
    groups.push({
      category,
      categoryLabel: categoryTasks[0].categoryLabel || category,
      completedCount: categoryTasks.filter((item) => item.completedToday).length,
      totalCount: categoryTasks.filter((item) => !item.isPendingAsset).length || categoryTasks.length,
      tasks: categoryTasks
    });
  });
  return groups;
}

function buildPhaseCopy(label) {
  return PHASE_COPY[label] || '今日计划';
}

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    phaseCopy: '轻量日计划',
    planTaskCount: 0,
    dailyTasks: [],
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false
  }),
  async onShow() {
    const data = await store.getDashboard();
    const groupedDailyTasks = buildGroupedDailyTasks(data.dailyTasks);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      phaseCopy: buildPhaseCopy(data.planPhaseLabel),
      groupedDailyTasks,
      hasGroupedTasks: groupedDailyTasks.length > 0
    })));
  },
  openTask(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    if (!category) {
      return;
    }
    const query = taskId
      ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
      : `/pages/lesson/index?category=${category}`;
    wx.navigateTo({
      url: query
    });
  }
});
