const store = require('../../utils/store');

Page({
  data: {
    child: {},
    level: {},
    familyReady: false,
    family: {},
    members: [],
    currentMember: {},
    subscriptionPreference: {
      dailyReportEnabled: false
    },
    syncMode: 'local',
    isReviewBuild: false,
    showCloudDebug: false,
    syncDebug: null
  },
  async onShow() {
    const data = await store.getProfileData();
    this.setData(data);
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
  }
});
