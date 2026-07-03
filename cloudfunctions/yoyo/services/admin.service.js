const { collection } = require('../adapters/db.adapter');
const { getWXContext } = require('../adapters/wx-context.adapter');

function getAdminOpenIds() {
  return String(process.env.YOYO_ADMIN_OPEN_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertAdmin(openId) {
  const adminOpenIds = getAdminOpenIds();
  if (!openId || !adminOpenIds.includes(openId)) {
    const error = new Error('admin-forbidden');
    error.code = 'admin-forbidden';
    throw error;
  }
}

function isAdminOpenId(openId) {
  return !!openId && getAdminOpenIds().includes(openId);
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

async function getAdminFamilyList() {
  const wxContext = getWXContext();
  assertAdmin(wxContext.OPENID);

  const [children, members, families, users] = await Promise.all([
    listAll('children'),
    listAll('familyMembers'),
    listAll('families'),
    listAll('users')
  ]);
  const familiesById = indexBy(families, 'familyId');
  const usersByOpenId = indexBy(users, 'openId');

  const rows = children.map((child) => {
    const familyId = String(child.familyId || '');
    const familyMembers = members.filter((member) => String(member.familyId || '') === familyId);
    return {
      childId: child.childId || child._id || '',
      childLoginCode: child.childLoginCode || '',
      childNickname: child.nickname || '',
      familyId,
      inviteCode: (familiesById[familyId] && familiesById[familyId].inviteCode) || '',
      members: familyMembers.map((member) => {
        const user = usersByOpenId[member.openId] || {};
        return {
          memberId: member.memberId || member._id || '',
          displayName: member.displayName || user.nickname || '',
          studyRole: member.studyRole || member.role || '',
          role: member.role || '',
          userId: member.userId || user.userId || '',
          openId: member.openId || ''
        };
      })
    };
  }).sort((left, right) => String(right.childLoginCode || '').localeCompare(String(left.childLoginCode || '')));

  return {
    isAdmin: true,
    rows,
    total: rows.length
  };
}

async function getAdminStatus() {
  const wxContext = getWXContext();
  return {
    isAdmin: isAdminOpenId(wxContext.OPENID)
  };
}

module.exports = {
  getAdminStatus,
  getAdminFamilyList
};
