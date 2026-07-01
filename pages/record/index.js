const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const EMPTY_REPORT = {
  ...contracts.createReportDefaults()
};
const EMPTY_DAY_SUMMARY = {
  completedCount: 0,
  totalCount: 0,
  statusText: '未完成',
  minutesText: '0 分钟'
};

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getMonthKey(year, month) {
  return `${year}-${pad(month)}`;
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

function markSelectedCells(cells, selectedDate) {
  return (cells || []).map((item) => Object.assign({}, item, {
    isSelected: item.date === selectedDate
  }));
}

function buildRecentDates(todayKey, days) {
  const today = parseDateKey(todayKey);
  const list = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    list.push(getDateKey(date));
  }
  return list;
}

function buildRecentDayItem(report) {
  const normalized = normalizeReport(report);
  const summary = buildDaySummary(normalized);
  return {
    date: normalized.date || '',
    label: formatDateLabel(normalized.date || ''),
    statusText: summary.statusText,
    countText: `${summary.completedCount} / ${summary.totalCount}`,
    minutesText: summary.minutesText,
    isCompleted: summary.completedCount > 0
  };
}

function buildWritingAttemptItem(item, index) {
  const attempt = item || {};
  const createdAt = attempt.createdAt || '';
  return Object.assign({}, attempt, {
    key: attempt.attemptId || `${attempt.promptId || 'writing'}-${createdAt || index}`,
    dateLabel: attempt.date ? formatDateLabel(attempt.date) : '',
    timeText: formatClock(createdAt),
    scoreText: `${Number(attempt.score || 0)} / ${Number(attempt.totalScore || 20)} 分`,
    expanded: false
  });
}

