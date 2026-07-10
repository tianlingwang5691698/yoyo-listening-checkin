const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');
const snapshotStore = require('../../utils/snapshot');
const appConfig = require('../../data/app-config');
const effects = require('../../utils/effects');

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const RECORD_HOME_SNAPSHOT_KEY = 'recordHomeSnapshotV1';
const EMPTY_REPORT = {
  ...contracts.createReportDefaults()
};
const EMPTY_DAY_SUMMARY = {
  completedCount: 0,
  totalCount: 0,
  statusText: '未完成',
  minutesText: '0 分钟'
};
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
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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
      label: `第 ${index + 1} 遍`,
      timeText: formatClock(value)
    }))
    .filter((entry) => entry.timeText);
}

function buildMetric(stats, mode) {
  const safeStats = stats || {};
  if (mode === 'total') {
    return {
      heroMetricValue: safeStats.completedDays || 0,
      heroMetricLabel: '累计打卡'
    };
  }
  return {
    heroMetricValue: safeStats.streakDays || 0,
    heroMetricLabel: '连续打卡'
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
    return `${hours}小时${restMinutes}分钟`;
  }
  if (hours) {
    return `${hours}小时`;
  }
  return `${restMinutes}分钟`;
}

function formatStatsDuration(stats) {
  if (stats && stats.heatmapFallback && !Number(stats.totalMinutes || 0)) {
    return '0分钟';
  }
  return formatDuration((stats || {}).totalMinutes);
}

function buildRecordDebugLine(stage, detail) {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const safeDetail = detail || {};
  return [
    `DEBUG: pages/record.onShow -> store.${stage} -> cloud.${safeDetail.action || stage}`,
    `字段：${safeDetail.field || 'stats.totalMinutes'}=${safeDetail.value}`,
    `耗时：client=${safeDetail.clientMs || 0}ms cloud=${safeDetail.cloudMs || 0}ms`,
    `targetChildId=${target.targetChildId || safeDetail.childId || 'self'}`
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
      catchupStatusLabel: '可追赶',
      catchupStatusClass: '',
      catchupCopy: `可点亮 ${state.missedDate || ''}`
    };
  }
  if (state.reason === 'catchup-used-today') {
    return {
      catchupStatusLabel: '今日已用',
      catchupStatusClass: 'is-warn',
      catchupCopy: '明天继续'
    };
  }
  if (state.reason === 'finish-current-plan-first') {
    return {
      catchupStatusLabel: '先完成今日',
      catchupStatusClass: 'is-warn',
      catchupCopy: '完成今日后可追赶'
    };
  }
  return {
    catchupStatusLabel: '无需追赶',
    catchupStatusClass: 'is-muted',
    catchupCopy: '节奏正常'
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
        displayTitle: `第 ${attemptIndex + 1} 次回答`,
        scoreText: attempt.status === 'score-pending' ? '待评分' : `${Number(attempt.score || 0)} 分`
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
    vocabulary: '词汇',
    reading: '阅读',
    grammar: '语法',
    writing: '写作'
  };
  return {
    id: safeItem.id || safeItem.recordId || `${type}:${safeItem.targetId || ''}`,
    type,
    categoryLabel: typeLabels[type] || safeItem.meta || '完成记录',
    title: safeItem.title || typeLabels[type] || '完成记录',
    progressText: safeItem.progressText || safeItem.meta || '已完成',
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
    statusText: completedCount ? '已完成' : (listenedCount ? '有记录' : '未完成'),
    minutesText: `${safeReport.totalMinutes || 0} 分钟`
  };
}

