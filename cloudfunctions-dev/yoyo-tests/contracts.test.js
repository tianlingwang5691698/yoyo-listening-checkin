const test = require('node:test');
const assert = require('node:assert/strict');

const contracts = require('../../../utils/contracts');

test('契约工厂返回完整默认结构', () => {
  assert.deepEqual(contracts.createCurrentMemberDefaults(), {
    studyRole: 'parent'
  });

  assert.deepEqual(contracts.createDashboardDefaults(), {
    user: {},
    currentUser: {},
    currentMember: { studyRole: 'parent' },
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: '',
      welcomeLine: '云端数据暂时不可用，请稍后重试。'
    },
    stats: {
      streakDays: 0,
      completedDays: 0,
      completedLessons: 0,
      completedTasks: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
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
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0,
      usedToday: false,
      reason: ''
    }
  });

  assert.deepEqual(contracts.createChildDefaults(), {
    nickname: '',
    avatarText: '',
    childLoginCode: ''
  });

  assert.deepEqual(contracts.createStatsDefaults(), {
    streakDays: 0,
    completedDays: 0,
    completedLessons: 0,
    completedTasks: 0,
    totalMinutes: 0,
    lastCheckinAt: '',
    lastCheckinDate: ''
  });

  assert.deepEqual(contracts.createCatchupStateDefaults(), {
    canCatchup: false,
    missedDate: '',
    planDayIndex: 0,
    usedToday: false,
    reason: ''
  });

  assert.deepEqual(contracts.createTaskProgressDefaults(), {
    playCount: 0,
    playStepText: '0/3',
    currentPass: 1,
    repeatTarget: 3,
    textUnlocked: false,
    transcriptVisible: true,
    completedToday: false
  });

  assert.deepEqual(contracts.createReportDefaults('2026-04-21'), {
    reportId: '',
    date: '2026-04-21',
    completedCategories: [],
    totalMinutes: 0,
    streakSnapshot: 0,
    planDayIndex: 0,
    planPhase: '',
    items: [],
    pushStatus: '',
    inAppVisible: true,
    updatedAt: ''
  });

  assert.deepEqual(contracts.createTaskDetailDefaults(), {
    user: {},
    currentUser: {},
    currentMember: { studyRole: 'parent' },
    child: null,
    stats: {
      streakDays: 0,
      completedDays: 0,
      completedLessons: 0,
      completedTasks: 0,
      totalMinutes: 0,
      lastCheckinAt: '',
      lastCheckinDate: ''
    },
    task: null,
    progress: {
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      repeatTarget: 3,
      textUnlocked: false,
      transcriptVisible: true,
      completedToday: false
    },
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
  });
});

test('契约工厂每次返回独立对象', () => {
  const left = contracts.createCatchupStateDefaults();
  const right = contracts.createCatchupStateDefaults();
  left.reason = 'ready';
  assert.equal(right.reason, '');

  const leftReport = contracts.createReportDefaults();
  const rightReport = contracts.createReportDefaults();
  leftReport.items.push({ taskId: 'task-1' });
  assert.equal(rightReport.items.length, 0);
});
