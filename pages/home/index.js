const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const monitor = require('../../utils/monitor');
const labels = require('../../utils/labels');
Page({
  data: page.createCloudPageData({
    child: contracts.createChildDefaults(),
    currentMember: contracts.createCurrentMemberDefaults(),
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    studyRole: 'parent',
    identityConfirmVisible: true,
    modeChangedNoticeVisible: false,
    homeLoading: true,
    readingLoading: true,
    readingToday: null,
    readingCompleted: false
  }),
  buildStudyModePresentation(member) {
    const studyRole = member && member.studyRole === 'student' ? 'student' : 'parent';
    return {
      studyRole
    };
  },
  applyDashboard(data) {
    const nextStudyRole = data.currentMember && data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const previousStudyRole = wx.getStorageSync('lastStudyRole') || '';
    const modeChangedNoticeVisible = previousStudyRole === 'student' && nextStudyRole === 'parent';
    wx.setStorageSync('lastStudyRole', nextStudyRole);
    const groupedDailyTasks = labels.normalizeHomeTaskGroups(data.groupedDailyTasks || []);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
      syncMode: data.syncMode,
      isReviewBuild: data.isReviewBuild,
      showCloudDebug: data.showCloudDebug,
      syncDebug: data.syncDebug,
      child: data.child,
      currentMember: data.currentMember,
      planDayIndex: data.planDayIndex,
      planPhaseLabel: data.planPhaseLabel,
      groupedDailyTasks,
      hasGroupedTasks: !!groupedDailyTasks.length,
      identityConfirmVisible: !page.isIdentityConfirmed(),
      modeChangedNoticeVisible,
      homeLoading: false
    }, this.buildStudyModePresentation(data.currentMember))));
    return groupedDailyTasks;
  },
  applyReadingHome(data) {
    this.setData({
      readingLoading: false,
      readingToday: data.passage || null,
      readingCompleted: !!data.completedToday
    });
  },
  async loadReadingHome() {
    this.setData({ readingLoading: true });
    const data = await store.getReadingHome({}, (fresh) => this.applyReadingHome(fresh));
    this.applyReadingHome(data);
  },
  async onShow() {
    const startedAt = Date.now();
    page.syncTheme(this);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 0 });
    }
    this.setData({
      homeLoading: true
    });
    const data = await store.getDashboard({ view: 'home' }, (fresh) => this.applyDashboard(fresh));
    const groupedDailyTasks = this.applyDashboard(data);
    this.loadReadingHome();
    monitor.logPerf('home', 'onShow', Date.now() - startedAt, {
      groups: groupedDailyTasks.length
    });
  },
  async confirmStudyIdentity(event) {
    const nextRole = event.currentTarget.dataset.role === 'student' ? 'student' : 'parent';
    try {
      const data = await store.setStudyRole(nextRole);
      page.setIdentityConfirmed(true);
      wx.setStorageSync('lastStudyRole', nextRole);
      if (nextRole === 'student') {
        wx.setStorageSync('hasUsedStudentMode', 'yes');
      }
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
        syncMode: data.syncMode,
        isReviewBuild: data.isReviewBuild,
        showCloudDebug: data.showCloudDebug,
        syncDebug: data.syncDebug,
        child: data.child,
        currentMember: data.currentMember,
        identityConfirmVisible: false,
        modeChangedNoticeVisible: false
      }, this.buildStudyModePresentation(data.currentMember))));
      wx.showToast({
        title: nextRole === 'student' ? '已进入学生设备' : '已进入家长模式',
        icon: 'none'
      });
      if (nextRole === 'parent' && data.currentMember && data.currentMember.role === 'owner') {
        wx.navigateTo({
          url: '/pages/family/index'
        });
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '切换失败',
        icon: 'none'
      });
    }
  },
  openTask(event) {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    const query = taskId
      ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
      : `/pages/lesson/index?category=${category}`;
    wx.navigateTo({
      url: query
    });
  },
  openReading() {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/reading/index'
    });
  },
  openFamilyPage() {
    wx.navigateTo({
      url: '/pages/family/index'
    });
  },
  onShareAppMessage() {
    return {
      title: '佑声英语',
      path: '/pages/home/index'
    };
  },
  onShareTimeline() {
    return {
      title: '佑声英语',
      query: ''
    };
  }
});
