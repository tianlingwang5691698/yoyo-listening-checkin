const { collection } = require('../adapters/db.adapter');
const { getWXContext } = require('../adapters/wx-context.adapter');

const BUILTIN_ADMIN_OPEN_IDS = ['om8JT3Zhqe1zeAiKUGGkU0ACjAWs'];
const ADMIN_SERVICE_VERSION = 'admin-diagnostic-20260703-1700';

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
    diagnostic: buildAdminDiagnostic(wxContext.OPENID || ''),
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
