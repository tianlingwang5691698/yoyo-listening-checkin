const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    family: {},
    currentMember: {},
    members: [],
    child: {},
    subscriptionPreference: {
      dailyReportEnabled: false
    },
    childCodeInput: '',
    inviteInput: '',
    joinName: '',
    studyRoleLabel: '陪伴者',
    studyRoleActionText: '设为学生'
  }),
  async onShow() {
    const data = await store.getFamilyPageData();
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation(data.currentMember))));
  },
  buildStudyRolePresentation(member) {
    const studyRole = member && member.studyRole === 'student' ? 'student' : 'parent';
    return {
      studyRoleLabel: studyRole === 'student' ? '学生设备' : '陪伴者',
      studyRoleActionText: studyRole === 'student' ? '设为陪伴' : '设为学生'
    };
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
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation(data.currentMember), {
        childCodeInput: '',
        joinName: ''
      })));
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
  copyChildCode() {
    const childLoginCode = (this.data.child && this.data.child.childLoginCode) || '';
    if (!childLoginCode) {
      wx.showToast({
        title: '孩子 ID 待同步',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: childLoginCode
    });
  },
  async toggleStudyRole() {
    const currentRole = this.data.currentMember && this.data.currentMember.studyRole === 'student' ? 'student' : 'parent';
    const nextRole = currentRole === 'student' ? 'parent' : 'student';
    try {
      const data = await store.setStudyRole(nextRole);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, this.buildStudyRolePresentation(data.currentMember))));
      wx.showToast({
        title: nextRole === 'student' ? '已设为学生设备' : '已设为陪伴者',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '切换失败',
        icon: 'none'
      });
    }
  }
});
