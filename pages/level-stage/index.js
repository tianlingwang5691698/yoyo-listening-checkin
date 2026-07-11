const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LEVEL_STAGE_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function t(key, variables) {
  const template = i18n.getPageText('levelStage', key);
  return Object.keys(variables || {}).reduce((text, name) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), variables[name]), template);
}

const STAGES = {
  'round-1': {
    levelId: 'A1',
    stageText: t('phase1'), title: t('comboA'), hint: t('comboHint')
  },
  'round-2': {
    levelId: 'A1',
    stageText: t('phase2'), title: t('comboB'), hint: t('comboHint')
  },
  'round-3': {
    levelId: 'A1',
    stageText: t('phase3'), title: t('comboC'), hint: t('comboHint')
  },
  custom: {
    levelId: t('listening'), stageText: t('today'), title: t('todayPlan'), hint: t('todayHint')
  }
};

function getStage(phase) {
  const key = STAGES[phase] ? phase : 'round-1';
  if (key === 'custom') return { levelId: t('listening'), stageText: t('today'), title: t('todayPlan'), hint: t('todayHint') };
  const suffix = key === 'round-2' ? '2' : key === 'round-3' ? '3' : '1';
  const letter = suffix === '2' ? 'B' : suffix === '3' ? 'C' : 'A';
  return { levelId: 'A1', stageText: t(`phase${suffix}`), title: t(`combo${letter}`), hint: t('comboHint') };
}

function getTextType(task) {
  if (!task || task.isPendingAsset) {
    return t('waiting');
  }
  if (task.transcriptTrackId) {
    return task.syncGranularity === 'line' ? t('sentenceSync') : t('wordSync');
  }
  if (task.transcriptStatus === 'pending') {
    return t('noText');
  }
  return t('listeningOnly');
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
    return t('waitingMaterial');
  }
  return task.audioCompactTitle || task.displayTitle || task.title || t('unnamedTask');
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
      meta: [getTextType(task), task.playStepText ? t('progress', { progress: task.playStepText }) : ''].filter(Boolean).join(' · '),
      orderText: task.planSlotIndex ? `${task.planSlotIndex}` : `${index + 1}`,
      completedToday: !!task.completedToday,
      stateText: task.completedToday ? t('completed') : t('start'),
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
      title: task.displayTitle || task.title || t('waitingMaterial'),
      taskCountText: taskCount ? t('taskCount', { count: taskCount }) : (tasks.length ? t('taskCount', { count: tasks.length }) : ''),
      textType: getTextType(task),
      minutesText: minutes ? t('minutes', { minutes }) : t('pending'),
      minutes,
      durationSec,
      taskId: task.taskId || '',
      tasks,
      taskSnapshot: task,
      disabled,
      expanded: category.expanded !== false,
      stateText: task.completedToday ? t('completed') : disabled ? t('unavailable') : '›',
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
    stage: getStage('round-1'),
    taskGroups: [],
    expandedGroupKey: '',
    totalMinutesText: t('pending'),
    hasTaskGroups: false,
    hydrated: false,
    language: i18n.getLanguage(),
    texts: i18n.getPageTexts('levelStage')
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
      stage: getStage(displayPhase),
      taskGroups,
      expandedGroupKey,
      totalMinutesText: totalMinutes ? t('minutes', { minutes: totalMinutes }) : t('pending'),
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
      stage: getStage(phase),
      expandedGroupKey: preferredExpandedGroupKey,
      hydrated: false
    }));
    const snapshot = getStageSnapshot(snapshotId) || getStageSnapshot(phase);
    if (snapshot) {
      this.setData(page.buildCloudPageData(this.data, {
        levelId,
        phase,
        stage: getStage(phase),
        taskGroups: normalizeStageTaskGroups(snapshot.taskGroups),
        expandedGroupKey: preferredExpandedGroupKey || snapshot.expandedGroupKey || '',
        totalMinutesText: snapshot.totalMinutesText || t('pending'),
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
    await new Promise((resolve) => wx.nextTick(resolve));
    this.levelStagePerf.ready('pageReady', {
      source: 'fallback',
      cacheHit: false,
      phase,
      groups: 0
    });
    const data = await refresh();
    this.levelStagePerf.mark('cloudRefresh', {
      source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'error' : 'cloud'),
      cacheHit: !!(data && data.__cacheHit),
      phase,
      groups: ((data && data.categories) || []).length
    });
  },
  onShow() {
    page.syncTheme(this);
    const language = i18n.getLanguage();
    const texts = i18n.getPageTexts('levelStage', language);
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.setData({ language, texts, stage: getStage(this.data.phase) });
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
