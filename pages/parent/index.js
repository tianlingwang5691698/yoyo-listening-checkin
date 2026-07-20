const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const contracts = require('../../utils/contracts');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');
const dailyReportRoute = require('../../utils/daily-report-route');

const PARENT_DASHBOARD_SNAPSHOT_KEY = 'parentDashboardSnapshotV3';
const PARENT_DASHBOARD_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;

function tr(key) { return i18n.getPageText('parent', key); }
function buildTexts() { return Object.keys(accountCatalog.parent['zh-CN']).reduce((texts, key) => { texts[key] = tr(key); return texts; }, {}); }
function formatText(text, values) { return Object.keys(values || {}).reduce((result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), String(text || '')); }
function getModules() { return [
  { key: 'listening', label: tr('listeningDuration'), unit: tr('minute'), copy: tr('listeningTimeCopy') },
  { key: 'reading', label: tr('readingCompleted'), unit: tr('article'), copy: tr('completeReading') },
  { key: 'grammar', label: tr('grammarPractice'), unit: tr('questionUnit'), copy: tr('completePractice') },
  { key: 'writing', label: tr('writingSubmitted'), unit: tr('article'), copy: tr('completeWriting') },
  { key: 'vocabulary', label: tr('vocabularyReviewed'), unit: tr('wordUnit'), copy: tr('reviewWords') },
  { key: 'speaking', label: tr('speakingPractice'), unit: tr('timeUnit'), copy: tr('completeRecording') }
]; }
function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? formatText(tr('dateLabel'), { month, day }) : dateKey || '';
}

function getTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return tr('reading');
  if (type === 'grammar') return tr('grammar');
  if (type === 'writing') return tr('writing');
  if (type === 'vocabulary') return tr('vocabulary');
  if (type === 'speaking') return tr('speaking');
  return tr('listening');
}

function getModuleKey(type) {
  if (type === 'reading-study') return 'reading';
  if (type === 'vocabulary') return 'vocabulary';
  return type;
}

function buildModuleStats(reports, completionItems) {
  const stats = getModules().map((item) => Object.assign({}, item, {
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
      map[key].displayCopy = incoming.latestTitle || map[key].displayCopy;
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
        map.speaking.latestTitle = item.questionText || tr('recordingScore');
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
    title: item.title || item.meta || tr('completionRecord')
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

function buildParentSummary(todayReport, moduleStats) {
  const completedCount = Number(todayReport && todayReport.totalCompletedCount) || 0;
  const minutes = Number(todayReport && todayReport.totalMinutes) || 0;
  const activeModules = (moduleStats || [])
    .filter((item) => Number(item.value == null ? item.count : item.value) > 0)
    .map((item) => String(item.label || '').replace(/时长|完成|练习|提交|背诵/g, ''))
    .filter(Boolean)
    .slice(0, 3);
  const title = completedCount > 0 ? tr('steadyProgress') : tr('noCompletedToday');
  const copy = completedCount > 0
    ? formatText(tr('completedSummary'), { count: completedCount, minutes: minutes ? formatText(tr('learningMinutesSuffix'), { count: minutes }) : '' })
    : tr('laterCopy');
  const detail = activeModules.length ? formatText(tr('modulesHaveRecords'), { modules: activeModules.join(', ') }) : tr('focusMainTask');
  return { title, copy, detail };
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
  const todayReport = summarizeReport(data.todayReport);
  const moduleStats = data.todayLearningStats || data.moduleStats ? buildModuleStats([{ moduleStats: data.todayLearningStats || data.moduleStats }], []) : buildModuleStats(recentReports.slice(0, 1), completionItems);
  return Object.assign({}, data, {
    childDisplayNickname: !String((data.child && data.child.nickname) || '').trim() || ['同学', '我'].includes(String((data.child && data.child.nickname) || '').trim()) ? tr('defaultNickname') : data.child.nickname,
    todayReport,
    recentReports,
    completionItems,
    moduleStats,
    parentSummary: buildParentSummary(todayReport, moduleStats),
    studentLinks,
    selectedStudentIndex,
    studentNames: studentLinks.map((item) => item.nickname || item.childLoginCode || tr('student'))
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
    childDisplayNickname: tr('defaultNickname'),
    todayReport: contracts.createReportDefaults(),
    parentSummary: buildParentSummary(contracts.createReportDefaults(), buildModuleStats([], [])),
    recentReports: [],
    completionItems: [],
    moduleStats: buildModuleStats([], []),
    studentLinks: [],
    studentNames: [],
    selectedStudentIndex: 0,
    recentExpanded: false,
    recentLoading: false,
    texts: buildTexts(),
    language: i18n.getLanguage()
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
    this.parentPerf = page.startPagePerf('parent');
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData({ texts, language: i18n.getLanguage() });
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.loadParentData();
  },
  loadParentData() {
    const loadSeq = this.parentDashboardLoadSeq + 1;
    this.parentDashboardLoadSeq = loadSeq;
    const snapshotId = getParentDashboardSnapshotId();
    const hasSnapshot = this.applyParentSnapshot(snapshotId);
    if (hasSnapshot && this.parentPerf) {
      this.parentPerf.ready('pageReady', {
        source: 'snapshot',
        cacheHit: true,
        reports: (this.data.recentReports || []).length
      });
    } else if (this.parentPerf) {
      wx.nextTick(() => {
        if (!this.parentPerf) return;
        this.parentPerf.ready('pageReady', {
          source: 'fallback',
          cacheHit: false,
          reports: (this.data.recentReports || []).length
        });
      });
    }
    store.getParentDashboard({ days: 1, summaryOnly: true, statsVersion: 'today-learning-v1' }, (fresh) => {
      if (loadSeq !== this.parentDashboardLoadSeq) return;
      this.saveParentSnapshot(snapshotId, fresh);
      this.applyParentData(fresh);
      if (this.parentPerf) {
        this.parentPerf.mark('cloudRefresh', { reports: (fresh.recentReports || []).length });
      }
    }).then((data) => {
      if (loadSeq !== this.parentDashboardLoadSeq) return;
      this.saveParentSnapshot(snapshotId, data);
      this.applyParentData(data);
      if (!hasSnapshot && this.parentPerf) {
        this.parentPerf.mark('cloudRefresh', {
          source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'error' : 'cloud'),
          cacheHit: !!(data && data.__cacheHit),
          reports: ((data && data.recentReports) || []).length
        });
      }
      if (data && !data.__cacheHit && data.syncMode !== 'cloud-error' && this.parentPerf) {
        this.parentPerf.mark('cloudRefresh', { reports: (data.recentReports || []).length });
      }
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
      url: dailyReportRoute.buildDailyReportDetailUrl(date),
      animationType: 'none',
      animationDuration: 0
    });
  }
});
