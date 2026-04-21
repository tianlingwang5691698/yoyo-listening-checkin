async function ensureUser(openId, deps) {
  if (!openId) {
    const error = new Error('登录状态暂时不可用，请稍后再试');
    error.code = 'login-unavailable';
    throw error;
  }
  const now = new Date().toISOString();
  const existing = await deps.findUserByOpenId(openId);
  if (existing) {
    await deps.updateUserById(existing._id, {
      lastLoginAt: now,
      updatedAt: now
    });
    return Object.assign({}, existing, {
      lastLoginAt: now,
      updatedAt: now
    });
  }
  const user = {
    userId: deps.buildUserId(openId),
    openId,
    unionId: '',
    nickName: '',
    avatarUrl: '',
    phoneNumberMasked: '',
    phoneBound: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
  await deps.createUser(user);
  return user;
}

async function getChild(familyId, deps) {
  let child = await deps.findChildByFamilyId(familyId);
  if (!child) {
    return null;
  }
  if (!/^\d{6}$/.test(String(child.childLoginCode || ''))) {
    const childLoginCode = await deps.makeUniqueChildLoginCode();
    await deps.updateChildById(child._id, {
      childLoginCode,
      updatedAt: new Date().toISOString()
    });
    child = Object.assign({}, child, { childLoginCode });
  }
  return Object.assign({}, child, {
    avatarText: deps.buildAvatarTextFromNickname(child.nickname || child.avatarText)
  });
}

async function ensureBootstrap(openId, deps) {
  const user = await ensureUser(openId, deps);
  let member = await deps.getMember(openId);
  if (!member) {
    const familyId = `family-${Date.now()}`;
    const now = new Date().toISOString();
    await deps.createFamily(familyId, {
      familyId,
      name: '听力打卡家庭',
      inviteCode: deps.makeInviteCode(),
      ownerOpenId: openId,
      createdAt: now
    });
    member = {
      familyId,
      memberId: `member-${Date.now()}`,
      userId: user.userId,
      openId,
      role: 'owner',
      studyRole: 'student',
      displayName: '我',
      subscriptionEnabled: false,
      joinedFamilyAt: now,
      createdAt: now
    };
    await deps.createMember(member);
    await deps.createSubscription({
      memberId: member.memberId,
      familyId,
      dailyReportEnabled: false,
      lastAuthorizedAt: ''
    });
    await deps.createChild(Object.assign({}, deps.childTemplate, {
      familyId,
      childLoginCode: await deps.makeUniqueChildLoginCode(),
      avatarText: deps.buildAvatarTextFromNickname(deps.childTemplate.nickname)
    }));
  } else if (!member.userId) {
    await deps.updateMemberById(member._id, {
      userId: user.userId
    });
    member = Object.assign({}, member, { userId: user.userId });
  }
  if (!member.studyRole) {
    const studyRole = deps.normalizeStudyRole(member);
    await deps.updateMemberById(member._id, {
      studyRole,
      updatedAt: new Date().toISOString()
    });
    member = Object.assign({}, member, { studyRole });
  }
  const family = await deps.getFamily(member.familyId);
  const child = await getChild(member.familyId, deps);
  const members = deps.normalizeAndDedupeMembers(await deps.findMembersByFamilyId(member.familyId));
  const subscriptionPreference = await deps.findSubscriptionByMemberId(member.memberId) || {
    memberId: member.memberId,
    familyId: member.familyId,
    dailyReportEnabled: !!member.subscriptionEnabled,
    lastAuthorizedAt: ''
  };
  return { user, family, member, child, members, subscriptionPreference };
}

module.exports = {
  ensureUser,
  getChild,
  ensureBootstrap
};
