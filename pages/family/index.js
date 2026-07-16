const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');

const PROFILE_SNAPSHOT_KEY = 'profileHomeSnapshotV1';

function buildCurrentProfileSnapshotId() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const familyId = String((target && target.targetFamilyId) || '').trim();
  const childId = String((target && target.targetChildId) || '').trim();
  return familyId || childId ? `target:${familyId}:${childId}` : 'self';
}

function isNicknameRequired(child) {
  const current = child || {};
  const nickname = String(current.nickname || '').trim();
  const childLoginCode = String(current.childLoginCode || '').trim();
  return !!current.nicknameRequired
    || !nickname
    || ['同学', '我'].includes(nickname)
    || (nickname === '佑佑' && childLoginCode !== '317613');
}

function buildTexts() {
  return Object.keys(accountCatalog.family['zh-CN']).reduce((texts, key) => {
    texts[key] = i18n.getPageText('family', key);
    return texts;
  }, {});
}

function formatText(text, values) {
  return Object.keys(values || {}).reduce((result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), String(text || ''));
}

function buildIdentityNicknamePresentation(data, texts) {
  const source = data || {};
  const member = source.currentMember || {};
  const isParent = member.studyRole !== 'student';
  const isBoundParent = isParent && member.role !== 'owner';
  const nickname = isBoundParent
    ? String(member.selfChildNickname || '').trim()
    : String((source.child && source.child.nickname) || '').trim();
  return {
    identityNicknameInput: nickname,
    identityNicknameLabel: isParent ? texts.myNickname : texts.studentNickname,
    identityNicknameRequired: isBoundParent
      ? !nickname || ['同学', '我'].includes(nickname)
      : isNicknameRequired(source.child)
  };
}

