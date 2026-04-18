const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    role: 'parent',
    childCode: '',
    displayName: '',
    child: {},
    currentMember: {}
  }),
  async onShow() {
    const data = await store.getProfileData();
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      childCode: '',
      displayName: (data.currentMember && data.currentMember.displayName) || ''
    })));
  },
  chooseRole(event) {
    const role = event.currentTarget.dataset.role || 'parent';
    this.setData({ role });
  },
  handleChildCodeInput(event) {
    this.setData({
      childCode: String(event.detail.value || '').replace(/\D/g, '').slice(0, 6)
    });
  },
  handleDisplayNameInput(event) {
    this.setData({
      displayName: event.detail.value
    });
  },
  copyChildCode() {
    const childLoginCode = (this.data.child && this.data.child.childLoginCode) || '';
    if (!childLoginCode) {
      wx.showToast({
        title: '孩子 ID 准备中',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: childLoginCode
    });
  },
  async submitIdentity() {
    if (this.data.role === 'student') {
      this.copyChildCode();
      return;
    }
    if (!/^\d{6}$/.test(String(this.data.childCode || ''))) {
      wx.showToast({
        title: '请输入 6 位孩子 ID',
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.joinFamilyByChildCode(this.data.childCode, this.data.displayName);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
        childCode: ''
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
  }
});
