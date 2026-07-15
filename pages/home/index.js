const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');
const {
  ACTIVE_LISTENING_LESSON_MAX_AGE_MS,
  getListeningOwnerId,
  getActiveListeningLessonKey,
  findListeningContinueTask
} = require('../../utils/listening-resume');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const ENTRY_POSTER_DISMISSED_KEY = 'homeEntryPosterDismissedV1';
const TODAY_COMPLETED_CACHE_KEY = 'todayCompletedItemsV1';
const HOME_DASHBOARD_SNAPSHOT_KEY = 'homeDashboardSnapshotV2';
const MATERIAL_HOME_SNAPSHOT_KEY = 'materialHomeSnapshotV1';
const LISTENING_PLAN_OVERVIEW_SNAPSHOT_KEY = 'listeningPlanOverviewSnapshotV5';
const PROFILE_SNAPSHOT_KEY = 'profileHomeSnapshotV1';

const VOCABULARY_ITEM_KEYS = [
  'listeningFlashcardItemsV1',
  'readingFlashcardItemsV1',
  'grammarFlashcardItemsV1',
  'writingFlashcardItemsV1',
  'speakingFlashcardItemsV1'
];

function t(key, variables) {
  const template = i18n.getPageText('home', key);
  return Object.keys(variables || {}).reduce((text, name) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), variables[name]), template);
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDisplayText() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const week = t(`weekday${now.getDay()}`);
  return t('dateDisplay', { month, day, week });
}

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 11) return t('morningGreeting');
  if (hour < 18) return t('afternoonGreeting');
  return t('eveningGreeting');
}

function buildHomeNavStyle() {
  try {
    const system = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const statusBarHeight = Number(system.statusBarHeight || 22);
    const contentTop = Math.ceil(statusBarHeight + 20);
    return `padding-top:${contentTop}px;`;
  } catch (error) {
    return 'padding-top:42px;';
  }
}

function profileInitial(child) {
  const name = String((child && (child.avatarText || child.nickname)) || '学');
  return name.slice(0, 1).toUpperCase();
}

function isDefaultChildNickname(child) {
  const value = String((child && child.nickname) || '').trim();
  const childLoginCode = String((child && child.childLoginCode) || '').trim();
  return !!(child && child.nicknameRequired) || !value || ['同学', '我'].includes(value) || (value === '佑佑' && childLoginCode !== '317613');
}

function buildVocabularySummary() {
  const today = todayString();
  const seen = {};
  const items = VOCABULARY_ITEM_KEYS.reduce((list, key) => {
    try {
      return list.concat(wx.getStorageSync(key) || []);
    } catch (error) {
      return list;
    }
  }, []).filter((item) => {
    if (!item || item.familiarLevel === 'mastered') return false;
    const text = item.flashcardKey || `${item.type || 'word'}:${item.text || item.word || item.phrase || ''}`;
    if (!text || seen[text]) return false;
    seen[text] = true;
    return true;
  });
  const dueItems = items.filter((item) => !item.nextReviewDate || item.nextReviewDate <= today);
  return {
    total: items.length,
    due: dueItems.length,
    words: items.filter((item) => item.type !== 'phrase').length,
    phrases: items.filter((item) => item.type === 'phrase').length
  };
}

function hasListeningMaterialContent(materialIndex) {
  const index = materialIndex || {};
  return !!((index.listeningEm1 || []).length || (index.listeningEm2 || []).length);
}

function hasWritingMaterialContent(materialIndex) {
  const index = materialIndex || {};
  return !!((index.writingEm1 || []).length || (index.writingEm2 || []).length);
}

function getMaterialHomeSnapshotKey(moduleId) {
  return `${MATERIAL_HOME_SNAPSHOT_KEY}:${moduleId}`;
}

function writeMaterialHomeSnapshots(materialIndex, source) {
  if (!materialIndex || materialIndex.syncMode === 'cloud-error') {
    return;
  }
  if (hasListeningMaterialContent(materialIndex)) {
    snapshotStore.write(getMaterialHomeSnapshotKey('listening'), 'listening', { materialIndex }, { source });
  }
  if (hasWritingMaterialContent(materialIndex)) {
    snapshotStore.write(getMaterialHomeSnapshotKey('writing'), 'writing', { materialIndex }, { source });
  }
}

