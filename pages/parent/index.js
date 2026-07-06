const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');
const snapshotStore = require('../../utils/snapshot');

const PARENT_DASHBOARD_SNAPSHOT_KEY = 'parentDashboardSnapshotV3';
const PARENT_DASHBOARD_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;

const MODULES = [
  { key: 'listening', label: '听力时长', unit: '分钟', copy: '今日听力用时' },
  { key: 'reading', label: '阅读完成', unit: '篇', copy: '完成阅读' },
  { key: 'grammar', label: '语法练习', unit: '题', copy: '完成练习' },
  { key: 'writing', label: '写作提交', unit: '篇', copy: '完成作文' },
  { key: 'vocabulary', label: '单词背诵', unit: '个', copy: '背诵单词' },
  { key: 'speaking', label: '口语练习', unit: '次', copy: '完成录音' }
];
function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? `${month}月${day}日` : dateKey || '';
}

function getTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return '阅读';
  if (type === 'grammar') return '语法';
  if (type === 'writing') return '写作';
  if (type === 'vocabulary') return '词汇';
  if (type === 'speaking') return '口语';
  return '听力';
}

function getModuleKey(type) {
  if (type === 'reading-study') return 'reading';
  if (type === 'vocabulary') return 'vocabulary';
  return type;
}

function buildModuleStats(reports, completionItems) {
  const stats = MODULES.map((item) => Object.assign({}, item, {
    count: 0,
    value: 0,
    latestTitle: item.copy,
    displayCopy: item.copy
  }));
  const map = stats.reduce((next, item) => {
    next[item.key] = item;
    return next;
  }, {});
  const applySummaryStats = (summaryStats) => {
    Object.keys(summaryStats || {}).forEach((key) => {
      if (!map[key]) return;
      const incoming = summaryStats[key] || {};
      map[key].count += Number(incoming.value == null ? incoming.count : incoming.value) || 0;
      map[key].value = map[key].count;
      map[key].unit = incoming.unit || map[key].unit;
      map[key].label = incoming.label || map[key].label;
      map[key].displayCopy = incoming.copy || incoming.latestTitle || map[key].displayCopy;
      if (incoming.latestTitle && incoming.latestTitle !== '暂无记录') {
        map[key].latestTitle = summaryStats[key].latestTitle;
      }
    });
  };
  if ((reports || []).some((report) => report && report.moduleStats)) {
    (reports || []).forEach((report) => applySummaryStats(report && report.moduleStats));
    return stats;
  }
  const countedCompletionIds = {};
  const appendCompletion = (item) => {
    const key = getModuleKey(item.type);
    const id = item.id || item.recordId || `${item.date || ''}:${item.type || ''}:${item.targetId || ''}`;
    if (!map[key] || countedCompletionIds[id]) return;
    countedCompletionIds[id] = true;
    map[key].count += 1;
    map[key].value = map[key].count;
    map[key].latestTitle = item.title || item.meta || map[key].latestTitle;
    map[key].displayCopy = map[key].latestTitle;
  };
  (reports || []).forEach((report) => {
    (report.items || []).forEach((item) => {
      if (item.completedToday && map.listening) {
        map.listening.count += 1;
        map.listening.value = map.listening.count;
        map.listening.latestTitle = item.title || item.categoryLabel || map.listening.latestTitle;
        map.listening.displayCopy = map.listening.latestTitle;
      }
    });
    (report.speakingAttempts || []).forEach((item) => {
      if (map.speaking) {
        map.speaking.count += 1;
        map.speaking.value = map.speaking.count;
        map.speaking.latestTitle = item.questionText || '录音评分';
        map.speaking.displayCopy = map.speaking.latestTitle;
      }
    });
    (report.completionItems || []).forEach(appendCompletion);
  });
  (completionItems || []).forEach(appendCompletion);
  return stats;
}

function normalizeCompletionItems(items) {
  return (items || []).map((item) => Object.assign({}, item, {
    dateLabel: formatDateLabel(item.date),
    typeLabel: getTypeLabel(item.type),
    title: item.title || item.meta || '完成记录'
  }));
}

function normalizeReport(report) {
  const safeReport = report || {};
  const completionItems = normalizeCompletionItems(safeReport.completionItems || []);
  const completedCategories = safeReport.completedCategories || [];
  return Object.assign({}, safeReport, {
    dateLabel: formatDateLabel(safeReport.date),
    items: (safeReport.items || []).map(labels.normalizeReportItem),
    completionItems,
    completedCategories,
    completedContentCount: completionItems.length,
    totalCompletedCount: completedCategories.length + completionItems.length
  });
}

