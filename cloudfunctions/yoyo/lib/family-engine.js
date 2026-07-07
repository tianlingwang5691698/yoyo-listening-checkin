async function updateChildProfile(familyId, payload, deps) {
  const child = await deps.getChild(familyId);
  if (!child) {
    throw new Error('孩子档案不存在');
  }
  const nickname = String((payload && payload.nickname) || '').trim();
  if (!nickname) {
    throw new Error('先填写孩子昵称');
  }
  if (['同学', '我'].includes(nickname) || (nickname === '佑佑' && String(child.childLoginCode || '').trim() !== '317613')) {
    throw new Error('请更换其他名字');
  }
  await deps.updateChildById(child._id, {
    nickname,
    avatarText: deps.buildAvatarTextFromNickname(nickname),
    updatedAt: new Date().toISOString()
  });
}

async function setExclusiveStudyRole(member, studyRole, deps) {
  const now = new Date().toISOString();
  if (studyRole === 'student') {
    const familyMembers = await deps.findMembersByFamilyId(member.familyId);
    await Promise.all(familyMembers
      .filter((item) => item._id)
      .map((item) => deps.updateMemberById(item._id, {
        studyRole: item.memberId === member.memberId ? 'student' : 'parent',
        updatedAt: now
      })));
    return;
  }
  await deps.updateMemberById(member._id, {
    studyRole: 'parent',
    updatedAt: now
  });
}

async function upsertFamilyMemberForFamily(openId, userId, familyId, displayName, options = {}, deps) {
  if (!deps) {
    deps = options;
    options = {};
  }
  const memberRecords = await deps.findMembersByOpenId(openId);
  let joinedMemberId = '';
  const existingMember = memberRecords.find((item) => item.familyId === familyId);
  const now = new Date().toISOString();
  const bindingProfile = {
    selfChildNickname: String(options.selfChildNickname || '').trim(),
    relationName: String(options.relationName || '').trim()
  };
  if (existingMember) {
    joinedMemberId = existingMember.memberId;
    await deps.updateMemberById(existingMember._id, {
      userId,
      familyId,
      displayName,
      selfChildNickname: bindingProfile.selfChildNickname,
      relationName: bindingProfile.relationName,
      role: existingMember.role || 'parent',
      studyRole: deps.normalizeStudyRole(existingMember),
      joinedFamilyAt: existingMember.joinedFamilyAt || existingMember.createdAt || now,
      updatedAt: now
    });
  } else {
    joinedMemberId = `member-${Date.now()}`;
    await deps.createMember({
      memberId: joinedMemberId,
      userId,
      familyId,
      openId,
      role: 'parent',
      studyRole: 'parent',
      displayName,
      selfChildNickname: bindingProfile.selfChildNickname,
      relationName: bindingProfile.relationName,
      subscriptionEnabled: false,
      joinedFamilyAt: now,
      createdAt: now
    });
  }
  const preference = await deps.findSubscriptionByMemberId(joinedMemberId);
  if (preference) {
    await deps.updateSubscriptionById(preference._id, {
      familyId
    });
  } else if (joinedMemberId) {
    await deps.createSubscription({
      memberId: joinedMemberId,
      familyId,
      dailyReportEnabled: false,
      lastAuthorizedAt: ''
    });
  }
  return joinedMemberId;
}

async function leaveCurrentFamily(ctx, deps) {
  const member = (ctx && ctx.member) || null;
  if (!member || !member._id) {
    throw new Error('当前成员不存在');
  }
  if ((member.role || '') === 'owner') {
    throw new Error('当前孩子主设备不能退出记录');
  }
  const ownFamily = await deps.findFamilyByOwnerOpenId(member.openId);
  const restoreFamilyId = String(member.previousFamilyId || (ownFamily && ownFamily.familyId) || '').trim();
  const restoreRole = String(member.previousRole || ((ownFamily && ownFamily.ownerOpenId === member.openId) ? 'owner' : 'parent') || 'parent').trim();
  const restoreStudyRole = String(member.previousStudyRole || (restoreRole === 'owner' ? 'student' : 'parent') || 'parent').trim();
  const restoreDisplayName = String(member.previousDisplayName || member.displayName || '').trim();
  const preference = await deps.findSubscriptionByMemberId(member.memberId);
  if (restoreFamilyId) {
    await deps.updateMemberById(member._id, {
      familyId: restoreFamilyId,
      role: restoreRole,
      studyRole: restoreStudyRole,
      displayName: restoreDisplayName,
      previousFamilyId: '',
      previousRole: '',
      previousStudyRole: '',
      previousDisplayName: '',
      updatedAt: new Date().toISOString()
    });
    if (preference && preference._id) {
      await deps.updateSubscriptionById(preference._id, {
        familyId: restoreFamilyId
      });
    } else {
      await deps.createSubscription({
        memberId: member.memberId,
        familyId: restoreFamilyId,
        dailyReportEnabled: false,
        lastAuthorizedAt: ''
      });
    }
    return;
  }
  if (preference && preference._id) {
    await deps.deleteSubscriptionById(preference._id);
  }
  await deps.deleteMemberById(member._id);
}

module.exports = {
  updateChildProfile,
  setExclusiveStudyRole,
  upsertFamilyMemberForFamily,
  leaveCurrentFamily
};
