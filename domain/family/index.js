const { childProfiles } = require('../../data/catalog');

const FAMILY_STORAGE_KEY = 'yoyo-family-local-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInviteCode() {
  return `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getDefaultFamilyState() {
  return {
    currentMemberId: 'member-owner',
    family: {
      familyId: 'family-local-yoyo',
      name: '佑佑一家',
      inviteCode: createInviteCode(),
      ownerOpenId: 'local-owner',
      createdAt: new Date().toISOString()
    },
    members: [
      {
        memberId: 'member-owner',
        familyId: 'family-local-yoyo',
        openId: 'local-owner',
        role: 'owner',
        displayName: '我',
        subscriptionEnabled: false
      },
      {
        memberId: 'member-father',
        familyId: 'family-local-yoyo',
        openId: 'local-father',
        role: 'parent',
        displayName: '弟弟',
        subscriptionEnabled: false
      },
      {
        memberId: 'member-mother',
        familyId: 'family-local-yoyo',
        openId: 'local-mother',
        role: 'parent',
        displayName: '弟媳',
        subscriptionEnabled: false
      }
    ],
    child: Object.assign({}, clone(childProfiles[0]), {
      familyId: 'family-local-yoyo'
    }),
    subscriptionPreference: {
      memberId: 'member-owner',
      familyId: 'family-local-yoyo',
      dailyReportEnabled: false,
      lastAuthorizedAt: ''
    }
  };
}

function ensureLocalFamilyState() {
  const existing = wx.getStorageSync(FAMILY_STORAGE_KEY);
  if (!existing) {
    wx.setStorageSync(FAMILY_STORAGE_KEY, getDefaultFamilyState());
  }
}

function loadLocalFamilyState() {
  ensureLocalFamilyState();
  return wx.getStorageSync(FAMILY_STORAGE_KEY) || getDefaultFamilyState();
}

function saveLocalFamilyState(state) {
  wx.setStorageSync(FAMILY_STORAGE_KEY, state);
}

function getCurrentMember(state) {
  return state.members.find((item) => item.memberId === state.currentMemberId) || state.members[0];
}

function getFamilyPageData() {
  const state = loadLocalFamilyState();
  const currentMember = getCurrentMember(state);
  return {
    syncMode: 'local',
    family: state.family,
    currentMember,
    members: state.members,
    child: state.child,
    subscriptionPreference: Object.assign({}, state.subscriptionPreference, {
      dailyReportEnabled: currentMember.subscriptionEnabled
    })
  };
}

function refreshInviteCode() {
  const state = loadLocalFamilyState();
  state.family.inviteCode = createInviteCode();
  saveLocalFamilyState(state);
  return getFamilyPageData();
}

function joinFamily(inviteCode, displayName) {
  const state = loadLocalFamilyState();
  if (inviteCode !== state.family.inviteCode) {
    throw new Error('邀请码不正确');
  }
  const normalizedName = String(displayName || '').trim() || '新家长';
  const existing = state.members.find((item) => item.displayName === normalizedName);
  if (!existing) {
    state.members.push({
      memberId: `member-${Date.now()}`,
      familyId: state.family.familyId,
      openId: `local-${Date.now()}`,
      role: 'parent',
      displayName: normalizedName,
      subscriptionEnabled: false
    });
    saveLocalFamilyState(state);
  }
  return getFamilyPageData();
}

function toggleSubscription(enabled) {
  const state = loadLocalFamilyState();
  const currentMember = getCurrentMember(state);
  currentMember.subscriptionEnabled = !!enabled;
  state.subscriptionPreference = {
    memberId: currentMember.memberId,
    familyId: state.family.familyId,
    dailyReportEnabled: !!enabled,
    lastAuthorizedAt: enabled ? new Date().toISOString() : state.subscriptionPreference.lastAuthorizedAt
  };
  saveLocalFamilyState(state);
  return getFamilyPageData();
}

module.exports = {
  ensureLocalFamilyState,
  loadLocalFamilyState,
  getFamilyPageData,
  refreshInviteCode,
  joinFamily,
  toggleSubscription
};
