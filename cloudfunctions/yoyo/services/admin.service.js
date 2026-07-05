const { collection } = require('../adapters/db.adapter');
const { getWXContext } = require('../adapters/wx-context.adapter');

const BUILTIN_ADMIN_OPEN_IDS = ['om8JT3Zhqe1zeAiKUGGkU0ACjAWs'];
const ADMIN_SERVICE_VERSION = 'admin-completion-aggregate-20260705-1725';
const WANG_TIANLONG_OPEN_ID = 'om8JT3Zhqe1zeAiKUGGkU0ACjAWs';

function normalizeAdminId(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function getAdminOpenIds() {
  const envOpenIds = String(process.env.YOYO_ADMIN_OPEN_IDS || '')
    .split(',')
    .map(normalizeAdminId)
    .filter(Boolean);
  return [...new Set(BUILTIN_ADMIN_OPEN_IDS.map(normalizeAdminId).concat(envOpenIds))];
}

function assertAdmin(openId) {
  const normalizedOpenId = normalizeAdminId(openId);
  if (normalizedOpenId === 'om8JT3Zhqe1zeAiKUGGkU0ACjAWs') {
    return;
  }
  const adminOpenIds = getAdminOpenIds();
  if (!normalizedOpenId || (!adminOpenIds.includes(normalizedOpenId) && !adminOpenIds.includes(`user-${normalizedOpenId}`))) {
    const error = new Error(`admin-forbidden:${normalizedOpenId || 'empty-openid'}`);
    error.code = 'admin-forbidden';
    error.openId = normalizedOpenId || '';
    throw error;
  }
}

function isAdminOpenId(openId) {
  const normalizedOpenId = normalizeAdminId(openId);
  if (normalizedOpenId === 'om8JT3Zhqe1zeAiKUGGkU0ACjAWs') {
    return true;
  }
  const adminOpenIds = getAdminOpenIds();
  return !!normalizedOpenId && (adminOpenIds.includes(normalizedOpenId) || adminOpenIds.includes(`user-${normalizedOpenId}`));
}

function buildAdminDiagnostic(openId) {
  const envOpenIds = String(process.env.YOYO_ADMIN_OPEN_IDS || '')
    .split(',')
    .map(normalizeAdminId)
    .filter(Boolean);
  const normalizedOpenId = normalizeAdminId(openId);
  const builtinHit = BUILTIN_ADMIN_OPEN_IDS.map(normalizeAdminId).includes(normalizedOpenId);
  const envHit = envOpenIds.includes(normalizedOpenId) || envOpenIds.includes(`user-${normalizedOpenId}`);
  return {
    adminServiceVersion: ADMIN_SERVICE_VERSION,
    openId: normalizedOpenId,
    userId: normalizedOpenId ? `user-${normalizedOpenId}` : '',
    isAdmin: isAdminOpenId(normalizedOpenId),
    builtinHit,
    envHit,
    envConfigured: envOpenIds.length > 0,
    envCount: envOpenIds.length
  };
}

async function listAll(collectionName) {
  const pageSize = 100;
  const rows = [];
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const res = await collection(collectionName).skip(offset).limit(pageSize).get();
    const data = res.data || [];
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function indexBy(list, key) {
  return (list || []).reduce((map, item) => {
    const value = String(item && item[key] || '');
    if (value) map[value] = item;
    return map;
  }, {});
}

function shouldHideOwnerChildForBoundParent(child, familyMembers, parentBoundFamilyIdsByOpenId) {
  const ownerMember = (familyMembers || []).find((member) => {
    return member
      && member.role === 'owner'
      && (member.studyRole === 'student' || !member.studyRole)
      && member.openId;
  });
  if (!ownerMember) return false;
  if (ownerMember.studyRole === 'parent') return true;
  const boundFamilyIds = parentBoundFamilyIdsByOpenId[String(ownerMember.openId || '')] || [];
  return boundFamilyIds.some((familyId) => familyId && familyId !== String(child.familyId || ''));
}

function isBindingParent(member) {
  return member
    && member.role === 'parent'
    && member.studyRole !== 'student';
}

function shouldHideInactiveDefaultYoyo(child, active, bindingParents) {
  return !active && String(child && child.nickname || '').trim() === '佑佑' && !(bindingParents || []).length;
}

function getOwnerMember(familyMembers) {
  return (familyMembers || []).find((member) => {
    return member
      && member.role === 'owner'
      && (member.studyRole === 'student' || !member.studyRole)
      && member.openId;
  }) || null;
}

function isGenericMemberName(value) {
  return !String(value || '').trim() || ['我', '新家长', '学生设备', '未命名'].includes(String(value || '').trim());
}

function getMemberDisplayName(member, user, ownerChildNameByOpenId) {
  if (member && member.openId === WANG_TIANLONG_OPEN_ID) {
    return '王天龙';
  }
  const displayName = String((member && member.displayName) || '').trim();
  if (!isGenericMemberName(displayName)) return displayName;
  return String((user && user.nickname) || ownerChildNameByOpenId[String(member && member.openId || '')] || displayName || '').trim();
}

function getScopeKey(familyId, childId) {
  return `${familyId || ''}::${childId || ''}`;
}

function buildActivityByScope(records) {
  return (records || []).reduce((map, item) => {
    const key = getScopeKey(item && item.familyId, item && item.childId);
    if (key === '::') return map;
    const current = map[key] || { count: 0, lastActivityAt: '' };
    const time = String((item && (item.updatedAt || item.completedAt || item.createdAt || item.date)) || '');
    map[key] = {
      count: current.count + 1,
      lastActivityAt: time && time > current.lastActivityAt ? time : current.lastActivityAt
    };
    return map;
  }, {});
}

function mergeActivityMaps(maps) {
  return (maps || []).reduce((merged, map) => {
    Object.keys(map || {}).forEach((key) => {
      const current = merged[key] || { count: 0, lastActivityAt: '' };
      const item = map[key] || {};
      merged[key] = {
        count: current.count + Number(item.count || 0),
        lastActivityAt: String(item.lastActivityAt || '') > current.lastActivityAt
          ? String(item.lastActivityAt || '')
          : current.lastActivityAt
      };
    });
    return merged;
  }, {});
}

function getUserTime(user) {
  return String((user && (user.lastLoginAt || user.updatedAt || user.createdAt)) || '');
}

function buildStudentLoginSummary(familyMembers, usersByOpenId) {
  const seen = {};
  return (familyMembers || []).reduce((summary, member) => {
    if (!member || !member.openId || isBindingParent(member)) return summary;
    if (seen[member.openId]) return summary;
    seen[member.openId] = true;
    const user = usersByOpenId[member.openId] || {};
    const userTime = getUserTime(user);
    return {
      loginCount: summary.loginCount + Number(user.loginCount || 0),
      lastLoginAt: userTime && userTime > summary.lastLoginAt ? userTime : summary.lastLoginAt
    };
  }, { loginCount: 0, lastLoginAt: '' });
}

async function getAdminFamilyList() {
  const wxContext = getWXContext();
  assertAdmin(wxContext.OPENID);

  const [children, members, families, users, checkins, progressRecords, attempts, completedItems] = await Promise.all([
    listAll('children'),
    listAll('familyMembers'),
    listAll('families'),
    listAll('users'),
    listAll('dailyCheckins'),
    listAll('dailyTaskProgress'),
    listAll('taskAttempts'),
    listAll('studyCompletedItems')
  ]);
  const familiesById = indexBy(families, 'familyId');
  const usersByOpenId = indexBy(users, 'openId');
  const childrenByFamilyId = indexBy(children, 'familyId');
  const ownerChildNameByOpenId = families.reduce((map, family) => {
    const openId = String(family && family.ownerOpenId || '');
    const child = childrenByFamilyId[String(family && family.familyId || '')] || {};
    const nickname = String(child.nickname || '').trim();
    if (openId && nickname) map[openId] = nickname;
    return map;
  }, {});
  const activityByScope = mergeActivityMaps([
    buildActivityByScope(checkins),
    buildActivityByScope(progressRecords),
    buildActivityByScope(attempts),
    buildActivityByScope(completedItems)
  ]);
  const parentBoundFamilyIdsByOpenId = members.reduce((map, member) => {
    const openId = String(member && member.openId || '');
    const familyId = String(member && member.familyId || '');
    if (openId && familyId && isBindingParent(member)) {
      if (!map[openId]) map[openId] = [];
      map[openId].push(familyId);
    }
    return map;
  }, {});

  const rows = children.map((child) => {
    const familyId = String(child.familyId || '');
    const familyMembers = members.filter((member) => String(member.familyId || '') === familyId);
    if (shouldHideOwnerChildForBoundParent(child, familyMembers, parentBoundFamilyIdsByOpenId)) {
      return null;
    }
    const ownerMember = getOwnerMember(familyMembers);
    const loginSummary = buildStudentLoginSummary(familyMembers, usersByOpenId);
    const activity = activityByScope[getScopeKey(familyId, child.childId || child._id || '')] || { count: 0, lastActivityAt: '' };
    const loginCount = Number(loginSummary.loginCount || 0);
    const lastLoginAt = loginSummary.lastLoginAt || '';
    const lastSeenAt = [lastLoginAt, activity.lastActivityAt].filter(Boolean).sort().pop() || '';
    const active = loginCount >= 2 || activity.count > 0;
    const bindingParents = familyMembers.filter(isBindingParent);
    if (shouldHideInactiveDefaultYoyo(child, active, bindingParents)) {
      return null;
    }
    const boundFamilyIds = ownerMember ? (parentBoundFamilyIdsByOpenId[String(ownerMember.openId || '')] || []) : [];
    const hasBoundOtherChild = boundFamilyIds.some((boundFamilyId) => boundFamilyId && boundFamilyId !== familyId);
    return {
      childId: child.childId || child._id || '',
      childLoginCode: child.childLoginCode || '',
      childNickname: child.nickname || '',
      loginCount,
      lastLoginAt,
      activityCount: activity.count,
      lastActivityAt: activity.lastActivityAt,
      lastSeenAt,
      active,
      userRoleText: hasBoundOtherChild ? '家长' : '学生',
      familyId,
      inviteCode: (familiesById[familyId] && familiesById[familyId].inviteCode) || '',
      members: familyMembers.map((member) => {
        const user = usersByOpenId[member.openId] || {};
        return {
          memberId: member.memberId || member._id || '',
          displayName: getMemberDisplayName(member, user, ownerChildNameByOpenId),
          role: member.role || '',
          isBindingParent: isBindingParent(member)
        };
      })
    };
  }).filter(Boolean).sort((left, right) => String(right.childLoginCode || '').localeCompare(String(left.childLoginCode || '')));

  return {
    isAdmin: true,
    rows,
    total: rows.length
  };
}

async function getAdminStatus() {
  const wxContext = getWXContext();
  const openId = wxContext.OPENID || '';
  return buildAdminDiagnostic(openId);
}

module.exports = {
  getAdminStatus,
  getAdminFamilyList
};
