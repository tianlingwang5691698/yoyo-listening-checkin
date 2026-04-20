const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');

const CATEGORY_ORDER = ['newconcept1', 'newconcept2', 'peppa', 'unlock1', 'song'];
const PHASE_COPY = {
  '第1轮': '轻量日计划',
  '第2轮': '复习加速',
  '第3轮': '冲刺复习'
};

function getTextType(task) {
  if (task.isPendingAsset) {
    return '待准备';
  }
  if (task.transcriptTrackId) {
    return task.syncGranularity === 'line' ? '句级' : '逐词';
  }
  if (task.transcriptStatus === 'pending') {
    return '文本准备中';
  }
  return '纯听力';
}

function decorateHomeTask(task) {
  const normalizedTask = labels.normalizeTask(task);
  const repeatTarget = normalizedTask.repeatTarget || 3;
  return Object.assign({}, normalizedTask, {
    textType: getTextType(normalizedTask),
    actionText: normalizedTask.isPendingAsset
      ? '等音频放入'
      : normalizedTask.completedToday
        ? '查看完成'
        : normalizedTask.playCount > 0
          ? '继续'
          : '开始',
    progressText: `${normalizedTask.playCount || 0}/${repeatTarget} 遍`
  });
}

function buildGroupedDailyTasks(tasks) {
  const groups = [];
  CATEGORY_ORDER.forEach((category) => {
    const categoryTasks = (tasks || []).filter((item) => item.category === category).map(decorateHomeTask);
    if (!categoryTasks.length) {
      return;
    }
    const activeTasks = categoryTasks.filter((item) => !item.isPendingAsset);
    const completedCount = activeTasks.filter((item) => item.completedToday).length;
    const totalCount = activeTasks.length || categoryTasks.length;
    const nextTask = categoryTasks.find((item) => !item.isPendingAsset && !item.completedToday) || categoryTasks[0];
    const allDone = completedCount === totalCount;
    const pending = nextTask && nextTask.isPendingAsset;
    groups.push({
      category,
      categoryLabel: labels.getCategoryDisplayLabel(category, categoryTasks[0].categoryLabel),
      completedCount,
      totalCount,
      progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      nextTask,
      programSubtitle: allDone
        ? '今日完成'
        : pending
          ? '等待音频'
          : (nextTask.displayTitle || nextTask.title || ''),
      programStateText: allDone ? '完成' : pending ? '等待' : '›',
      textType: nextTask ? nextTask.textType : '待准备',
      actionText: nextTask ? nextTask.actionText : '待准备',
      tasks: categoryTasks
    });
  });
  return groups;
}

function buildPhaseCopy(label) {
  return PHASE_COPY[label] || '今日计划';
}

Page({
  data: page.createCloudPageData({
    child: null,
    currentMember: {},
    stats: {},
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    phaseCopy: '轻量日计划',
    planTaskCount: 0,
    dailyTasks: [],
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false,
    studyRole: 'parent',
    identityConfirmVisible: true,
    modeChangedNoticeVisible: false
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
    const data = await store.getDashboard({ view: 'home' });
    const groupedDailyTasks = buildGroupedDailyTasks(data.dailyTasks);
    const total = data.activeTaskCount || data.planTaskCount || 0;
    const done = data.completedTaskCountToday || 0;
    const nextStudyRole = data.currentMember && data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const previousStudyRole = wx.getStorageSync('lastStudyRole') || '';
    const modeChangedNoticeVisible = previousStudyRole === 'student' && nextStudyRole === 'parent';
    wx.setStorageSync('lastStudyRole', nextStudyRole);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      phaseCopy: buildPhaseCopy(data.planPhaseLabel),
      groupedDailyTasks,
      hasGroupedTasks: groupedDailyTasks.length > 0,
      identityConfirmVisible: !page.isIdentityConfirmed(),
      modeChangedNoticeVisible
    }, this.buildStudyModePresentation(data.currentMember))));
    console.log(`[perf][home] onShow total=${Date.now() - startedAt}ms tasks=${(data.dailyTasks || []).length}`);
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
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
        groupedDailyTasks: this.data.groupedDailyTasks,
        hasGroupedTasks: this.data.hasGroupedTasks,
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