function getListeningOverviewSnapshotId(levelId) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}:${levelId || 'A1'}`;
}

function writeListeningOverviewSnapshot(data, levelId, source) {
  if (!data || data.syncMode === 'cloud-error' || !(data.materials || []).length) return;
  const snapshotId = getListeningOverviewSnapshotId(levelId);
  snapshotStore.write(`${LISTENING_PLAN_OVERVIEW_SNAPSHOT_KEY}:${snapshotId}`, snapshotId, data, { source });
}

function buildListeningSummary(groupedDailyTasks, options = {}) {
  if (options.needsListeningPlanSetup) return t('setupListeningPlan');
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  const nextGroup = groups.find((item) => Number(item.completedCount || 0) < Number(item.totalCount || 0));
  if (!groups.length) return t('enterListening');
  if (total > 0 && completed >= total) return t('completedToday');
  return t('listeningProgress', { completed, total: total || groups.length, next: (nextGroup && nextGroup.categoryLabel) || t('continue') });
}

function formatEstimatedDuration(seconds) {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return t('durationPending');
  }
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) {
    return t('minutes', { minutes });
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return t('hoursMinutes', { hours, minutes: rest ? t('minutes', { minutes: rest }) : '' });
}

function getListeningDurationSec(groupedDailyTasks) {
  return (groupedDailyTasks || []).reduce((sum, group) => {
    const groupDuration = Number(group && group.durationSec || 0);
    if (groupDuration > 0) {
      return sum + groupDuration;
    }
    return sum + ((group && group.tasks) || []).reduce((taskSum, task) => (
      taskSum + (Number(task.durationSec || 0) * Number(task.repeatTarget || 1))
    ), 0);
  }, 0);
}

function getCompletedListeningDurationSec(groupedDailyTasks) {
  return (groupedDailyTasks || []).reduce((sum, group) => (
    sum + ((group && group.tasks) || []).reduce((taskSum, task) => {
      if (!task || !task.completedToday) return taskSum;
      return taskSum + (Number(task.durationSec || 0) * Number(task.repeatTarget || 1));
    }, 0)
  ), 0);
}

function formatHoursFromMinutes(minutes) {
  const value = Number(minutes || 0);
  return (Math.round((value / 60) * 10) / 10).toFixed(1);
}

function buildHomeVisualMetrics(groupedDailyTasks, options = {}) {
  const stats = options.stats || {};
  const hasCloudGoalMinutes = options.todayListeningGoalMinutes !== undefined
    && options.todayListeningGoalMinutes !== null
    && Number.isFinite(Number(options.todayListeningGoalMinutes));
  const goalMinutes = hasCloudGoalMinutes
    ? Math.max(0, Math.round(Number(options.todayListeningGoalMinutes)))
    : (Math.round(getListeningDurationSec(groupedDailyTasks) / 60) || 0);
  const hasCloudTodayMinutes = options.todayListeningMinutes !== undefined
    && options.todayListeningMinutes !== null
    && Number.isFinite(Number(options.todayListeningMinutes));
  const doneMinutes = hasCloudTodayMinutes
    ? Math.max(0, Math.round(Number(options.todayListeningMinutes)))
    : Math.round(getCompletedListeningDurationSec(groupedDailyTasks) / 60);
  const safeGoal = Math.max(0, goalMinutes);
  const safeDone = Math.max(0, doneMinutes);
  const progressPercent = safeGoal > 0 ? Math.min(100, Math.round((safeDone / safeGoal) * 100)) : 0;
  return {
    todayGoalMinutes: safeGoal,
    todayDoneMinutes: safeDone,
    todayProgressPercent: progressPercent,
    todayProgressStyle: `background: conic-gradient(#86aaa1 ${progressPercent}%, rgba(134, 170, 161, 0.22) 0);`,
    libraryProgressStyle: `background: conic-gradient(#9b7746 ${progressPercent}%, rgba(184, 149, 98, 0.2) 0);`,
    streakDaysText: String(Number(stats.streakDays || 0)),
    completedTasksText: String(Number(stats.completedTasks || 0)),
    totalStudyHoursText: formatHoursFromMinutes(stats.totalMinutes || 0)
  };
}

function buildListeningTaskStatus(groupedDailyTasks, options = {}) {
  if (options.needsListeningPlanSetup) {
    return {
      title: t('todayTask'),
      copy: t('noListeningPlanCopy'),
      primaryLine: t('noListeningPlan'),
      secondaryLine: t('chooseMaterialRhythm'),
      action: t('setupPlan'),
      pending: false,
      setupRequired: true
    };
  }
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  if (!groups.length || !total) {
    return {
      title: t('todayTask'),
      copy: t('noListeningTaskCopy'),
      primaryLine: t('noListeningTask'),
      secondaryLine: t('resetPlanHint'),
      action: t('setupPlan'),
      pending: false,
      setupRequired: true
    };
  }
  const pending = completed < total;
  const durationSec = getListeningDurationSec(groups);
  const durationText = durationSec > 0 ? t('estimatedDuration', { duration: formatEstimatedDuration(durationSec) }) : t('durationPending');
  return {
    title: t('todayTask'),
    copy: t('taskStatusCopy', { completed, total, duration: durationText, status: pending ? t('pending') : t('completed') }),
    primaryLine: t('listeningCount', { completed, total }),
    secondaryLine: t('durationStatus', { duration: durationText, status: pending ? t('pending') : t('completed') }),
    action: pending ? t('continueLearning') : t('viewRecords'),
    pending,
    setupRequired: false
  };
}

function findNextListeningTask(groupedDailyTasks) {
  const groups = groupedDailyTasks || [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex] || {};
    const task = (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset);
    if (task) {
      return {
        category: task.category || group.category || '',
        taskId: task.taskId || ''
      };
    }
  }
  return null;
}

function findNextListeningGroupKey(groupedDailyTasks) {
  const next = findNextListeningTask(groupedDailyTasks);
  if (next && next.category) {
    return next.category;
  }
  const firstGroup = (groupedDailyTasks || []).find((item) => item && item.category);
  return firstGroup ? firstGroup.category : '';
}

function readActiveListeningLesson() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const ownerId = getListeningOwnerId(target);
  return snapshotStore.read(getActiveListeningLessonKey(target), {
    id: ownerId,
    maxAgeMs: ACTIVE_LISTENING_LESSON_MAX_AGE_MS
  });
}

function buildListeningResumeQuery(task, activeLesson) {
  if (!task) return '';
  const parts = [
    `resumeCategory=${encodeURIComponent(task.category || '')}`,
    `resumeTaskId=${encodeURIComponent(task.taskId || '')}`
  ];
  const activeMatches = activeLesson
    && String(activeLesson.category || '') === String(task.category || '')
    && String(activeLesson.taskId || '') === String(task.taskId || '');
  if (!activeMatches) return `&${parts.join('&')}`;
  const planRunType = ['normal', 'catchup'].includes(activeLesson.planRunType) ? activeLesson.planRunType : 'normal';
  parts.push(`resumePlanRunType=${planRunType}`);
  if (activeLesson.targetDate) parts.push(`resumeTargetDate=${encodeURIComponent(activeLesson.targetDate)}`);
  if (activeLesson.planDayIndex !== undefined && activeLesson.planDayIndex !== '') {
    parts.push(`resumePlanDayIndex=${encodeURIComponent(activeLesson.planDayIndex)}`);
  }
  return `&${parts.join('&')}`;
}

