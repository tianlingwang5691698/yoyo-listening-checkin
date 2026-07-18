const store = require('../../utils/store');
const page = require('../../utils/page');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('reading', key, undefined, fallback);
const READING_PASSAGE_SNAPSHOT_KEY = 'readingPassageSnapshotV1';
const READING_HOME_SNAPSHOT_KEY = 'readingHomeSnapshotV2';
const READING_DIRECTORY_VERSION = 'senior-2009-v2';
const READING_HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HIDDEN_READING_EXAM_TYPES = new Set(['真题']);
const READING_STAGE_EXAM_TYPES = {
  junior: ['一模', '二模'],
  senior: ['春考', '秋考']
};

function filterVisibleCategoryTree(categoryTree) {
  return (Array.isArray(categoryTree) ? categoryTree : []).map((root) => {
    const groups = (Array.isArray(root.groups) ? root.groups : [])
      .filter((group) => !HIDDEN_READING_EXAM_TYPES.has(group.key))
      .map((group) => Object.assign({}, group, {
        label: group.key
      }));
    const stages = Object.keys(READING_STAGE_EXAM_TYPES).map((stageKey) => {
      const stageGroups = groups.filter((group) => READING_STAGE_EXAM_TYPES[stageKey].includes(group.key));
      return {
        key: stageKey,
        label: stageKey === 'junior' ? text('junior', '初中') : text('senior', '高中'),
        meta: stageGroups.map((group) => group.label).join('、'),
        count: stageGroups.reduce((sum, group) => sum + Number(group.count || 0), 0),
        groups: stageGroups
      };
    }).filter((stage) => stage.groups.length);
    return Object.assign({}, root, {
      groups,
      stages,
      count: stages.reduce((sum, stage) => sum + stage.count, 0)
    });
  });
}

function isCompletePassageSnapshot(passage) {
  return !!(passage
    && passage._id
    && String(passage.passage || '').trim()
    && Array.isArray(passage.questions)
    && passage.questions.length);
}

function pickStage(categoryTree, selectedStage) {
  const root = categoryTree && categoryTree[0] ? categoryTree[0] : null;
  const stages = root && Array.isArray(root.stages) ? root.stages : [];
  return stages.find((stage) => stage.key === selectedStage)
    || stages.find((stage) => stage.count)
    || stages[0]
    || null;
}

function pickGroup(stage, selectedExamType) {
  const groups = stage && Array.isArray(stage.groups) ? stage.groups : [];
  return groups.find((group) => group.key === selectedExamType)
    || groups.find((group) => group.count)
    || groups[0]
    || null;
}

function pickDistrict(group, selectedDistrict) {
  const districts = group && Array.isArray(group.districts) ? group.districts : [];
  return districts.find((district) => district.key === selectedDistrict)
    || districts.find((district) => district.count)
    || districts[0]
    || null;
}

