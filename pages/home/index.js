const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const monitor = require('../../utils/monitor');
const labels = require('../../utils/labels');
const completed = require('../../utils/completed');

const VOCABULARY_ITEM_KEYS = [
  'listeningFlashcardItemsV1',
  'readingFlashcardItemsV1',
  'grammarFlashcardItemsV1',
  'writingFlashcardItemsV1',
  'speakingFlashcardItemsV1'
];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDisplayText() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  return `${month}月${day}日（${week}）`;
}

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 11) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function profileInitial(child) {
  const name = String((child && child.nickname) || 'Y');
  return name.slice(0, 1).toUpperCase();
}

function buildVocabularySummary() {
  const today = todayString();
  const seen = {};
  const items = VOCABULARY_ITEM_KEYS.reduce((list, key) => {
    try {
      return list.concat(wx.getStorageSync(key) || []);
    } catch (error) {
      return list;
    }
  }, []).filter((item) => {
    if (!item || item.familiarLevel === 'mastered') return false;
    const text = item.flashcardKey || `${item.type || 'word'}:${item.text || item.word || item.phrase || ''}`;
    if (!text || seen[text]) return false;
    seen[text] = true;
    return true;
  });
  const dueItems = items.filter((item) => !item.nextReviewDate || item.nextReviewDate <= today);
  return {
    total: items.length,
    due: dueItems.length,
    words: items.filter((item) => item.type !== 'phrase').length,
    phrases: items.filter((item) => item.type === 'phrase').length
  };
}

function buildListeningSummary(groupedDailyTasks) {
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  const nextGroup = groups.find((item) => Number(item.completedCount || 0) < Number(item.totalCount || 0));
  if (!groups.length) return '同步中';
  if (total > 0 && completed >= total) return '今日已完成';
  return `${completed}/${total || groups.length} 完成 · ${(nextGroup && nextGroup.categoryLabel) || '继续'}`;
}

function buildListeningTaskStatus(groupedDailyTasks) {
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  if (!groups.length || !total) {
    return {
      title: '今日任务',
      copy: '听力任务准备中',
      action: '准备中',
      pending: false
    };
  }
  const pending = completed < total;
  return {
    title: '今日任务',
    copy: `听力 ${completed}/${total} · ${pending ? '待完成' : '已完成'}`,
    action: pending ? '继续学习 →' : '查看记录',
    pending
  };
}

function findNextListeningTask(groupedDailyTasks) {
  const groups = groupedDailyTasks || [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex] || {};
    const task = (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset);
    if (task) {
      return {
        category: task.category || group.category || '',
        taskId: task.taskId || ''
      };
    }
  }
  return null;
}

function buildReadingSummary(passage, completed) {
  if (!passage) return '6-9 年级阅读';
  if (completed) return '今日已完成';
  return `${passage.questionCount || 0} 题 · ${(passage.meta || '').split(' · ')[0] || '今日阅读'}`;
}