Page({
  data: page.createCloudPageData({
    family: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    members: [],
    child: contracts.createChildDefaults(),
    studentLinks: [],
    studentCards: [],
    subscriptionPreference: {
      dailyReportEnabled: false
    },
    childCodeInput: '',
    inviteInput: '',
    joinName: '',
    bindingNicknameInput: '',
    bindingRelationInput: '',
    identityNicknameInput: '',
    identityNicknameLabel: i18n.getPageText('family', 'myNickname'),
    identityNicknameRequired: false,
    savingIdentityNickname: false,
    nicknameSaveDebug: '',
    bindingProfileRequired: false,
    studyRoleLabel: i18n.getPageText('family', 'parent'),
    studyRoleActionText: i18n.getPageText('family', 'switched'),
    undoingLastListened: false,
    childJoinRequired: false,
    texts: buildTexts(),
    language: i18n.getLanguage()
  }),
  applyFamilyState(data, extra) {
    const studentCards = this.buildStudentCards(data);
    const bindingInputs = this.buildBindingProfileInputs(data);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation((data || {}).currentMember), buildIdentityNicknamePresentation(data, this.data.texts), {
      memberCards: this.buildMemberCards((data || {}).members, (data || {}).currentMember),
      studentCards,
      studentCountText: studentCards.length ? formatText(this.data.texts.boundCount, { count: studentCards.length }) : '',
      bindingProfileRequired: this.isBindingProfileRequired(data),
      bindingNicknameInput: bindingInputs.selfChildNickname,
      bindingRelationInput: bindingInputs.relationName
    }, extra || {})));
  },
  async onShow() {
    this.familyPerf = page.startPagePerf('family');
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData({ texts, language: i18n.getLanguage() });
    wx.setNavigationBarTitle({ title: texts.navTitle });
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const cached = store.getCachedReadResult ? store.getCachedReadResult('getFamilyPage', target) : null;
    if (cached) {
      this.applyFamilyState(cached, {
        childJoinRequired: this.isChildJoinRequired(cached)
      });
      this.familyPerf.ready('pageReady', {
        source: 'cache',
        cacheHit: true,
        members: (cached.members || []).length
      });
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.familyPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        members: 0
      });
    }
    const data = await store.getFamilyPageData((fresh) => {
      this.applyFamilyState(fresh, {
        childJoinRequired: this.isChildJoinRequired(fresh)
      });
      if (this.familyPerf) {
        this.familyPerf.mark('cloudRefresh', { members: (fresh.members || []).length });
      }
    });
    this.applyFamilyState(data, {
      childJoinRequired: this.isChildJoinRequired(data)
    });
    if (!cached) {
      this.familyPerf.mark('cloudRefresh', {
        source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'error' : 'cloud'),
        cacheHit: !!(data && data.__cacheHit),
        members: ((data && data.members) || []).length
      });
    }
  },
  isChildJoinRequired(data) {
    return false;
  },
  isBindingProfileRequired(data) {
    const member = (data && data.currentMember) || {};
    if (!member.memberId || member.role === 'owner') {
      return false;
    }
    return !String(member.selfChildNickname || '').trim() || !String(member.relationName || '').trim();
  },
  buildBindingProfileInputs(data) {
    const member = (data && data.currentMember) || {};
    return {
      selfChildNickname: String(member.selfChildNickname || '').trim(),
      relationName: String(member.relationName || '').trim()
    };
  },
  buildStudyRolePresentation(member) {
    const studyRole = member && member.studyRole === 'student' ? 'student' : 'parent';
    return {
      studyRoleLabel: studyRole === 'student' ? this.data.texts.student : this.data.texts.parent,
      studyRoleActionText: this.data.texts.switched
    };
  },
  buildMemberCards(members, currentMember) {
    const currentMemberId = currentMember && currentMember.memberId ? currentMember.memberId : '';
    return (members || []).map((item) => {
      return {
        memberId: item.memberId,
        displayName: item.displayName,
        isCurrentDevice: item.memberId === currentMemberId
      };
    });
  },
  buildStudentCards(data) {
    const studentLinks = (data && data.studentLinks) || [];
    const child = (data && data.child) || null;
    const fallback = child && (child.childLoginCode || child.nickname) ? [{
      familyId: (data.family && data.family.familyId) || child.familyId || '',
      childId: child.childId || '',
      nickname: child.nickname || this.data.texts.defaultStudent,
      childLoginCode: child.childLoginCode || '',
      isCurrent: true
    }] : [];
    const source = studentLinks.length ? studentLinks : fallback;
    return source.filter((item) => item && item.role !== 'owner').map((item) => {
      return {
        familyId: item.familyId,
        childId: item.childId,
        nickname: item.nickname || this.data.texts.defaultStudent,
        childLoginCode: item.childLoginCode || '',
        isCurrent: !!item.isCurrent
      };
    });
  },
  handleInviteInput(event) {
    this.setData({
      inviteInput: event.detail.value
    });
  },
  handleChildCodeInput(event) {
    this.setData({
      childCodeInput: String(event.detail.value || '').replace(/\D/g, '').slice(0, 6)
    });
  },
  handleJoinNameInput(event) {
    this.setData({
      joinName: event.detail.value
    });
  },
  handleBindingNicknameInput(event) {
    this.setData({
      bindingNicknameInput: event.detail.value
    });
  },
  handleBindingRelationInput(event) {
    this.setData({
      bindingRelationInput: event.detail.value
    });
  },
  handleIdentityNicknameInput(event) {
    this.setData({ identityNicknameInput: event.detail.value });
  },
  async saveIdentityNickname() {
    if (this.data.savingIdentityNickname) return;
    const nickname = String(this.data.identityNicknameInput || '').trim();
    const member = this.data.currentMember || {};
    const isBoundParent = member.studyRole !== 'student' && member.role !== 'owner';
    const childLoginCode = String((this.data.child && this.data.child.childLoginCode) || '').trim();
    if (!nickname) {
      wx.showToast({ title: this.data.texts.enterNickname, icon: 'none' });
      return;
    }
    if (['同学', '我'].includes(nickname) || (!isBoundParent && nickname === '佑佑' && childLoginCode !== '317613')) {
      wx.showToast({ title: this.data.texts.chooseAnotherNickname, icon: 'none' });
      return;
    }
    this.setData({ savingIdentityNickname: true, nicknameSaveDebug: '' });
    try {
      const data = isBoundParent
        ? await store.updateBindingProfile(nickname, String(member.relationName || '').trim())
        : await store.updateChildProfile(nickname);
      const savedNickname = isBoundParent
        ? String((data && data.currentMember && data.currentMember.selfChildNickname) || '').trim()
        : String((data && data.child && data.child.nickname) || '').trim();
      if (!data || data.syncMode === 'cloud-error' || savedNickname !== nickname) {
        const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
        const cloudMessage = data && data.cloudError && data.cloudError.message;
        const syncDebug = (data && data.syncDebug) || {};
        const action = isBoundParent ? 'updateBindingProfile' : 'updateChildProfile';
        const error = new Error(cloudMessage || '云端未返回新昵称');
        error.debugText = `DEBUG: family.saveIdentityNickname -> store.${action} -> cloud.${action} -> nickname：${savedNickname || '缺失'}；expected=${nickname}；targetChildId=${target.targetChildId || '缺失'}；cloudError.message=${cloudMessage || '无'}；syncDebug.reason=${syncDebug.reason || '无'}；syncDebug.envId=${syncDebug.envId || '无'}`;
        throw error;
      }
      this.applyFamilyState(data, { savingIdentityNickname: false, nicknameSaveDebug: '' });
      if (!isBoundParent) {
        const snapshotId = buildCurrentProfileSnapshotId();
        snapshotStore.write(`${PROFILE_SNAPSHOT_KEY}:${snapshotId}`, snapshotId, data, { source: 'family-profile-save' });
      }
      wx.showToast({ title: this.data.texts.nicknameUpdated, icon: 'none' });
    } catch (error) {
      this.setData({
        savingIdentityNickname: false,
        nicknameSaveDebug: error.debugText || `DEBUG: family.saveIdentityNickname -> store -> cloud -> 异常：${error.message || '未知'}`
      });
      wx.showToast({ title: this.data.texts.updateFailed, icon: 'none' });
    }
  },
  async saveBindingProfile() {
    const selfChildNickname = String(this.data.bindingNicknameInput || '').trim();
    const relationName = String(this.data.bindingRelationInput || '').trim();
    if (!selfChildNickname || ['同学', '我'].includes(selfChildNickname)) {
      wx.showToast({
        title: this.data.texts.enterOwnNickname,
        icon: 'none'
      });
      return;
    }
    if (!relationName) {
      wx.showToast({
        title: this.data.texts.enterRelation,
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.updateBindingProfile(selfChildNickname, relationName);
      this.applyFamilyState(data, {
        bindingProfileRequired: this.isBindingProfileRequired(data)
      });
      wx.showToast({
        title: this.data.texts.updated,
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: this.data.texts.updateFailed,
        icon: 'none'
      });
    }
  },
  async refreshInviteCode() {
    const data = await store.refreshInviteCode();
    this.setData(page.buildCloudPageData(this.data, data));
    wx.showToast({
      title: this.data.texts.inviteRefreshed,
      icon: 'none'
    });
  },
  async joinFamily() {
    if (!this.data.inviteInput) {
      wx.showToast({
        title: this.data.texts.enterInvite,
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.joinFamily(this.data.inviteInput, this.data.joinName);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
        inviteInput: '',
        joinName: ''
      })));
      wx.showToast({
        title: this.data.texts.joinedFamily,
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: this.data.texts.joinFailed,
        icon: 'none'
      });
    }
  },
  async joinFamilyByChildCode() {
    if (!/^\d{6}$/.test(String(this.data.childCodeInput || ''))) {
      wx.showToast({
        title: this.data.texts.enterSixDigitId,
        icon: 'none'
      });
      return;
    }
    try {
      const currentRole = this.data.currentMember && this.data.currentMember.studyRole === 'student' ? 'student' : 'parent';
      const data = await store.joinFamilyByChildCode(this.data.childCodeInput, this.data.joinName, {
        studyRole: currentRole
      });
      if (currentRole === 'student') {
        wx.setStorageSync('lastStudyRole', 'student');
        wx.setStorageSync('hasUsedStudentMode', 'yes');
      }
      this.applyFamilyState(data, {
        childCodeInput: '',
        joinName: '',
        childJoinRequired: this.isChildJoinRequired(data)
      });
      wx.showToast({
        title: currentRole === 'student' ? this.data.texts.studentLoggedIn : this.data.texts.studentBound,
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: this.data.texts.bindFailed,
        icon: 'none'
      });
    }
  },
  async selectStudent(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const target = this.data.studentCards[index];
    if (!target) {
      return;
    }
    store.setSelectedStudentTarget(target);
    store.setLastParentStudentTarget(target);
    const data = await store.getFamilyPageData();
    this.applyFamilyState(data, {
      childJoinRequired: this.isChildJoinRequired(data)
    });
    wx.showToast({
      title: this.data.texts.studentSwitched,
      icon: 'none'
    });
  },
  async leaveFamily() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: this.data.texts.exitTitle,
        content: this.data.texts.exitContent,
        confirmText: this.data.texts.exit,
        confirmColor: '#b45e40',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    try {
      const data = await store.leaveFamily();
      wx.removeStorageSync('lastStudyRole');
      this.applyFamilyState(data, {
        childCodeInput: '',
        joinName: '',
        childJoinRequired: this.isChildJoinRequired(data)
      });
      wx.showToast({
        title: this.data.texts.exited,
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: this.data.texts.exitFailed,
        icon: 'none'
      });
    }
  },
  async toggleStudyRole() {
    const currentRole = this.data.currentMember && this.data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const nextRole = currentRole === 'student' ? 'parent' : 'student';
    let preparedSwitch = null;
    try {
      preparedSwitch = store.prepareStudyRoleSwitch(nextRole);
      page.setIdentityConfirmed(true);
      wx.setStorageSync('lastStudyRole', nextRole);
      if (nextRole === 'student') {
        wx.setStorageSync('hasUsedStudentMode', 'yes');
      }
      this.setData(Object.assign({
        currentMember: Object.assign({}, this.data.currentMember || {}, { studyRole: nextRole })
      }, this.buildStudyRolePresentation({ studyRole: nextRole })));
      const roleRequest = store.setStudyRole(nextRole, { preparedSwitch });
      wx.showToast({
        title: nextRole === 'student' ? this.data.texts.switchedStudent : this.data.texts.switchedParent,
        icon: 'none'
      });
      wx.switchTab({
        url: '/pages/home/index'
      });
      const data = await roleRequest;
      if (!data || data.syncMode === 'cloud-error' || !data.currentMember || data.currentMember.studyRole !== nextRole) {
        throw new Error((data && data.cloudError && data.cloudError.message) || '身份同步失败');
      }
    } catch (error) {
      if (preparedSwitch) {
        store.restoreStudyRoleSwitch(preparedSwitch);
      }
      wx.showToast({
        title: this.data.texts.switchFailed,
        icon: 'none'
      });
      wx.navigateTo({
        url: '/pages/family/index'
      });
    }
  },
  async undoLastListened() {
    if (this.data.undoingLastListened) {
      return;
    }
    const choice = await new Promise((resolve) => {
      wx.showModal({
        title: this.data.texts.clearPlayTitle,
        content: this.data.texts.clearPlayContent,
        cancelText: this.data.texts.notNow,
        confirmText: this.data.texts.clear,
        confirmColor: '#b45e40',
        success: (res) => resolve(res.confirm ? 'clear' : ''),
        fail: () => resolve('')
      });
    });
    if (!choice) {
      return;
    }
    this.setData({ undoingLastListened: true });
    try {
      const data = await store.undoLastListened();
      this.applyFamilyState(data, {
        undoingLastListened: false
      });
      const cleared = data.cleared || {};
      wx.showToast({
        title: cleared.playCount ? this.data.texts.playCleared : this.data.texts.handled,
        icon: 'none'
      });
    } catch (error) {
      this.setData({ undoingLastListened: false });
      wx.showToast({
        title: this.data.texts.undoFailed,
        icon: 'none'
      });
    }
  }
});
