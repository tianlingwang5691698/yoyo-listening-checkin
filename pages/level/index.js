const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const LEVEL_TABS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => ({
  levelId,
  enabled: ['A1', 'A2', 'B1', 'B2'].includes(levelId),
  stateText: ['A1', 'A2', 'B1', 'B2'].includes(levelId) ? '' : '未开放'
}));

const PHASE_LABELS = {
  '第1轮': '听力组合 A',
  '第2轮': '听力组合 B',
  '第3轮': '听力组合 C'
};

const STAGE_GROUPS = [
  {
    phaseLabel: '第1轮',
    phaseKey: 'round-1',
    stageText: '阶段一',
    title: '听力组合 A',
    hint: '累积 A1 听力时长。',
  },
  {
    phaseLabel: '第2轮',
    phaseKey: 'round-2',
    stageText: '阶段二',
    title: '听力组合 B',
    hint: '累积 A1 听力时长。',
  },
  {
    phaseLabel: '第3轮',
    phaseKey: 'round-3',
    stageText: '阶段三',
    title: '听力组合 C',
    hint: '累积 A1 听力时长。',
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

function buildStandaloneEntries(categories) {
  return (categories || []).map((category) => {
    const task = category.todayTask || {};
    return Object.assign({}, category, {
      title: task.displayTitle || task.title || '等待素材',
      textType: getTextType(task),
      stateText: '›',
      stateClass: '',
      disabled: !task.taskId,
      taskId: task.taskId || ''
    });
  });
}

function buildLevelTabs(selectedLevel) {
  return LEVEL_TABS.map((item) => Object.assign({}, item, {
    active: item.levelId === selectedLevel
  }));
}

function buildCurrentStage(data) {
  const stage = STAGE_GROUPS.find((item) => item.phaseLabel === data.planPhaseLabel) || STAGE_GROUPS[0];
  return {
    levelId: 'A1',
    label: PHASE_LABELS[data.planPhaseLabel] || stage.title,
    stageText: stage.stageText,
    hint: stage.hint,
    phaseKey: stage.phaseKey
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
    a2Categories: [],
    b1Categories: [],
    b2Categories: [],
    levelDebug: null,
    levelTabs: LEVEL_TABS,
    selectedLevel: 'A1',
    currentStage: {
      levelId: 'A1',
      label: '听力组合 A',
      stageText: '阶段一',
      hint: '累积 A1 听力时长。',
      phaseKey: 'round-1'
    },
    stageGroups: STAGE_GROUPS,
    programEntries: []
  }),
  async onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const data = await store.getLevelOverview();
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const a2Categories = (data.a2Categories || []).map(labels.normalizeCategory);
    const b1Categories = (data.b1Categories || []).map(labels.normalizeCategory);
    const b2Categories = (data.b2Categories || []).map(labels.normalizeCategory);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      categories,
      a2Categories,
      b1Categories,
      b2Categories,
      levelDebug: data.levelDebug || null,
      levelTabs: buildLevelTabs(this.data.selectedLevel || 'A1'),
      currentStage: buildCurrentStage(data),
      stageGroups: buildStageGroups(data),
      programEntries: ['A2', 'B1', 'B2'].includes(this.data.selectedLevel || 'A1')
        ? buildStandaloneEntries((this.data.selectedLevel || 'A1') === 'A2' ? a2Categories : ((this.data.selectedLevel || 'A1') === 'B1' ? b1Categories : b2Categories))
        : buildProgramEntries(categories)
    })));
  },
  chooseLevel(event) {
    const enabled = event.currentTarget.dataset.enabled;
    const levelId = event.currentTarget.dataset.levelId || 'A1';
    if (enabled === false || enabled === 'false') {
      wx.showToast({
        title: '暂未开放',
        icon: 'none'
      });
      return;
    }
    const selectedLevel = ['A2', 'B1', 'B2'].includes(levelId) ? levelId : 'A1';
    this.setData({
      selectedLevel,
      levelTabs: buildLevelTabs(selectedLevel),
      programEntries: selectedLevel === 'A2'
        ? buildStandaloneEntries(this.data.a2Categories)
        : selectedLevel === 'B1'
          ? buildStandaloneEntries(this.data.b1Categories)
          : selectedLevel === 'B2'
            ? buildStandaloneEntries(this.data.b2Categories)
            : buildProgramEntries(this.data.categories)
    });
  },
  openStage(event) {
    const phase = event.currentTarget.dataset.phase;
    if (!phase) {
      return;
    }
    wx.navigateTo({
      url: `/pages/level-stage/index?levelId=A1&phase=${phase}`
    });
  },
  openTask(event) {
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
