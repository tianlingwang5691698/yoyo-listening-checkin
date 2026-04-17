Page({
  data: {
    role: 'student',
    childCode: '',
    parentInviteCode: ''
  },
  chooseRole(event) {
    const role = event.currentTarget.dataset.role || 'student';
    this.setData({ role });
  },
  handleChildCodeInput(event) {
    this.setData({
      childCode: event.detail.value
    });
  },
  handleParentInviteInput(event) {
    this.setData({
      parentInviteCode: event.detail.value
    });
  },
  submitIdentity() {
    wx.showToast({
      title: '身份绑定功能后续开放',
      icon: 'none'
    });
  }
});
