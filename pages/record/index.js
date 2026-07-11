const store = require('../../utils/store');
const cloud = require('../../domain/cloud/index');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');
const snapshotStore = require('../../utils/snapshot');
const appConfig = require('../../app-config');
const effects = require('../../utils/effects');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');

function tr(key) { return i18n.getPageText('record', key); }
function buildTexts() {
  return Object.keys(accountCatalog.record['zh-CN']).reduce((texts, key) => {
    texts[key] = tr(key);
    return texts;
  }, {});
}
function formatText(text, values) {
  return Object.keys(values || {}).reduce((result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), String(text || ''));
}
function getWeekLabels() { return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(tr); }
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const RECORD_HOME_SNAPSHOT_KEY = 'recordHomeSnapshotV2';
const EMPTY_REPORT = {
  ...contracts.createReportDefaults()
};
function getEmptyDaySummary() {
  return { completedCount: 0, totalCount: 0, statusText: tr('notCompleted'), minutesText: tr('zeroMinutes') };
}
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getMonthKey(year, month) {
  return `${year}-${pad(month)}`;
}

function getTargetSnapshotPart() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function getRecordHomeSnapshotId(year, month) {
  return `${getTargetSnapshotPart()}:${getMonthKey(year, month)}`;
}

function getRecordHomeSnapshotKey(year, month) {
  return `${RECORD_HOME_SNAPSHOT_KEY}:${getRecordHomeSnapshotId(year, month)}`;
}

function isValidRecordSnapshot(snapshot, targetPart, year, month) {
  return !!(snapshot
    && snapshot.targetPart === targetPart
    && Number(snapshot.calendarYear || 0) === Number(year || 0)
    && Number(snapshot.calendarMonth || 0) === Number(month || 0)
    && snapshot.heatmapData
    && Array.isArray(snapshot.heatmapData.heatmap));
}

function parseDateKey(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  return formatText(tr('monthDay'), { month: date.getMonth() + 1, day: date.getDate() });
}

