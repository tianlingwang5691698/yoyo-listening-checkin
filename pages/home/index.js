const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const CATEGORY_ORDER = ['peppa', 'unlock1', 'song'];
const PHASE_COPY = {
  '第1轮': '轻量日计划',
  '第2轮': '复习加速',
  '第3轮': '冲刺复习'
};
const PROGRAM_STEPS = [
  {
    key: 'peppa',
    orderText: '01',
    title: 'Peppa',
    copy: '剧情输入',
    tone: 'peppa'
  },
  {
    key: 'unlock1',
    orderText: '02',
    title: 'Unlock 1',
    copy: '体系训练',
    tone: 'unlock'
  },
  {
    key: 'song',
    orderText: '03',
    title: 'Songs',
    copy: '节奏巩固',
    tone: 'song'
  }
];

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
  const normalizedTask = labels.normalizeTask(task);
  const repeatTarget = normalizedTask.repeatTarget || 3;
  return Object.assign({}, normalizedTask, {
    textType: getTextType(normalizedTask),
    actionText: normalizedTask.isPendingAsset
      ? '等音频放入'
      : normalizedTask.completedToday
        ? '查看完成'
        : normalizedTask.playCount > 0
          ? '继续'
          : '开始',
    progressText: `${normalizedTask.playCount || 0}/${repeatTarget} 遍`
  });
}

function getProgramMeta(category) {
  return PROGRAM_STEPS.find((item) => item.key === category) || {
    key: category,
    orderText: '',
    title: labels.getCategoryDisplayLabel(category, category),
    copy: '今日训练',
    tone: 'unlock'
  };
}

function buildGroupedDailyTasks(tasks) {
  const groups = [];
  CATEGORY_ORDER.forEach((category) => {
    const categoryTasks = (tasks || []).filter((item) => item.category === category).map(decorateHomeTask);
    if (!categoryTasks.length) {
      return;
    }
    const activeTasks = categoryTasks.filter((item) => !item.isPendingAsset);
    const completedCount = activeTasks.filter((item) => item.completedToday).length;
    const totalCount = activeTasks.length || categoryTasks.length;
    const nextTask = categoryTasks.find((item) => !item.isPendingAsset && !item.completedToday) || categoryTasks[0];
    const meta = getProgramMeta(category);
    groups.push({
      category,
      categoryLabel: labels.getCategoryDisplayLabel(category, categoryTasks[0].categoryLabel),
      orderText: meta.orderText,
      programCopy: meta.copy,
      tone: meta.tone,
      completedCount,
      totalCount,
      progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      nextTask,
      textType: nextTask ? nextTask.textType : '待准备',
      actionText: nextTask ? nextTask.actionText : '待准备',
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
    programSteps: PROGRAM_STEPS,
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
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
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
