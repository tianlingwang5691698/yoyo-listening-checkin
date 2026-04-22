const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const monitor = require('../../utils/monitor');
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
    homeLoading: true
  }),
  buildStudyModePresentation(member) {
    const studyRole = member && member.studyRole === 'student' ? 'student' : 'parent';
    return {
      studyRole
    };
  },
  async onShow() {
    const startedAt = Date.now();
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 0 });
    }
    this.setData({
      homeLoading: true
    });
    const data = await store.getDashboard({ view: 'home' });
    const nextStudyRole = data.currentMember && data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const previousStudyRole = wx.getStorageSync('lastStudyRole') || '';
    const modeChangedNoticeVisible = previousStudyRole === 'student' && nextStudyRole === 'parent';
    wx.setStorageSync('lastStudyRole', nextStudyRole);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
      syncMode: data.syncMode,
      isReviewBuild: data.isReviewBuild,
      showCloudDebug: data.showCloudDebug,
      syncDebug: data.syncDebug,
      child: data.child,
      currentMember: data.currentMember,
      planDayIndex: data.planDayIndex,
      planPhaseLabel: data.planPhaseLabel,
      groupedDailyTasks: data.groupedDailyTasks || [],
      hasGroupedTasks: !!((data.groupedDailyTasks || []).length),
      identityConfirmVisible: !page.isIdentityConfirmed(),
      modeChangedNoticeVisible,
      homeLoading: false
    }, this.buildStudyModePresentation(data.currentMember))));
    monitor.logPerf('home', 'onShow', Date.now() - startedAt, {
      groups: (data.groupedDailyTasks || []).length
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
  openFamilyPage() {
    wx.navigateTo({
      url: '/pages/family/index'
    });
  }
});
