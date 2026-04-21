function createCurrentMemberDefaults() {
  return {
    studyRole: 'parent'
  };
}

function createDashboardDefaults() {
  return {
    user: {},
    currentUser: {},
    currentMember: createCurrentMemberDefaults(),
    child: Object.assign(createChildDefaults(), {
      welcomeLine: '云端数据暂时不可用，请稍后重试。'
    }),
    stats: createStatsDefaults(),
    planDayIndex: 1,
    planPhase: '',
    planPhaseLabel: '第1轮',
    planTaskCount: 0,
    dailyTasks: [],
    groupedDailyTasks: [],
    categorySummaries: [],
    activeTaskCount: 0,
    completedTaskCountToday: 0,
    allDailyDone: false,
    catchupState: createCatchupStateDefaults()
  };
}

function createFamilyPageDefaults() {
  return {
    family: null,
    user: {},
    currentUser: {},
    currentMember: createCurrentMemberDefaults(),
    members: [],
    child: createChildDefaults(),
    subscriptionPreference: null
  };
}

function createChildDefaults() {
  return {
    nickname: '',
    avatarText: '',
    childLoginCode: ''
  };
}

function createStatsDefaults() {
  return {
    streakDays: 0,
    completedDays: 0,
    completedLessons: 0,
    completedTasks: 0,
    totalMinutes: 0,
    lastCheckinAt: '',
    lastCheckinDate: ''
  };
}

function createCatchupStateDefaults() {
  return {
    canCatchup: false,
    missedDate: '',
    planDayIndex: 0,
    usedToday: false,
    reason: ''
  };
}

function createTaskProgressDefaults() {
  return {
    playCount: 0,
    playStepText: '0/3',
    currentPass: 1,
    repeatTarget: 3,
    textUnlocked: false,
    transcriptVisible: true,
    completedToday: false
  };
}

function createReportDefaults(date) {
  return {
    reportId: '',
    date: date || '',
    completedCategories: [],
    totalMinutes: 0,
    streakSnapshot: 0,
    planDayIndex: 0,
    planPhase: '',
    items: [],
    pushStatus: '',
    inAppVisible: true,
    updatedAt: ''
  };
}

function createTaskDetailDefaults() {
  return {
    user: {},
    currentUser: {},
    currentMember: createCurrentMemberDefaults(),
    child: null,
    stats: createStatsDefaults(),
    task: null,
    progress: createTaskProgressDefaults(),
    categoryTasks: [],
    categoryTaskCount: 0,
    categoryCompletedCount: 0,
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    planRunType: 'normal',
    targetDate: '',
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    todayRecord: null,
    history: [],
    studyWriteAllowed: false,
    studyWriteMessage: '',
    checkinReady: false,
    transcriptPendingLoad: false
  };
}

module.exports = {
  createCurrentMemberDefaults,
  createDashboardDefaults,
  createChildDefaults,
  createFamilyPageDefaults,
  createStatsDefaults,
  createCatchupStateDefaults,
  createTaskProgressDefaults,
  createReportDefaults,
  createTaskDetailDefaults
};
