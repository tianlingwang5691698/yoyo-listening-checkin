const test = require('node:test');
const assert = require('node:assert/strict');

const familyService = require('../services/family.service');
const dashboardService = require('../services/dashboard.service');
const taskService = require('../services/task.service');
const identityService = require('../services/identity.service');
const familyFacade = require('../facades/family.facade');
const studyFacade = require('../facades/study.facade');
const childRepository = require('../repositories/child.repository');

test('leaveFamily 退出后回到原本自己的记录', async (t) => {
  const calls = [];
  t.mock.method(familyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openId: 'open-1' },
      member: {
        _id: 'member-doc-1',
        memberId: 'member-1',
        openId: 'open-1',
        role: 'parent',
        familyId: 'family-child'
      }
    }
  }));
  t.mock.method(familyFacade, 'leaveCurrentFamily', async (ctx) => {
    calls.push(['leaveCurrentFamily', ctx.member.familyId]);
  });
  t.mock.method(familyFacade, 'ensureBootstrap', async () => ({
    user: { openId: 'open-1' },
    family: { familyId: 'family-self' },
    member: { memberId: 'member-1', role: 'owner', studyRole: 'student' },
    members: [{ memberId: 'member-1' }],
    child: { childLoginCode: '123456' },
    subscriptionPreference: { dailyReportEnabled: false }
  }));

  const result = await familyService.leaveFamily({});
  assert.equal(result.family.familyId, 'family-self');
  assert.equal(result.currentMember.role, 'owner');
  assert.equal(result.currentMember.studyRole, 'student');
  assert.deepEqual(calls, [['leaveCurrentFamily', 'family-child']]);
});

test('leaveCurrentFamily 对 owner 直接拒绝', async (t) => {
  const shared = require('../services/shared.service');
  const familyRepository = require('../repositories/family.repository');
  const subscriptionRepository = require('../repositories/subscription.repository');

  t.mock.method(familyRepository, 'findFamilyByOwnerOpenId', async () => null);
  t.mock.method(subscriptionRepository, 'findByMemberId', async () => null);

  await assert.rejects(
    () => shared.leaveCurrentFamily({
      member: {
        _id: 'member-doc-1',
        role: 'owner',
        memberId: 'member-1',
        openId: 'open-1'
      }
    }),
    /当前孩子主设备不能退出记录/
  );
});

test('setStudyRole 返回 currentMember 而不是 member', async (t) => {
  t.mock.method(familyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openId: 'open-1' },
      member: { memberId: 'member-1', studyRole: 'parent' }
    }
  }));
  t.mock.method(familyFacade, 'setExclusiveStudyRole', async () => {});
  t.mock.method(familyFacade, 'ensureBootstrap', async () => ({
    user: { openId: 'open-1' },
    family: { familyId: 'family-self' },
    member: { memberId: 'member-1', role: 'owner', studyRole: 'student' },
    members: [{ memberId: 'member-1' }],
    child: { childLoginCode: '123456' },
    subscriptionPreference: { dailyReportEnabled: false }
  }));

  const result = await identityService.setStudyRole({
    payload: { studyRole: 'student' }
  });

  assert.equal(result.currentMember.studyRole, 'student');
  assert.equal(result.currentMember.memberId, 'member-1');
  assert.equal(result.member, undefined);
});

test('joinFamilyByChildCode 会进入孩子记录', async (t) => {
  const calls = [];
  t.mock.method(familyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openId: 'open-1', userId: 'user-1' }
    }
  }));
  t.mock.method(childRepository, 'findByLoginCode', async (childLoginCode) => {
    assert.equal(childLoginCode, '123456');
    return { familyId: 'family-child' };
  });
  t.mock.method(familyFacade, 'upsertFamilyMemberForFamily', async (openId, userId, familyId, displayName) => {
    calls.push(['join', openId, userId, familyId, displayName]);
  });
  t.mock.method(familyFacade, 'ensureBootstrap', async () => ({
    user: { openId: 'open-1', userId: 'user-1' },
    family: { familyId: 'family-child' },
    member: { memberId: 'member-1', role: 'parent', studyRole: 'parent' },
    members: [{ memberId: 'member-1' }],
    child: { childLoginCode: '654321' },
    subscriptionPreference: { dailyReportEnabled: false }
  }));

  const result = await familyService.joinFamilyByChildCode({
    payload: { childLoginCode: '123456', displayName: '妈妈' }
  });

  assert.equal(result.family.familyId, 'family-child');
  assert.equal(result.currentMember.role, 'parent');
  assert.deepEqual(calls, [['join', 'open-1', 'user-1', 'family-child', '妈妈']]);
});

