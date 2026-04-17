const store = require('../../utils/store');
const page = require('../../utils/page');

Page({
  data: page.createCloudPageData({
    child: {},
    level: {},
    familyReady: false,
    family: {},
    members: [],
    currentUser: {},
    currentMember: {},
    subscriptionPreference: {
      dailyReportEnabled: false
    }
  }),
  async onShow() {
    const data = await store.getProfileData();
    this.setData(page.buildCloudPageData(this.data, data));
  },
  openParentPage() {
    wx.navigateTo({
      url: '/pages/parent/index'
    });
  },
  openFamilyPage() {
    wx.navigateTo({
      url: '/pages/family/index'
    });
  },
  openIdentityPage() {
    wx.navigateTo({
      url: '/pages/identity/index'
    });
  }
});
