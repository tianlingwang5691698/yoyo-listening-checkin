const test = require('node:test');
const assert = require('node:assert/strict');

const checkinEngine = require('../lib/checkin-engine');

test('全部完成后写入当天打卡并回写日报', async () => {
  let savedCheckin = null;
  let upsertReportArgs = null;
  const result = await checkinEngine.maybeCreateCheckin({
    familyId: 'family-1',
    childId: 'child-1',
    userId: 'user-1',
    openId: 'open-1',
    memberId: 'member-1'
  }, [
    { category: 'peppa', date: '2026-04-21', taskId: 'peppa-1', completedToday: true }
  ], '2026-04-21', { planDayIndex: 1 }, {
    getCheckins: async () => [],
    getPlanDayIndex: () => 1,
    buildPlanForDay: () => ({
      dayIndex: 1,
      phase: { key: 'round-1' },
      flatTasks: [{ category: 'peppa', taskId: 'peppa-1', isPendingAsset: false }]
    }),
    getTaskProgressForDate: () => ({ completedToday: true }),
    computeStreak: () => 0,
    upsertCheckin: async (_existing, next) => {
      savedCheckin = next;
    },
    upsertDailyReport: async (scope, date) => {
      upsertReportArgs = { scope, date };
    }
  });

  assert.equal(result.date, '2026-04-21');
  assert.equal(result.planDayIndex, 1);
  assert.equal(savedCheckin.recordId, 'family-1_child-1_2026-04-21');
  assert.deepEqual(upsertReportArgs, {
    scope: {
      familyId: 'family-1',
      childId: 'child-1',
      userId: 'user-1',
      openId: 'open-1',
      memberId: 'member-1'
    },
    date: '2026-04-21'
  });
});

test('未全部完成时不写打卡', async () => {
  let writeCount = 0;
  const result = await checkinEngine.maybeCreateCheckin({
    familyId: 'family-1',
    childId: 'child-1'
  }, [], '2026-04-21', {}, {
    getCheckins: async () => [],
    getPlanDayIndex: () => 1,
    buildPlanForDay: () => ({
      dayIndex: 1,
      phase: { key: 'round-1' },
      flatTasks: [{ category: 'peppa', taskId: 'peppa-1', isPendingAsset: false }]
    }),
    getTaskProgressForDate: () => ({ completedToday: false }),
    computeStreak: () => 0,
    upsertCheckin: async () => { writeCount += 1; },
    upsertDailyReport: async () => { writeCount += 1; }
  });

  assert.equal(result, null);
  assert.equal(writeCount, 0);
});