Page({
  data: page.createCloudPageData({
    loading: true,
    passage: null,
    passages: [],
    categoryRoot: null,
    categoryTree: [],
    directoryLoaded: false,
    directoryLoading: false,
    navigationLevel: 'root',
    selectedStage: 'junior',
    selectedStageNode: null,
    selectedExamType: '一模',
    selectedGroup: null,
    selectedDistrict: '',
    selectedDistrictNode: null,
    memoryPlan: null,
    completedCount: 0,
    totalCount: 0,
    isRootLevel: true,
    isStageLevel: false,
    isExamLevel: false,
    isDistrictLevel: false,
    selectedHeader: text('eyebrow', '中考阅读'),
    completedToday: false,
    latestAttempt: null
  }),
  applyReadingHome(data) {
    data = data || {};
    const categoryTree = filterVisibleCategoryTree(data.categoryTree);
    const selectedStageNode = pickStage(categoryTree, this.data.selectedStage);
    const selectedGroup = pickGroup(selectedStageNode, this.data.selectedExamType);
    const selectedDistrictNode = pickDistrict(selectedGroup, this.data.selectedDistrict);
    const hasDirectory = !!(categoryTree && categoryTree.length);
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      passage: data.passage || null,
      passages: data.passages || [],
      categoryRoot: categoryTree[0] || null,
      categoryTree,
      directoryLoaded: hasDirectory || this.data.directoryLoaded,
      directoryLoading: false,
      selectedStage: selectedStageNode ? selectedStageNode.key : '',
      selectedStageNode,
      selectedExamType: selectedGroup ? selectedGroup.key : '',
      selectedGroup,
      selectedDistrict: selectedDistrictNode ? selectedDistrictNode.key : '',
      selectedDistrictNode,
      isRootLevel: this.data.navigationLevel === 'root',
      isStageLevel: this.data.navigationLevel === 'stage',
      isExamLevel: this.data.navigationLevel === 'exam',
      isDistrictLevel: this.data.navigationLevel === 'district',
      selectedHeader: this.data.navigationLevel === 'root'
        ? ((categoryTree[0] && categoryTree[0].label) || text('eyebrow', '中考阅读'))
        : (this.data.navigationLevel === 'stage'
          ? ((selectedStageNode && selectedStageNode.label) || text('navTitle', '阅读'))
          : (this.data.navigationLevel === 'exam'
            ? ((selectedGroup && selectedGroup.label) || text('navTitle', '阅读'))
            : `${selectedGroup && selectedGroup.label ? selectedGroup.label : text('navTitle', '阅读')} · ${selectedDistrictNode && selectedDistrictNode.label ? selectedDistrictNode.label : ''}`)),
      memoryPlan: data.memoryPlan || this.data.memoryPlan || null,
      completedCount: data.completedCount || this.data.completedCount || 0,
      totalCount: data.totalCount || data.dailyCount || this.data.totalCount || 0,
      completedToday: data.completedToday === undefined ? !!this.data.completedToday : !!data.completedToday,
      latestAttempt: data.latestAttempt || this.data.latestAttempt || null,
      dailyCount: data.dailyCount || this.data.dailyCount || 0,
      today: data.today || this.data.today || ''
    }));
  },
  async onShow() {
    this.readingPerf = page.startPagePerf('reading-home');
    page.syncTheme(this);
    if (!page.requireIdentityConfirmed()) {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.readingPerf.ready('pageReady', {
        source: 'identity-blocked',
        cacheHit: true,
        groups: 0
      });
      return;
    }
    const snapshot = snapshotStore.read(READING_HOME_SNAPSHOT_KEY, {
      id: 'directory',
      maxAgeMs: READING_HOME_SNAPSHOT_MAX_AGE_MS
    });
    const hasSnapshot = !!snapshot;
    if (snapshot) {
      this.applyReadingHome(snapshot);
      this.readingPerf.ready('pageReady', {
        source: 'snapshot',
        cacheHit: true,
        groups: ((((snapshot.categoryTree || [])[0] || {}).groups) || []).length
      });
    } else {
      this.setData({ loading: true });
      await new Promise((resolve) => wx.nextTick(resolve));
      this.readingPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        groups: 0
      });
    }
    const data = await store.getReadingHome({ directoryOnly: true, directoryVersion: READING_DIRECTORY_VERSION }, (fresh) => {
      this.applyReadingHome(fresh);
      if (fresh && fresh.syncMode !== 'cloud-error') {
        snapshotStore.write(READING_HOME_SNAPSHOT_KEY, 'directory', fresh, { source: 'reading-home' });
      }
      if (this.readingPerf) {
        this.readingPerf.mark('cloudRefresh', {
          groups: (((fresh.categoryTree || [])[0] || {}).groups || []).length
        });
      }
    });
    if (data && data.syncMode !== 'cloud-error') {
      this.applyReadingHome(data);
    } else if (!hasSnapshot) {
      this.applyReadingHome(data);
    }
    if (data && data.syncMode !== 'cloud-error') {
      snapshotStore.write(READING_HOME_SNAPSHOT_KEY, 'directory', data, { source: 'reading-home' });
    }
    if (this.readingPerf) {
      this.readingPerf.mark('cloudRefresh', {
        cacheHit: !!data.__cacheHit,
        groups: (((data.categoryTree || [])[0] || {}).groups || []).length
      });
    }
  },
  openPracticeHistory() {
    wx.navigateTo({
      url: '/pages/practice-history/index?type=reading'
    });
  },
  async loadDirectory() {
    if (this.data.directoryLoading || this.data.directoryLoaded) {
      return;
    }
    this.setData({ directoryLoading: true });
    try {
      const data = await store.getReadingHome({ directoryOnly: true, directoryVersion: READING_DIRECTORY_VERSION });
      this.applyReadingHome(data);
    } catch (error) {
      this.setData({ directoryLoading: false });
      wx.showToast({ title: text('loadFailed', '目录加载失败'), icon: 'none' });
    }
  },
  onDirectoryTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  },
  onDirectoryTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || this.touchStartX === undefined) return;
    const dx = touch.clientX - this.touchStartX;
    const dy = Math.abs(touch.clientY - this.touchStartY);
    this.touchStartX = undefined;
    this.touchStartY = undefined;
    if (dx > 70 && dy < 50 && !this.data.isRootLevel) {
      this.backOneLevel();
    }
  },
  selectStage(event) {
    const stage = event.currentTarget.dataset.stage || '';
    const selectedStageNode = pickStage(this.data.categoryTree, stage);
    const selectedGroup = pickGroup(selectedStageNode, '');
    const selectedDistrictNode = pickDistrict(selectedGroup, '');
    this.setData({
      navigationLevel: 'stage',
      selectedStage: stage,
      selectedStageNode,
      selectedExamType: selectedGroup ? selectedGroup.key : '',
      selectedGroup,
      selectedDistrict: selectedDistrictNode ? selectedDistrictNode.key : '',
      selectedDistrictNode,
      isRootLevel: false,
      isStageLevel: true,
      isExamLevel: false,
      isDistrictLevel: false,
      selectedHeader: selectedStageNode && selectedStageNode.label ? selectedStageNode.label : text('navTitle', '阅读')
    });
  },
  selectExamType(event) {
    const examType = event.currentTarget.dataset.examType || '';
    const selectedGroup = pickGroup(this.data.selectedStageNode, examType);
    const selectedDistrictNode = pickDistrict(selectedGroup, '');
    this.setData({
      navigationLevel: 'exam',
      selectedExamType: examType,
      selectedGroup,
      selectedDistrict: selectedDistrictNode ? selectedDistrictNode.key : '',
      selectedDistrictNode,
      isRootLevel: false,
      isStageLevel: false,
      isExamLevel: true,
      isDistrictLevel: false,
      selectedHeader: selectedGroup && selectedGroup.label ? selectedGroup.label : text('navTitle', '阅读')
    });
  },
  selectDistrict(event) {
    const district = event.currentTarget.dataset.district || '';
    const selectedDistrictNode = pickDistrict(this.data.selectedGroup, district);
    this.setData({
      navigationLevel: 'district',
      selectedDistrict: district,
      selectedDistrictNode,
      isRootLevel: false,
      isStageLevel: false,
      isExamLevel: false,
      isDistrictLevel: true,
      selectedHeader: `${this.data.selectedGroup && this.data.selectedGroup.label ? this.data.selectedGroup.label : text('navTitle', '阅读')} · ${selectedDistrictNode && selectedDistrictNode.label ? selectedDistrictNode.label : district}`
    });
  },
  backToRoot() {
    this.setData({
      navigationLevel: 'root',
      selectedDistrictNode: null,
      isRootLevel: true,
      isStageLevel: false,
      isExamLevel: false,
      isDistrictLevel: false,
      selectedHeader: this.data.categoryRoot && this.data.categoryRoot.label ? this.data.categoryRoot.label : text('eyebrow', '中考阅读')
    });
  },
  backToStage() {
    this.setData({
      navigationLevel: 'stage',
      isRootLevel: false,
      isStageLevel: true,
      isExamLevel: false,
      isDistrictLevel: false,
      selectedHeader: this.data.selectedStageNode && this.data.selectedStageNode.label ? this.data.selectedStageNode.label : text('navTitle', '阅读')
    });
  },
  backToExam() {
    this.setData({
      navigationLevel: 'exam',
      isRootLevel: false,
      isStageLevel: false,
      isExamLevel: true,
      isDistrictLevel: false,
      selectedHeader: this.data.selectedGroup && this.data.selectedGroup.label ? this.data.selectedGroup.label : text('navTitle', '阅读')
    });
  },
  backOneLevel() {
    if (this.data.isDistrictLevel) {
      this.backToExam();
      return;
    }
    if (this.data.isExamLevel) {
      this.backToStage();
      return;
    }
    if (this.data.isStageLevel) {
      this.backToRoot();
      return;
    }
    wx.navigateBack({ delta: 1 });
  },
  openPassage(event) {
    const passageId = event && event.currentTarget ? event.currentTarget.dataset.passageId : '';
    const fallbackPassage = this.data.passage || {};
    const targetPassageId = passageId || fallbackPassage._id || '';
    if (!targetPassageId) {
      return;
    }
    const passages = (this.data.selectedDistrictNode && this.data.selectedDistrictNode.passages) || this.data.passages || [];
    const passage = passages.find((item) => item && item._id === targetPassageId) || fallbackPassage;
    if (passage && passage._id === targetPassageId && isCompletePassageSnapshot(passage)) {
      snapshotStore.write(READING_PASSAGE_SNAPSHOT_KEY, targetPassageId, { passage }, { source: 'reading' });
    }
    wx.navigateTo({
      url: `/pages/reading/detail/index?passageId=${encodeURIComponent(targetPassageId)}`
    });
  }
});