function buildCalendarDaySummary(heatmap, date) {
  const record = (heatmap || []).find((item) => item && item.date === date) || {};
  const count = Number(record.count || 0);
  const completed = !!record.completed || count > 0;
  if (!completed) {
    return EMPTY_DAY_SUMMARY;
  }
  const completedCount = Math.max(count, 1);
  return {
    completedCount,
    totalCount: completedCount,
    statusText: '已完成',
    minutesText: '待加载'
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
    weekLabels: WEEK_LABELS,
    metricMode: 'streak',
    heroMetricValue: 0,
    heroMetricLabel: '连续打卡',
    totalDurationText: '0分钟',
    planDayIndex: 1,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    calendarTitle: '',
    monthCells: [],
    todayDate: getDateKey(new Date()),
    selectedDate: getDateKey(new Date()),
    selectedDateLabel: '',
    selectedDayReport: EMPTY_REPORT,
    selectedDaySummary: EMPTY_DAY_SUMMARY,
    selectedDayLoaded: false,
    selectedDayLoading: false,
    catchupStatusLabel: '无需追赶',
    catchupStatusClass: 'is-muted',
    catchupCopy: '节奏正常',
    catchupState: contracts.createCatchupStateDefaults(),
    catchupTasks: [],
    catchupTasksLoaded: false,
    catchupTasksLoading: false,
    recordDebugLines: [],
    streakMilestoneVisible: false,
    streakMilestoneLabel: ''
  }),
  async onShow() {
    this.recordPerf = page.startPagePerf('record');
    const loadSeq = (this.recordLoadSeq || 0) + 1;
    this.recordLoadSeq = loadSeq;
    page.syncTheme(this);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const refreshToken = page.getHeatmapRefreshToken();
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
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, snapshot, {
        totalDurationText: snapshot.totalDurationText === '待同步'
          ? formatStatsDuration(snapshot.stats)
          : snapshot.totalDurationText,
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
        totalDurationText: '0分钟',
        calendarYear,
        calendarMonth,
        calendarTitle: `${calendarYear}年${calendarMonth}月`,
        todayDate: getDateKey(today),
        selectedDate,
        selectedDateLabel: formatDateLabel(selectedDate),
        selectedDayLoaded: false,
        selectedDayLoading: false,
        selectedDayReport: EMPTY_REPORT,
        selectedDaySummary: EMPTY_DAY_SUMMARY,
        monthCells: buildMonthCells(calendarYear, calendarMonth, [], selectedDate, contracts.createCatchupStateDefaults()),
        catchupState: contracts.createCatchupStateDefaults(),
        catchupTasks: [],
        catchupTasksLoaded: false,
        catchupTasksLoading: false
      }, buildMetric(emptyStats, this.data.metricMode), buildCatchupPresentation(contracts.createCatchupStateDefaults()))));
    }
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
    const dashboardPromise = store.getDashboard({ view: 'record', debug: true }, (fresh) => {
        if (loadSeq !== this.recordLoadSeq) return;
        const cachedHeatmap = this.getCachedMonthData(calendarYear, calendarMonth);
        const nextStats = mergeStatsWithHeatmap(fresh.stats, cachedHeatmap && cachedHeatmap.heatmap);
        const freshState = Object.assign({}, fresh, {
          stats: nextStats,
          totalDurationText: formatStatsDuration(nextStats),
          planDayIndex: fresh.planDayIndex || 1
        });
        this.setData(page.buildCloudPageData(this.data, Object.assign({}, freshState, buildMetric(freshState.stats, this.data.metricMode))));
      });
    const heatmapPromise = this.getMonthHeatmapCached(calendarYear, calendarMonth, { force: true });
    dashboardPromise.then((dashboard) => {
      if (loadSeq !== this.recordLoadSeq) return;
      const dashboardPerf = (dashboard && dashboard.perfDebug) || {};
      const dashboardStages = dashboardPerf.stages || {};
      const cachedHeatmap = this.getCachedMonthData(calendarYear, calendarMonth);
      const nextStats = mergeStatsWithHeatmap(dashboard.stats, cachedHeatmap && cachedHeatmap.heatmap);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, dashboard, {
        stats: nextStats,
        totalDurationText: formatStatsDuration(nextStats),
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
      const nextStats = mergeStatsWithHeatmap(this.data.stats, heatmapData.heatmap);
      this.setData(page.buildCloudPageData(this.data, Object.assign({
        stats: nextStats,
        totalDurationText: formatStatsDuration(nextStats),
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
      const nextStats = mergeStatsWithHeatmap(dashboard.stats, heatmapData.heatmap);
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
          value: formatStatsDuration(nextStats),
          clientMs: Date.now() - dashboardStartedAt,
          cloudMs: dashboardPerf.totalMs || 0,
          childId: dashboardPerf.childId || ''
        })
      ];
      const nextState = Object.assign({}, dashboard, {
        child: dashboard.child,
        stats: nextStats,
        totalDurationText: formatStatsDuration(nextStats),
        recordDebugLines: debugLines,
        calendarYear,
        calendarMonth,
        calendarTitle: `${calendarYear}年${calendarMonth}月`,
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
        { heatmapData, targetPart }
      ), { source: 'record-home' });
      if (this.recordPerf) {
        this.recordPerf.ready('pageReady', {
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
      streakMilestoneLabel: `连续 ${streak} 天`
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
      calendarTitle: `${year}年${month}月`,
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
      wx.showToast({ title: '追赶任务加载失败', icon: 'none' });
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
      wx.showToast({ title: audioType === 'feedback' ? '暂无建议语音' : '暂无录音', icon: 'none' });
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
      wx.showToast({ title: '播放失败', icon: 'none' });
    }
  }
});
