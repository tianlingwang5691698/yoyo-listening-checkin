const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const STAGES = {
  'round-1': {
    levelId: 'A1',
    stageText: '阶段一',
    title: '基础输入组',
    hint: '先建立稳定输入。'
  },
  'round-2': {
    levelId: 'A1',
    stageText: '阶段二',
    title: '复习加速组',
    hint: '提高回看密度。'
  },
  'round-3': {
    levelId: 'A1',
    stageText: '阶段三',
    title: '综合冲刺组',
    hint: '集中巩固节奏。'
  }
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

function getTaskMinutes(task) {
  if (!task || task.isPendingAsset || !task.durationSec) {
    return 0;
  }
  return Math.max(1, Math.round((task.durationSec * (task.repeatTarget || 3)) / 60));
}

function buildTaskGroups(categories) {
  return (categories || []).map((category) => {
    const task = labels.normalizeTask(category.todayTask || {});
    const minutes = getTaskMinutes(task);
    const disabled = !!(category.isPendingAsset || task.isPendingAsset);
    return {
      category: category.category,
      categoryLabel: labels.getCategoryDisplayLabel(category.category, category.categoryLabel),
      title: task.displayTitle || task.title || '等待素材',
      textType: getTextType(task),
      minutesText: minutes ? `${minutes} 分钟` : '待生成',
      minutes,
      taskId: task.taskId || '',
      disabled,
      stateText: task.completedToday ? '完成' : disabled ? '等待' : '›'
    };
  });
}

Page({
  data: page.createCloudPageData({
    levelId: 'A1',
    phase: 'round-1',
    stage: STAGES['round-1'],
    taskGroups: [],
    totalMinutesText: '待生成'
  }),
  async onLoad(query) {
    const phase = query.phase || 'round-1';
    const data = await store.getLevelOverview();
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const taskGroups = buildTaskGroups(categories);
    const totalMinutes = taskGroups.reduce((sum, item) => sum + item.minutes, 0);
    this.setData(page.buildCloudPageData(this.data, {
      levelId: query.levelId || 'A1',
      phase,
      stage: STAGES[phase] || STAGES['round-1'],
      taskGroups,
      totalMinutesText: totalMinutes ? `${totalMinutes} 分钟` : '待生成'
    }));
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
