const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LEVEL_STAGE_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
  },
  custom: {
    levelId: '听力',
    stageText: '今日',
    title: '今日计划',
    hint: '按你保存的素材顺序完成今天的听力。'
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

function getTaskTitle(task) {
  if (!task || task.isPendingAsset) {
    return '等待素材';
  }
  return task.audioCompactTitle || task.displayTitle || task.title || '未命名任务';
}

function buildTaskRows(category) {
  const fallbackTask = labels.normalizeTask(category.todayTask || {});
  const sourceTasks = Array.isArray(category.tasks) && category.tasks.length
    ? category.tasks
    : (fallbackTask && fallbackTask.taskId ? [fallbackTask] : []);
  return sourceTasks.map((source, index) => {
    const task = labels.normalizeTask(source || {});
    return {
      taskId: task.taskId || '',
      title: getTaskTitle(task),
      meta: [getTextType(task), task.playStepText ? `进度 ${task.playStepText}` : ''].filter(Boolean).join(' · '),
      orderText: task.planSlotIndex ? `${task.planSlotIndex}` : `${index + 1}`,
      completedToday: !!task.completedToday,
      stateText: task.completedToday ? '完成' : '开始',
      taskSnapshot: task,
      disabled: !!task.isPendingAsset
    };
  });
}

function buildTaskGroups(categories) {
  return (categories || []).map((category) => {
    const task = labels.normalizeTask(category.todayTask || {});
    const tasks = buildTaskRows(category);
    const taskCount = Number(category.todayTaskCount || task.plannedTaskCount || 0);
    const durationSec = getTaskDurationSec(task, category.plannedDurationSec);
    const minutes = getDurationMinutes(durationSec);
    const disabled = !!(category.isPendingAsset || task.isPendingAsset);
    return {
      groupKey: category.category,
      category: category.category,
      categoryLabel: labels.getCategoryDisplayLabel(category.category, category.categoryLabel),
      title: task.displayTitle || task.title || '等待素材',
      taskCountText: taskCount ? `${taskCount} 个任务` : (tasks.length ? `${tasks.length} 个任务` : ''),
      textType: getTextType(task),
      minutesText: minutes ? `${minutes} 分钟` : '待生成',
      minutes,
      durationSec,
      taskId: task.taskId || '',
      tasks,
      taskSnapshot: task,
      disabled,
      expanded: category.expanded !== false,
      stateText: task.completedToday ? '完成' : disabled ? '未开放' : '›',
      planRunType: category.planRunType || 'normal',
      planDayIndex: category.planDayIndex || 0
    };
  });
}

function normalizeStageTaskGroups(taskGroups) {
  return (taskGroups || []).map((item) => Object.assign({}, item, {
    expanded: item.expanded !== false
  }));
}

function shouldShowTaskGroups(phase) {
  return phase === 'round-1' || phase === 'round-2' || phase === 'custom';
}

function getStageSnapshot(snapshotId) {
  const snapshot = snapshotStore.read(LEVEL_STAGE_SNAPSHOT_KEY, {
    id: snapshotId,
    maxAgeMs: LEVEL_STAGE_SNAPSHOT_MAX_AGE_MS
  });
  if (!snapshot || !Array.isArray(snapshot.taskGroups) || !snapshot.taskGroups.length) return null;
  return snapshot.taskGroups.some((item) => !item.disabled && Array.isArray(item.tasks) && item.tasks.length)
    ? snapshot
    : null;
}

function writeStageSnapshot(snapshotId, phase, data) {
  if (!snapshotId || !phase || !data || !Array.isArray(data.taskGroups) || !data.taskGroups.length) return;
  if (!data.taskGroups.some((item) => !item.disabled)) return;
  snapshotStore.write(LEVEL_STAGE_SNAPSHOT_KEY, snapshotId, Object.assign({}, data, { phase }), {
    source: 'level-stage'
  });
}

Page({
  data: page.createCloudPageData({
    levelId: 'A1',
    phase: 'round-1',
    stage: STAGES['round-1'],
    taskGroups: [],
    expandedGroupKey: '',
    totalMinutesText: '待生成',
    hasTaskGroups: false,
    hydrated: false
  }),
  applyOverview(data, phase, levelId, preferredExpandedGroupKey, snapshotId) {
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const displayPhase = data.planPhase || phase;
    const hasTaskGroups = shouldShowTaskGroups(displayPhase) && categories.length > 0;
    const expandedState = {};
    (this.data.taskGroups || []).forEach((item) => {
      if (item && item.groupKey) {
        expandedState[item.groupKey] = item.expanded !== false;
      }
    });
    const taskGroups = hasTaskGroups ? buildTaskGroups(categories).map((item) => Object.assign({}, item, {
      expanded: Object.prototype.hasOwnProperty.call(expandedState, item.groupKey)
        ? expandedState[item.groupKey]
        : true
    })) : [];
    const totalMinutes = getDurationMinutes(taskGroups.reduce((sum, item) => sum + item.durationSec, 0));
    const currentExpandedGroupKey = preferredExpandedGroupKey || this.data.expandedGroupKey;
    const expandedGroupKey = taskGroups.some((item) => item.groupKey === currentExpandedGroupKey)
      ? currentExpandedGroupKey
      : '';
    const nextData = {
      levelId,
      phase: displayPhase,
      stage: STAGES[displayPhase] || STAGES['round-1'],
      taskGroups,
      expandedGroupKey,
      totalMinutesText: totalMinutes ? `${totalMinutes} 分钟` : '待生成',
      hasTaskGroups,
      hydrated: true
    };
    this.setData(page.buildCloudPageData(this.data, nextData));
    writeStageSnapshot(snapshotId || displayPhase, displayPhase, nextData);
  },
  async onLoad(query) {
    this.levelStagePerf = page.startPagePerf('level-stage');
    page.syncTheme(this);
    const phase = query.phase || 'round-1';
    const levelId = query.levelId || 'A1';
    const preferredExpandedGroupKey = query.expand || '';
    const snapshotId = query.snapshotId || phase;
    const fastMode = query.fast === '1';
    this.setData(page.buildCloudPageData(this.data, {
      levelId,
      phase,
      stage: STAGES[phase] || STAGES['round-1'],
      expandedGroupKey: preferredExpandedGroupKey,
      hydrated: false
    }));
    const snapshot = getStageSnapshot(snapshotId) || getStageSnapshot(phase);
    if (snapshot) {
      this.setData(page.buildCloudPageData(this.data, {
        levelId,
        phase,
        stage: STAGES[phase] || STAGES['round-1'],
        taskGroups: normalizeStageTaskGroups(snapshot.taskGroups),
        expandedGroupKey: preferredExpandedGroupKey || snapshot.expandedGroupKey || '',
        totalMinutesText: snapshot.totalMinutesText || '待生成',
        hasTaskGroups: true,
        hydrated: true
      }));
      this.levelStagePerf.ready('pageReady', {
        source: 'snapshot',
        cacheHit: true,
        phase,
        groups: (snapshot.taskGroups || []).length
      });
    }
    const refresh = async () => {
      const data = await store.getLevelOverview({ phase }, (fresh) => {
        this.applyOverview(fresh, phase, levelId, preferredExpandedGroupKey, snapshotId);
        if (this.levelStagePerf) {
          this.levelStagePerf.mark('cloudRefresh', { phase, groups: (fresh.categories || []).length });
        }
      });
      this.applyOverview(data, phase, levelId, preferredExpandedGroupKey, snapshotId);
      return data;
    };
    if (snapshot && fastMode) {
      return;
    }
    if (snapshot) {
      setTimeout(() => {
        refresh().catch(() => {});
      }, 1200);
      return;
    }
    const data = await refresh();
    this.levelStagePerf.ready('pageReady', {
      source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'error' : 'cloud'),
      cacheHit: !!(data && data.__cacheHit),
      phase,
      groups: ((data && data.categories) || []).length
    });
    if (data && !data.__cacheHit && data.syncMode !== 'cloud-error') {
      this.levelStagePerf.mark('cloudRefresh', { phase, groups: (data.categories || []).length });
    }
  },
  onShow() {
    page.syncTheme(this);
  },
  toggleTaskGroup(event) {
    const groupIndex = Number(event.currentTarget.dataset.groupIndex || 0);
    const taskGroup = (this.data.taskGroups || [])[groupIndex];
    if (!taskGroup || taskGroup.disabled) {
      return;
    }
    this.setData({
      [`taskGroups[${groupIndex}].expanded`]: taskGroup.expanded === false
    });
  },
  openTaskByIndex(groupIndex, taskIndex) {
    const taskGroup = (this.data.taskGroups || [])[groupIndex];
    const taskRow = taskGroup && (taskGroup.tasks || [])[taskIndex];
    if (!taskGroup || !taskRow || taskGroup.disabled || taskRow.disabled) {
      return;
    }
    const category = taskGroup.category;
    const taskId = taskRow.taskId;
    const planRunType = taskGroup.planRunType || 'normal';
    const planDayIndex = taskGroup.planDayIndex || '';
    if (taskRow.taskSnapshot) {
      snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
        category,
        taskId,
        task: taskRow.taskSnapshot
      }, { source: 'level-stage' });
    }
    const previewQuery = planRunType === 'preview'
      ? `&planRunType=preview&planDayIndex=${planDayIndex}`
      : '';
    wx.navigateTo({
      url: taskId
        ? `/pages/lesson/index?category=${category}&taskId=${taskId}${previewQuery}`
        : `/pages/lesson/index?category=${category}${previewQuery}`
    });
  },
  openTask(event) {
    const groupIndex = Number(event.currentTarget.dataset.groupIndex || 0);
    const taskIndex = Number(event.currentTarget.dataset.taskIndex || 0);
    this.openTaskByIndex(groupIndex, taskIndex);
  }
});
