const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');
const LEVEL_STAGE_SNAPSHOT_KEY = 'levelStageSnapshotV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const ENTRY_POSTER_DISMISSED_KEY = 'homeEntryPosterDismissedV1';
const TODAY_COMPLETED_CACHE_KEY = 'todayCompletedItemsV1';

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
  const name = String((child && (child.avatarText || child.nickname)) || '学');
  return name.slice(0, 1).toUpperCase();
}

function isDefaultChildNickname(child) {
  const value = String((child && child.nickname) || '').trim();
  const childLoginCode = String((child && child.childLoginCode) || '').trim();
  return !!(child && child.nicknameRequired) || !value || ['同学', '我'].includes(value) || (value === '佑佑' && childLoginCode !== '317613');
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

function buildListeningSummary(groupedDailyTasks, options = {}) {
  if (options.needsListeningPlanSetup) return '设置听力计划';
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  const nextGroup = groups.find((item) => Number(item.completedCount || 0) < Number(item.totalCount || 0));
  if (!groups.length) return '进入听力';
  if (total > 0 && completed >= total) return '今日已完成';
  return `${completed}/${total || groups.length} 完成 · ${(nextGroup && nextGroup.categoryLabel) || '继续'}`;
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

function getListeningDurationSec(groupedDailyTasks) {
  return (groupedDailyTasks || []).reduce((sum, group) => {
    const groupDuration = Number(group && group.durationSec || 0);
    if (groupDuration > 0) {
      return sum + groupDuration;
    }
    return sum + ((group && group.tasks) || []).reduce((taskSum, task) => (
      taskSum + (Number(task.durationSec || 0) * Number(task.repeatTarget || 1))
    ), 0);
  }, 0);
}

function buildListeningTaskStatus(groupedDailyTasks, options = {}) {
  if (options.needsListeningPlanSetup) {
    return {
      title: '今日任务',
      copy: '先设置听力计划',
      action: '设置计划 →',
      pending: false,
      setupRequired: true
    };
  }
  const groups = groupedDailyTasks || [];
  const total = groups.reduce((sum, item) => sum + Number(item.totalCount || 0), 0);
  const completed = groups.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
  if (!groups.length || !total) {
    return {
      title: '今日任务',
      copy: '暂无今日听力任务',
      action: '设置计划 →',
      pending: false,
      setupRequired: true
    };
  }
  const pending = completed < total;
  const durationSec = getListeningDurationSec(groups);
  const durationText = durationSec > 0 ? `预计 ${formatEstimatedDuration(durationSec)}` : '时长待生成';
  return {
    title: '今日任务',
    copy: `听力 ${completed}/${total} · ${durationText} · ${pending ? '待完成' : '已完成'}`,
    action: pending ? '继续学习 →' : '查看记录',
    pending,
    setupRequired: false
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

function getCurrentPhaseKey(planPhaseLabel) {
  if (planPhaseLabel === '阶段二') return 'round-2';
  if (planPhaseLabel === '阶段三') return 'round-3';
  return 'round-1';
}

function isEntryPosterDismissed() {
  try {
    return wx.getStorageSync(ENTRY_POSTER_DISMISSED_KEY) === 'yes';
  } catch (error) {
    return false;
  }
}

function shouldShowEntryPoster() {
  return true;
}

function shouldShowIdentityConfirm() {
  return true;
}

function buildStageSnapshotTaskGroups(groupedDailyTasks) {
  return (groupedDailyTasks || []).map((group) => {
    const task = (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset)
      || (group.tasks || [])[0]
      || group.nextTask
      || {};
    const disabled = !!(task.isPendingAsset || group.isPendingAsset);
    const tasks = (group.tasks || []).map((sourceTask, index) => ({
      taskId: sourceTask.taskId || '',
      title: sourceTask.displayTitle || sourceTask.title || group.programSubtitle || '',
      meta: [sourceTask.textType || group.textType || '', sourceTask.progressText ? `进度 ${sourceTask.progressText}` : ''].filter(Boolean).join(' · '),
      orderText: sourceTask.planSlotIndex ? `${sourceTask.planSlotIndex}` : `${index + 1}`,
      completedToday: !!sourceTask.completedToday,
      stateText: sourceTask.completedToday ? '完成' : '开始',
      taskSnapshot: sourceTask,
      disabled: !!sourceTask.isPendingAsset
    }));
    return {
      category: task.category || group.category || '',
      categoryLabel: group.categoryLabel || task.categoryLabel || '',
      title: task.displayTitle || task.title || group.programSubtitle || '',
      taskCountText: Number(group.totalCount || 0) ? `${Number(group.totalCount || 0)} 个任务` : '',
      textType: task.textType || group.textType || '',
      minutesText: group.minutesText || '',
      minutes: Number(group.minutes || 0),
      durationSec: Number(group.durationSec || 0),
      taskId: task.taskId || '',
      tasks,
      taskSnapshot: task,
      disabled,
      stateText: task.completedToday ? '完成' : disabled ? '等待' : '›',
      planRunType: task.planRunType || group.planRunType || 'normal',
      planDayIndex: task.planDayIndex || group.planDayIndex || 0
    };
  });
}

function buildTodayCompletedItems(groupedDailyTasks) {
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
          taskSnapshot: task,
          attempts,
          completedToday: true
        });
      }
    });
    return list;
  }, []);
  const seen = {};
  return listeningItems.filter((item) => {
    const key = item.id || `${item.type}:${item.category || ''}:${item.taskId || ''}:${item.title || ''}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function buildCompletedCacheTarget(child) {
  const source = child || {};
  return {
    targetFamilyId: String(source.familyId || '').trim(),
    targetChildId: String(source.childId || '').trim(),
    childLoginCode: String(source.childLoginCode || '').trim()
  };
}

function isListeningCompletedCacheItem(item) {
  return item
    && (item.type === 'listening' || item.type === 'speaking')
    && !!item.category
    && !!item.taskId;
}

function writeTodayCompletedCache(child, items) {
  try {
    wx.setStorageSync(TODAY_COMPLETED_CACHE_KEY, {
      date: todayString(),
      target: buildCompletedCacheTarget(child),
      items: (items || []).filter(isListeningCompletedCacheItem)
    });
  } catch (error) {}
}

function buildCompletedUrl(child) {
  const target = buildCompletedCacheTarget(child);
  const query = [
    `date=${todayString()}`,
    'scope=listening',
    target.targetFamilyId ? `targetFamilyId=${encodeURIComponent(target.targetFamilyId)}` : '',
    target.targetChildId ? `targetChildId=${encodeURIComponent(target.targetChildId)}` : '',
    target.childLoginCode ? `childLoginCode=${encodeURIComponent(target.childLoginCode)}` : ''
  ].filter(Boolean).join('&');
  return `/pages/home/completed/index?${query}`;
}

Page({
  data: page.createCloudPageData({
    child: contracts.createChildDefaults(),
    profileInitial: '学',
    currentMember: contracts.createCurrentMemberDefaults(),
    planDayIndex: 1,
    todayDisplay: todayDisplayText(),
    greeting: greetingText(),
    planPhaseLabel: '第1轮',
    groupedDailyTasks: [],
    hasGroupedTasks: false,
    planSource: 'none',
    needsListeningPlanSetup: false,
    studyRole: 'parent',
    identityConfirmVisible: true,
    modeChangedNoticeVisible: false,
    homeLoading: true,
    readingLoading: true,
    readingToday: null,
    readingCompleted: false,
    listeningSummary: '进入听力',
    listeningTaskStatus: buildListeningTaskStatus([]),
    nextListeningTask: null,
    readingSummary: '进入阅读',
    vocabularySummary: buildVocabularySummary(),
    todayCompletedItems: [],
    entryPosterVisible: true,
    entryPosterPage: 0,
    identitySelectedInSession: false,
    nicknameRequired: false,
    nicknameInput: ''
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
    const needsListeningPlanSetup = !!data.needsListeningPlanSetup || data.planSource === 'none';
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
      syncMode: data.syncMode,
      isReviewBuild: data.isReviewBuild,
      showCloudDebug: data.showCloudDebug,
      syncDebug: data.syncDebug,
      child: data.child,
      nicknameRequired: isDefaultChildNickname(data.child),
      nicknameInput: isDefaultChildNickname(data.child) ? '' : ((data.child && data.child.nickname) || ''),
      profileInitial: profileInitial(data.child),
      currentMember: data.currentMember,
      planDayIndex: data.planDayIndex,
      planPhaseLabel: data.planPhaseLabel,
      planSource: data.planSource || 'none',
      needsListeningPlanSetup,
      groupedDailyTasks,
      hasGroupedTasks: !!groupedDailyTasks.length,
      listeningSummary: buildListeningSummary(groupedDailyTasks, { needsListeningPlanSetup }),
      listeningTaskStatus: buildListeningTaskStatus(groupedDailyTasks, { needsListeningPlanSetup }),
      nextListeningTask: findNextListeningTask(groupedDailyTasks),
      todayCompletedItems: buildTodayCompletedItems(groupedDailyTasks),
      identityConfirmVisible: !this.data.identitySelectedInSession,
      modeChangedNoticeVisible,
      homeLoading: false
    }, this.buildStudyModePresentation(data.currentMember))));
    return groupedDailyTasks;
  },
  ensureNicknameReady() {
    if (!this.data.nicknameRequired) {
      return true;
    }
    wx.showToast({
      title: '请更换其他名字',
      icon: 'none'
    });
    return false;
  },
  ensureIdentityReady() {
    if (!this.data.identityConfirmVisible) {
      return true;
    }
    wx.showToast({
      title: '请先选择身份',
      icon: 'none'
    });
    return false;
  },
  handleNicknameInput(event) {
    this.setData({
      nicknameInput: event.detail.value
    });
  },
  async saveRequiredNickname() {
    const nickname = String(this.data.nicknameInput || '').trim();
    if (!nickname || ['同学', '我'].includes(nickname) || (nickname === '佑佑' && String((this.data.child && this.data.child.childLoginCode) || '').trim() !== '317613')) {
      wx.showToast({
        title: '请更换其他名字',
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.updateChildProfile(nickname);
      const child = data.child || Object.assign({}, this.data.child, { nickname, nicknameRequired: false });
      this.setData(page.buildCloudPageData(this.data, {
        child,
        nicknameInput: child.nickname || nickname,
        nicknameRequired: isDefaultChildNickname(child),
        profileInitial: profileInitial(child)
      }));
      wx.showToast({
        title: '昵称已保存',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    }
  },
  async onShow() {
    this.homePerf = page.startPagePerf('home');
    page.syncTheme(this);
    const tabBar = this.getTabBar && this.getTabBar();
    const identitySelectedInSession = !!this.data.identitySelectedInSession;
    const entryPosterVisible = !identitySelectedInSession && shouldShowEntryPoster();
    const identityConfirmVisible = !identitySelectedInSession && shouldShowIdentityConfirm();
    if (tabBar) {
      tabBar.setData({
        selected: 0,
        hidden: entryPosterVisible
      });
    }
    this.setData({
      homeLoading: true,
      todayDisplay: todayDisplayText(),
      greeting: greetingText(),
      vocabularySummary: buildVocabularySummary(),
      entryPosterVisible,
      identityConfirmVisible,
      entryPosterPage: entryPosterVisible ? 0 : this.data.entryPosterPage,
      identitySelectedInSession
    });
    const data = await store.getDashboard({ view: 'home' }, (fresh) => {
      const groups = this.applyDashboard(fresh);
      if (this.homePerf) {
        this.homePerf.mark('cloudRefresh', {
          groups: groups.length
        });
      }
    });
    const groupedDailyTasks = this.applyDashboard(data);
    if (this.homePerf) {
      this.homePerf.ready('pageReady', {
        cacheHit: !!data.__cacheHit,
        groups: groupedDailyTasks.length
      });
    }
    setTimeout(() => {
      writeTodayCompletedCache(this.data.child, this.data.todayCompletedItems || []);
    }, 100);
  },
  showNextEntryPosterPage() {
    this.setData({
      entryPosterPage: 1
    });
  },
  showPrevEntryPosterPage() {
    this.setData({
      entryPosterPage: 0
    });
  },
  closeEntryPoster() {
    try {
      wx.setStorageSync(ENTRY_POSTER_DISMISSED_KEY, 'yes');
    } catch (error) {}
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ hidden: false });
    }
    this.setData({
      entryPosterVisible: false
    });
  },
  async confirmStudyIdentity(event) {
    const nextRole = event.currentTarget.dataset.role === 'student' ? 'student' : 'parent';
    page.setIdentityConfirmed(true);
    try {
      wx.setStorageSync(ENTRY_POSTER_DISMISSED_KEY, 'yes');
    } catch (error) {}
    wx.setStorageSync('lastStudyRole', nextRole);
    if (nextRole === 'student') {
      wx.setStorageSync('hasUsedStudentMode', 'yes');
    }
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ hidden: false });
    }
    this.setData(Object.assign({
      identityConfirmVisible: false,
      modeChangedNoticeVisible: false,
      entryPosterVisible: false,
      identitySelectedInSession: true
    }, this.buildStudyModePresentation({ studyRole: nextRole })));
    try {
      const data = await store.setStudyRole(nextRole);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, {
        syncMode: data.syncMode,
        isReviewBuild: data.isReviewBuild,
        showCloudDebug: data.showCloudDebug,
        syncDebug: data.syncDebug,
        child: data.child,
        nicknameRequired: isDefaultChildNickname(data.child),
        nicknameInput: isDefaultChildNickname(data.child) ? '' : ((data.child && data.child.nickname) || ''),
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
    if (!this.ensureIdentityReady()) return;
    const category = event.currentTarget.dataset.category;
    const taskId = event.currentTarget.dataset.taskId;
    const disabled = event.currentTarget.dataset.disabled;
    if (!category || disabled === true || disabled === 'true') {
      return;
    }
    if (!this.ensureNicknameReady()) {
      return;
    }
    const query = taskId
      ? `/pages/lesson/index?category=${category}&taskId=${taskId}`
      : `/pages/lesson/index?category=${category}`;
    this.writeLessonTaskSnapshot(category, taskId);
    wx.navigateTo({
      url: query
    });
  },
  writeLessonTaskSnapshot(category, taskId) {
    const groups = this.data.groupedDailyTasks || [];
    const group = groups.find((item) => item.category === category) || null;
    const task = group
      ? ((group.tasks || []).find((item) => item.taskId === taskId)
        || (group.tasks || []).find((item) => !item.completedToday && !item.isPendingAsset)
        || (group.tasks || [])[0]
        || group.nextTask)
      : null;
    if (!task) return;
    const safeTaskId = taskId || task.taskId || '';
    snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${safeTaskId}`, {
      category,
      taskId: safeTaskId,
      task
    }, { source: 'home' });
  },
  openListening() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/material/index?module=listening'
    });
  },
  openReading() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/reading/index'
    });
  },
  openGrammar() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/grammar/index'
    });
  },
  openTest() {
    if (!this.ensureIdentityReady()) return;
    wx.showToast({
      title: '测试模块暂未开放',
      icon: 'none'
    });
  },
  openWriting() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/material/index?module=writing'
    });
  },
  openSpeaking() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/speaking/index'
    });
  },
  openVocabulary() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    wx.navigateTo({
      url: '/pages/reading/flashcards/index'
    });
  },
  openCompleted() {
    if (!this.ensureIdentityReady()) return;
    if (!this.ensureNicknameReady()) {
      return;
    }
    if (this.data.listeningTaskStatus && this.data.listeningTaskStatus.setupRequired) {
      wx.navigateTo({
        url: '/pages/listening-plan/index?levelId=A1'
      });
      return;
    }
    if (this.data.listeningTaskStatus && this.data.listeningTaskStatus.pending) {
      const phase = this.data.planSource === 'custom-listening'
        ? 'custom'
        : getCurrentPhaseKey(this.data.planPhaseLabel);
      const taskGroups = buildStageSnapshotTaskGroups(this.data.groupedDailyTasks);
      const totalMinutes = taskGroups.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
      snapshotStore.write(LEVEL_STAGE_SNAPSHOT_KEY, phase, {
        phase,
        taskGroups,
        totalMinutesText: totalMinutes ? `${totalMinutes} 分钟` : '待生成'
      }, { source: 'home-stage' });
      wx.navigateTo({
        url: `/pages/level-stage/index?levelId=${phase === 'custom' ? 'custom' : 'A1'}&phase=${phase}`
      });
      return;
    }
    writeTodayCompletedCache(this.data.child, this.data.todayCompletedItems || []);
    wx.navigateTo({
      url: buildCompletedUrl(this.data.child)
    });
  },
  openFamilyPage() {
    if (!this.ensureIdentityReady()) return;
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
