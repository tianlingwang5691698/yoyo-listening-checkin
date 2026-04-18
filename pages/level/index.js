const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const LEVEL_TABS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => ({
  levelId,
  enabled: levelId === 'A1',
  stateText: levelId === 'A1' ? '' : '未开放'
}));

const PHASE_LABELS = {
  '第1轮': '轻量日计划',
  '第2轮': '复习加速',
  '第3轮': '冲刺复习'
};

function getTextType(task) {
  if (!task || task.isPendingAsset) {
    return '等待';
  }
  if (task.transcriptTrackId) {
    return task.syncGranularity === 'line' ? '句级' : '逐词';
  }
  if (task.transcriptStatus === 'pending') {
    return '准备中';
  }
  return '纯听力';
}

function buildProgramEntries(categories) {
  return (categories || []).map((category) => {
    const task = category.todayTask || {};
    const disabled = !!(category.isPendingAsset || task.isPendingAsset);
    return Object.assign({}, category, {
      title: task.displayTitle || task.title || '等待素材',
      textType: getTextType(task),
      stateText: task.completedToday ? '完成' : disabled ? '等待' : '›',
      stateClass: task.completedToday ? 'is-done' : disabled ? 'is-waiting' : '',
      disabled,
      taskId: task.taskId || ''
    });
  });
}

function buildCurrentStage(data) {
  return {
    levelId: 'A1',
    label: PHASE_LABELS[data.planPhaseLabel] || data.planPhaseLabel || '轻量日计划',
    dayText: `Day ${data.planDayIndex || 1}`
  };
}

Page({
  data: page.createCloudPageData({
    child: null,
    level: null,
    stats: {},
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    categories: [],
    levelTabs: LEVEL_TABS,
    currentStage: {
      levelId: 'A1',
      label: '轻量日计划',
      dayText: 'Day 1'
    },
    programEntries: []
  }),
  async onShow() {
    const data = await store.getLevelOverview();
    const categories = (data.categories || []).map(labels.normalizeCategory);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      categories,
      levelTabs: LEVEL_TABS,
      currentStage: buildCurrentStage(data),
      programEntries: buildProgramEntries(categories)
    })));
  },
  chooseLevel(event) {
    const enabled = event.currentTarget.dataset.enabled;
    if (enabled === false || enabled === 'false') {
      wx.showToast({
        title: '暂未开放',
        icon: 'none'
      });
    }
  },
  openCategory(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    wx.navigateTo({
      url: taskId
        ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
        : `/pages/lesson/index?category=${category}`
    });
  }
});
