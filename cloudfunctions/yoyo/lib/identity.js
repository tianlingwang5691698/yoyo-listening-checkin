function makeInviteCode() {
  return `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeChildLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildAvatarTextFromNickname(nickname) {
  const text = String(nickname || '').trim();
  if (!text) {
    return 'YY';
  }
  const compact = text.replace(/\s+/g, '');
  if (compact === '佑佑') {
    return 'YY';
  }
  return compact.slice(0, 2).toUpperCase();
}

function getMemberIdentityKey(member) {
  return String((member && (member.openId || member.userId || member.memberId)) || '');
}

function normalizeStudyRole(member) {
  const studyRole = String((member && member.studyRole) || '').trim();
  if (studyRole === 'student' || studyRole === 'parent') {
    return studyRole;
  }
  return member && member.role === 'owner' ? 'student' : 'parent';
}

function normalizeAndDedupeMembers(members) {
  const unique = new Map();
  (members || []).forEach((member) => {
    const normalized = Object.assign({}, member, {
      studyRole: normalizeStudyRole(member)
    });
    const key = getMemberIdentityKey(normalized);
    if (!key) {
      unique.set(normalized.memberId || `member-${unique.size}`, normalized);
      return;
    }
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, normalized);
      return;
    }
    const existingUpdatedAt = String(existing.updatedAt || existing.createdAt || '');
    const nextUpdatedAt = String(normalized.updatedAt || normalized.createdAt || '');
    if (nextUpdatedAt >= existingUpdatedAt) {
      unique.set(key, Object.assign({}, normalized, {
        joinedFamilyAt: [existing.joinedFamilyAt, normalized.joinedFamilyAt, existing.createdAt, normalized.createdAt]
          .filter(Boolean)
          .sort()[0] || normalized.joinedFamilyAt || normalized.createdAt || ''
      }));
    }
  });
  return Array.from(unique.values()).sort((a, b) => {
    if (a.studyRole !== b.studyRole) {
      return a.studyRole === 'student' ? -1 : 1;
    }
    return String(a.joinedFamilyAt || a.createdAt || '').localeCompare(String(b.joinedFamilyAt || b.createdAt || ''));
  });
}

function buildUserId(openId) {
  return `user-${String(openId || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

module.exports = {
  makeInviteCode,
  makeChildLoginCode,
  buildAvatarTextFromNickname,
  getMemberIdentityKey,
  normalizeStudyRole,
  normalizeAndDedupeMembers,
  buildUserId
};