function buildTodayCompletedItems(groupedDailyTasks, readingToday, readingCompleted) {
  let speakingAttempts = [];
  try {
    const report = wx.getStorageSync('todayReportForCompletedV1') || null;
    speakingAttempts = report && Array.isArray(report.speakingAttempts) ? report.speakingAttempts : [];
  } catch (error) {
    speakingAttempts = [];
  }
  const listeningItems = (groupedDailyTasks || []).reduce((list, group) => {
    (group.tasks || []).forEach((task) => {
      if (task.completedToday) {
        const attempts = speakingAttempts.filter((attempt) => (
          attempt.category === (task.category || group.category)
          && (attempt.taskId === task.taskId || attempt.taskId === task.originalTaskId)
        ));
        list.push({
          type: attempts.length ? 'speaking' : 'listening',
          title: task.displayTitle || task.title || group.categoryLabel,
          meta: attempts.length ? '回答评分' : (group.categoryLabel || task.category || '听力'),
          category: task.category || group.category || '',
          taskId: task.taskId || '',
          progressText: task.progressText || '',
          attempts,
          completedToday: true
        });
      }
    });
    return list;
  }, []);
  if (readingCompleted && readingToday) {
    listeningItems.push({
      type: 'reading',
      title: readingToday.title || '阅读',
      meta: '阅读',
      passageId: readingToday._id || '',
      completedToday: true,
      latestAttempt: readingToday.latestAttempt || null
    });
  }
  const extraItems = (this && this.data && this.data.cloudCompletedItems) || completed.getTodayCompletedItems();
  const seen = {};
  return listeningItems.concat(extraItems).filter((item) => {
    const key = item.id || `${item.type}:${item.title}:${item.passageId || item.topicId || ''}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

Page({
  data: page.createCloudPageData({
    child: contracts.createChildDefaults(),
    profileInitial: 'Y',
    currentMember: contracts.createCurrentMemberDefaults(),
    planDayIndex: 1,
    todayDisplay: todayDisplayText(),
    greeting: greetingText(),
    planPhaseLabel: '第1轮',
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    studyRole: 'parent',
    identityConfirmVisible: true,
    modeChangedNoticeVisible: false,
    homeLoading: true,
    readingLoading: true,
    readingToday: null,
    readingCompleted: false,
    listeningSummary: '同步中',
    listeningTaskStatus: buildListeningTaskStatus([]),
    nextListeningTask: null,
    readingSummary: '6-9 年级阅读',
    vocabularySummary: buildVocabularySummary(),
    todayCompletedItems: [],
    cloudCompletedItems: []
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
      profileInitial: profileInitial(data.child),
      currentMember: data.currentMember,
      planDayIndex: data.planDayIndex,
      planPhaseLabel: data.planPhaseLabel,
      groupedDailyTasks,
      hasGroupedTasks: !!groupedDailyTasks.length,
      listeningSummary: buildListeningSummary(groupedDailyTasks),
      listeningTaskStatus: buildListeningTaskStatus(groupedDailyTasks),
      nextListeningTask: findNextListeningTask(groupedDailyTasks),
      todayCompletedItems: buildTodayCompletedItems.call(this, groupedDailyTasks, this.data.readingToday, this.data.readingCompleted),
      identityConfirmVisible: !page.isIdentityConfirmed(),
      modeChangedNoticeVisible,
      homeLoading: false
    }, this.buildStudyModePresentation(data.currentMember))));
    return groupedDailyTasks;
  },
  applyReadingHome(data) {
    const passage = data.passage || null;
    const completed = !!data.completedToday;
    this.setData({
      readingLoading: false,
      readingToday: passage,
      readingCompleted: completed,
      readingSummary: buildReadingSummary(passage, completed),
      todayCompletedItems: buildTodayCompletedItems.call(this, this.data.groupedDailyTasks, passage, completed)
    });
  },
  async loadStudyCompletions() {
    try {
      const data = await store.getStudyCompletions({ date: todayString() });
      const items = data && Array.isArray(data.items) ? data.items : [];
      this.setData({
        cloudCompletedItems: items,
        todayCompletedItems: buildTodayCompletedItems.call(this, this.data.groupedDailyTasks, this.data.readingToday, this.data.readingCompleted)
      });
    } catch (error) {}
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
      homeLoading: true,
      todayDisplay: todayDisplayText(),
      greeting: greetingText(),
      vocabularySummary: buildVocabularySummary()
    });
    const data = await store.getDashboard({ view: 'home' }, (fresh) => this.applyDashboard(fresh));
    const groupedDailyTasks = this.applyDashboard(data);
    try {
      const reportData = await store.getDailyReportByDate(todayString());
      wx.setStorageSync('todayReportForCompletedV1', reportData.report || null);
      this.setData({
        todayCompletedItems: buildTodayCompletedItems.call(this, this.data.groupedDailyTasks, this.data.readingToday, this.data.readingCompleted)
      });
    } catch (error) {}
    this.loadStudyCompletions();
    this.loadReadingHome();
    monitor.logPerf('home', 'onShow', Date.now() - startedAt, {
      groups: groupedDailyTasks.length
    });
  },
  async confirmStudyIdentity(event) {
    const nextRole = event.currentTarget.dataset.role === 'student' ? 'student' : 'parent';
    page.setIdentityConfirmed(true);
    wx.setStorageSync('lastStudyRole', nextRole);
    if (nextRole === 'student') {
      wx.setStorageSync('hasUsedStudentMode', 'yes');
    }
    this.setData(Object.assign({
      identityConfirmVisible: false,
      modeChangedNoticeVisible: false
    }, this.buildStudyModePresentation({ studyRole: nextRole })));
    try {
      const data = await store.setStudyRole(nextRole);
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
    } catch (error) {
      wx.showToast({
        title: '已本机切换，云端稍后同步',
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
  openListening() {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/material/index?module=listening'
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
  openGrammar() {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/grammar/index'
    });
  },
  openTest() {
    wx.showToast({
      title: '测试模块准备中',
      icon: 'none'
    });
  },
  openWriting() {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/material/index?module=writing'
    });
  },
  openSpeaking() {
    if (this.data.identityConfirmVisible) {
      wx.showToast({
        title: '先选择身份',
        icon: 'none'
      });
      return;
    }
    wx.showToast({
      title: '口语练习准备中',
      icon: 'none'
    });
  },
  openVocabulary() {
    wx.navigateTo({
      url: '/pages/reading/flashcards/index'
    });
  },
  openCompleted() {
    if (this.data.listeningTaskStatus && this.data.listeningTaskStatus.pending && this.data.nextListeningTask && this.data.nextListeningTask.category) {
      const task = this.data.nextListeningTask;
      wx.navigateTo({
        url: task.taskId
          ? `/pages/lesson/index?category=${task.category}&taskId=${task.taskId}`
          : `/pages/lesson/index?category=${task.category}`
      });
      return;
    }
    wx.setStorageSync('todayCompletedItemsV1', this.data.todayCompletedItems || []);
    wx.navigateTo({
      url: '/pages/home/completed/index'
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
