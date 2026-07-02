const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';

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
    return '暂无文本';
  }
  return '纯听力';
}

function getTaskDurationSec(task, plannedDurationSec) {
  if (Number(plannedDurationSec || 0) > 0) {
    return Number(plannedDurationSec);
  }
  if (!task || task.isPendingAsset || !task.durationSec) {
    return 0;
  }
  return Number(task.durationSec) * Number(task.repeatTarget || 1);
}

function getDurationMinutes(durationSec) {
  return durationSec > 0 ? Math.max(1, Math.round(durationSec / 60)) : 0;
}

function buildTaskGroups(categories) {
  return (categories || []).map((category) => {
    const task = labels.normalizeTask(category.todayTask || {});
    const taskCount = Number(category.todayTaskCount || task.plannedTaskCount || 0);
    const durationSec = getTaskDurationSec(task, category.plannedDurationSec);
    const minutes = getDurationMinutes(durationSec);
    const disabled = !!(category.isPendingAsset || task.isPendingAsset);
    return {
      category: category.category,
      categoryLabel: labels.getCategoryDisplayLabel(category.category, category.categoryLabel),
      title: task.displayTitle || task.title || '等待素材',
      taskCountText: taskCount ? `${taskCount} 个任务` : '',
      textType: getTextType(task),
      minutesText: minutes ? `${minutes} 分钟` : '待生成',
      minutes,
      durationSec,
      taskId: task.taskId || '',
      taskSnapshot: task,
      disabled,
      stateText: task.completedToday ? '完成' : disabled ? '等待' : '›',
      planRunType: category.planRunType || 'normal',
      planDayIndex: category.planDayIndex || 0
    };
  });
}

function shouldShowTaskGroups(phase) {
  return phase === 'round-1' || phase === 'round-2';
}

function getStageSnapshot(phase) {
  try {
    const snapshot = wx.getStorageSync(LEVEL_STAGE_SNAPSHOT_KEY) || null;
    if (snapshot && snapshot.phase === phase && Array.isArray(snapshot.taskGroups) && snapshot.taskGroups.length) {
      return snapshot;
    }
  } catch (error) {}
  return null;
}

function writeStageSnapshot(phase, snapshot) {
  if (!phase || !snapshot || !Array.isArray(snapshot.taskGroups) || !snapshot.taskGroups.length) return;
  try {
    wx.setStorageSync(LEVEL_STAGE_SNAPSHOT_KEY, Object.assign({}, snapshot, { phase }));
  } catch (error) {}
}

Page({
  data: page.createCloudPageData({
    levelId: 'A1',
    phase: 'round-1',
    stage: STAGES['round-1'],
    taskGroups: [],
    totalMinutesText: '待生成',
    hasTaskGroups: false,
    hydrated: false
  }),
  applyOverview(data, phase, levelId) {
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const hasTaskGroups = shouldShowTaskGroups(phase) && categories.length > 0;
    const taskGroups = hasTaskGroups ? buildTaskGroups(categories) : [];
    const totalMinutes = getDurationMinutes(taskGroups.reduce((sum, item) => sum + item.durationSec, 0));
    const nextData = {
      levelId,
      phase,
      stage: STAGES[phase] || STAGES['round-1'],
      taskGroups,
      totalMinutesText: totalMinutes ? `${totalMinutes} 分钟` : '待生成',
      hasTaskGroups,
      hydrated: true
    };
    this.setData(page.buildCloudPageData(this.data, nextData));
    writeStageSnapshot(phase, nextData);
  },
  async onLoad(query) {
    page.syncTheme(this);
    const phase = query.phase || 'round-1';
    const levelId = query.levelId || 'A1';
    this.setData(page.buildCloudPageData(this.data, {
      levelId,
      phase,
      stage: STAGES[phase] || STAGES['round-1'],
      hydrated: false
    }));
    const snapshot = getStageSnapshot(phase);
    if (snapshot) {
      this.setData(page.buildCloudPageData(this.data, {
        levelId,
        phase,
        stage: STAGES[phase] || STAGES['round-1'],
        taskGroups: snapshot.taskGroups,
        totalMinutesText: snapshot.totalMinutesText || '待生成',
        hasTaskGroups: true,
        hydrated: true
      }));
    }
    const data = await store.getLevelOverview({ phase }, (fresh) => this.applyOverview(fresh, phase, levelId));
    this.applyOverview(data, phase, levelId);
  },
  onShow() {
    page.syncTheme(this);
  },
  openTask(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    const disabled = event.currentTarget.dataset.disabled;
    const planRunType = event.currentTarget.dataset.planRunType || 'normal';
    const planDayIndex = event.currentTarget.dataset.planDayIndex || '';
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    const taskGroup = (this.data.taskGroups || []).find((item) => item.category === category && item.taskId === taskId) || null;
    if (taskGroup && taskGroup.taskSnapshot) {
      try {
        wx.setStorageSync(LESSON_TASK_SNAPSHOT_KEY, {
          savedAt: Date.now(),
          category,
          taskId,
          task: taskGroup.taskSnapshot
        });
      } catch (error) {}
    }
    const previewQuery = planRunType === 'preview'
      ? `&planRunType=preview&planDayIndex=${planDayIndex}`
      : '';
    wx.navigateTo({
      url: taskId
        ? `/pages/lesson/index?category=${category}&taskId=${taskId}${previewQuery}`
        : `/pages/lesson/index?category=${category}${previewQuery}`
    });
  }
});