function buildStageSnapshotId(child, phase) {
  const target = buildCompletedCacheTarget(child);
  return [
    target.targetFamilyId || 'self',
    target.targetChildId || target.childLoginCode || 'self',
    phase || 'round-1'
  ].join(':');
}

function buildHomeDashboardSnapshotId(child) {
  const target = buildCompletedCacheTarget(child);
  return [
    target.targetFamilyId || 'self',
    target.targetChildId || target.childLoginCode || 'self'
  ].join(':');
}

function getCurrentPhaseKey(planPhaseLabel) {
  if (planPhaseLabel === '阶段二') return 'round-2';
  if (planPhaseLabel === '阶段三') return 'round-3';
  return 'round-1';
}

function isEntryPosterDismissed() {
  try {
    return wx.getStorageSync(ENTRY_POSTER_DISMISSED_KEY) === 'yes';
  } catch (error) {
    return false;
  }
}

function shouldShowEntryPoster() {
  return true;
}

function shouldShowIdentityConfirm() {
  return true;
}

function buildStageSnapshotTaskGroups(groupedDailyTasks) {
  return (groupedDailyTasks || []).map((group) => {
    const task = (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset)
      || (group.tasks || [])[0]
      || group.nextTask
      || {};
    const disabled = !!(task.isPendingAsset || group.isPendingAsset);
    const tasks = (group.tasks || []).map((sourceTask, index) => ({
      taskId: sourceTask.taskId || '',
      title: sourceTask.displayTitle || sourceTask.title || group.programSubtitle || '',
      meta: [sourceTask.textType || group.textType || '', sourceTask.progressText ? t('progress', { progress: sourceTask.progressText }) : ''].filter(Boolean).join(' · '),
      orderText: sourceTask.planSlotIndex ? `${sourceTask.planSlotIndex}` : `${index + 1}`,
      completedToday: !!sourceTask.completedToday,
      stateText: sourceTask.completedToday ? t('completed') : t('start'),
      taskSnapshot: sourceTask,
      disabled: !!sourceTask.isPendingAsset
    }));
    return {
      category: task.category || group.category || '',
      categoryLabel: group.categoryLabel || task.categoryLabel || '',
      title: task.displayTitle || task.title || group.programSubtitle || '',
      taskCountText: Number(group.totalCount || 0) ? t('taskCount', { count: Number(group.totalCount || 0) }) : '',
      textType: task.textType || group.textType || '',
      minutesText: group.minutesText || '',
      minutes: Number(group.minutes || 0),
      durationSec: Number(group.durationSec || 0),
      taskId: task.taskId || '',
      tasks,
      taskSnapshot: task,
      disabled,
      expanded: true,
      stateText: task.completedToday ? t('completed') : disabled ? t('waiting') : '›',
      planRunType: task.planRunType || group.planRunType || 'normal',
      planDayIndex: task.planDayIndex || group.planDayIndex || 0
    };
  });
}

