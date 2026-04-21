const test = require('node:test');
const assert = require('node:assert/strict');

const familyService = require('../services/family.service');
const dashboardService = require('../services/dashboard.service');
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
    includeTaskProgressSummary: true
  });
  assert.deepEqual(recordResult, {
    includeDailyTasks: false,
    includeHomeTaskGroups: false,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: false
  });
});