test('退出后再切学生会回到自己的学生态', async (t) => {
  t.mock.method(familyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openId: 'open-1' },
      member: { memberId: 'member-1', studyRole: 'parent' }
    }
  }));
  t.mock.method(familyFacade, 'setExclusiveStudyRole', async () => {});
  t.mock.method(familyFacade, 'ensureBootstrap', async () => ({
    user: { openId: 'open-1' },
    family: { familyId: 'family-self' },
    member: { memberId: 'member-1', role: 'owner', studyRole: 'student' },
    members: [{ memberId: 'member-1' }],
    child: { childLoginCode: '123456' },
    subscriptionPreference: { dailyReportEnabled: false }
  }));

  const result = await identityService.setStudyRole({
    payload: { studyRole: 'student' }
  });

  assert.equal(result.family.familyId, 'family-self');
  assert.equal(result.currentMember.studyRole, 'student');
  assert.equal(result.currentMember.role, 'owner');
});

test('getDashboard 按 view 返回不同 shape', async (t) => {
  t.mock.method(studyFacade, 'prepareRequestContext', async () => ({
    ctx: { user: {}, member: {}, family: {}, child: {} }
  }));
  t.mock.method(studyFacade, 'getDashboardData', async (_ctx, options) => options);

  const homeResult = await dashboardService.getDashboard({ payload: { view: 'home' } });
  const recordResult = await dashboardService.getDashboard({ payload: { view: 'record' } });

  assert.deepEqual(homeResult, {
    includeDailyTasks: false,
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: false
  });
  assert.deepEqual(recordResult, {
    includeDailyTasks: false,
    includeHomeTaskGroups: false,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: false,
    includeUser: false,
    includeFamily: false
  });
});

test('getTaskDetail lesson view 不返回首屏不用的大字段', async (t) => {
  t.mock.method(studyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { userId: 'user-1' },
      member: { memberId: 'member-1', studyRole: 'parent' },
      child: { childId: 'child-1' }
    },
    today: '2026-04-21'
  }));
  t.mock.method(studyFacade, 'getDashboardData', async () => ({
    dailyTasks: [{
      category: 'peppa',
      taskId: 'peppa-1',
      playCount: 0,
      repeatTarget: 3,
      transcriptVisible: true,
      completedToday: false
    }],
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    allDailyDone: false,
    catchupState: {
      canCatchup: false,
      missedDate: '',
      planDayIndex: 0
    },
    stats: { totalMinutes: 999 }
  }));
  t.mock.method(studyFacade, 'getUserScope', () => ({ childId: 'child-1' }));
  t.mock.method(studyFacade, 'getChildProgressRecords', async () => [
    { category: 'peppa', completedToday: true, date: '2026-04-20', taskId: 'old-task', playCount: 3 }
  ]);
  t.mock.method(studyFacade, 'getCheckins', async () => []);
  t.mock.method(studyFacade, 'normalizeStudyRole', () => 'parent');

  const result = await taskService.getTaskDetail({
    payload: {
      view: 'lesson',
      category: 'peppa',
      taskId: 'peppa-1'
    }
  });

  assert.equal(result.user, undefined);
  assert.equal(result.currentUser, undefined);
  assert.equal(result.stats, undefined);
  assert.deepEqual(result.history, []);
  assert.equal(result.task.taskId, 'peppa-1');
  assert.equal(result.currentMember.memberId, 'member-1');
});