function buildTodayCompletedItems(groupedDailyTasks) {
  let speakingAttempts = [];
  try {
    const report = wx.getStorageSync('todayReportForCompletedV1') || null;
    speakingAttempts = report && Array.isArray(report.speakingAttempts) ? report.speakingAttempts : [];
  } catch (error) {
    speakingAttempts = [];
  }
  const listeningItems = (groupedDailyTasks || []).reduce((list, group) => {
    (group.tasks || []).forEach((task) => {
      if (task.completedToday) {
        const attempts = speakingAttempts.filter((attempt) => (
          attempt.category === (task.category || group.category)
          && (attempt.taskId === task.taskId || attempt.taskId === task.originalTaskId)
        ));
        list.push({
          type: attempts.length ? 'speaking' : 'listening',
          title: task.displayTitle || task.title || group.categoryLabel,
          meta: attempts.length ? t('answerScoring') : (group.categoryLabel || task.category || t('listening')),
          category: task.category || group.category || '',
          taskId: task.taskId || '',
          progressText: task.progressText || '',
          taskSnapshot: task,
          attempts,
          completedToday: true
        });
      }
    });
    return list;
  }, []);
  const seen = {};
  return listeningItems.filter((item) => {
    const key = item.id || `${item.type}:${item.category || ''}:${item.taskId || ''}:${item.title || ''}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function buildCompletedCacheTarget(child) {
  const source = child || {};
  return {
    targetFamilyId: String(source.familyId || '').trim(),
    targetChildId: String(source.childId || '').trim(),
    childLoginCode: String(source.childLoginCode || '').trim()
  };
}

function isListeningCompletedCacheItem(item) {
  return item
    && (item.type === 'listening' || item.type === 'speaking')
    && !!item.category
    && !!item.taskId;
}

function writeTodayCompletedCache(child, items) {
  try {
    wx.setStorageSync(TODAY_COMPLETED_CACHE_KEY, {
      date: todayString(),
      target: buildCompletedCacheTarget(child),
      items: (items || []).filter(isListeningCompletedCacheItem)
    });
  } catch (error) {}
}

function buildCompletedUrl(child) {
  const target = buildCompletedCacheTarget(child);
  const query = [
    `date=${todayString()}`,
    'scope=listening',
    target.targetFamilyId ? `targetFamilyId=${encodeURIComponent(target.targetFamilyId)}` : '',
    target.targetChildId ? `targetChildId=${encodeURIComponent(target.targetChildId)}` : '',
    target.childLoginCode ? `childLoginCode=${encodeURIComponent(target.childLoginCode)}` : ''
  ].filter(Boolean).join('&');
  return `/pages/home/completed/index?${query}`;
}

Page({
  data: page.createCloudPageData({
    child: contracts.createChildDefaults(),
    profileInitial: t('studentInitial'),
    currentMember: contracts.createCurrentMemberDefaults(),
    stats: contracts.createStatsDefaults(),
    planDayIndex: 1,
    checkinDayCount: 0,
    todayDisplay: todayDisplayText(),
    greeting: greetingText(),
    planPhaseLabel: t('round1'),
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    planSource: 'none',
    needsListeningPlanSetup: false,
    studyRole: 'parent',
    identityConfirmVisible: true,
    modeChangedNoticeVisible: false,
    homeLoading: true,
    homeDataReady: false,
    homeDataTarget: '',
    readingLoading: true,
    readingToday: null,
    readingCompleted: false,
    listeningSummary: t('enterListening'),
    listeningTaskStatus: buildListeningTaskStatus([]),
    nextListeningTask: null,
    readingSummary: t('enterReading'),
    language: i18n.getLanguage(),
    texts: i18n.getPageTexts('home'),
    vocabularySummary: buildVocabularySummary(),
    todayGoalMinutes: 0,
    todayDoneMinutes: 0,
    todayProgressPercent: 0,
    todayProgressStyle: 'background: conic-gradient(#86aaa1 0%, rgba(134, 170, 161, 0.22) 0);',
    libraryProgressStyle: 'background: conic-gradient(#9b7746 0%, rgba(184, 149, 98, 0.2) 0);',
    streakDaysText: '0',
    completedTasksText: '0',
    totalStudyHoursText: '0.0',
    waveBars: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'],
    todayCompletedItems: [],
    entryPosterVisible: true,
    entryPosterPage: 0,
    identitySelectedInSession: false,
    nicknameRequired: false,
    nicknameInput: '',
    homeNavStyle: buildHomeNavStyle()
  }),
  buildStudyModePresentation(member) {
    const studyRole = member && member.studyRole === 'student' ? 'student' : 'parent';
    return {
      studyRole
    };
  },
  applyDashboard(data) {
    const currentTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const currentTargetPart = `${currentTarget.targetFamilyId || 'self'}:${currentTarget.targetChildId || 'self'}`;
    if (data && data.syncMode === 'cloud-error' && this.data.homeDataReady && this.data.homeDataTarget === currentTargetPart) {
      this.setData({
        syncMode: data.syncMode,
        syncDebug: data.syncDebug,
        showCloudDebug: data.showCloudDebug,
        homeLoading: false
      });
      return this.data.groupedDailyTasks || [];
    }
    const nextStudyRole = data.currentMember && data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const previousStudyRole = wx.getStorageSync('lastStudyRole') || '';
    const modeChangedNoticeVisible = previousStudyRole === 'student' && nextStudyRole === 'parent';
    wx.setStorageSync('lastStudyRole', nextStudyRole);
    const groupedDailyTasks = labels.normalizeHomeTaskGroups(data.groupedDailyTasks || []);
    const needsListeningPlanSetup = !!data.needsListeningPlanSetup || data.planSource === 'none';
    if (data && data.syncMode !== 'cloud-error' && data.child) {
      snapshotStore.write(HOME_DASHBOARD_SNAPSHOT_KEY, buildHomeDashboardSnapshotId(data.child), data, { source: 'home-dashboard' });
    }
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
      syncMode: data.syncMode,
      isReviewBuild: data.isReviewBuild,
      showCloudDebug: data.showCloudDebug,
      syncDebug: data.syncDebug,
      child: data.child,
      nicknameRequired: isDefaultChildNickname(data.child),
      nicknameInput: isDefaultChildNickname(data.child) ? '' : ((data.child && data.child.nickname) || ''),
      profileInitial: profileInitial(data.child),
      currentMember: data.currentMember,
      stats: data.stats || contracts.createStatsDefaults(),
      planDayIndex: data.planDayIndex,
      checkinDayCount: Number(data.checkinDayCount || 0),
      planDayText: t('dayLabel', { day: Number(data.checkinDayCount || 0) }),
      planPhaseLabel: data.planPhaseLabel,
      planSource: data.planSource || 'none',
      needsListeningPlanSetup,
      groupedDailyTasks,
      hasGroupedTasks: !!groupedDailyTasks.length,
      listeningSummary: buildListeningSummary(groupedDailyTasks, { needsListeningPlanSetup }),
      listeningTaskStatus: buildListeningTaskStatus(groupedDailyTasks, { needsListeningPlanSetup }),
      nextListeningTask: findNextListeningTask(groupedDailyTasks),
      todayCompletedItems: buildTodayCompletedItems(groupedDailyTasks),
      ...buildHomeVisualMetrics(groupedDailyTasks, {
        stats: data.stats || contracts.createStatsDefaults(),
        todayListeningMinutes: data.todayListeningMinutes,
        todayListeningGoalMinutes: data.todayListeningGoalMinutes
      }),
      identityConfirmVisible: !this.data.identitySelectedInSession,
      modeChangedNoticeVisible,
      homeLoading: false,
      homeDataReady: data.syncMode !== 'cloud-error',
      homeDataTarget: currentTargetPart
    }, this.buildStudyModePresentation(data.currentMember))));
    return groupedDailyTasks;
  },
  applyFastDashboardSnapshot(nextRole) {
    const selectedTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const payloads = [
      Object.assign({ view: 'home' }, selectedTarget || {}),
      { view: 'home' }
    ];
    for (let index = 0; index < payloads.length; index += 1) {
      const cached = store.getCachedReadResult ? store.getCachedReadResult('getDashboard', payloads[index]) : null;
      if (cached && cached.child && cached.syncMode !== 'cloud-error') {
        this.applyDashboard(Object.assign({}, cached, {
          currentMember: Object.assign({}, cached.currentMember || {}, { studyRole: nextRole })
        }));
        return true;
      }
    }
    const currentGroups = this.data.groupedDailyTasks || [];
    if (this.data.homeDataReady && this.data.child) {
      this.applyDashboard(Object.assign({}, this.data, {
        currentMember: Object.assign({}, this.data.currentMember || {}, { studyRole: nextRole }),
        groupedDailyTasks: currentGroups
      }));
      return true;
    }
    return false;
  },
  ensureNicknameReady() {
    if (!this.data.nicknameRequired) {
      return true;
    }
    wx.showToast({
      title: t('changeNickname'),
      icon: 'none'
    });
    return false;
  },
  ensureIdentityReady() {
    if (!this.data.identityConfirmVisible) {
      return true;
    }
    wx.showToast({
      title: t('chooseIdentity'),
      icon: 'none'
    });
    return false;
  },
  handleNicknameInput(event) {
    this.setData({
      nicknameInput: event.detail.value
    });
  },
  async saveRequiredNickname() {
    const nickname = String(this.data.nicknameInput || '').trim();
    if (!nickname || ['同学', '我'].includes(nickname) || (nickname === '佑佑' && String((this.data.child && this.data.child.childLoginCode) || '').trim() !== '317613')) {
      wx.showToast({
        title: t('changeNickname'),
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.updateChildProfile(nickname);
      const child = data.child || Object.assign({}, this.data.child, { nickname, nicknameRequired: false });
      this.setData(page.buildCloudPageData(this.data, {
        child,
        nicknameInput: child.nickname || nickname,
        nicknameRequired: isDefaultChildNickname(child),
        profileInitial: profileInitial(child)
      }));
      wx.showToast({
        title: t('nicknameSaved'),
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || t('saveFailed'),
        icon: 'none'
      });
    }
  },
  async onShow() {
    const homePerf = page.startPagePerf('home');
    this.homePerf = homePerf;
    page.syncTheme(this, {
      windowColors: (currentTheme) => currentTheme === 'library'
        ? { frontColor: '#ffffff', backgroundColor: '#1c140f' }
        : null
    });
    const language = i18n.getLanguage();
    const texts = i18n.getPageTexts('home', language);
    wx.setNavigationBarTitle({ title: texts.navTitle });
    const tabBar = this.getTabBar && this.getTabBar();
    const identitySelectedInSession = !!this.data.identitySelectedInSession;
    const entryPosterVisible = !identitySelectedInSession && shouldShowEntryPoster();
    const identityConfirmVisible = !identitySelectedInSession && shouldShowIdentityConfirm();
    const selectedTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const selectedTargetPart = `${selectedTarget.targetFamilyId || 'self'}:${selectedTarget.targetChildId || 'self'}`;
    const memoryReady = this.data.homeDataReady && this.data.homeDataTarget === selectedTargetPart;
    const cachedDashboard = store.getCachedReadResult
      ? store.getCachedReadResult('getDashboard', Object.assign({ view: 'home' }, selectedTarget))
      : null;
    const cacheReady = !!(cachedDashboard && cachedDashboard.syncMode !== 'cloud-error' && cachedDashboard.child);
    if (!memoryReady && cacheReady) {
      this.applyDashboard(cachedDashboard);
    } else if (!memoryReady) {
      this.setData({ homeDataReady: false, homeDataTarget: selectedTargetPart });
    }
    if (tabBar) {
      const tabBarData = {};
      if (tabBar.data.selected !== 0) tabBarData.selected = 0;
      if (tabBar.data.hidden !== entryPosterVisible) tabBarData.hidden = entryPosterVisible;
      if (Object.keys(tabBarData).length) tabBar.setData(tabBarData);
    }
    this.setData({
      texts,
      language,
      planDayText: t('dayLabel', { day: this.data.checkinDayCount }),
      homeLoading: !memoryReady && !cacheReady,
      todayDisplay: todayDisplayText(),
      greeting: greetingText(),
      listeningSummary: buildListeningSummary(this.data.groupedDailyTasks, { needsListeningPlanSetup: this.data.needsListeningPlanSetup }),
      listeningTaskStatus: buildListeningTaskStatus(this.data.groupedDailyTasks, { needsListeningPlanSetup: this.data.needsListeningPlanSetup }),
      homeNavStyle: buildHomeNavStyle(),
      vocabularySummary: buildVocabularySummary(),
      entryPosterVisible,
      identityConfirmVisible,
      entryPosterPage: entryPosterVisible ? 0 : this.data.entryPosterPage,
      identitySelectedInSession
    });
    await new Promise((resolve) => wx.nextTick(resolve));
    homePerf.ready('pageReady', {
      cacheHit: memoryReady || cacheReady,
      source: memoryReady ? 'memory' : (cacheReady ? 'cache' : 'skeleton'),
      groups: (this.data.groupedDailyTasks || []).length
    });
    const homeRefreshPromise = this.startHomeDashboardRefresh({ skipCache: true, perf: homePerf });
    setTimeout(() => {
      writeTodayCompletedCache(this.data.child, this.data.todayCompletedItems || []);
    }, 100);
    this.scheduleHomePrefetches(homeRefreshPromise);
  },
  onUnload() {
    this.clearHomePrefetchTimers();
    this.invalidateHomeDashboardRefresh();
  },
  onHide() {
    this.clearHomePrefetchTimers();
    this.invalidateHomeDashboardRefresh();
  },
  clearHomePrefetchTimers() {
    (this._homePrefetchTimers || []).forEach((timer) => clearTimeout(timer));
    this._homePrefetchTimers = [];
    this._homePrefetchScheduleId = Number(this._homePrefetchScheduleId || 0) + 1;
  },
  scheduleHomePrefetches(refreshPromise) {
    this.clearHomePrefetchTimers();
    const scheduleId = this._homePrefetchScheduleId;
    Promise.resolve(refreshPromise).catch(() => {}).then(() => {
      if (scheduleId !== this._homePrefetchScheduleId) return;
      const steps = [
        [0, () => {
          this.prefetchListeningMaterialHome();
          this.prefetchReadingHome();
          this.prefetchVocabularyHome();
        }],
        [200, () => this.prefetchWritingMaterialHome()],
        [400, () => this.prefetchGrammarHome()],
        [600, () => this.prefetchListeningOverview()],
        [1000, () => this.prefetchRecordHome()],
        [1400, () => this.prefetchProfileHome()]
      ];
      this._homePrefetchTimers = steps.map(([delay, task]) => setTimeout(task, delay));
    });
  },
  showNextEntryPosterPage() {
    this.setData({
      entryPosterPage: 1
    });
  },
  showPrevEntryPosterPage() {
    this.setData({
      entryPosterPage: 0
    });
  },
  closeEntryPoster() {
    try {
      wx.setStorageSync(ENTRY_POSTER_DISMISSED_KEY, 'yes');
    } catch (error) {}
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ hidden: false });
    }
    this.setData({
      entryPosterVisible: false
    });
  },
  async confirmStudyIdentity(event) {
    const nextRole = event.currentTarget.dataset.role === 'student' ? 'student' : 'parent';
    page.setIdentityConfirmed(true);
    try {
      wx.setStorageSync(ENTRY_POSTER_DISMISSED_KEY, 'yes');
    } catch (error) {}
    wx.setStorageSync('lastStudyRole', nextRole);
    if (nextRole === 'student') {
      wx.setStorageSync('hasUsedStudentMode', 'yes');
    }
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ hidden: false });
    }
    this.setData(Object.assign({
      identityConfirmVisible: false,
      modeChangedNoticeVisible: false,
      entryPosterVisible: false,
      identitySelectedInSession: true
    }, this.buildStudyModePresentation({ studyRole: nextRole })));
    const fastPainted = this.applyFastDashboardSnapshot(nextRole);
    if (!fastPainted) {
      this.setData({ homeLoading: true, homeDataReady: false });
    }
    wx.showToast({
      title: nextRole === 'student' ? t('enteredStudent') : t('enteredParent'),
      icon: 'none',
      duration: 900
    });
    try {
      const roleRequest = store.setStudyRole(nextRole);
      setTimeout(() => {
        this.prefetchListeningOverview();
        this.prefetchRecordHome();
        this.prefetchProfileHome();
        this.prefetchVocabularyHome();
      }, nextRole === 'student' ? 0 : 1200);
      const data = await roleRequest;
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
        syncMode: data.syncMode,
        isReviewBuild: data.isReviewBuild,
        showCloudDebug: data.showCloudDebug,
        syncDebug: data.syncDebug,
        child: data.child,
        nicknameRequired: isDefaultChildNickname(data.child),
        nicknameInput: isDefaultChildNickname(data.child) ? '' : ((data.child && data.child.nickname) || ''),
        currentMember: data.currentMember,
        identityConfirmVisible: false,
        modeChangedNoticeVisible: false
      }, this.buildStudyModePresentation(data.currentMember))));
      const snapshot = snapshotStore.read(HOME_DASHBOARD_SNAPSHOT_KEY, {
        id: buildHomeDashboardSnapshotId(data.child),
        maxAgeMs: 10 * 60 * 1000
      });
      if (snapshot) {
        this.applyDashboard(Object.assign({}, snapshot, {
          child: data.child || snapshot.child,
          currentMember: data.currentMember || snapshot.currentMember
        }));
      }
      this.startHomeDashboardRefresh();
    } catch (error) {
      wx.showToast({
        title: t('localSwitched'),
        icon: 'none'
      });
    }
  },
  beginHomeDashboardRefresh() {
    this._homeDashboardRefreshId = Number(this._homeDashboardRefreshId || 0) + 1;
    return this._homeDashboardRefreshId;
  },
  invalidateHomeDashboardRefresh() {
    this._homeDashboardRefreshId = Number(this._homeDashboardRefreshId || 0) + 1;
  },
  isHomeDashboardRefreshCurrent(refreshId) {
    return refreshId === this._homeDashboardRefreshId;
  },
  startHomeDashboardRefresh(options = {}) {
    const refreshId = this.beginHomeDashboardRefresh();
    return this.refreshHomeDashboard(Object.assign({}, options, { refreshId })).catch(() => {
      if (this.isHomeDashboardRefreshCurrent(refreshId)) {
        this.setData({ homeLoading: false });
      }
      return this.data.groupedDailyTasks || [];
    });
  },
  async refreshHomeDashboard(options = {}) {
    const refreshId = options.refreshId || this.beginHomeDashboardRefresh();
    const selectedTarget = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const currentChild = this.data.child || {};
    const target = selectedTarget.targetFamilyId || selectedTarget.targetChildId
      ? selectedTarget
      : {
        targetFamilyId: String(currentChild.familyId || '').trim(),
        targetChildId: String(currentChild.childId || '').trim()
      };
    const cached = store.getCachedReadResult
      ? store.getCachedReadResult('getDashboard', Object.assign({ view: 'home' }, target))
      : null;
    if (!options.skipCache && cached && cached.child && this.isHomeDashboardRefreshCurrent(refreshId)) {
      this.applyDashboard(cached);
    }
    const data = await store.getDashboard(Object.assign({ view: 'home', forceRefresh: true }, target), (fresh) => {
      if (!this.isHomeDashboardRefreshCurrent(refreshId)) return;
      const groups = this.applyDashboard(fresh);
      if (options.perf || this.homePerf) {
        (options.perf || this.homePerf).mark('cloudRefresh', {
          groups: groups.length
        });
      }
    });
    if (!this.isHomeDashboardRefreshCurrent(refreshId)) {
      return this.data.groupedDailyTasks || [];
    }
    const groups = this.applyDashboard(data);
    if (options.perf || this.homePerf) {
      (options.perf || this.homePerf).mark('cloudRefresh', {
        groups: groups.length,
        dataFresh: data.syncMode === 'cloud'
      });
    }
    return groups;
  },
  prefetchListeningMaterialHome() {
    const cached = store.getCachedReadResult
      ? store.getCachedReadResult('getMaterialIndex', { moduleId: 'listening' })
      : null;
    if (hasListeningMaterialContent(cached)) {
      writeMaterialHomeSnapshots(cached, 'home-material-cache');
      return;
    }
    store.getMaterialIndex({ moduleId: 'listening' }, (freshIndex) => {
      writeMaterialHomeSnapshots(freshIndex, 'home-material-refresh');
    }).then((materialIndex) => {
      writeMaterialHomeSnapshots(materialIndex, 'home-material-prefetch');
    }).catch(() => {});
  },
  prefetchWritingMaterialHome() {
    const snapshot = snapshotStore.read(getMaterialHomeSnapshotKey('writing'), {
      id: 'writing',
      maxAgeMs: 7 * 24 * 60 * 60 * 1000
    });
    if (snapshot && hasWritingMaterialContent(snapshot.materialIndex)) return;
    const cached = store.getCachedReadResult
      ? store.getCachedReadResult('getMaterialIndex', { moduleId: 'writing' })
      : null;
    if (hasWritingMaterialContent(cached)) {
      writeMaterialHomeSnapshots(cached, 'home-writing-cache');
      return;
    }
    store.getMaterialIndex({ moduleId: 'writing' }, (freshIndex) => {
      writeMaterialHomeSnapshots(freshIndex, 'home-writing-refresh');
    }).then((materialIndex) => {
      writeMaterialHomeSnapshots(materialIndex, 'home-writing-prefetch');
    }).catch(() => {});
  },
  prefetchGrammarHome() {
    const examIds = ['em2', 'em1'];
    examIds.forEach((examId) => {
      const cached = store.getCachedReadResult
        ? store.getCachedReadResult('getGrammarHome', { examId })
        : null;
      if (cached && (cached.topicTypes || []).length) return;
      store.getGrammarHome({ examId }).catch(() => {});
    });
  },
  prefetchReadingHome() {
    const snapshot = snapshotStore.read('readingHomeSnapshotV1', {
      id: 'directory',
      maxAgeMs: 7 * 24 * 60 * 60 * 1000
    });
    if (snapshot && ((snapshot.categoryTree || [])[0] || {}).count) {
      return;
    }
    store.getReadingHome({ directoryOnly: true }, (fresh) => {
      if (fresh && fresh.syncMode !== 'cloud-error' && ((fresh.categoryTree || [])[0] || {}).count) {
        snapshotStore.write('readingHomeSnapshotV1', 'directory', fresh, { source: 'home-reading-refresh' });
      }
    }).then((data) => {
      if (data && data.syncMode !== 'cloud-error' && ((data.categoryTree || [])[0] || {}).count) {
        snapshotStore.write('readingHomeSnapshotV1', 'directory', data, { source: 'home-reading-prefetch' });
      }
    }).catch(() => {});
  },
  prefetchVocabularyHome() {
    store.getFlashcardReview({ scope: 'personal' }).catch(() => {});
  },
  prefetchListeningOverview() {
    const levelId = 'A1';
    const snapshotId = getListeningOverviewSnapshotId(levelId);
    const snapshot = snapshotStore.read(`${LISTENING_PLAN_OVERVIEW_SNAPSHOT_KEY}:${snapshotId}`, {
      id: snapshotId,
      maxAgeMs: 24 * 60 * 60 * 1000
    });
    if (snapshot && (snapshot.materials || []).length) return;
    store.getListeningPlanOverview({ levelId }, (fresh) => {
      writeListeningOverviewSnapshot(fresh, levelId, 'home-level-refresh');
    }).then((data) => {
      writeListeningOverviewSnapshot(data, levelId, 'home-level-prefetch');
    }).catch(() => {});
  },
  prefetchRecordHome() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const dashboardPayload = Object.assign({ view: 'record' }, target);
    const heatmapPayload = Object.assign({ year, month }, target);
    const dashboardCached = store.getCachedReadResult
      ? store.getCachedReadResult('getDashboard', dashboardPayload)
      : null;
    const heatmapCached = store.getCachedReadResult
      ? store.getCachedReadResult('getMonthHeatmap', heatmapPayload)
      : null;
    if (!dashboardCached) {
      store.getDashboard({ view: 'record' }).catch(() => {});
    }
    if (!heatmapCached) {
      store.getMonthHeatmap(year, month).catch(() => {});
    }
  },
  prefetchProfileHome() {
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const familyId = String((target && target.targetFamilyId) || '').trim();
    const childId = String((target && target.targetChildId) || '').trim();
    const snapshotId = familyId || childId ? `target:${familyId}:${childId}` : 'self';
    const snapshotKey = `${PROFILE_SNAPSHOT_KEY}:${snapshotId}`;
    const snapshot = snapshotStore.read(snapshotKey, {
      id: snapshotId,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000
    });
    if (snapshot && snapshot.child && snapshot.child.nickname) return;
    store.getProfileData((fresh) => {
      if (fresh && fresh.syncMode !== 'cloud-error' && fresh.child) {
        snapshotStore.write(snapshotKey, snapshotId, fresh, { source: 'home-profile-refresh' });
      }
    }).then((data) => {
      if (data && data.syncMode !== 'cloud-error' && data.child) {
        snapshotStore.write(snapshotKey, snapshotId, data, { source: 'home-profile-prefetch' });
      }
    }).catch(() => {});
  },
  openTask(event) {
    if (!this.ensureIdentityReady()) return;
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    if (!this.ensureNicknameReady()) {
      return;
    }
    if (category === 'grammar') {
      const group = (this.data.groupedDailyTasks || []).find((item) => item.category === 'grammar');
      const task = group && (group.tasks || []).find((item) => item.taskId === taskId);
      if (!task) return;
      wx.navigateTo({
        url: `/grammar-package/pages/classroom/index?topic=${encodeURIComponent(task.topic || '')}&lessonNumber=${Number(task.lessonNumber || 1)}&taskId=${encodeURIComponent(task.taskId || '')}`
      });
      return;
    }
    const query = taskId
      ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
      : `/pages/lesson/index?category=${category}`;
    this.writeLessonTaskSnapshot(category, taskId);
    wx.navigateTo({
      url: query
    });
  },
  writeLessonTaskSnapshot(category, taskId) {
    const groups = this.data.groupedDailyTasks || [];
    const group = groups.find((item) => item.category === category) || null;
    const task = group
      ? ((group.tasks || []).find((item) => item.taskId === taskId)
        || (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset)
        || (group.tasks || [])[0]
        || group.nextTask)
      : null;
    if (!task) return;
    const safeTaskId = taskId || task.taskId || '';
    snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${safeTaskId}`, {
      category,
      taskId: safeTaskId,
      task
    }, { source: 'home' });
  },
  openListening() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    this.prefetchListeningMaterialHome();
    wx.navigateTo({
      url: '/pages/material/index?module=listening'
    });
  },
  openReading() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    this.prefetchReadingHome();
    wx.navigateTo({
      url: '/pages/reading/index'
    });
  },
  openGrammar() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/grammar/index'
    });
  },
  openTest() {
    if (!this.ensureIdentityReady()) return;
    wx.showToast({
      title: t('testUnavailable'),
      icon: 'none'
    });
  },
  openWriting() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/material/index?module=writing'
    });
  },
  openSpeaking() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/speaking/index'
    });
  },
  openVocabulary() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/reading/flashcards/index'
    });
  },
  openCompleted() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    if (!this.data.homeDataReady) return;
    if (this.data.listeningTaskStatus && this.data.listeningTaskStatus.setupRequired) {
      wx.navigateTo({
        url: '/pages/listening-plan/index?levelId=A1'
      });
      return;
    }
    if (this.data.listeningTaskStatus && this.data.listeningTaskStatus.pending) {
      const activeLesson = readActiveListeningLesson();
      const continueTask = findListeningContinueTask(this.data.groupedDailyTasks, activeLesson);
      const phase = this.data.planSource === 'custom-listening'
        ? 'custom'
        : getCurrentPhaseKey(this.data.planPhaseLabel);
      const taskGroups = buildStageSnapshotTaskGroups(this.data.groupedDailyTasks);
      const totalMinutes = taskGroups.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
      const expandedGroupKey = findNextListeningGroupKey(this.data.groupedDailyTasks);
      const snapshotId = buildStageSnapshotId(this.data.child, phase);
      snapshotStore.write(LEVEL_STAGE_SNAPSHOT_KEY, snapshotId, {
        phase,
        taskGroups,
        totalMinutesText: totalMinutes ? t('minutes', { minutes: totalMinutes }) : t('durationPending'),
        expandedGroupKey
      }, { source: 'home-stage' });
      snapshotStore.write(LEVEL_STAGE_SNAPSHOT_KEY, phase, {
        phase,
        taskGroups,
        totalMinutesText: totalMinutes ? t('minutes', { minutes: totalMinutes }) : t('durationPending'),
        expandedGroupKey
      }, { source: 'home-stage-legacy' });
      wx.navigateTo({
        url: `/pages/level-stage/index?levelId=${phase === 'custom' ? 'custom' : 'A1'}&phase=${phase}&fast=1&snapshotId=${encodeURIComponent(snapshotId)}${expandedGroupKey ? `&expand=${encodeURIComponent(expandedGroupKey)}` : ''}${buildListeningResumeQuery(continueTask, activeLesson)}`
      });
      return;
    }
    writeTodayCompletedCache(this.data.child, this.data.todayCompletedItems || []);
    wx.navigateTo({
      url: buildCompletedUrl(this.data.child)
    });
  },
  openFamilyPage() {
    if (!this.ensureIdentityReady()) return;
    wx.navigateTo({
      url: '/pages/family/index'
    });
  },
  onShareAppMessage() {
    return {
      title: t('brandTitle'),
      path: '/pages/home/index'
    };
  },
  onShareTimeline() {
    return {
      title: t('brandTitle'),
      query: ''
    };
  }
});
