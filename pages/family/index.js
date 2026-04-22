const store = require('../../utils/store');
const page = require('../../utils/page');
const contracts = require('../../utils/contracts');

Page({
  data: page.createCloudPageData({
    family: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    members: [],
    child: contracts.createChildDefaults(),
    subscriptionPreference: {
      dailyReportEnabled: false
    },
    childCodeInput: '',
    inviteInput: '',
    joinName: '',
    studyRoleLabel: '家长',
    studyRoleActionText: '切换',
    undoingLastListened: false,
    childJoinRequired: false
  }),
  applyFamilyState(data, extra) {
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation((data || {}).currentMember), {
      memberCards: this.buildMemberCards((data || {}).members, (data || {}).currentMember)
    }, extra || {})));
  },
  async onShow() {
    const data = await store.getFamilyPageData();
    this.applyFamilyState(data, {
      childJoinRequired: this.isChildJoinRequired(data)
    });
  },
  isChildJoinRequired(data) {
    const member = (data && data.currentMember) || {};
    return member.role === 'owner'
      && member.studyRole === 'parent'
      && wx.getStorageSync('hasUsedStudentMode') !== 'yes';
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
        title: '请输入 6 位孩子 ID',
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.joinFamilyByChildCode(this.data.childCodeInput, this.data.joinName);
      this.applyFamilyState(data, {
        childCodeInput: '',
        joinName: '',
        childJoinRequired: this.isChildJoinRequired(data)
      });
      wx.showToast({
        title: '已加入孩子记录',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '绑定失败',
        icon: 'none'
      });
    }
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
