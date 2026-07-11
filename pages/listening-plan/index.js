const store = require('../../utils/store');
const page = require('../../utils/page');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const OVERVIEW_SNAPSHOT_KEY = 'listeningPlanOverviewSnapshotV2';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function t(key, variables) {
  const template = i18n.getPageText('listeningPlan', key);
  return Object.keys(variables || {}).reduce((text, name) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), variables[name]), template);
}

function localizeMaterialTitle(title) {
  return String(title || '')
    .replace(/听口练习册 第二版/g, t('listeningWorkbook2'))
    .replace(/听口 第三版/g, t('listening3'))
    .replace(/听口 第二版/g, t('listening2'))
    .replace(/课本/g, t('textbook'));
}

const FALLBACK_LEVEL_TABS = ['Pre A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => ({
  levelId,
  enabled: levelId !== 'C1' && levelId !== 'C2',
  active: levelId === 'A1',
  stateText: levelId === 'C1' || levelId === 'C2' ? t('unavailable') : ''
}));
const FALLBACK_MATERIALS = {
  'Pre A1': [{ category: 'song', title: 'Songs' }],
  A1: [
    { category: 'newconcept1', title: 'New Concept 1' },
    { category: 'unlock1', title: 'Unlock 1 听口 第二版' },
    { category: 'peppa', title: 'Peppa' }
  ],
  A2: [
    { category: 'peppa', title: 'Peppa' },
    { category: 'newconcept2', title: 'New Concept 2' },
    { category: 'unlock2', title: 'Unlock 2 课本' }
  ],
  B1: [
    { category: 'newconcept3', title: 'New Concept 3' },
    { category: 'unlock3textbook', title: 'Unlock3 听口 第二版' },
    { category: 'unlock3thirdedition', title: 'Unlock3 听口 第三版' },
    { category: 'unlock3', title: 'Unlock3 听口练习册 第二版' }
  ],
  B2: [
    { category: 'newconcept4', title: 'New Concept 4' },
    { category: 'unlock4', title: 'Unlock 4 课本' },
    { category: 'unlock4thirdedition', title: 'Unlock 4 听口 第三版' }
  ]
};

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
    return t('durationPending');
  }
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) {
    return `${minutes} ${t('minute')}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} ${t('hour')}${rest ? ` ${rest} ${t('minute')}` : ''}`;
}

function buildMaterialRows(materials, activePlan) {
  return (materials || []).filter((item) => !getPlanMaterial(activePlan, item.category)).map((item) => {
    return Object.assign({}, item, {
      title: localizeMaterialTitle(item.title),
      countText: item.totalCount ? `${item.totalCount} ${t('items')}` : t('enterable'),
      stateText: item.enabled ? t('add') : t('unavailable'),
      disabled: !item.enabled
    });
  });
}

function buildSelectedRows(activePlan) {
  return ((activePlan && activePlan.materials) || []).filter((item) => item && item.enabled !== false).map((item) => ({
    category: item.category || '',
    levelId: item.levelId || 'A1',
    title: localizeMaterialTitle(item.title || item.category || t('listeningMaterial')),
    meta: `${item.startNo || 1}-${item.endNo || item.totalCount || 1} · ${t('daily')} ${item.dailyCount || 1} ${t('items')} · ${item.repeatTarget || 3} ${t('times')} · ${Number(item.estimatedDailyDurationSec || 0) > 0 ? `${t('dailyApprox')} ${formatEstimatedDuration(item.estimatedDailyDurationSec)}` : t('durationPending')}`,
    estimatedDailyDurationSec: Number(item.estimatedDailyDurationSec || 0),
    dailyCount: Number(item.dailyCount || 1)
  }));
}

function buildPlanSummary(activePlan) {
  const selectedRows = buildSelectedRows(activePlan);
  const dailyTotal = selectedRows.reduce((sum, item) => sum + Number(item.dailyCount || 0), 0);
  const durationTotal = selectedRows.reduce((sum, item) => sum + Number(item.estimatedDailyDurationSec || 0), 0);
  const durationText = durationTotal > 0 ? ` · ${t('estimated')} ${formatEstimatedDuration(durationTotal)}` : (selectedRows.length ? ` · ${t('durationPending')}` : '');
  return {
    selectedRows,
    selectedCount: selectedRows.length,
    dailyTotal,
    durationTotal,
    summaryText: selectedRows.length ? `${t('selectedMaterials', { count: selectedRows.length, daily: dailyTotal })}${durationText}` : t('noMaterialSelected')
  };
}

