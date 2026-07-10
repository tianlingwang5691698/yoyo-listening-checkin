const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');

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
    bindingProfileRequired: false,
    studyRoleLabel: '家长',
    studyRoleActionText: '切换',
    undoingLastListened: false,
    childJoinRequired: false
  }),
  applyFamilyState(data, extra) {
    const studentCards = this.buildStudentCards(data);
    const bindingInputs = this.buildBindingProfileInputs(data);
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation((data || {}).currentMember), {
      memberCards: this.buildMemberCards((data || {}).members, (data || {}).currentMember),
      studentCards,
      studentCountText: studentCards.length ? `已绑定 ${studentCards.length} 人` : '',
      bindingProfileRequired: this.isBindingProfileRequired(data),
      bindingNicknameInput: bindingInputs.selfChildNickname,
      bindingRelationInput: bindingInputs.relationName
    }, extra || {})));
  },
  async onShow() {
    this.familyPerf = page.startPagePerf('family');
    page.syncTheme(this);
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
      this.familyPerf.ready('pageReady', {
        source: data && data.__cacheHit ? 'cache' : (data && data.syncMode === 'cloud-error' ? 'error' : 'cloud'),
        cacheHit: !!(data && data.__cacheHit),
        members: ((data && data.members) || []).length
      });
    }
    if (data && !data.__cacheHit && data.syncMode !== 'cloud-error') {
      this.familyPerf.mark('cloudRefresh', { members: (data.members || []).length });
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
      studyRoleLabel: studyRole === 'student' ? '学生' : '家长',
      studyRoleActionText: '切换'
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
      nickname: child.nickname || '学生',
      childLoginCode: child.childLoginCode || '',
      isCurrent: true
    }] : [];
    const source = studentLinks.length ? studentLinks : fallback;
    return source.filter((item) => item && item.role !== 'owner').map((item) => {
      return {
        familyId: item.familyId,
        childId: item.childId,
        nickname: item.nickname || '学生',
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
  async saveBindingProfile() {
    const selfChildNickname = String(this.data.bindingNicknameInput || '').trim();
    const relationName = String(this.data.bindingRelationInput || '').trim();
    if (!selfChildNickname || ['同学', '我'].includes(selfChildNickname)) {
      wx.showToast({
        title: '先填写你的昵称',
        icon: 'none'
      });
      return;
    }
    if (!relationName) {
      wx.showToast({
        title: '先填写和孩子的关系',
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
        title: '已更新',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      });
    }
  },
  async refreshInviteCode() {
    const data = await store.refreshInviteCode();
    this.setData(page.buildCloudPageData(this.data, data));
    wx.showToast({
      title: '邀请码已刷新',
      icon: 'none'
    });
  },
  async joinFamily() {
    if (!this.data.inviteInput) {
      wx.showToast({
        title: '先输入邀请码',
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
        title: '已加入家庭',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none'
      });
    }
  },
  async joinFamilyByChildCode() {
    if (!/^\d{6}$/.test(String(this.data.childCodeInput || ''))) {
      wx.showToast({
        title: '请输入 6 位学号',
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
        title: currentRole === 'student' ? '已登录学生账号' : '已绑定学生',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '绑定失败',
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
      title: '已切换学生',
      icon: 'none'
    });
  },
  async leaveFamily() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '退出孩子记录？',
        content: '退出后，这个微信将不再连接当前孩子记录。',
        confirmText: '退出',
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
        title: '已退出孩子记录',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '退出失败',
        icon: 'none'
      });
    }
  },
  async toggleStudyRole() {
    const currentRole = this.data.currentMember && this.data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const nextRole = currentRole === 'student' ? 'parent' : 'student';
    try {
      const data = await store.setStudyRole(nextRole);
      page.setIdentityConfirmed(true);
      wx.setStorageSync('lastStudyRole', nextRole);
      if (nextRole === 'student') {
        wx.setStorageSync('hasUsedStudentMode', 'yes');
      }
      this.applyFamilyState(data, {
        childJoinRequired: this.isChildJoinRequired(data)
      });
      wx.showToast({
        title: nextRole === 'student' ? '已切到学生' : '已切到家长',
        icon: 'none'
      });
      if (nextRole === 'student') {
        wx.switchTab({
          url: '/pages/home/index'
        });
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '切换失败',
        icon: 'none'
      });
    }
  },
  async undoLastListened() {
    if (this.data.undoingLastListened) {
      return;
    }
    const choice = await new Promise((resolve) => {
      wx.showModal({
        title: '清掉多记播放？',
        content: '今天还没打卡，可以清掉家长误记的播放次数。',
        cancelText: '不用',
        confirmText: '清掉',
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
        title: cleared.playCount ? '已清掉多记播放' : '已处理',
        icon: 'none'
      });
    } catch (error) {
      this.setData({ undoingLastListened: false });
      wx.showToast({
        title: error.message || '撤回失败',
        icon: 'none'
      });
    }
  }
});
