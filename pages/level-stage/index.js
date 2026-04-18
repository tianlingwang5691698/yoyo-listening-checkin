const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const STAGES = {
  'round-1': {
    levelId: 'A1',
    stageText: '阶段一',
    title: '听力组合 A',
    hint: '多种材料累积 A1 听力时长。'
  },
  'round-2': {
    levelId: 'A1',
    stageText: '阶段二',
    title: '听力组合 B',
    hint: '多种材料累积 A1 听力时长。'
  },
  'round-3': {
    levelId: 'A1',
    stageText: '阶段三',
    title: '听力组合 C',
    hint: '多种材料累积 A1 听力时长。'
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

function shouldShowTaskGroups(phase) {
  return phase === 'round-1';
}

Page({
  data: page.createCloudPageData({
    levelId: 'A1',
    phase: 'round-1',
    stage: STAGES['round-1'],
    taskGroups: [],
    totalMinutesText: '待生成',
    hasTaskGroups: false
  }),
  async onLoad(query) {
    const phase = query.phase || 'round-1';
    const data = await store.getLevelOverview();
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const hasTaskGroups = shouldShowTaskGroups(phase);
    const taskGroups = hasTaskGroups ? buildTaskGroups(categories) : [];
    const totalMinutes = taskGroups.reduce((sum, item) => sum + item.minutes, 0);
    this.setData(page.buildCloudPageData(this.data, {
      levelId: query.levelId || 'A1',
      phase,
      stage: STAGES[phase] || STAGES['round-1'],
      taskGroups,
      totalMinutesText: totalMinutes ? `${totalMinutes} 分钟` : '待生成',
      hasTaskGroups
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