function getTargetSnapshotPart() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function getOverviewSnapshotId(levelId) {
  return `${getTargetSnapshotPart()}:${levelId || 'A1'}`;
}

function buildFallbackOverview(levelId, currentData) {
  const selectedLevel = levelId || 'A1';
  return {
    selectedLevel,
    levelTabs: buildLevelTabs(currentData.levelTabs, selectedLevel),
    materials: (FALLBACK_MATERIALS[selectedLevel] || []).map((item) => Object.assign({}, item, {
      levelId: selectedLevel,
      totalCount: 0,
      enabled: true
    })),
    activePlan: currentData.activePlan || null,
    isYoyoFixedPlan: !!currentData.isYoyoFixedPlan,
    fixedPlan: currentData.fixedPlan || null
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
    planSummaryText: t('noMaterialSelected'),
    activePlan: null,
    isYoyoFixedPlan: false,
    fixedPlan: null,
    clearing: false,
    levelLoading: false,
    language: i18n.getLanguage(),
    texts: i18n.getPageTexts('listeningPlan')
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
        source: 'listening-plan-active'
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
        source: 'listening-plan-overview'
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
      this.applyOverview(buildFallbackOverview(nextLevel, this.data), nextLevel);
      this.setData({ levelLoading: true });
    }
    if (!this.overviewRequests[nextLevel]) {
      const request = store.getListeningPlanOverview({ levelId: nextLevel }, (fresh) => {
        this.applyOverviewIfCurrent(fresh, nextLevel);
        if (!options.prefetch && this.listeningPlanPerf) {
          this.listeningPlanPerf.mark('cloudRefresh', { levelId: nextLevel, materials: (fresh.materials || []).length });
        }
      });
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
    this.listeningPlanPerf = page.startPagePerf('listening-plan');
    page.syncTheme(this);
    const language = i18n.getLanguage();
    const texts = i18n.getPageTexts('listeningPlan', language);
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.setData({ language, texts });
    if (this.data.materials.length || this.data.activePlan) this.applyOverview(this.data, this.data.selectedLevel);
    if (!page.requireIdentityConfirmed()) {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.listeningPlanPerf.ready('pageReady', {
        source: 'identity-blocked',
        cacheHit: true,
        levelId: this.data.selectedLevel || 'A1',
        materials: (this.data.materials || []).length
      });
      return;
    }
    const levelId = this.data.selectedLevel || 'A1';
    const memoryCached = this.overviewCache[levelId] || null;
    const snapshot = memoryCached ? null : snapshotStore.read(OVERVIEW_SNAPSHOT_KEY, {
      id: getOverviewSnapshotId(levelId),
      maxAgeMs: SNAPSHOT_MAX_AGE_MS
    });
    const request = this.loadOverview(levelId);
    if (memoryCached || snapshot) {
      const first = memoryCached || snapshot;
      this.listeningPlanPerf.ready('pageReady', {
        source: memoryCached ? 'memory' : 'snapshot',
        cacheHit: true,
        levelId,
        materials: (first.materials || []).length
      });
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.listeningPlanPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        levelId,
        materials: (this.data.materials || []).length
      });
    }
    const data = await request;
    if (!memoryCached && !snapshot) {
      this.listeningPlanPerf.mark('cloudRefresh', {
        source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'fallback' : 'cloud'),
        cacheHit: !!(data && data.__cacheHit),
        levelId,
        materials: ((data && data.materials) || this.data.materials || []).length
      });
    }
  },
  async chooseLevel(event) {
    const enabled = event.currentTarget.dataset.enabled;
    const levelId = event.currentTarget.dataset.levelId || 'A1';
    if (enabled === false || enabled === 'false') {
      wx.showToast({ title: t('temporarilyUnavailable'), icon: 'none' });
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
      title: t('clearModalTitle'),
      content: t('clearModalContent'),
      confirmText: t('clearConfirm'),
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
              throw new Error((result.cloudError && result.cloudError.message) || t('clearFailed'));
            }
          }
          await this.loadOverview(this.data.selectedLevel || 'A1');
          wx.showToast({ title: t('cleared'), icon: 'none' });
        } catch (error) {
          wx.showToast({ title: t('clearFailed'), icon: 'none' });
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
