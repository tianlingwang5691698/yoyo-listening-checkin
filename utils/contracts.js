/**
 * @typedef {Object} CurrentMemberData
 * @property {'student'|'parent'} studyRole
 */

/**
 * @typedef {Object} ChildData
 * @property {string} nickname
 * @property {string} avatarText
 * @property {string} childLoginCode
 */

/**
 * @typedef {Object} StatsData
 * @property {number} streakDays
 * @property {number} completedDays
 * @property {number} completedLessons
 * @property {number} completedTasks
 * @property {number} totalMinutes
 * @property {string} lastCheckinAt
 * @property {string} lastCheckinDate
 */

/**
 * @typedef {Object} CatchupStateData
 * @property {boolean} canCatchup
 * @property {string} missedDate
 * @property {number} planDayIndex
 * @property {boolean} usedToday
 * @property {string} reason
 */

/**
 * @typedef {Object} TaskProgressData
 * @property {number} playCount
 * @property {string} playStepText
 * @property {number} currentPass
 * @property {number} repeatTarget
 * @property {boolean} textUnlocked
 * @property {boolean} transcriptVisible
 * @property {boolean} completedToday
 */

/**
 * @typedef {Object} ReportData
 * @property {string} reportId
 * @property {string} date
 * @property {string[]} completedCategories
 * @property {number} totalMinutes
 * @property {number} streakSnapshot
 * @property {number} planDayIndex
 * @property {string} planPhase
 * @property {any[]} items
 * @property {string} pushStatus
 * @property {boolean} inAppVisible
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} DashboardData
 * @property {Object} user
 * @property {Object} currentUser
 * @property {CurrentMemberData} currentMember
 * @property {ChildData & {welcomeLine: string}} child
 * @property {StatsData} stats
 * @property {number} planDayIndex
 * @property {string} planPhase
 * @property {string} planPhaseLabel
 * @property {number} planTaskCount
 * @property {any[]} dailyTasks
 * @property {any[]} groupedDailyTasks
 * @property {any[]} categorySummaries
 * @property {number} activeTaskCount
 * @property {number} completedTaskCountToday
 * @property {boolean} allDailyDone
 * @property {CatchupStateData} catchupState
 */

/**
 * @typedef {Object} FamilyPageData
 * @property {Object|null} family
 * @property {Object} user
 * @property {Object} currentUser
 * @property {CurrentMemberData} currentMember
 * @property {any[]} members
 * @property {ChildData} child
 * @property {Object|null} subscriptionPreference
 */

/**
 * @typedef {Object} TaskDetailData
 * @property {Object} user
 * @property {Object} currentUser
 * @property {CurrentMemberData} currentMember
 * @property {ChildData|null} child
 * @property {StatsData} stats
 * @property {Object|null} task
 * @property {TaskProgressData} progress
 * @property {any[]} categoryTasks
 * @property {number} categoryTaskCount
 * @property {number} categoryCompletedCount
 * @property {number} planDayIndex
 * @property {string} planPhaseLabel
 * @property {string} planRunType
 * @property {string} targetDate
 * @property {Object|null} scriptSource
 * @property {Object|null} transcriptTrack
 * @property {any[]} transcriptLines
 * @property {Object|null} todayRecord
 * @property {any[]} history
 * @property {boolean} studyWriteAllowed
 * @property {string} studyWriteMessage
 * @property {boolean} checkinReady
 * @property {boolean} transcriptPendingLoad
 */

/** @returns {CurrentMemberData} */
function createCurrentMemberDefaults() {
  return {
    studyRole: 'parent'
  };
}

/** @returns {DashboardData} */
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

/** @returns {FamilyPageData} */
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

/** @returns {ChildData} */
function createChildDefaults() {
  return {
    nickname: '',
    avatarText: '',
    childLoginCode: ''
  };
}

/** @returns {StatsData} */
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

/** @returns {CatchupStateData} */
function createCatchupStateDefaults() {
  return {
    canCatchup: false,
    missedDate: '',
    planDayIndex: 0,
    usedToday: false,
    reason: ''
  };
}

/** @returns {TaskProgressData} */
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

/** @param {string=} date
 *  @returns {ReportData}
 */
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

/** @returns {TaskDetailData} */
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