Page({
  monthCache: {},
  monthRequests: {},
  calendarLoadVersion: 0,
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
    selectedDayLoading: false,
    recentDays: [],
    recentDaysLoading: false,
    catchupStatusLabel: '无需追赶',
    catchupStatusClass: 'is-muted',
    catchupCopy: '节奏正常',
    catchupState: contracts.createCatchupStateDefaults(),
    catchupTasks: [],
    writingAttempts: [],
    writingAttemptsLoading: false
  }),
  async onShow() {
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
    const [dashboard, heatmapData] = await Promise.all([
      store.getDashboard({ view: 'record' }, (fresh) => {
        const freshState = Object.assign({}, fresh, {
          totalDurationText: formatDuration((fresh.stats || {}).totalMinutes),
          planDayIndex: fresh.planDayIndex || 1
        });
        this.setData(page.buildCloudPageData(this.data, Object.assign({}, freshState, buildMetric(freshState.stats, this.data.metricMode))));
      }),
      this.getMonthHeatmapCached(calendarYear, calendarMonth, { force: true })
    ]);
    const catchupPresentation = buildCatchupPresentation(heatmapData.catchupState);
    const nextState = Object.assign({}, dashboard, {
      child: dashboard.child,
      stats: dashboard.stats,
      totalDurationText: formatDuration((dashboard.stats || {}).totalMinutes),
      calendarYear,
      calendarMonth,
      calendarTitle: `${calendarYear}年${calendarMonth}月`,
      todayDate: getDateKey(today),
      selectedDate,
      selectedDateLabel: formatDateLabel(selectedDate),
      monthCells: buildMonthCells(calendarYear, calendarMonth, heatmapData.heatmap, selectedDate, heatmapData.catchupState),
      catchupState: heatmapData.catchupState,
      catchupTasks: [],
      planDayIndex: dashboard.planDayIndex || 1
    });
    this.setData(page.buildCloudPageData(this.data, Object.assign(
      {},
      nextState,
      buildMetric(nextState.stats, this.data.metricMode),
      catchupPresentation
    )));
    this.preloadAdjacentMonths(calendarYear, calendarMonth);
    await Promise.all([
      this.loadSelectedDay(selectedDate).catch(() => {}),
      this.loadRecentDays().catch(() => {}),
      this.loadWritingAttempts().catch(() => {}),
      this.loadCatchupTasks().catch(() => {})
    ]);
  },
  getCachedMonthData(year, month) {
    return this.monthCache[getMonthKey(year, month)] || null;
  },
  async getMonthHeatmapCached(year, month, options) {
    const key = getMonthKey(year, month);
    const shouldForce = !!(options && options.force);
    if (!shouldForce && this.monthCache[key]) {
      return this.monthCache[key];
    }
    if (!shouldForce && this.monthRequests[key]) {
      return this.monthRequests[key];
    }
    const applyData = (data) => {
      const safeData = data || {};
      this.monthCache[key] = {
        heatmap: safeData.heatmap || [],
        catchupState: safeData.catchupState || this.data.catchupState
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
    this.setData({
      monthCells: buildMonthCells(this.data.calendarYear, this.data.calendarMonth, heatmapData.heatmap, this.data.selectedDate, this.data.catchupState)
    });
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
      monthCells: buildMonthCells(year, month, cachedData.heatmap, selectedDate, this.data.catchupState)
    }, buildCatchupPresentation(this.data.catchupState))));
    const heatmapData = await this.getMonthHeatmapCached(year, month, { force: true });
    if (loadVersion !== this.calendarLoadVersion) {
      return;
    }
    this.setData(page.buildCloudPageData(this.data, Object.assign({
      monthCells: buildMonthCells(year, month, heatmapData.heatmap, selectedDate, heatmapData.catchupState),
      catchupState: heatmapData.catchupState
    }, buildCatchupPresentation(heatmapData.catchupState))));
    this.preloadAdjacentMonths(year, month);
  },
  async loadSelectedDay(date) {
    this.setData({
      selectedDayLoading: true
    });
    const applyData = (data) => {
      this.setData({
        selectedDayReport: normalizeReport(data.report),
        selectedDaySummary: buildDaySummary(normalizeReport(data.report)),
        selectedDayLoading: false,
        selectedDateLabel: formatDateLabel(date)
      });
    };
    const data = await store.getDailyReportByDate(date, applyData);
    applyData(data);
  },
  async loadRecentDays() {
    const dates = buildRecentDates(this.data.todayDate || getDateKey(new Date()), 7);
    this.setData({ recentDaysLoading: true });
    try {
      const reports = await Promise.all(dates.map((date) => store.getDailyReportByDate(date).then((data) => data.report)));
      this.setData({
        recentDays: reports.map(buildRecentDayItem),
        recentDaysLoading: false
      });
    } catch (error) {
      this.setData({ recentDaysLoading: false });
    }
  },
  async loadWritingAttempts() {
    this.setData({ writingAttemptsLoading: true });
    try {
      const applyData = (data) => {
        this.setData({
          writingAttempts: (data.attempts || []).map(buildWritingAttemptItem),
          writingAttemptsLoading: false
        });
      };
      const data = await store.getWritingAttempts({ limit: 20 }, applyData);
      applyData(data);
    } catch (error) {
      this.setData({ writingAttemptsLoading: false });
    }
  },
  async loadCatchupTasks() {
    const applyData = (heatmapData) => {
      this.setData(page.buildCloudPageData(this.data, Object.assign({
        catchupTasks: labels.normalizeTaskList(heatmapData.catchupTasks || []),
        catchupState: heatmapData.catchupState || this.data.catchupState
      }, buildCatchupPresentation(heatmapData.catchupState || this.data.catchupState))));
      this.refreshMonthCellsFromCache();
    };
    const heatmapData = await store.getHeatmap(42, applyData);
    applyData(heatmapData);
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
    await this.loadSelectedDay(selectedDate);
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
    await this.loadSelectedDay(date);
  },
  async selectDate(event) {
    const date = event.currentTarget.dataset.date;
    if (!date) {
      return;
    }
    this.setData({
      selectedDate: date,
      selectedDateLabel: formatDateLabel(date),
      monthCells: markSelectedCells(this.data.monthCells, date)
    });
    await this.loadSelectedDay(date);
  },
  async openRecentDay(event) {
    const date = event.currentTarget.dataset.date;
    if (!date) return;
    await this.goToDate(date);
  },
  openCatchupTask(event) {
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    if (!category || !taskId || !this.data.catchupState || !this.data.catchupState.canCatchup) {
      return;
    }
    const targetDate = this.data.catchupState.missedDate || '';
    const planDayIndex = this.data.catchupState.planDayIndex || '';
    wx.navigateTo({
      url: `/pages/lesson/index?category=${category}&taskId=${taskId}&planRunType=catchup&targetDate=${targetDate}&planDayIndex=${planDayIndex}`
    });
  },
  toggleWritingAttempt(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const items = (this.data.writingAttempts || []).slice();
    if (!items[index]) return;
    items[index] = Object.assign({}, items[index], { expanded: !items[index].expanded });
    this.setData({ writingAttempts: items });
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
      wx.navigateTo({
        url: `/pages/lesson/index?category=${item.category}&taskId=${item.taskId}`
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
      ? (attempt.feedbackAudioFileId || '')
      : (attempt.answerAudioFileId || '');
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
