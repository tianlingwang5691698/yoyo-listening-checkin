const WANG_TIANLONG_OPEN_ID = 'om8JT3Zhqe1zeAiKUGGkU0ACjAWs';

function getOwnerDisplayName(openId) {
  return openId === WANG_TIANLONG_OPEN_ID ? '王天龙' : '我';
}

async function ensureUser(openId, deps) {
  if (!openId) {
    const error = new Error('登录状态暂时不可用，请稍后再试');
    error.code = 'login-unavailable';
    throw error;
  }
  const now = new Date().toISOString();
  const existing = await deps.findUserByOpenId(openId);
  if (existing) {
    const loginCount = Number(existing.loginCount || 0) + 1;
    await deps.updateUserById(existing._id, {
      loginCount,
      lastLoginAt: now,
      updatedAt: now
    });
    return Object.assign({}, existing, {
      loginCount,
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
    loginCount: 1,
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
  const shouldMigrateDefaultProfile = String(child.nickname || '').trim() === '佑佑'
    && (!child.avatarText || String(child.avatarText).trim() === 'YY');
  if (shouldMigrateDefaultProfile) {
    const updatedAt = new Date().toISOString();
    await deps.updateChildById(child._id, {
      nickname: '同学',
      avatarText: '学',
      updatedAt
    });
    child = Object.assign({}, child, {
      nickname: '同学',
      avatarText: '学',
      updatedAt
    });
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

function selectMember(memberRecords, target) {
  const list = memberRecords || [];
  const targetFamilyId = String((target && target.targetFamilyId) || '').trim();
  const forceSelf = !!(target && target.forceSelf);
  if (targetFamilyId) {
    const matched = list.find((item) => item.familyId === targetFamilyId);
    if (matched) {
      return matched;
    }
  }
  const owner = list.find((item) => item.role === 'owner');
  if (forceSelf) {
    return owner || null;
  }
  return owner || list[0] || null;
}

async function buildStudentLinks(memberRecords, currentMember, deps) {
  const seen = {};
  const links = [];
  for (const member of memberRecords || []) {
    const familyId = String(member.familyId || '').trim();
    if (!familyId || seen[familyId]) {
      continue;
    }
    seen[familyId] = true;
    const child = await getChild(familyId, deps);
    if (!child) {
      continue;
    }
    links.push({
      familyId,
      childId: child.childId || '',
      childLoginCode: child.childLoginCode || '',
      nickname: child.nickname || '',
      avatarText: child.avatarText || '',
      memberId: member.memberId || '',
      role: member.role || 'parent',
      studyRole: deps.normalizeStudyRole(member),
      isCurrent: !!(currentMember && member.memberId === currentMember.memberId)
    });
  }
  return links;
}

async function ensureBootstrap(openId, deps, target) {
  const user = await ensureUser(openId, deps);
  let memberRecords = deps.findMembersByOpenId ? await deps.findMembersByOpenId(openId) : [];
  let member = selectMember(memberRecords, target);
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
      displayName: getOwnerDisplayName(openId),
      subscriptionEnabled: false,
      joinedFamilyAt: now,
      createdAt: now
    };
    await deps.createMember(member);
    memberRecords = memberRecords.concat(member);
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
  const ownerDisplayName = getOwnerDisplayName(openId);
  if (member.role === 'owner' && member.displayName !== ownerDisplayName) {
    await deps.updateMemberById(member._id, {
      displayName: ownerDisplayName,
      updatedAt: new Date().toISOString()
    });
    member = Object.assign({}, member, { displayName: ownerDisplayName });
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
  const studentLinks = await buildStudentLinks(memberRecords, member, deps);
  const subscriptionPreference = await deps.findSubscriptionByMemberId(member.memberId) || {
    memberId: member.memberId,
    familyId: member.familyId,
    dailyReportEnabled: !!member.subscriptionEnabled,
    lastAuthorizedAt: ''
  };
  return { user, family, member, child, members, studentLinks, subscriptionPreference };
}

module.exports = {
  ensureUser,
  getChild,
  ensureBootstrap
};
