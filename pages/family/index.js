const store = require('../../utils/store');

Page({
  data: {
    syncMode: 'local',
    family: {},
    currentMember: {},
    members: [],
    child: {},
    subscriptionPreference: {
      dailyReportEnabled: false
    },
    inviteInput: '',
    joinName: ''
  },
  async onShow() {
    const data = await store.getFamilyPageData();
    this.setData(data);
  },
  handleInviteInput(event) {
    this.setData({
      inviteInput: event.detail.value
    });
  },
  handleJoinNameInput(event) {
    this.setData({
      joinName: event.detail.value
    });
  },
  async refreshInviteCode() {
    const data = await store.refreshInviteCode();
    this.setData(data);
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
      this.setData(Object.assign({}, data, {
        inviteInput: '',
        joinName: ''
      }));
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
  }
});
