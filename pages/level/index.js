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

function buildMaterialRows(materials) {
  return (materials || []).map((item) => Object.assign({}, item, {
    countText: item.totalCount ? `${item.totalCount} 条` : '待加入',
    stateText: item.selected ? '已选' : (item.enabled ? '›' : '等待'),
    disabled: !item.enabled
  }));
}

Page({
  data: page.createCloudPageData({
    child: null,
    stats: {},
    selectedLevel: 'A1',
    levelTabs: FALLBACK_LEVEL_TABS,
    materials: [],
    activePlan: null,
    planSource: 'fixed-yoyo',
    isYoyoFixedPlan: false,
    fixedPlan: null
  }),
  applyOverview(data) {
    const selectedLevel = data.selectedLevel || this.data.selectedLevel || 'A1';
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      selectedLevel,
      levelTabs: buildLevelTabs(data.levelTabs, selectedLevel),
      materials: buildMaterialRows(data.materials || []),
      activePlan: data.activePlan || null,
      fixedPlan: data.fixedPlan || null,
      isYoyoFixedPlan: !!data.isYoyoFixedPlan
    })));
  },
  async loadOverview(levelId) {
    const data = await store.getListeningPlanOverview({ levelId }, (fresh) => this.applyOverview(fresh));
    this.applyOverview(data);
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
    await this.loadOverview(levelId);
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
