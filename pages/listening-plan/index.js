const store = require('../../utils/store');
const page = require('../../utils/page');

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
  return (materials || []).filter((item) => !getPlanMaterial(activePlan, item.category)).map((item) => {
    return Object.assign({}, item, {
      countText: item.totalCount ? `${item.totalCount} 条` : '待加入',
      stateText: item.enabled ? '添加' : '等待',
      disabled: !item.enabled
    });
  });
}

function buildSelectedRows(activePlan) {
  return ((activePlan && activePlan.materials) || []).filter((item) => item && item.enabled !== false).map((item) => ({
    category: item.category || '',
    levelId: item.levelId || 'A1',
    title: item.title || item.category || '听力素材',
    meta: `${item.startNo || 1}-${item.endNo || item.totalCount || 1} · 每天 ${item.dailyCount || 1} 条 · ${item.repeatTarget || 3} 遍 · ${Number(item.estimatedDailyDurationSec || 0) > 0 ? `每日约 ${formatEstimatedDuration(item.estimatedDailyDurationSec)}` : '时长待生成'}`,
    estimatedDailyDurationSec: Number(item.estimatedDailyDurationSec || 0),
    dailyCount: Number(item.dailyCount || 1)
  }));
}

function buildPlanSummary(activePlan) {
  const selectedRows = buildSelectedRows(activePlan);
  const dailyTotal = selectedRows.reduce((sum, item) => sum + Number(item.dailyCount || 0), 0);
  const durationTotal = selectedRows.reduce((sum, item) => sum + Number(item.estimatedDailyDurationSec || 0), 0);
  const durationText = durationTotal > 0 ? ` · 预计 ${formatEstimatedDuration(durationTotal)}` : (selectedRows.length ? ' · 时长待生成' : '');
  return {
    selectedRows,
    selectedCount: selectedRows.length,
    dailyTotal,
    durationTotal,
    summaryText: selectedRows.length ? `已选 ${selectedRows.length} 个素材 · 每天 ${dailyTotal} 条${durationText}` : '还没有选择素材'
  };
}

Page({
  overviewCache: {},
  overviewRequests: {},
  data: page.createCloudPageData({
    selectedLevel: 'A1',
    levelTabs: FALLBACK_LEVEL_TABS,
    materials: [],
    selectedRows: [],
    selectedCount: 0,
    dailyTotal: 0,
    planSummaryText: '还没有选择素材',
    activePlan: null,
    isYoyoFixedPlan: false,
    fixedPlan: null,
    clearing: false,
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
    }
  },
  applyOverview(data, expectedLevel) {
    const selectedLevel = expectedLevel || data.selectedLevel || this.data.selectedLevel || 'A1';
    const activePlan = data.activePlan || null;
    const planSummary = buildPlanSummary(activePlan);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      selectedLevel,
      levelTabs: buildLevelTabs(data.levelTabs, selectedLevel),
      materials: buildMaterialRows(data.materials || [], activePlan),
      selectedRows: planSummary.selectedRows,
      selectedCount: planSummary.selectedCount,
      dailyTotal: planSummary.dailyTotal,
      planSummaryText: planSummary.summaryText,
      activePlan,
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
    const cached = this.overviewCache[nextLevel];
    if (cached && !options.prefetch) {
      this.applyOverview(cached, nextLevel);
    }
    if (!cached && !options.prefetch) {
      this.setData({ levelLoading: true, materials: [] });
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
  async onLoad(query) {
    page.syncTheme(this);
    const levelId = query.levelId || 'A1';
    this.setData({
      selectedLevel: levelId,
      levelTabs: buildLevelTabs(this.data.levelTabs, levelId)
    });
  },
  async onShow() {
    page.syncTheme(this);
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
  finishPlan() {
    wx.navigateBack({ delta: 1 });
  },
  clearPlan() {
    if (!this.data.selectedRows.length || this.data.clearing) {
      return;
    }
    wx.showModal({
      title: '清空计划',
      content: '清空后今日听力计划会重新设置。',
      confirmText: '清空',
      confirmColor: '#C47A32',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ clearing: true });
        try {
          for (const item of this.data.selectedRows) {
            const result = await store.removeListeningPlanMaterial({ category: item.category });
            if (result && result.syncMode === 'cloud-error') {
              throw new Error((result.cloudError && result.cloudError.message) || '清空失败');
            }
          }
          await this.loadOverview(this.data.selectedLevel || 'A1');
          wx.showToast({ title: '已清空', icon: 'none' });
        } catch (error) {
          wx.showToast({ title: '清空失败', icon: 'none' });
          console.warn('[listening-plan-clear-error]', error && (error.message || error.errMsg) || error);
        } finally {
          this.setData({ clearing: false });
        }
      }
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
