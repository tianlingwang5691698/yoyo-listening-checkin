const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const EMPTY_REPORT = {
  date: '',
  totalMinutes: 0,
  completedCategories: [],
  items: []
};

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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

function buildCatchupPresentation(catchupState) {
  const state = catchupState || {};
  if (state.canCatchup) {
    return {
      catchupStatusLabel: '可追赶',
      catchupStatusClass: ''
    };
  }
  if (state.reason === 'catchup-used-today') {
    return {
      catchupStatusLabel: '今日已用',
      catchupStatusClass: 'is-warn'
    };
  }
  if (state.reason === 'finish-current-plan-first') {
    return {
      catchupStatusLabel: '先完成今日',
      catchupStatusClass: 'is-warn'
    };
  }
  return {
    catchupStatusLabel: '无需追赶',
    catchupStatusClass: 'is-muted'
  };
}

function buildMonthCells(year, month, heatmap, selectedDate) {
  const heatmapMap = {};
  (heatmap || []).forEach((item) => {
    heatmapMap[item.date] = item;
  });
  const todayKey = getDateKey(new Date());
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
      isCatchupTarget: !!record.isCatchupTarget
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
  return Object.assign({}, safeReport, {
    items: (safeReport.items || []).map(labels.normalizeReportItem),
    totalMinutes: safeReport.totalMinutes || 0,
    completedCategories: safeReport.completedCategories || []
  });
}

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    weekLabels: WEEK_LABELS,
    metricMode: 'streak',
    heroMetricValue: 0,
    heroMetricLabel: '连续打卡',
    planDayIndex: 1,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    calendarTitle: '',
    monthCells: [],
    calendarPages: [],
    calendarSwiperIndex: 1,
    todayDate: getDateKey(new Date()),
    selectedDate: getDateKey(new Date()),
    selectedDateLabel: '',
    selectedDayReport: EMPTY_REPORT,
    selectedDayLoading: false,
    catchupStatusLabel: '无需追赶',
    catchupStatusClass: 'is-muted',
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0,
      reason: ''
    },
    catchupTasks: []
  }),
  async onShow() {
    const today = new Date();
    const selectedDate = this.data.selectedDate || getDateKey(today);
    const calendarYear = this.data.calendarYear || today.getFullYear();
    const calendarMonth = this.data.calendarMonth || today.getMonth() + 1;
    const [dashboard, heatmapData] = await Promise.all([
      store.getDashboard(),
      store.getMonthHeatmap(calendarYear, calendarMonth)
    ]);
    const calendarPages = await this.buildCalendarPages(calendarYear, calendarMonth, selectedDate);
    const nextState = Object.assign({}, dashboard, {
      child: dashboard.child,
      stats: dashboard.stats,
      calendarYear,
      calendarMonth,
      calendarTitle: `${calendarYear}年${calendarMonth}月`,
      todayDate: getDateKey(today),
      selectedDate,
      selectedDateLabel: formatDateLabel(selectedDate),
      monthCells: buildMonthCells(calendarYear, calendarMonth, heatmapData.heatmap, selectedDate),
      calendarPages,
      calendarSwiperIndex: 1,
      catchupState: heatmapData.catchupState,
      catchupTasks: [],
      planDayIndex: dashboard.planDayIndex || 1
    });
    this.setData(page.buildCloudPageData(this.data, Object.assign(
      {},
      nextState,
      buildMetric(nextState.stats, this.data.metricMode),
      buildCatchupPresentation(nextState.catchupState)
    )));
    await this.loadSelectedDay(selectedDate);
    await this.loadCatchupTasks();
  },
  async buildCalendarPages(year, month, selectedDate) {
    const monthRefs = [addMonths(year, month, 1), { year, month }, addMonths(year, month, -1)];
    const sideLabels = ['下月', '当前月份', '上月'];
    const pages = await Promise.all(monthRefs.map(async (item, index) => {
      if (index === 0 && isFutureMonth(item.year, item.month)) {
        return {
          year: item.year,
          month: item.month,
          title: `${item.year}年${item.month}月`,
          sideLabel: sideLabels[index],
          disabled: true,
          cells: []
        };
      }
      const heatmapData = await store.getMonthHeatmap(item.year, item.month);
      return {
        year: item.year,
        month: item.month,
        title: `${item.year}年${item.month}月`,
        sideLabel: sideLabels[index],
        disabled: false,
        cells: buildMonthCells(item.year, item.month, heatmapData.heatmap, index === 1 ? selectedDate : '')
      };
    }));
    return pages;
  },
  async loadCalendar(year, month, selectedDate) {
    const heatmapData = await store.getMonthHeatmap(year, month);
    const calendarPages = await this.buildCalendarPages(year, month, selectedDate);
    this.setData(page.buildCloudPageData(this.data, Object.assign({
      calendarYear: year,
      calendarMonth: month,
      calendarTitle: `${year}年${month}月`,
      selectedDate,
      selectedDateLabel: formatDateLabel(selectedDate),
      monthCells: buildMonthCells(year, month, heatmapData.heatmap, selectedDate),
      calendarPages,
      calendarSwiperIndex: 1,
      catchupState: heatmapData.catchupState
    }, buildCatchupPresentation(heatmapData.catchupState))));
  },
  async loadSelectedDay(date) {
    this.setData({
      selectedDayLoading: true
    });
    const data = await store.getDailyReportByDate(date);
    this.setData({
      selectedDayReport: normalizeReport(data.report),
      selectedDayLoading: false,
      selectedDateLabel: formatDateLabel(date)
    });
  },
  async loadCatchupTasks() {
    const heatmapData = await store.getHeatmap(42);
    this.setData(page.buildCloudPageData(this.data, Object.assign({
      catchupTasks: labels.normalizeTaskList(heatmapData.catchupTasks || []),
      catchupState: heatmapData.catchupState || this.data.catchupState
    }, buildCatchupPresentation(heatmapData.catchupState || this.data.catchupState))));
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
  async handleCalendarSwiperChange(event) {
    const current = event.detail.current;
    if (current === 1) {
      return;
    }
    const pageData = this.data.calendarPages[current];
    if (!pageData || pageData.disabled) {
      this.setData({
        calendarSwiperIndex: 1
      });
      return;
    }
    const today = new Date();
    const selectedDate = pageData.year === today.getFullYear() && pageData.month === today.getMonth() + 1
      ? getDateKey(today)
      : `${pageData.year}-${pad(pageData.month)}-01`;
    await this.loadCalendar(pageData.year, pageData.month, selectedDate);
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
    const calendarPages = this.data.calendarPages.map((pageItem) => Object.assign({}, pageItem, {
      cells: (pageItem.cells || []).map((item) => Object.assign({}, item, {
        isSelected: item.date === date
      }))
    }));
    this.setData({
      selectedDate: date,
      selectedDateLabel: formatDateLabel(date),
      monthCells: this.data.monthCells.map((item) => Object.assign({}, item, {
        isSelected: item.date === date
      })),
      calendarPages
    });
    await this.loadSelectedDay(date);
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
  }
});
