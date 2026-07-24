const test = require('node:test');
const assert = require('node:assert/strict');

const taskService = require('../services/task.service');
const study = require('../facades/study.facade');

function fixedTask(overrides = {}) {
  return Object.assign({
    category: 'unlock1workbook',
    taskId: 'unlock1workbook-1__fixed_listening_round_1',
    originalTaskId: 'unlock1workbook-1',
    planSlotIndex: 1,
    planSlotCount: 1,
    planDayIndex: 86,
    playCount: 0,
    repeatTarget: 3,
    completedToday: false,
    transcriptVisible: false
  }, overrides);
}

test('佑佑固定计划详情优先使用当日独立任务', async (t) => {
  let standaloneReads = 0;
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'student' }, child: { childId: 'child-yoyo', childLoginCode: '317613' } },
    today: '2026-07-24'
  }));
  t.mock.method(study, 'getDashboardData', async () => ({
    planSource: 'fixed-yoyo',
    dailyTasks: [fixedTask()],
    planDayIndex: 86,
    planPhaseLabel: '阶段二',
    allDailyDone: false,
    catchupState: { canCatchup: false, missedDate: '', planDayIndex: 0 }
  }));
  t.mock.method(study, 'getUserScope', () => ({ childId: 'child-yoyo' }));
  t.mock.method(study, 'getChildProgressRecords', async () => []);
  t.mock.method(study, 'getCheckins', async () => []);
  t.mock.method(study, 'resolveStandaloneCategoryTasks', async () => {
    standaloneReads += 1;
    return [fixedTask({ taskId: 'unlock1workbook-1', originalTaskId: '', planSlotIndex: 0 })];
  });
  t.mock.method(study, 'normalizeStudyRole', () => 'student');
  t.mock.method(study, 'isStudyWriteAllowed', () => true);
  t.mock.method(study, 'isYoyoChild', () => true);

  const result = await taskService.getTaskDetail({
    payload: { view: 'lesson', planRunType: 'normal', category: 'unlock1workbook' }
  });

  assert.equal(result.task.taskId, 'unlock1workbook-1__fixed_listening_round_1');
  assert.equal(result.task.planSlotIndex, 1);
  assert.equal(standaloneReads, 0);
});

test('佑佑从旧快照完成独立任务时恢复固定计划槽位', async (t) => {
  const saved = [];
  let progressRecords = [];
  let standaloneReads = 0;
  t.mock.method(study, 'prepareRequestContext', async () => ({
    ctx: { member: { studyRole: 'student' }, child: { childId: 'child-yoyo', childLoginCode: '317613' } },
    today: '2026-07-24'
  }));
  t.mock.method(study, 'getUserScope', () => ({
    userId: 'user-1', openId: 'open-1', memberId: 'member-1', familyId: 'family-1', childId: 'child-yoyo'
  }));
  t.mock.method(study, 'getChildProgressRecords', async () => progressRecords);
  t.mock.method(study, 'getCheckins', async () => []);
  t.mock.method(study, 'isStudyWriteAllowed', () => true);
  t.mock.method(study, 'normalizeStudyRole', () => 'student');
  t.mock.method(study, 'getActiveListeningPlan', async () => null);
  t.mock.method(study, 'isYoyoChild', () => true);
  t.mock.method(study, 'getPeppaReviewPlanOptions', () => ({}));
  t.mock.method(study, 'buildFixedPlanBySlots', () => ({
    dayIndex: 86,
    phase: { key: 'round-2', label: '阶段二' },
    flatTasks: [fixedTask()],
    byCategory: { unlock1: [fixedTask()] }
  }));
  t.mock.method(study, 'decorateFixedSlotPlanTasks', (records) => [fixedTask(records.length ? {
    playCount: 3,
    completedToday: true
  } : {})]);
  t.mock.method(study, 'resolveStandaloneCategoryTasks', async () => {
    standaloneReads += 1;
    return [fixedTask({ taskId: 'unlock1workbook-1', originalTaskId: '', planSlotIndex: 0 })];
  });
  t.mock.method(study, 'saveProgressRecord', async (record) => {
    saved.push(record);
    progressRecords = [record];
  });
  t.mock.method(study, 'syncFixedPlanProgressSummary', async () => {});
  t.mock.method(study, 'upsertDailyReport', async () => {});
  t.mock.method(study, 'maybeCreateCheckin', async () => null);

  await taskService.markTaskListened({
    payload: {
      category: 'unlock1workbook',
      taskId: 'unlock1workbook-1',
      planRunType: 'normal',
      completeOnListen: true,
      continuousQueueV1: true
    }
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].taskId, 'unlock1workbook-1__fixed_listening_round_1');
  assert.equal(saved[0].originalTaskId, 'unlock1workbook-1');
  assert.equal(saved[0].planSlotIndex, 1);
  assert.equal(saved[0].completedToday, true);
  assert.equal(standaloneReads, 0);
});