function formatClock(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimeLines(item) {
  const playMoments = Array.isArray(item.playMoments) ? item.playMoments : [];
  return playMoments
    .map((value, index) => ({
      key: `${item.category}-${item.taskId || 'task'}-${index}`,
      label: formatText(tr('passNumber'), { count: index + 1 }),
      timeText: formatClock(value)
    }))
    .filter((entry) => entry.timeText);
}

function buildMetric(stats, mode) {
  const safeStats = stats || {};
  if (mode === 'total') {
    return {
      heroMetricValue: safeStats.completedDays || 0,
      heroMetricLabel: tr('totalCheckins')
    };
  }
  return {
    heroMetricValue: safeStats.streakDays || 0,
    heroMetricLabel: tr('streakCheckins')
  };
}

function buildHeatmapStatsFallback(heatmap) {
  const rows = (heatmap || []).filter((item) => item && (item.completed || Number(item.count || 0) > 0));
  if (!rows.length) {
    return null;
  }
  const completedDateMap = rows.reduce((map, item) => {
    map[item.date] = true;
    return map;
  }, {});
  let streakDays = 0;
  let cursor = new Date();
  while (completedDateMap[getDateKey(cursor)]) {
    streakDays += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  const completedTasks = rows.reduce((sum, item) => sum + Math.max(1, Number(item.count || 0)), 0);
  return {
    streakDays,
    completedDays: rows.length,
    completedLessons: rows.length,
    completedTasks,
    totalMinutes: 0,
    heatmapFallback: true
  };
}

function mergeStatsWithHeatmap(stats, heatmap) {
  const safeStats = stats || {};
  const hasStats = Number(safeStats.completedDays || 0) > 0
    || Number(safeStats.completedTasks || 0) > 0
    || Number(safeStats.streakDays || 0) > 0
    || Number(safeStats.totalMinutes || 0) > 0;
  if (hasStats) {
    return safeStats;
  }
  return buildHeatmapStatsFallback(heatmap) || safeStats;
}

function formatDuration(minutes) {
  const totalMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;
  if (hours && restMinutes) {
    return formatText(tr('hoursMinutes'), { hours, minutes: restMinutes });
  }
  if (hours) {
    return formatText(tr('hours'), { hours });
  }
  return formatText(tr('minutes'), { minutes: restMinutes });
}

function formatStatsDuration(stats, options) {
  const pending = !!(options && options.pending);
  const hasActivity = Number((stats && stats.completedDays) || 0) > 0
    || Number((stats && stats.completedTasks) || 0) > 0;
  if (pending && hasActivity && !Number((stats && stats.totalMinutes) || 0)) {
    return tr('syncingDuration');
  }
  if (stats && stats.heatmapFallback && !Number(stats.totalMinutes || 0)) {
    return tr('zeroMinutes').replace(' ', '');
  }
  return formatDuration((stats || {}).totalMinutes);
}

function buildDisplayStats(stats, options) {
  const nextStats = Object.assign({}, stats || {});
  nextStats.totalDurationText = formatStatsDuration(nextStats, options);
  return nextStats;
}

async function getFreshRecordDashboard() {
  const startedAt = Date.now();
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const result = await cloud.callYoyo('getDashboard', Object.assign({
    view: 'record',
    debug: true,
    deviceId: store.getDeviceId(),
    deviceStudyRole: store.getDeviceStudyRole()
  }, target));
  return Object.assign({ syncMode: 'cloud' }, result || {}, {
    __cacheHit: false,
    __elapsedMs: Date.now() - startedAt
  });
}

function buildRecordDebugLine(stage, detail) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const safeDetail = detail || {};
  return [
    `DEBUG: pages/record.onShow -> store.${stage} -> cloud.${safeDetail.action || stage}`,
    `字段：${safeDetail.field || 'stats.totalMinutes'}=${safeDetail.value}`,
    `耗时：client=${safeDetail.clientMs || 0}ms cloud=${safeDetail.cloudMs || 0}ms`,
    `targetChildId=${target.targetChildId || safeDetail.childId || 'self'}`,
    `env=${appConfig.cloudEnvId}`
  ].join('；');
}

function buildRecordPendingDebugLine(stage, startedAt) {
  return buildRecordDebugLine(stage, {
    action: stage,
    field: 'pending',
    value: 'waiting',
    clientMs: Date.now() - startedAt,
    cloudMs: 0
  });
}

function buildCatchupPresentation(catchupState) {
  const state = catchupState || {};
  if (state.canCatchup) {
    return {
      catchupStatusLabel: tr('available'),
      catchupStatusClass: '',
      catchupCopy: formatText(tr('availableCopy'), { date: state.missedDate || '' })
    };
  }
  if (state.reason === 'catchup-used-today') {
    return {
      catchupStatusLabel: tr('usedToday'),
      catchupStatusClass: 'is-warn',
      catchupCopy: tr('tomorrow')
    };
  }
  if (state.reason === 'finish-current-plan-first') {
    return {
      catchupStatusLabel: tr('finishTodayFirst'),
      catchupStatusClass: 'is-warn',
      catchupCopy: tr('finishTodayCopy')
    };
  }
  return {
    catchupStatusLabel: tr('notNeeded'),
    catchupStatusClass: 'is-muted',
    catchupCopy: tr('normalRhythm')
  };
}

function buildMonthCells(year, month, heatmap, selectedDate, catchupState) {
  const heatmapMap = {};
  (heatmap || []).forEach((item) => {
    heatmapMap[item.date] = item;
  });
  const todayKey = getDateKey(new Date());
  const catchupTarget = (catchupState && catchupState.missedDate) || '';
  const firstDate = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDate.getDay(); i += 1) {
    cells.push({
      key: `blank-${i}`,
      isBlank: true
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const record = heatmapMap[date] || {};
    cells.push({
      key: date,
      date,
      dayText: day,
      intensity: record.intensity || 0,
      completed: !!record.completed,
      isToday: date === todayKey,
      isSelected: date === selectedDate,
      isCatchupTarget: catchupTarget === date
    });
  }
  return cells;
}

function addMonths(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function isFutureMonth(year, month) {
  const today = new Date();
  return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
}

function normalizeReport(report) {
  const safeReport = report || {};
  const speakingAttempts = safeReport.speakingAttempts || [];
  const items = (safeReport.items || []).map((item) => {
    const normalized = labels.normalizeReportItem(item);
    const attempts = speakingAttempts
      .filter((attempt) => (
        attempt.category === normalized.category
        && (attempt.taskId === normalized.taskId || attempt.taskId === normalized.originalTaskId)
      ))
      .map((attempt, attemptIndex) => Object.assign({}, attempt, {
        displayTitle: formatText(tr('attemptNumber'), { count: attemptIndex + 1 }),
        scoreText: attempt.status === 'score-pending' ? tr('scorePending') : formatText(tr('score'), { score: Number(attempt.score || 0) })
      }));
    return Object.assign({}, normalized, {
      timeLines: buildTimeLines(normalized),
      type: attempts.length ? 'speaking' : 'listening',
      attempts,
      attemptCount: attempts.length,
      latestAttemptScore: attempts.length ? Number(attempts[attempts.length - 1].score || 0) : 0,
      expanded: false
    });
  });
  return Object.assign({}, safeReport, {
    items,
    totalMinutes: safeReport.totalMinutes || 0,
    completedCategories: safeReport.completedCategories || []
  });
}

function normalizeCompletionItem(item) {
  const safeItem = item || {};
  const type = String(safeItem.type || '');
  const typeLabels = {
    vocabulary: tr('vocabulary'),
    reading: tr('reading'),
    grammar: tr('grammar'),
    writing: tr('writing')
  };
  return {
    id: safeItem.id || safeItem.recordId || `${type}:${safeItem.targetId || ''}`,
    targetId: safeItem.targetId || '',
    passageId: safeItem.passageId || (type === 'reading' ? safeItem.targetId || '' : ''),
    type,
    categoryLabel: typeLabels[type] || safeItem.meta || tr('completionRecord'),
    title: safeItem.title || typeLabels[type] || tr('completionRecord'),
    progressText: safeItem.progressText || safeItem.meta || tr('completed'),
    completedToday: safeItem.completedToday !== false,
    playCount: '',
    repeatTarget: '',
    isStudyCompletion: true,
    latestAttempt: safeItem.latestAttempt || null
  };
}

function mergeReportWithCompletions(report, completions) {
  const normalizedReport = normalizeReport(report);
  const completionItems = (completions || []).map(normalizeCompletionItem);
  return Object.assign({}, normalizedReport, {
    items: (normalizedReport.items || []).concat(completionItems)
  });
}

function buildDaySummary(report) {
  const safeReport = report || EMPTY_REPORT;
  const items = safeReport.items || [];
  const completedCount = items.filter((item) => item.completedToday).length;
  const listenedCount = items.filter((item) => Number(item.playCount || 0) > 0).length;
  const totalCount = items.length;
  return {
    completedCount,
    totalCount,
    statusText: completedCount ? tr('completed') : (listenedCount ? tr('hasRecord') : tr('notCompleted')),
    minutesText: formatText(tr('minutes'), { minutes: safeReport.totalMinutes || 0 })
  };
}

function buildCalendarDaySummary(heatmap, date) {
  const record = (heatmap || []).find((item) => item && item.date === date) || {};
  const count = Number(record.count || 0);
  const completed = !!record.completed || count > 0;
  if (!completed) {
    return getEmptyDaySummary();
  }
  const completedCount = Math.max(count, 1);
  return {
    completedCount,
    totalCount: completedCount,
    statusText: tr('completed'),
    minutesText: tr('loading')
  };
}

function markSelectedCells(cells, selectedDate) {
  return (cells || []).map((item) => Object.assign({}, item, {
    isSelected: item.date === selectedDate
  }));
}

function buildLessonQuery(params) {
  return Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

Page({
  monthCache: {},
  monthRequests: {},
  calendarLoadVersion: 0,
  deferredLoadTimer: null,
  lastHeatmapRefreshToken: 0,
  data: page.createCloudPageData({
    child: contracts.createChildDefaults(),
    stats: contracts.createStatsDefaults(),
    weekLabels: getWeekLabels(),
    metricMode: 'streak',
    heroMetricValue: 0,
    heroMetricLabel: tr('streakCheckins'),
    totalDurationText: tr('zeroMinutes').replace(' ', ''),
    planDayIndex: 1,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    calendarTitle: '',
    monthCells: [],
    todayDate: getDateKey(new Date()),
    selectedDate: getDateKey(new Date()),
    selectedDateLabel: '',
    selectedDayReport: EMPTY_REPORT,
    selectedDaySummary: getEmptyDaySummary(),
    selectedDayLoaded: false,
    selectedDayLoading: false,
    catchupStatusLabel: tr('notNeeded'),
    catchupStatusClass: 'is-muted',
    catchupCopy: tr('normalRhythm'),
    catchupState: contracts.createCatchupStateDefaults(),
    catchupTasks: [],
    catchupTasksLoaded: false,
    catchupTasksLoading: false,
    recordDebugLines: [],
    streakMilestoneVisible: false,
    streakMilestoneLabel: '',
    texts: buildTexts()
  }),
  async onShow() {
    this.recordPerf = page.startPagePerf('record');
    const loadSeq = (this.recordLoadSeq || 0) + 1;
    this.recordLoadSeq = loadSeq;
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData(Object.assign({
      texts,
      language: i18n.getLanguage(),
      weekLabels: getWeekLabels(),
      calendarTitle: formatText(tr('calendarTitle'), { year: this.data.calendarYear, month: this.data.calendarMonth }),
      selectedDateLabel: formatDateLabel(this.data.selectedDate),
      totalDurationText: formatStatsDuration(this.data.stats, { pending: true }),
      selectedDaySummary: this.data.selectedDayLoaded ? buildDaySummary(this.data.selectedDayReport) : getEmptyDaySummary()
    }, buildMetric(this.data.stats, this.data.metricMode), buildCatchupPresentation(this.data.catchupState)));
    wx.setNavigationBarTitle({ title: texts.navTitle });
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
    if (!page.requireIdentityConfirmed()) {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.recordPerf.ready('pageReady', {
        source: 'identity-blocked',
        cacheHit: true,
        cells: (this.data.monthCells || []).length
      });
      return;
    }
    const refreshToken = page.getHeatmapRefreshToken();
    const previousRefreshToken = Number(this.lastHeatmapRefreshToken || 0);
    this.shouldCelebrateFreshCompletion = store.getDeviceStudyRole() === 'student'
      && refreshToken > previousRefreshToken;
    if (refreshToken !== this.lastHeatmapRefreshToken) {
      this.monthCache = {};
      this.monthRequests = {};
      this.lastHeatmapRefreshToken = refreshToken;
    }
    const today = new Date();
    const selectedDate = this.data.selectedDate || getDateKey(today);
    const calendarYear = this.data.calendarYear || today.getFullYear();
    const calendarMonth = this.data.calendarMonth || today.getMonth() + 1;
    const targetPart = getTargetSnapshotPart();
    if (targetPart !== this.lastRecordTargetPart) {
      this.monthCache = {};
      this.monthRequests = {};
      this.lastRecordTargetPart = targetPart;
    }
    const snapshotId = getRecordHomeSnapshotId(calendarYear, calendarMonth);
    const snapshot = snapshotStore.read(getRecordHomeSnapshotKey(calendarYear, calendarMonth), {
      id: snapshotId,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000
    }) || snapshotStore.read(RECORD_HOME_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000
    });
    if (isValidRecordSnapshot(snapshot, targetPart, calendarYear, calendarMonth)) {
      this.monthCache[getMonthKey(calendarYear, calendarMonth)] = snapshot.heatmapData || {
        heatmap: [],
        catchupState: snapshot.catchupState || this.data.catchupState
      };
      const snapshotHeatmap = (snapshot.heatmapData && snapshot.heatmapData.heatmap) || [];
      const snapshotStats = buildDisplayStats(snapshot.stats, { pending: true });
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, snapshot, {
        stats: snapshotStats,
        totalDurationText: snapshotStats.totalDurationText,
        selectedDayLoaded: false,
        selectedDayLoading: false,
        selectedDayReport: EMPTY_REPORT,
        selectedDaySummary: buildCalendarDaySummary(snapshotHeatmap, selectedDate)
      })));
      this.scheduleDeferredLoads(calendarYear, calendarMonth, selectedDate);
      if (this.recordPerf) {
        this.recordPerf.ready('pageReady', {
          source: 'snapshot',
          cacheHit: true,
          cells: (this.data.monthCells || []).length
        });
      }
    } else {
      const emptyStats = contracts.createStatsDefaults();
      this.setData(page.buildCloudPageData(this.data, Object.assign({
        stats: emptyStats,
        totalDurationText: tr('syncingDuration'),
        calendarYear,
        calendarMonth,
        calendarTitle: formatText(tr('calendarTitle'), { year: calendarYear, month: calendarMonth }),
        todayDate: getDateKey(today),
        selectedDate,
        selectedDateLabel: formatDateLabel(selectedDate),
        selectedDayLoaded: false,
        selectedDayLoading: false,
        selectedDayReport: EMPTY_REPORT,
        selectedDaySummary: getEmptyDaySummary(),
        monthCells: buildMonthCells(calendarYear, calendarMonth, [], selectedDate, contracts.createCatchupStateDefaults()),
        catchupState: contracts.createCatchupStateDefaults(),
        catchupTasks: [],
        catchupTasksLoaded: false,
        catchupTasksLoading: false
      }, buildMetric(emptyStats, this.data.metricMode), buildCatchupPresentation(contracts.createCatchupStateDefaults()))));
    }
    await new Promise((resolve) => wx.nextTick(resolve));
    this.recordPerf.ready('pageReady', {
      source: snapshot ? 'snapshot' : 'fallback',
      cacheHit: !!snapshot,
      cells: (this.data.monthCells || []).length
    });
    const dashboardStartedAt = Date.now();
    const heatmapStartedAt = Date.now();
    this.clearRecordDebugTimer();
    this.setData({
      recordDebugLines: [
        buildRecordPendingDebugLine('getDashboard', dashboardStartedAt),
        buildRecordPendingDebugLine('getMonthHeatmap', heatmapStartedAt)
      ]
    });
    this.recordDebugTimer = setTimeout(() => {
      if (loadSeq !== this.recordLoadSeq) return;
      this.recordDebugTimer = null;
      this.setData({
        recordDebugLines: [
          buildRecordPendingDebugLine('getDashboard', dashboardStartedAt),
          buildRecordPendingDebugLine('getMonthHeatmap', heatmapStartedAt)
        ]
      });
    }, 3000);
    const dashboardPromise = getFreshRecordDashboard();
    const heatmapPromise = this.getMonthHeatmapCached(calendarYear, calendarMonth, { force: true });
    dashboardPromise.then((dashboard) => {
      if (loadSeq !== this.recordLoadSeq) return;
      const dashboardPerf = (dashboard && dashboard.perfDebug) || {};
      const dashboardStages = dashboardPerf.stages || {};
      const cachedHeatmap = this.getCachedMonthData(calendarYear, calendarMonth);
      const nextStats = buildDisplayStats(mergeStatsWithHeatmap(dashboard.stats, cachedHeatmap && cachedHeatmap.heatmap));
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, dashboard, {
        stats: nextStats,
        totalDurationText: nextStats.totalDurationText,
        recordDebugLines: [
          buildRecordDebugLine('getDashboard', {
            action: 'getDashboard',
            field: 'stats.totalMinutes',
            value: Number((dashboard.stats && dashboard.stats.totalMinutes) || 0),
            clientMs: dashboard.__elapsedMs || (Date.now() - dashboardStartedAt),
            cloudMs: dashboardPerf.totalMs || 0,
            childId: dashboardPerf.childId || ''
          }),
          buildRecordDebugLine('getDashboard', {
            action: 'getDashboard',
            field: 'perf.stages',
            value: `records=${dashboardStages.records || 0}ms activePlan=${dashboardStages.activePlan || 0}ms stats=${dashboardStages.stats || 0}ms`,
            clientMs: dashboard.__elapsedMs || (Date.now() - dashboardStartedAt),
            cloudMs: dashboardPerf.totalMs || 0,
            childId: dashboardPerf.childId || ''
          }),
          buildRecordPendingDebugLine('getMonthHeatmap', heatmapStartedAt)
        ]
      }, buildMetric(nextStats, this.data.metricMode))));
    }).catch(() => {});
    heatmapPromise.then((heatmapData) => {
      if (loadSeq !== this.recordLoadSeq) return;
      const nextStats = buildDisplayStats(mergeStatsWithHeatmap(this.data.stats, heatmapData.heatmap));
      this.setData(page.buildCloudPageData(this.data, Object.assign({
        stats: nextStats,
        totalDurationText: nextStats.totalDurationText,
        selectedDaySummary: buildCalendarDaySummary(heatmapData.heatmap, selectedDate),
        monthCells: buildMonthCells(calendarYear, calendarMonth, heatmapData.heatmap, selectedDate, heatmapData.catchupState),
        catchupState: heatmapData.catchupState,
        recordDebugLines: [
          buildRecordDebugLine('getMonthHeatmap', {
            action: 'getMonthHeatmap',
            field: 'heatmap.length',
            value: (heatmapData.heatmap || []).length,
            clientMs: heatmapData.__elapsedMs || (Date.now() - heatmapStartedAt),
            cloudMs: 0
          })
        ]
      }, buildMetric(nextStats, this.data.metricMode), buildCatchupPresentation(heatmapData.catchupState))));
    }).catch(() => {});
    Promise.all([
      dashboardPromise,
      heatmapPromise
    ]).then(([dashboard, heatmapData]) => {
      if (loadSeq !== this.recordLoadSeq) return;
      this.clearRecordDebugTimer();
      const catchupPresentation = buildCatchupPresentation(heatmapData.catchupState);
      const nextStats = buildDisplayStats(mergeStatsWithHeatmap(dashboard.stats, heatmapData.heatmap));
      const dashboardPerf = (dashboard && dashboard.perfDebug) || {};
      const dashboardStages = dashboardPerf.stages || {};
      const debugLines = [
        buildRecordDebugLine('getDashboard', {
          action: 'getDashboard',
          field: 'stats.totalMinutes',
          value: Number((dashboard.stats && dashboard.stats.totalMinutes) || 0),
          clientMs: dashboard.__elapsedMs || (Date.now() - dashboardStartedAt),
          cloudMs: dashboardPerf.totalMs || 0,
          childId: dashboardPerf.childId || ''
        }),
        buildRecordDebugLine('getDashboard', {
          action: 'getDashboard',
          field: 'perf.stages',
          value: `records=${dashboardStages.records || 0}ms activePlan=${dashboardStages.activePlan || 0}ms stats=${dashboardStages.stats || 0}ms`,
          clientMs: dashboard.__elapsedMs || (Date.now() - dashboardStartedAt),
          cloudMs: dashboardPerf.totalMs || 0,
          childId: dashboardPerf.childId || ''
        }),
        buildRecordDebugLine('getMonthHeatmap', {
          action: 'getMonthHeatmap',
          field: 'heatmap.length',
          value: (heatmapData.heatmap || []).length,
          clientMs: heatmapData.__elapsedMs || (Date.now() - heatmapStartedAt),
          cloudMs: 0,
          childId: dashboardPerf.childId || ''
        }),
        buildRecordDebugLine('mergeStatsWithHeatmap', {
          action: 'front.mergeStatsWithHeatmap',
          field: 'display.totalDurationText',
          value: nextStats.totalDurationText,
          clientMs: Date.now() - dashboardStartedAt,
          cloudMs: dashboardPerf.totalMs || 0,
          childId: dashboardPerf.childId || ''
        })
      ];
      const nextState = Object.assign({}, dashboard, {
        child: dashboard.child,
        stats: nextStats,
        totalDurationText: nextStats.totalDurationText,
        recordDebugLines: debugLines,
        calendarYear,
        calendarMonth,
        calendarTitle: formatText(tr('calendarTitle'), { year: calendarYear, month: calendarMonth }),
        todayDate: getDateKey(today),
        selectedDate,
        selectedDateLabel: formatDateLabel(selectedDate),
        selectedDayLoaded: false,
        selectedDayLoading: false,
        selectedDayReport: EMPTY_REPORT,
        selectedDaySummary: buildCalendarDaySummary(heatmapData.heatmap, selectedDate),
        monthCells: buildMonthCells(calendarYear, calendarMonth, heatmapData.heatmap, selectedDate, heatmapData.catchupState),
        catchupState: heatmapData.catchupState,
        catchupTasks: [],
        catchupTasksLoaded: false,
        catchupTasksLoading: false,
        planDayIndex: dashboard.planDayIndex || 1
      });
      this.setData(page.buildCloudPageData(this.data, Object.assign(
        {},
        nextState,
        buildMetric(nextState.stats, this.data.metricMode),
        catchupPresentation
      )));
      this.showStreakMilestoneIfNeeded(nextState.stats);
      snapshotStore.write(getRecordHomeSnapshotKey(calendarYear, calendarMonth), snapshotId, Object.assign(
        {},
        nextState,
        buildMetric(nextState.stats, this.data.metricMode),
        catchupPresentation,
        { heatmapData, targetPart, recordDebugLines: [] }
      ), { source: 'record-home' });
      if (this.recordPerf) {
        this.recordPerf.mark('cloudRefresh', {
          cacheHit: !!dashboard.__cacheHit && !!heatmapData.__cacheHit,
          dashboardCacheHit: !!dashboard.__cacheHit,
          heatmapCacheHit: !!heatmapData.__cacheHit,
          cells: nextState.monthCells.length
        });
      }
      this.scheduleDeferredLoads(calendarYear, calendarMonth, selectedDate);
    }).catch((error) => {
      this.clearRecordDebugTimer();
      this.setData({
        recordDebugLines: [
          buildRecordDebugLine('recordLoad', {
            action: 'Promise.all',
            field: 'error',
            value: String((error && (error.message || error.errMsg)) || error || 'unknown'),
            clientMs: Date.now() - dashboardStartedAt,
            cloudMs: 0
          })
        ]
      });
    });
  },
  onHide() {
    this.clearDeferredLoads();
    this.clearMilestoneTimer();
    this.clearRecordDebugTimer();
  },
  clearRecordDebugTimer() {
    if (this.recordDebugTimer) {
      clearTimeout(this.recordDebugTimer);
      this.recordDebugTimer = null;
    }
  },
  clearMilestoneTimer() {
    if (this.milestoneTimer) {
      clearTimeout(this.milestoneTimer);
      this.milestoneTimer = null;
    }
  },
  showStreakMilestoneIfNeeded(stats) {
    if (!this.shouldCelebrateFreshCompletion || store.getDeviceStudyRole() !== 'student') return;
    this.shouldCelebrateFreshCompletion = false;
    const streak = Number((stats && stats.streakDays) || 0);
    if (!STREAK_MILESTONES.includes(streak)) return;
    const key = `streakMilestoneSfx:${getTargetSnapshotPart()}:${streak}`;
    try {
      if (wx.getStorageSync(key)) return;
      wx.setStorageSync(key, true);
    } catch (error) {}
    this.clearMilestoneTimer();
    effects.playComplete({ voiceKey: 'streakMilestone' });
    this.setData({
      streakMilestoneVisible: true,
      streakMilestoneLabel: formatText(tr('streakDays'), { count: streak })
    });
    this.milestoneTimer = setTimeout(() => {
      this.milestoneTimer = null;
      this.setData({ streakMilestoneVisible: false });
    }, 2200);
  },
  clearDeferredLoads() {
    if (this.deferredLoadTimer) {
      clearTimeout(this.deferredLoadTimer);
      this.deferredLoadTimer = null;
    }
  },
  scheduleDeferredLoads(calendarYear, calendarMonth, selectedDate) {
    this.clearDeferredLoads();
    this.deferredLoadTimer = setTimeout(() => {
      this.deferredLoadTimer = null;
      this.preloadAdjacentMonths(calendarYear, calendarMonth);
    }, 350);
  },
  getCachedMonthData(year, month) {
    return this.monthCache[getMonthKey(year, month)] || null;
  },
  async getMonthHeatmapCached(year, month, options) {
    const key = getMonthKey(year, month);
    const shouldForce = !!(options && options.force);
    if (!shouldForce && this.monthCache[key]) {
      this.monthCache[key].__cacheHit = true;
      return this.monthCache[key];
    }
    if (!shouldForce && this.monthRequests[key]) {
      return this.monthRequests[key];
    }
    const applyData = (data) => {
      const safeData = data || {};
      this.monthCache[key] = {
        heatmap: safeData.heatmap || [],
        catchupState: safeData.catchupState || this.data.catchupState,
        __elapsedMs: safeData.__elapsedMs || 0,
        __cacheHit: !!safeData.__cacheHit
      };
      if (this.data.calendarYear === year && this.data.calendarMonth === month) {
        this.refreshMonthCellsFromCache();
      }
      return this.monthCache[key];
    };
    const request = store.getMonthHeatmap(year, month, applyData).then((data) => {
      applyData(data);
      delete this.monthRequests[key];
      return this.monthCache[key];
    }).catch((error) => {
      delete this.monthRequests[key];
      throw error;
    });
    this.monthRequests[key] = request;
    return request;
  },
  preloadAdjacentMonths(year, month) {
    [addMonths(year, month, -1), addMonths(year, month, 1)].forEach((item) => {
      if (!isFutureMonth(item.year, item.month)) {
        this.getMonthHeatmapCached(item.year, item.month).then(() => {
          if (this.data.calendarYear === year && this.data.calendarMonth === month) {
            this.refreshMonthCellsFromCache();
          }
        }).catch(() => {});
      }
    });
  },
  refreshMonthCellsFromCache() {
    const heatmapData = this.getCachedMonthData(this.data.calendarYear, this.data.calendarMonth) || { heatmap: [] };
    const nextState = {
      monthCells: buildMonthCells(this.data.calendarYear, this.data.calendarMonth, heatmapData.heatmap, this.data.selectedDate, this.data.catchupState)
    };
    if (!this.data.selectedDayLoaded) {
      nextState.selectedDaySummary = buildCalendarDaySummary(heatmapData.heatmap, this.data.selectedDate);
    }
    this.setData(nextState);
  },
  async loadCalendar(year, month, selectedDate) {
    this.calendarLoadVersion += 1;
    const loadVersion = this.calendarLoadVersion;
    const cachedData = this.getCachedMonthData(year, month) || { heatmap: [], catchupState: this.data.catchupState };
    this.setData(page.buildCloudPageData(this.data, Object.assign({
      calendarYear: year,
      calendarMonth: month,
      calendarTitle: formatText(tr('calendarTitle'), { year, month }),
      selectedDate,
      selectedDateLabel: formatDateLabel(selectedDate),
      selectedDayLoaded: false,
      selectedDayLoading: false,
      selectedDayReport: EMPTY_REPORT,
      selectedDaySummary: buildCalendarDaySummary(cachedData.heatmap, selectedDate),
      monthCells: buildMonthCells(year, month, cachedData.heatmap, selectedDate, this.data.catchupState)
    }, buildCatchupPresentation(this.data.catchupState))));
    const heatmapData = await this.getMonthHeatmapCached(year, month, { force: true });
    if (loadVersion !== this.calendarLoadVersion) {
      return;
    }
    this.setData(page.buildCloudPageData(this.data, Object.assign({
      monthCells: buildMonthCells(year, month, heatmapData.heatmap, selectedDate, heatmapData.catchupState),
      selectedDaySummary: buildCalendarDaySummary(heatmapData.heatmap, selectedDate),
      catchupState: heatmapData.catchupState
    }, buildCatchupPresentation(heatmapData.catchupState))));
    this.preloadAdjacentMonths(year, month);
  },
  async loadSelectedDay(input) {
    const date = typeof input === 'string'
      ? input
      : (input && input.currentTarget && input.currentTarget.dataset && input.currentTarget.dataset.date) || this.data.selectedDate;
    if (!date || this.data.selectedDayLoading) {
      return;
    }
    this.setData({
      selectedDayLoading: true
    });
    let reportData = null;
    let completionData = null;
    const applyData = () => {
      if (!reportData) {
        return;
      }
      const selectedDayReport = mergeReportWithCompletions(
        reportData && reportData.report,
        completionData && completionData.items
      );
      this.setData({
        selectedDayReport,
        selectedDaySummary: buildDaySummary(selectedDayReport),
        selectedDayLoaded: true,
        selectedDayLoading: false,
        selectedDateLabel: formatDateLabel(date)
      });
    };
    const [data, completions] = await Promise.all([
      store.getDailyReportByDate(date, (fresh) => {
        reportData = fresh;
        applyData();
      }),
      store.getStudyCompletions({ date }, (freshCompletions) => {
        completionData = freshCompletions;
        applyData();
      })
    ]);
    reportData = data;
    completionData = completions;
    applyData();
  },
  async loadCatchupTasks() {
    if (!this.data.catchupState || !this.data.catchupState.canCatchup || this.data.catchupTasksLoading) {
      return;
    }
    this.setData({ catchupTasksLoading: true });
    const applyData = (heatmapData) => {
      this.setData(page.buildCloudPageData(this.data, Object.assign({
        catchupTasks: labels.normalizeTaskList(heatmapData.catchupTasks || []),
        catchupState: heatmapData.catchupState || this.data.catchupState,
        catchupTasksLoaded: true,
        catchupTasksLoading: false
      }, buildCatchupPresentation(heatmapData.catchupState || this.data.catchupState))));
      this.refreshMonthCellsFromCache();
    };
    try {
      const heatmapData = await store.getHeatmap(42, applyData);
      applyData(heatmapData);
    } catch (error) {
      this.setData({ catchupTasksLoading: false });
      wx.showToast({ title: this.data.texts.catchupLoadFailed, icon: 'none' });
    }
  },
  switchMetric(event) {
    const mode = event.currentTarget.dataset.mode || 'streak';
    this.setData(Object.assign({
      metricMode: mode
    }, buildMetric(this.data.stats, mode)));
  },
  async switchMonth(event) {
    const direction = Number(event.currentTarget.dataset.direction || 0);
    if (!direction) {
      return;
    }
    const current = new Date(this.data.calendarYear, this.data.calendarMonth - 1 + direction, 1);
    const today = new Date();
    const nextYear = current.getFullYear();
    const nextMonth = current.getMonth() + 1;
    if (nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonth > today.getMonth() + 1)) {
      return;
    }
    const selectedDate = nextYear === today.getFullYear() && nextMonth === today.getMonth() + 1
      ? getDateKey(today)
      : `${nextYear}-${pad(nextMonth)}-01`;
    await this.loadCalendar(nextYear, nextMonth, selectedDate);
  },
  async pickDate(event) {
    const date = event.detail.value;
    if (!date) {
      return;
    }
    await this.goToDate(date);
  },
  async goToDate(date) {
    const target = parseDateKey(date);
    const today = new Date();
    if (target > today) {
      return;
    }
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    await this.loadCalendar(year, month, date);
  },
  async selectDate(event) {
    const date = event.currentTarget.dataset.date;
    if (!date) {
      return;
    }
    this.setData({
      selectedDate: date,
      selectedDateLabel: formatDateLabel(date),
      selectedDayLoaded: false,
      selectedDayLoading: false,
      selectedDayReport: EMPTY_REPORT,
      selectedDaySummary: buildCalendarDaySummary((this.getCachedMonthData(this.data.calendarYear, this.data.calendarMonth) || {}).heatmap, date),
      monthCells: markSelectedCells(this.data.monthCells, date)
    });
  },
  openCatchupTask(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    if (!category || !taskId || !this.data.catchupState || !this.data.catchupState.canCatchup) {
      return;
    }
    const targetDate = this.data.catchupState.missedDate || '';
    const planDayIndex = this.data.catchupState.planDayIndex || '';
    const task = (this.data.catchupTasks || []).find((item) => item.category === category && item.taskId === taskId);
    if (task) {
      snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
        category,
        taskId,
        task: Object.assign({}, task, {
          targetDate,
          planDayIndex
        })
      }, { source: 'record-catchup' });
    }
    wx.navigateTo({
      url: `/pages/lesson/index?category=${category}&taskId=${taskId}&planRunType=catchup&targetDate=${targetDate}&planDayIndex=${planDayIndex}`
    });
  },
  openReportItem(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const item = (this.data.selectedDayReport.items || [])[index];
    if (!item) return;
    if (item.isStudyCompletion && item.type === 'reading' && item.passageId) {
      const attemptId = item.latestAttempt && (item.latestAttempt.attemptId || item.latestAttempt._id) || '';
      wx.navigateTo({
        url: `/pages/reading/detail/index?passageId=${encodeURIComponent(item.passageId)}&attemptId=${encodeURIComponent(attemptId)}`
      });
      return;
    }
    if (item.type === 'speaking' && item.attempts && item.attempts.length) {
      const report = Object.assign({}, this.data.selectedDayReport);
      const items = (report.items || []).slice();
      items[index] = Object.assign({}, item, { expanded: !item.expanded });
      report.items = items;
      this.setData({ selectedDayReport: report });
      return;
    }
    if (item.category && item.taskId) {
      const report = this.data.selectedDayReport || {};
      const planDayIndex = Number(report.planDayIndex || item.planDayIndex || 0) || this.data.planDayIndex || '';
      const targetDate = report.date || this.data.selectedDate || '';
      snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${item.category}:${item.taskId}`, {
        category: item.category,
        taskId: item.taskId,
        task: Object.assign({}, item.taskSnapshot || {}, item, {
          targetDate,
          planDayIndex
        })
      }, { source: 'record' });
      const query = buildLessonQuery({
        category: item.category,
        taskId: item.taskId,
        planRunType: 'preview',
        targetDate,
        planDayIndex
      });
      wx.navigateTo({
        url: `/pages/lesson/index?${query}`
      });
    }
  },
  async playAttempt(event) {
    const itemIndex = Number(event.currentTarget.dataset.itemIndex || 0);
    const attemptIndex = Number(event.currentTarget.dataset.attemptIndex || 0);
    const audioType = String(event.currentTarget.dataset.audioType || 'answer');
    const item = (this.data.selectedDayReport.items || [])[itemIndex] || {};
    const attempt = (item.attempts || [])[attemptIndex] || null;
    if (!attempt) return;
    const fileId = audioType === 'feedback'
      ? (attempt.feedbackAudioFileId || buildCloudFileId(attempt.feedbackAudioCloudPath))
      : (attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath));
    if (!fileId) {
      wx.showToast({ title: audioType === 'feedback' ? this.data.texts.noSuggestionAudio : this.data.texts.noRecording, icon: 'none' });
      return;
    }
    try {
      const url = await store.getTempFileURL(fileId);
      if (!this.audioContext) {
        this.audioContext = wx.createInnerAudioContext();
        this.audioContext.obeyMuteSwitch = false;
      }
      this.audioContext.stop();
      this.audioContext.src = url;
      this.audioContext.play();
    } catch (error) {
      wx.showToast({ title: this.data.texts.playbackFailed, icon: 'none' });
    }
  }
});
