const store = require('../../utils/store');
const page = require('../../utils/page');
const snapshotStore = require('../../utils/snapshot');

const OVERVIEW_SNAPSHOT_KEY = 'listeningPlanOverviewSnapshotV2';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FALLBACK_LEVEL_TABS = ['Pre A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => ({
  levelId,
  enabled: levelId !== 'C1' && levelId !== 'C2',
  active: levelId === 'A1',
  stateText: levelId === 'C1' || levelId === 'C2' ? '未开放' : ''
}));

function buildLevelTabs(tabs, selectedLevel) {
  return (tabs && tabs.length ? tabs : FALLBACK_LEVEL_TABS).map((item) => Object.assign({}, item, {
    active: item.levelId === selectedLevel
  }));
}

function getPlanMaterial(activePlan, category) {
  return ((activePlan && activePlan.materials) || []).find((item) => item.category === category) || null;
}

function formatEstimatedDuration(seconds) {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return '时长待生成';
  }
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} 小时${rest ? `${rest} 分钟` : ''}`;
}

function buildMaterialRows(materials, activePlan) {
  return (materials || []).map((item) => Object.assign({}, item, {
    countText: item.totalCount ? `${item.totalCount} 条` : '待加入',
    stateText: getPlanMaterial(activePlan, item.category) || item.selected ? '已选' : (item.enabled ? '›' : '等待'),
    disabled: !item.enabled
  }));
}

function buildPlanSummary(activePlan) {
  const materials = ((activePlan && activePlan.materials) || []).filter((item) => item && item.enabled !== false);
  const dailyTotal = materials.reduce((sum, item) => sum + Number(item.dailyCount || 0), 0);
  const durationTotal = materials.reduce((sum, item) => sum + Number(item.estimatedDailyDurationSec || 0), 0);
  const durationText = durationTotal > 0 ? ` · 预计 ${formatEstimatedDuration(durationTotal)}` : ' · 时长待生成';
  return materials.length ? `已选 ${materials.length} 个素材 · 每天 ${dailyTotal} 条${durationText}` : '素材、集数、每日数量';
}

function getTargetSnapshotPart() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function getOverviewSnapshotId(levelId) {
  return `${getTargetSnapshotPart()}:${levelId || 'A1'}`;
}

Page({
  overviewCache: {},
  overviewRequests: {},
  data: page.createCloudPageData({
    child: null,
    stats: {},
    selectedLevel: 'A1',
    levelTabs: FALLBACK_LEVEL_TABS,
    materials: [],
    activePlan: null,
    planSummaryText: '素材、集数、每日数量',
    planSource: 'fixed-yoyo',
    isYoyoFixedPlan: false,
    fixedPlan: null,
    levelLoading: false
  }),
  hasActivePlanField(data) {
    return Object.prototype.hasOwnProperty.call(data || {}, 'activePlan');
  },
  syncCachedActivePlan(activePlan) {
    Object.keys(this.overviewCache || {}).forEach((levelId) => {
      this.overviewCache[levelId] = Object.assign({}, this.overviewCache[levelId], {
        activePlan: activePlan || null
      });
      snapshotStore.write(OVERVIEW_SNAPSHOT_KEY, getOverviewSnapshotId(levelId), this.overviewCache[levelId], {
        source: 'level-active'
      });
    });
  },
  rememberOverview(levelId, data) {
    if (!data || data.syncMode === 'cloud-error') {
      return;
    }
    if (this.hasActivePlanField(data)) {
      this.syncCachedActivePlan(data.activePlan || null);
    }
    if (Array.isArray(data.materials)) {
      this.overviewCache[levelId] = Object.assign({}, data, {
        selectedLevel: levelId
      });
      snapshotStore.write(OVERVIEW_SNAPSHOT_KEY, getOverviewSnapshotId(levelId), this.overviewCache[levelId], {
        source: 'level-overview'
      });
    }
  },
  applyOverview(data, expectedLevel) {
    const selectedLevel = expectedLevel || data.selectedLevel || this.data.selectedLevel || 'A1';
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      selectedLevel,
      levelTabs: buildLevelTabs(data.levelTabs, selectedLevel),
      materials: buildMaterialRows(data.materials || [], data.activePlan || null),
      activePlan: data.activePlan || null,
      planSummaryText: buildPlanSummary(data.activePlan || null),
      fixedPlan: data.fixedPlan || null,
      isYoyoFixedPlan: !!data.isYoyoFixedPlan,
      levelLoading: false
    })));
  },
  applyOverviewIfCurrent(data, levelId) {
    this.rememberOverview(levelId, data);
    if (this.data.selectedLevel === levelId) {
      this.applyOverview(data, levelId);
    }
  },
  async loadOverview(levelId, options = {}) {
    const nextLevel = levelId || 'A1';
    const snapshot = snapshotStore.read(OVERVIEW_SNAPSHOT_KEY, {
      id: getOverviewSnapshotId(nextLevel),
      maxAgeMs: SNAPSHOT_MAX_AGE_MS
    });
    const cached = this.overviewCache[nextLevel] || snapshot;
    if (cached && !options.prefetch) {
      this.overviewCache[nextLevel] = cached;
      this.applyOverview(cached, nextLevel);
    }
    if (!cached && !options.prefetch) {
      this.setData({ levelLoading: true });
    }
    if (!this.overviewRequests[nextLevel]) {
      const request = store.getListeningPlanOverview({ levelId: nextLevel }, (fresh) => this.applyOverviewIfCurrent(fresh, nextLevel));
      this.overviewRequests[nextLevel] = request.then((data) => {
        delete this.overviewRequests[nextLevel];
        return data;
      }, (error) => {
        delete this.overviewRequests[nextLevel];
        throw error;
      });
    }
    const data = await this.overviewRequests[nextLevel];
    if (data && data.syncMode === 'cloud-error') {
      if (!cached && !options.prefetch && this.data.selectedLevel === nextLevel) {
        this.setData({ levelLoading: false });
      }
      return cached || data;
    }
    this.rememberOverview(nextLevel, data);
    if (!options.prefetch && this.data.selectedLevel === nextLevel) {
      this.applyOverview(data, nextLevel);
    }
    return data;
  },
  async onShow() {
    page.syncTheme(this);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    await this.loadOverview(this.data.selectedLevel || 'A1');
  },
  async chooseLevel(event) {
    const enabled = event.currentTarget.dataset.enabled;
    const levelId = event.currentTarget.dataset.levelId || 'A1';
    if (enabled === false || enabled === 'false') {
      wx.showToast({ title: '暂未开放', icon: 'none' });
      return;
    }
    this.setData({
      selectedLevel: levelId,
      levelTabs: buildLevelTabs(this.data.levelTabs, levelId)
    });
    this.loadOverview(levelId);
  },
  openPlanSettings() {
    const levelId = this.data.selectedLevel || 'A1';
    wx.navigateTo({
      url: `/pages/listening-plan/index?levelId=${encodeURIComponent(levelId)}`
    });
  },
  openMaterial(event) {
    const category = event.currentTarget.dataset.category;
    const levelId = event.currentTarget.dataset.levelId || this.data.selectedLevel || 'A1';
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    wx.navigateTo({
      url: `/pages/listening-material/index?levelId=${encodeURIComponent(levelId)}&category=${encodeURIComponent(category)}`
    });
  },
  openFixedStage() {
    const fixedPlan = this.data.fixedPlan || {};
    const phase = fixedPlan.planPhase || 'round-2';
    wx.navigateTo({
      url: `/pages/level-stage/index?levelId=A1&phase=${phase}`
    });
  }
});
