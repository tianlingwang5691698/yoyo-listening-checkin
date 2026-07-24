const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LEVEL_STAGE_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const YOYO_FIXED_PLAN_OUTLINE = {
  cycleDays: 72,
  items: [
    {
      category: 'grammar',
      slotCount: 5,
      startNo: 1,
      endNo: 168,
      totalCount: 168,
      syntaxTotalCount: 106,
      scheduleText: '词法第1轮每天5课；词法第2轮每天10课；句法每天5课'
    },
    { category: 'newconcept1', slotCount: 3, startNo: 1, endNo: 76, totalCount: 76 },
    { category: 'peppa', slotCount: 5, startNo: 73, endNo: 157, totalCount: 85 },
    { category: 'unlock1', slotCount: 3, startNo: 1, endNo: 24, totalCount: 24, workbookCount: 12 },
    { category: 'vocabulary', slotCount: 1, startNo: 1, endNo: 32, totalCount: 1690, round: 1, currentList: 1 }
  ]
};

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
  if (task.category === 'grammar') {
    return t('course');
  }
  if (task.category === 'vocabulary') {
    return t('memorization');
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
  return task.displayTitle || task.audioTitle || task.title || t('unnamedTask');
}

function buildTaskRows(category) {
  const fallbackTask = labels.normalizeTask(category.todayTask || {});
  const sourceTasks = Array.isArray(category.tasks) && category.tasks.length
    ? category.tasks
    : (fallbackTask && fallbackTask.taskId ? [fallbackTask] : []);
  return sourceTasks.map((source, index) => {
    const task = labels.normalizeTask(source || {});
    const taskMeta = [getTextType(task), task.playStepText ? t('progress', { progress: task.playStepText }) : ''].filter(Boolean).join(' · ');
    return {
      taskId: task.taskId || '',
      title: getTaskTitle(task),
      meta: taskMeta,
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

function buildFixedPlanOutline(outline) {
  if (!outline || !Array.isArray(outline.items)) return null;
  const categoryTitles = {
    grammar: '语法微课',
    newconcept1: 'New Concept 1',
    peppa: 'Peppa',
    unlock1: 'Unlock 1 听口 第二版',
    speaking: 'Unlock 1 每日跟读',
    vocabulary: '初中词汇'
  };
  return {
    cycleDays: Number(outline.cycleDays || 72),
    items: outline.items.map((item) => {
      const startNo = Number(item.startNo || 1);
      const endNo = item.category === 'newconcept1' ? 76 : Number(item.endNo || 0);
      const totalCount = item.category === 'newconcept1' ? 76 : Number(item.totalCount || 0);
      if (item.category === 'vocabulary') {
        return Object.assign({}, item, {
          title: categoryTitles.vocabulary,
          rangeText: t('listRangeSummary', { total: totalCount || 1690 }),
          dailyText: t('dailyVocabularyStudy'),
          progressText: t('vocabularyPlanProgress', { round: Number(item.round || 1), list: Number(item.currentList || 1) })
        });
      }
      if (item.category === 'speaking') {
        return Object.assign({}, item, {
          title: categoryTitles.speaking,
          rangeText: '练习册32天 → 课本45天',
          dailyText: '练习册约8–12句；课本每天3段'
        });
      }
      if (item.category === 'grammar') {
        return Object.assign({}, item, {
          title: categoryTitles.grammar,
          rangeText: `词法 ${totalCount} 课 × 2轮 → 句法 ${Number(item.syntaxTotalCount || 106)} 课`,
          dailyText: item.scheduleText || '词法第1轮每天5课；词法第2轮每天10课；句法每天5课'
        });
      }
      if (item.category === 'unlock1') {
        return Object.assign({}, item, {
          title: categoryTitles.unlock1,
          rangeText: `当前课本轮 → 练习册第二版 ${Number(item.workbookCount || 12)} 集`,
          dailyText: '第1轮每天1集×3遍；第2–3轮每天3集×1遍'
        });
      }
      const unit = item.category === 'grammar' ? t('microLessonUnit') : item.category === 'newconcept1' ? t('lessonUnit') : t('episodeUnit');
      const dailyUnit = item.category === 'grammar'
        ? t('dailyMicroLessonUnit')
        : item.category === 'newconcept1'
          ? t('dailyLessonUnit')
          : item.category === 'peppa'
            ? t('dailyEpisodeUnit')
            : t('dailyAudioUnit');
      return Object.assign({}, item, {
        title: categoryTitles[item.category] || item.category,
        rangeText: t('rangeSummary', { start: startNo, end: endNo, total: totalCount, unit }),
        dailyText: t('dailyStudy', { count: Number(item.slotCount || 0), unit: dailyUnit })
      });
    })
  };
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
    fixedPlanOutline: null,
    hydrated: false,
    language: i18n.getLanguage(),
    texts: i18n.getPageTexts('levelStage')
  }),
  applyOverview(data, phase, levelId, preferredExpandedGroupKey, snapshotId) {
    const categories = (data.categories || []).map(labels.normalizeCategory);
    const displayPhase = data.planPhase || phase;
    const fixedPlanOutline = this.fixedPlanMode
      ? buildFixedPlanOutline(data.fixedPlanOutline || YOYO_FIXED_PLAN_OUTLINE)
      : null;
    const hasTaskGroups = !fixedPlanOutline && shouldShowTaskGroups(displayPhase) && categories.length > 0;
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
      fixedPlanOutline,
      hydrated: true
    };
    this.setData(page.buildCloudPageData(this.data, nextData));
    writeStageSnapshot(snapshotId || displayPhase, displayPhase, nextData);
    this.tryOpenResumeTask();
  },
  async onLoad(query) {
    this.levelStagePerf = page.startPagePerf('level-stage');
    page.syncTheme(this);
    const phase = query.phase || 'round-1';
    const levelId = query.levelId || 'A1';
    const preferredExpandedGroupKey = query.expand || '';
    const snapshotId = query.snapshotId || phase;
    const fastMode = query.fast === '1';
    this.fixedPlanMode = query.fixed === '1';
    this.resumeOpenToken = 0;
    this.resumeTaskOpened = false;
    this.resumeTaskRequest = query.resumeCategory && query.resumeTaskId ? {
      category: query.resumeCategory,
      taskId: query.resumeTaskId,
      planRunType: query.resumePlanRunType || 'normal',
      targetDate: query.resumeTargetDate || '',
      planDayIndex: query.resumePlanDayIndex || ''
    } : null;
    this.setData(page.buildCloudPageData(this.data, {
      levelId,
      phase,
      stage: getStage(phase),
      expandedGroupKey: preferredExpandedGroupKey,
      fixedPlanOutline: this.fixedPlanMode ? buildFixedPlanOutline(YOYO_FIXED_PLAN_OUTLINE) : null,
      hydrated: false
    }));
    const snapshot = getStageSnapshot(snapshotId) || getStageSnapshot(phase);
    if (snapshot && !this.fixedPlanMode) {
      this.setData(page.buildCloudPageData(this.data, {
        levelId,
        phase,
        stage: getStage(phase),
        taskGroups: normalizeStageTaskGroups(snapshot.taskGroups),
        expandedGroupKey: preferredExpandedGroupKey || snapshot.expandedGroupKey || '',
        totalMinutesText: snapshot.totalMinutesText || t('pending'),
        hasTaskGroups: true,
        fixedPlanOutline: snapshot.fixedPlanOutline || null,
        hydrated: true
      }));
      this.levelStagePerf.ready('pageReady', {
        source: 'snapshot',
        cacheHit: true,
        phase,
        groups: (snapshot.taskGroups || []).length
      });
      this.tryOpenResumeTask();
    }
    const refresh = async () => {
      const data = await store.getLevelOverview({ phase, fixed: this.fixedPlanMode }, (fresh) => {
        this.applyOverview(fresh, phase, levelId, preferredExpandedGroupKey, snapshotId);
        if (this.levelStagePerf) {
          this.levelStagePerf.mark('cloudRefresh', { phase, groups: (fresh.categories || []).length });
        }
      });
      this.applyOverview(data, phase, levelId, preferredExpandedGroupKey, snapshotId);
      return data;
    };
    if (snapshot && fastMode && !this.fixedPlanMode) {
      return;
    }
    if (snapshot && !this.fixedPlanMode) {
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
  tryOpenResumeTask() {
    if (this.resumeTaskOpened || !this.resumeTaskRequest) return false;
    const request = this.resumeTaskRequest;
    const groupIndex = (this.data.taskGroups || []).findIndex((group) => (
      String(group.category || '') === String(request.category || '')
    ));
    const taskGroup = (this.data.taskGroups || [])[groupIndex];
    const taskIndex = taskGroup ? (taskGroup.tasks || []).findIndex((task) => (
      String(task.taskId || '') === String(request.taskId || '')
    )) : -1;
    if (groupIndex < 0 || taskIndex < 0) return false;
    const resumeOpenToken = ++this.resumeOpenToken;
    this.resumeTaskOpened = true;
    this.resumeTaskRequest = null;
    wx.nextTick(() => {
      if (resumeOpenToken !== this.resumeOpenToken) return;
      this.openTaskByIndex(groupIndex, taskIndex, request);
    });
    return true;
  },
  openTaskByIndex(groupIndex, taskIndex, routeOptions = {}) {
    const taskGroup = (this.data.taskGroups || [])[groupIndex];
    const taskRow = taskGroup && (taskGroup.tasks || [])[taskIndex];
    if (!taskGroup || !taskRow || taskGroup.disabled || taskRow.disabled) {
      return;
    }
    const category = taskGroup.category;
    const taskId = taskRow.taskId;
    const planRunType = ['normal', 'catchup', 'preview'].includes(routeOptions.planRunType)
      ? routeOptions.planRunType
      : (taskGroup.planRunType || 'normal');
    const planDayIndex = routeOptions.planDayIndex !== undefined && routeOptions.planDayIndex !== ''
      ? routeOptions.planDayIndex
      : (taskGroup.planDayIndex || '');
    const targetDate = routeOptions.targetDate || '';
    if (taskRow.taskSnapshot) {
      snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
        category,
        taskId,
        task: taskRow.taskSnapshot
      }, { source: 'level-stage' });
    }
    if (category === 'grammar') {
      const task = taskRow.taskSnapshot || {};
      const deviceStudyRole = store.getDeviceStudyRole ? store.getDeviceStudyRole() : 'parent';
      const previewQuery = planRunType === 'preview' || deviceStudyRole !== 'student' ? '&preview=1' : '';
      wx.navigateTo({
        url: `/grammar-package/pages/classroom/index?topic=${encodeURIComponent(task.topic || '')}&lessonNumber=${Number(task.lessonNumber || 1)}&taskId=${encodeURIComponent(task.taskId || taskId || '')}${previewQuery}`
      });
      return;
    }
    if (category === 'vocabulary') {
      wx.navigateTo({ url: '/pages/reading/flashcards/index?dailyPlan=junior-list' });
      return;
    }
    if (category === 'speaking') {
      const task = taskRow.taskSnapshot || taskRow;
      wx.navigateTo({
        url: `/pages/speaking/index?dailyPlan=unlock1speaking&audioCategory=${encodeURIComponent(task.audioCategory || 'unlock1workbook')}&audioTaskId=${encodeURIComponent(task.audioTaskId || '')}&paragraphIndex=${Number(task.paragraphIndex || 1)}&sentenceStart=${Number(task.sentenceStartIndex || 1)}&sentenceEnd=${Number(task.sentenceEndIndex || task.sentenceStartIndex || 1)}`
      });
      return;
    }
    const routeQuery = [
      planRunType !== 'normal' ? `planRunType=${encodeURIComponent(planRunType)}` : '',
      targetDate ? `targetDate=${encodeURIComponent(targetDate)}` : '',
      planDayIndex !== '' ? `planDayIndex=${encodeURIComponent(planDayIndex)}` : ''
    ].filter(Boolean).map((item) => `&${item}`).join('');
    wx.navigateTo({
      url: taskId
        ? `/pages/lesson/index?category=${encodeURIComponent(category)}&taskId=${encodeURIComponent(taskId)}${routeQuery}`
        : `/pages/lesson/index?category=${encodeURIComponent(category)}${routeQuery}`
    });
  },
  openFixedPlanItem(event) {
    const category = String(event.currentTarget.dataset.category || '');
    if (category === 'grammar') {
      const deviceStudyRole = store.getDeviceStudyRole ? store.getDeviceStudyRole() : 'parent';
      const previewQuery = deviceStudyRole === 'student' ? '' : '&preview=1';
      wx.navigateTo({ url: `/grammar-package/pages/classroom/index?topic=noun${previewQuery}` });
      return;
    }
    if (category === 'vocabulary') {
      wx.navigateTo({ url: '/pages/reading/flashcards/index?dailyPlan=junior-list' });
      return;
    }
    if (category === 'speaking') {
      wx.navigateTo({ url: '/pages/speaking/index' });
      return;
    }
    if (category) {
      wx.navigateTo({
        url: `/pages/listening-material/index?levelId=A1&category=${encodeURIComponent(category)}`
      });
    }
  },
  openTask(event) {
    const groupIndex = Number(event.currentTarget.dataset.groupIndex || 0);
    const taskIndex = Number(event.currentTarget.dataset.taskIndex || 0);
    this.resumeOpenToken += 1;
    this.resumeTaskOpened = true;
    this.resumeTaskRequest = null;
    this.openTaskByIndex(groupIndex, taskIndex);
  }
});