function summarizeReport(report) {
  const raw = report || {};
  const safeReport = normalizeReport(report);
  return Object.assign({}, safeReport, {
    items: [],
    speakingAttempts: [],
    completionItems: [],
    completedContentCount: Number(raw.completedContentCount || safeReport.completedContentCount || 0),
    speakingAttemptCount: Number(raw.speakingAttemptCount || (safeReport.speakingAttempts || []).length || 0),
    totalCompletedCount: Number(raw.totalCompletedCount || safeReport.totalCompletedCount || 0)
  });
}

function normalizeParentData(data) {
  const recentReports = (data.recentReports || []).map(summarizeReport);
  const completionItems = [];
  const studentLinks = data.studentLinks || [];
  const selectedStudentIndex = Math.max(0, studentLinks.findIndex((item) => item && item.isCurrent));
  return Object.assign({}, data, {
    todayReport: summarizeReport(data.todayReport),
    recentReports,
    completionItems,
    moduleStats: data.todayLearningStats || data.moduleStats ? buildModuleStats([{ moduleStats: data.todayLearningStats || data.moduleStats }], []) : buildModuleStats(recentReports.slice(0, 1), completionItems),
    studentLinks,
    selectedStudentIndex,
    studentNames: studentLinks.map((item) => item.nickname || item.childLoginCode || '学生')
  });
}

function getParentDashboardSnapshotId() {
  const target = store.getSelectedStudentTarget();
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function hasParentDashboardSummary(data) {
  return !!(data && (data.todayReport || (data.recentReports || []).length || data.moduleStats));
}

Page({
  data: page.createCloudPageData({
    family: {},
    child: contracts.createChildDefaults(),
    todayReport: contracts.createReportDefaults(),
    recentReports: [],
    completionItems: [],
    moduleStats: buildModuleStats([], []),
    studentLinks: [],
    studentNames: [],
    selectedStudentIndex: 0,
    recentExpanded: false,
    recentLoading: false
  }),
  parentDashboardLoadSeq: 0,
  applyParentData(data) {
    this.setData(page.buildCloudPageData(this.data, normalizeParentData(data)));
  },
  applyParentSnapshot(snapshotId) {
    const snapshot = snapshotStore.read(PARENT_DASHBOARD_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: PARENT_DASHBOARD_SNAPSHOT_MAX_AGE_MS
    });
    if (hasParentDashboardSummary(snapshot)) {
      this.applyParentData(snapshot);
      return true;
    }
    return false;
  },
  saveParentSnapshot(snapshotId, data) {
    if (!hasParentDashboardSummary(data) || data.syncMode === 'cloud-error') {
      return;
    }
    snapshotStore.write(PARENT_DASHBOARD_SNAPSHOT_KEY, snapshotId, data, {
      source: 'parent-dashboard-summary'
    });
  },
  onShow() {
    page.syncTheme(this);
    this.loadParentData();
  },
  loadParentData() {
    const loadSeq = this.parentDashboardLoadSeq + 1;
    this.parentDashboardLoadSeq = loadSeq;
    const snapshotId = getParentDashboardSnapshotId();
    this.applyParentSnapshot(snapshotId);
    store.getParentDashboard({ days: 1, summaryOnly: true, statsVersion: 'today-learning-v1' }, (fresh) => {
      if (loadSeq !== this.parentDashboardLoadSeq) return;
      this.saveParentSnapshot(snapshotId, fresh);
      this.applyParentData(fresh);
    }).then((data) => {
      if (loadSeq !== this.parentDashboardLoadSeq) return;
      this.saveParentSnapshot(snapshotId, data);
      this.applyParentData(data);
    });
  },
  handleStudentChange(event) {
    const index = Number(event.detail && event.detail.value) || 0;
    const target = this.data.studentLinks[index];
    if (!target) {
      return;
    }
    store.setSelectedStudentTarget(target);
    store.setLastParentStudentTarget(target);
    this.setData({
      selectedStudentIndex: index,
      completionItems: [],
      moduleStats: buildModuleStats([], []),
      recentReports: [],
      recentExpanded: false,
      recentLoading: false
    });
    this.loadParentData();
  },
  loadRecentReports() {
    if (this.data.recentLoading) return;
    if (this.data.recentExpanded) {
      this.setData({ recentExpanded: false });
      return;
    }
    this.setData({ recentLoading: true });
    store.getParentDashboard({ days: 7, summaryOnly: true, statsVersion: 'today-learning-v1' }).then((data) => {
      const normalized = normalizeParentData(data);
      this.setData({
        recentReports: normalized.recentReports,
        recentExpanded: true,
        recentLoading: false
      });
    }).catch(() => {
      this.setData({ recentLoading: false });
    });
  },
  openDailyDetail(event) {
    const date = event.currentTarget.dataset.date;
    if (!date) {
      return;
    }
    wx.navigateTo({
      url: `/pages/parent/detail/index?date=${date}`
    });
  }
});
