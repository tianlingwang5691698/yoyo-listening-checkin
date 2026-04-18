const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const LEVEL_TABS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => ({
  levelId,
  enabled: levelId === 'A1',
  stateText: levelId === 'A1' ? '' : '未开放'
}));

const PHASE_LABELS = {
  '第1轮': '基础输入组',
  '第2轮': '复习加速组',
  '第3轮': '综合冲刺组'
};

const STAGE_GROUPS = [
  {
    phaseLabel: '第1轮',
    stageText: '阶段一',
    title: '基础输入组',
    composition: 'Peppa · Unlock 1 · Songs'
  },
  {
    phaseLabel: '第2轮',
    stageText: '阶段二',
    title: '复习加速组',
    composition: '多条复习 · 三线并行'
  },
  {
    phaseLabel: '第3轮',
    stageText: '阶段三',
    title: '综合冲刺组',
    composition: '高频回看 · 集中巩固'
  }
];

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
  const stage = STAGE_GROUPS.find((item) => item.phaseLabel === data.planPhaseLabel) || STAGE_GROUPS[0];
  return {
    levelId: 'A1',
    label: PHASE_LABELS[data.planPhaseLabel] || stage.title,
    stageText: stage.stageText,
    composition: stage.composition
  };
}

function buildStageGroups(data) {
  return STAGE_GROUPS.map((stage) => Object.assign({}, stage, {
    active: stage.phaseLabel === data.planPhaseLabel
  }));
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
      label: '基础输入组',
      stageText: '阶段一',
      composition: 'Peppa · Unlock 1 · Songs'
    },
    stageGroups: STAGE_GROUPS,
    programEntries: []
  }),
  async onShow() {
    const data = await store.getLevelOverview();
    const categories = (data.categories || []).map(labels.normalizeCategory);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      categories,
      levelTabs: LEVEL_TABS,
      currentStage: buildCurrentStage(data),
      stageGroups: buildStageGroups(data),
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
