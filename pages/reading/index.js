const store = require('../../utils/store');
const page = require('../../utils/page');
const READING_PASSAGE_SNAPSHOT_KEY = 'readingPassageSnapshotV1';

function pickGroup(categoryTree, selectedExamType) {
  const root = categoryTree && categoryTree[0] ? categoryTree[0] : null;
  const groups = root && Array.isArray(root.groups) ? root.groups : [];
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
    selectedExamType: '二模',
    selectedGroup: null,
    selectedDistrict: '',
    selectedDistrictNode: null,
    memoryPlan: null,
    completedCount: 0,
    totalCount: 0,
    isRootLevel: true,
    isExamLevel: false,
    isDistrictLevel: false,
    selectedHeader: '中考阅读',
    completedToday: false,
    latestAttempt: null
  }),
  applyReadingHome(data) {
    data = data || {};
    const categoryTree = data.categoryTree || [];
    const selectedGroup = pickGroup(categoryTree, this.data.selectedExamType);
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
      selectedGroup,
      selectedDistrict: selectedDistrictNode ? selectedDistrictNode.key : '',
      selectedDistrictNode,
      isRootLevel: this.data.navigationLevel === 'root',
      isExamLevel: this.data.navigationLevel === 'exam',
      isDistrictLevel: this.data.navigationLevel === 'district',
      selectedHeader: this.data.navigationLevel === 'root'
        ? ((categoryTree[0] && categoryTree[0].label) || '中考阅读')
        : (this.data.navigationLevel === 'exam'
          ? ((selectedGroup && selectedGroup.label) || '阅读')
          : `${selectedGroup && selectedGroup.label ? selectedGroup.label : '阅读'} · ${selectedDistrictNode && selectedDistrictNode.label ? selectedDistrictNode.label : ''}`),
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
      return;
    }
    this.setData({ loading: true });
    const data = await store.getReadingHome({ directoryOnly: true }, (fresh) => {
      this.applyReadingHome(fresh);
      if (this.readingPerf) {
        this.readingPerf.mark('cloudRefresh', {
          groups: (((fresh.categoryTree || [])[0] || {}).groups || []).length
        });
      }
    });
    this.applyReadingHome(data);
    if (this.readingPerf) {
      this.readingPerf.ready('pageReady', {
        cacheHit: !!data.__cacheHit,
        groups: (((data.categoryTree || [])[0] || {}).groups || []).length
      });
    }
  },
  async loadDirectory() {
    if (this.data.directoryLoading || this.data.directoryLoaded) {
      return;
    }
    this.setData({ directoryLoading: true });
    try {
      const data = await store.getReadingHome({ directoryOnly: true });
      this.applyReadingHome(data);
    } catch (error) {
      this.setData({ directoryLoading: false });
      wx.showToast({ title: '目录加载失败', icon: 'none' });
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
  selectExamType(event) {
    const examType = event.currentTarget.dataset.examType || '';
    const selectedGroup = pickGroup(this.data.categoryTree, examType);
    const selectedDistrictNode = pickDistrict(selectedGroup, '');
    this.setData({
      navigationLevel: 'exam',
      selectedExamType: examType,
      selectedGroup,
      selectedDistrict: selectedDistrictNode ? selectedDistrictNode.key : '',
      selectedDistrictNode,
      isRootLevel: false,
      isExamLevel: true,
      isDistrictLevel: false,
      selectedHeader: selectedGroup && selectedGroup.label ? selectedGroup.label : '阅读'
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
      isExamLevel: false,
      isDistrictLevel: true,
      selectedHeader: `${this.data.selectedGroup && this.data.selectedGroup.label ? this.data.selectedGroup.label : '阅读'} · ${selectedDistrictNode && selectedDistrictNode.label ? selectedDistrictNode.label : district}`
    });
  },
  backToRoot() {
    this.setData({
      navigationLevel: 'root',
      selectedDistrictNode: null,
      isRootLevel: true,
      isExamLevel: false,
      isDistrictLevel: false,
      selectedHeader: this.data.categoryRoot && this.data.categoryRoot.label ? this.data.categoryRoot.label : '中考阅读'
    });
  },
  backToExam() {
    this.setData({
      navigationLevel: 'exam',
      isRootLevel: false,
      isExamLevel: true,
      isDistrictLevel: false,
      selectedHeader: this.data.selectedGroup && this.data.selectedGroup.label ? this.data.selectedGroup.label : '阅读'
    });
  },
  backOneLevel() {
    if (this.data.isDistrictLevel) {
      this.backToExam();
      return;
    }
    if (this.data.isExamLevel) {
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
    if (passage && passage._id === targetPassageId) {
      try {
        wx.setStorageSync(READING_PASSAGE_SNAPSHOT_KEY, {
          savedAt: Date.now(),
          passage
        });
      } catch (error) {}
    }
    wx.navigateTo({
      url: `/pages/reading/detail/index?passageId=${targetPassageId}`
    });
  }
});
