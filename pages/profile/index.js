const store = require('../../utils/store');
const page = require('../../utils/page');

const DAILY_ENCOURAGEMENTS = [
  ['Small steps count.', '一点点坚持，也会慢慢变强。'],
  ['Your ears are growing.', '今天听见的，都会留下来。'],
  ['Listen softly, keep going.', '慢慢听，继续往前。'],
  ['Every day adds up.', '每天一点点，都会算数。'],
  ['You are building a habit.', '你正在养成一个很棒的习惯。'],
  ['Three times, one brave heart.', '听三遍，是小小的勇敢。'],
  ['Good listening takes time.', '好的听力，是慢慢长出来的。']
];

function getDailyEncouragement() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayIndex = Math.floor(diff / 86400000);
  const item = DAILY_ENCOURAGEMENTS[dayIndex % DAILY_ENCOURAGEMENTS.length];
  return {
    english: item[0],
    chinese: item[1]
  };
}

function buildProfilePresentation(data) {
  const child = (data && data.child) || {};
  const childLoginCode = String(child.childLoginCode || '');
  const childCodeReady = /^\d{6}$/.test(childLoginCode);
  return {
    childCodeReady,
    childCodeText: childCodeReady ? childLoginCode : ((data && data.syncMode) === 'cloud' ? '同步中' : '待同步')
  };
}

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
    },
    childNicknameInput: '',
    dailyEncouragement: getDailyEncouragement(),
    childCodeReady: false,
    childCodeText: '待同步'
  }),
  async onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const data = await store.getProfileData();
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      childNicknameInput: (data.child && data.child.nickname) || '',
      dailyEncouragement: getDailyEncouragement()
    }, buildProfilePresentation(data))));
  },
  handleChildNicknameInput(event) {
    this.setData({
      childNicknameInput: event.detail.value
    });
  },
  async saveChildProfile() {
    const nickname = String(this.data.childNicknameInput || '').trim();
    if (!nickname) {
      wx.showToast({
        title: '先输入孩子昵称',
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.updateChildProfile(nickname);
      this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
        childNicknameInput: (data.child && data.child.nickname) || nickname
      }, buildProfilePresentation(data))));
      wx.showToast({
        title: '昵称已更新',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      });
    }
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
