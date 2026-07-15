const store = require('../../utils/store');
const page = require('../../utils/page');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const OVERVIEW_SNAPSHOT_KEY = 'listeningPlanOverviewSnapshotV6';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function t(key, variables) {
  const template = i18n.getPageText('level', key);
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
const DEFAULT_FIRST_LEVEL = 'A1';
const LEVEL_MATERIALS = {
  'Pre A1': [
    { category: 'song', title: 'Songs' },
    { category: 'littlebear', title: 'Little Bear' }
  ],
  A1: [
    { category: 'newconcept1', title: 'New Concept 1' },
    { category: 'unlock1', title: 'Unlock 1 听口 第二版' },
    { category: 'peppa', title: 'Peppa' }
  ],
  A2: [
    { category: 'newconcept2', title: 'New Concept 2' },
    { category: 'petethecat', title: 'Pete the Cat' },
    { category: 'magictreehouse', title: 'Magic Tree House' },
    { category: 'unlock2', title: 'Unlock 2 课本' }
  ],
  B1: [
    { category: 'newconcept3', title: 'New Concept 3' },
    { category: 'magictreehouseb1', title: 'Magic Tree House' },
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
  return (materials || []).map((item) => {
    const selected = !!(getPlanMaterial(activePlan, item.category) || item.selected);
    return Object.assign({}, item, {
      title: localizeMaterialTitle(item.title),
      countText: item.totalCount ? `${item.totalCount} ${t('items')}` : (item.enabled ? t('enterable') : t('unavailable')),
      stateText: selected ? t('selected') : (item.enabled ? '›' : t('unavailable')),
      selected,
      disabled: !item.enabled
    });
  });
}

function buildFallbackOverview(levelId, currentData) {
  const selectedLevel = levelId || 'A1';
  const activePlan = currentData.activePlan || null;
  return {
    child: currentData.child || null,
    stats: currentData.stats || {},
    selectedLevel,
    levelTabs: buildLevelTabs(currentData.levelTabs, selectedLevel),
    materials: (LEVEL_MATERIALS[selectedLevel] || []).map((item) => ({
      levelId: selectedLevel,
      category: item.category,
      title: item.title,
      totalCount: 0,
      enabled: true,
      optimistic: true
    })),
    activePlan,
    planSource: currentData.planSource || 'fixed-yoyo',
    isYoyoFixedPlan: !!currentData.isYoyoFixedPlan,
    fixedPlan: currentData.fixedPlan || null
  };
}

function buildPlanSummary(activePlan) {
  const materials = ((activePlan && activePlan.materials) || []).filter((item) => item && item.enabled !== false);
  const dailyTotal = materials.reduce((sum, item) => sum + Number(item.dailyCount || 0), 0);
  const durationTotal = materials.reduce((sum, item) => sum + Number(item.estimatedDailyDurationSec || 0), 0);
  const durationText = durationTotal > 0 ? ` · ${t('estimated')} ${formatEstimatedDuration(durationTotal)}` : ` · ${t('durationPending')}`;
  return materials.length ? `${t('selectedMaterials', { count: materials.length, daily: dailyTotal })}${durationText}` : t('planPlaceholder');
}

function getTargetSnapshotPart() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function getOverviewSnapshotId(levelId) {
  return `${getTargetSnapshotPart()}:${levelId || 'A1'}`;
}

function getOverviewSnapshotKey(levelId) {
  return `${OVERVIEW_SNAPSHOT_KEY}:${getOverviewSnapshotId(levelId)}`;
}

Page({
  overviewCache: {},
  overviewRequests: {},
  scheduleSecondaryLevelPrefetch(firstLevel) {
    if (this.secondaryPrefetchTimer) {
      clearTimeout(this.secondaryPrefetchTimer);
    }
    const levels = (this.data.levelTabs || FALLBACK_LEVEL_TABS)
      .filter((tab) => tab && tab.enabled && tab.levelId !== firstLevel)
      .map((tab) => tab.levelId);
    this.secondaryPrefetchTimer = setTimeout(() => {
      this.secondaryPrefetchTimer = null;
      levels.reduce((chain, levelId) => (
        chain.then(() => this.loadOverview(levelId, { prefetch: true }).catch(() => null))
      ), Promise.resolve());
    }, 800);
  },
  markLevelCloudRefresh(data, levelId) {
    if (!this.levelPerf || this.levelCloudRefreshLogged) return;
    this.levelCloudRefreshLogged = true;
    this.levelPerf.mark('cloudRefresh', {
      levelId,
      materials: ((data && data.materials) || []).length
    });
  },
  data: page.createCloudPageData({
    child: null,
    stats: {},
    selectedLevel: 'A1',
    levelTabs: FALLBACK_LEVEL_TABS,
    materials: [],
    activePlan: null,
    planSummaryText: t('planPlaceholder'),
    planSource: 'fixed-yoyo',
    isYoyoFixedPlan: false,
    fixedPlan: null,
    levelLoading: false,
    language: i18n.getLanguage(),
    texts: i18n.getPageTexts('level')
  }),
  hasActivePlanField(data) {
    return Object.prototype.hasOwnProperty.call(data || {}, 'activePlan');
  },
  syncCachedActivePlan(activePlan) {
    Object.keys(this.overviewCache || {}).forEach((levelId) => {
      this.overviewCache[levelId] = Object.assign({}, this.overviewCache[levelId], {
        activePlan: activePlan || null
      });
      snapshotStore.write(getOverviewSnapshotKey(levelId), getOverviewSnapshotId(levelId), this.overviewCache[levelId], {
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
      snapshotStore.write(getOverviewSnapshotKey(levelId), getOverviewSnapshotId(levelId), this.overviewCache[levelId], {
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
    const snapshot = snapshotStore.read(getOverviewSnapshotKey(nextLevel), {
      id: getOverviewSnapshotId(nextLevel),
      maxAgeMs: SNAPSHOT_MAX_AGE_MS
    }) || snapshotStore.read(OVERVIEW_SNAPSHOT_KEY, {
      id: getOverviewSnapshotId(nextLevel),
      maxAgeMs: SNAPSHOT_MAX_AGE_MS
    });
    const memoryCached = this.overviewCache[nextLevel] || null;
    const cached = memoryCached || snapshot;
    if (cached && !options.prefetch) {
      this.overviewCache[nextLevel] = cached;
      this.applyOverview(cached, nextLevel);
      if (options.interactive) {
        setTimeout(() => {
          this.loadOverview(nextLevel, { prefetch: true }).catch(() => {});
        }, 600);
        return cached;
      }
    }
    if (!cached && !options.prefetch) {
      this.applyOverview(buildFallbackOverview(nextLevel, this.data), nextLevel);
      this.setData({ levelLoading: true });
    }
    if (!this.overviewRequests[nextLevel]) {
      const request = store.getListeningPlanOverview({ levelId: nextLevel }, (fresh) => {
        this.applyOverviewIfCurrent(fresh, nextLevel);
        if (!options.prefetch) {
          this.markLevelCloudRefresh(fresh, nextLevel);
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
  async onShow() {
    this.levelPerf = page.startPagePerf('level');
    this.levelCloudRefreshLogged = false;
    page.syncTheme(this);
    const language = i18n.getLanguage();
    const texts = i18n.getPageTexts('level', language);
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.setData({ language, texts });
    if (this.data.materials.length) this.applyOverview(this.data, this.data.selectedLevel);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && tabBar.data.selected !== 1) {
      tabBar.setData({ selected: 1 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const firstLevel = this.data.selectedLevel || DEFAULT_FIRST_LEVEL;
    const memoryCached = this.overviewCache[firstLevel] || null;
    const snapshot = memoryCached ? null : (
      snapshotStore.read(getOverviewSnapshotKey(firstLevel), {
        id: getOverviewSnapshotId(firstLevel),
        maxAgeMs: SNAPSHOT_MAX_AGE_MS
      }) || snapshotStore.read(OVERVIEW_SNAPSHOT_KEY, {
        id: getOverviewSnapshotId(firstLevel),
        maxAgeMs: SNAPSHOT_MAX_AGE_MS
      })
    );
    const firstRequest = this.loadOverview(firstLevel);
    if (memoryCached || snapshot) {
      this.levelPerf.ready('pageReady', {
        source: memoryCached ? 'memory' : 'snapshot',
        cacheHit: true,
        levelId: firstLevel,
        materials: ((memoryCached || snapshot).materials || []).length
      });
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.levelPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        levelId: firstLevel,
        materials: (this.data.materials || []).length
      });
    }
    const firstData = await firstRequest;
    if (firstData && !firstData.__cacheHit && firstData.syncMode !== 'cloud-error') {
      this.markLevelCloudRefresh(firstData, firstLevel);
    }
    this.scheduleSecondaryLevelPrefetch(firstLevel);
  },
  onHide() {
    if (this.secondaryPrefetchTimer) {
      clearTimeout(this.secondaryPrefetchTimer);
      this.secondaryPrefetchTimer = null;
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
    this.loadOverview(levelId, { interactive: true });
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
