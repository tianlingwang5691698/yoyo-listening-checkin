const test = require('node:test');
const assert = require('node:assert/strict');

const familyService = require('../services/family.service');
const dashboardService = require('../services/dashboard.service');
const taskService = require('../services/task.service');
const identityService = require('../services/identity.service');
const familyFacade = require('../facades/family.facade');
const studyFacade = require('../facades/study.facade');
const childRepository = require('../repositories/child.repository');
const familyRepository = require('../repositories/family.repository');
const familyEngine = require('../lib/family-engine');
const bootstrapEngine = require('../lib/bootstrap-engine');

test('无目标学生时默认选择本机 owner 家庭', async () => {
  const ctx = await bootstrapEngine.ensureBootstrap('open-1', {
    findUserByOpenId: async () => ({ openId: 'open-1', userId: 'user-1' }),
    updateUserById: async () => {},
    createUser: async () => {},
    buildUserId: () => 'user-1',
    findMembersByOpenId: async () => [
      { familyId: 'family-bound', memberId: 'member-bound', role: 'parent', studyRole: 'parent' },
      { familyId: 'family-self', memberId: 'member-self', role: 'owner', studyRole: 'student' }
    ],
    createFamily: async () => {},
    createMember: async () => {},
    updateMemberById: async () => {},
    createSubscription: async () => {},
    createChild: async () => {},
    makeInviteCode: () => 'INVITE',
    makeUniqueChildLoginCode: async () => '123456',
    buildAvatarTextFromNickname: () => 'Y',
    childTemplate: {},
    normalizeStudyRole: (member) => member.studyRole || 'parent',
    getFamily: async (familyId) => ({ familyId }),
    findChildByFamilyId: async (familyId) => ({ familyId, childId: `${familyId}-child`, childLoginCode: '123456' }),
    updateChildById: async () => {},
    normalizeAndDedupeMembers: (members) => members,
    findMembersByFamilyId: async () => [],
    findSubscriptionByMemberId: async () => null
  });

  assert.equal(ctx.family.familyId, 'family-self');
  assert.equal(ctx.member.role, 'owner');
  assert.equal(ctx.child.childId, 'family-self-child');
});

test('强制本机学生时没有 owner 会创建本机家庭', async () => {
  const createdFamilies = [];
  const createdMembers = [];
  const ctx = await bootstrapEngine.ensureBootstrap('open-1', {
    findUserByOpenId: async () => ({ openId: 'open-1', userId: 'user-1' }),
    updateUserById: async () => {},
    createUser: async () => {},
    buildUserId: () => 'user-1',
    findMembersByOpenId: async () => [
      { familyId: 'family-bound', memberId: 'member-bound', role: 'parent', studyRole: 'parent' }
    ],
    createFamily: async (familyId, data) => createdFamilies.push({ familyId, data }),
    createMember: async (member) => createdMembers.push(member),
    updateMemberById: async () => {},
    createSubscription: async () => {},
    createChild: async () => {},
    makeInviteCode: () => 'INVITE',
    makeUniqueChildLoginCode: async () => '123456',
    buildAvatarTextFromNickname: () => 'Y',
    childTemplate: { childId: 'child-yoyo', nickname: '佑佑' },
    normalizeStudyRole: (member) => member.studyRole || 'parent',
    getFamily: async (familyId) => ({ familyId }),
    findChildByFamilyId: async (familyId) => ({ familyId, childId: `${familyId}-child`, childLoginCode: '123456' }),
    updateChildById: async () => {},
    normalizeAndDedupeMembers: (members) => members,
    findMembersByFamilyId: async () => [],
    findSubscriptionByMemberId: async () => null
  }, { forceSelf: true });

  assert.equal(createdFamilies.length, 1);
  assert.equal(createdMembers[0].role, 'owner');
  assert.equal(ctx.member.role, 'owner');
  assert.equal(ctx.member.studyRole, 'student');
});

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
  t.mock.method(familyRepository, 'findMembersByOpenId', async () => []);
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

test('joinFamilyByChildCode 禁止绑定自己的孩子 ID', async (t) => {
  t.mock.method(familyFacade, 'prepareRequestContext', async () => ({
    ctx: {
      user: { openId: 'open-1', userId: 'user-1' }
    }
  }));
  t.mock.method(childRepository, 'findByLoginCode', async () => ({ familyId: 'family-self' }));
  t.mock.method(familyRepository, 'findMembersByOpenId', async () => [{
    openId: 'open-1',
    familyId: 'family-self'
  }]);

  await assert.rejects(
    familyService.joinFamilyByChildCode({
      payload: { childLoginCode: '123456', displayName: '妈妈' }
    }),
    /不能绑定自己的孩子 ID/
  );
});

test('老师绑定新学生时保留原有学生绑定', async () => {
  const created = [];
  const updates = [];
  const joinedMemberId = await familyEngine.upsertFamilyMemberForFamily('open-1', 'user-1', 'family-new', '老师', {
    findMembersByOpenId: async () => [{
      _id: 'member-doc-old',
      memberId: 'member-old',
      userId: 'user-1',
      openId: 'open-1',
      familyId: 'family-old',
      role: 'parent',
      studyRole: 'parent'
    }],
    updateMemberById: async (id, data) => updates.push({ id, data }),
    createMember: async (data) => created.push(data),
    normalizeStudyRole: (member) => member.studyRole || 'parent',
    findSubscriptionByMemberId: async () => null,
    updateSubscriptionById: async () => {},
    createSubscription: async () => {}
  });

  assert.equal(joinedMemberId, created[0].memberId);
  assert.equal(created[0].familyId, 'family-new');
  assert.equal(created[0].studyRole, 'parent');
  assert.deepEqual(updates, []);
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
    includeStats: false,
    includeChildStats: false,
    reconcileCheckins: false
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
