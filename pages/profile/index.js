const store = require('../../utils/store');
const page = require('../../utils/page');
const theme = require('../../utils/theme');

const DAILY_ENCOURAGEMENTS = [
  ['Small steps count.', '一点点坚持，也会慢慢变强。'],
  ['Your ears are growing.', '今天听见的，都会留下来。'],
  ['Listen softly, keep going.', '慢慢听，继续往前。'],
  ['Every day adds up.', '每天一点点，都会算数。'],
  ['You are building a habit.', '你正在养成一个很棒的习惯。'],
  ['Three times, one brave heart.', '听三遍，是小小的勇敢。'],
  ['Good listening takes time.', '好的听力，是慢慢长出来的。'],
  ['One more sound today.', '今天多听懂一点点。'],
  ['Keep your ears open.', '小耳朵打开，进步就会进来。'],
  ['A little focus helps.', '专心一小会儿，也很厉害。'],
  ['You heard something new.', '今天又听见了新的声音。'],
  ['Practice makes it familiar.', '多听几次，就会越来越熟。'],
  ['Your rhythm is building.', '你的学习节奏正在建立。'],
  ['Listen, then understand.', '先听见，再慢慢听懂。'],
  ['Tiny progress is progress.', '小小进步，也是真的进步。'],
  ['You are getting steadier.', '你正在越来越稳。'],
  ['Today counts.', '今天的坚持也算数。'],
  ['Sounds become words.', '声音会慢慢变成听得懂的词。'],
  ['Stay with the sentence.', '跟住一句话，就更靠近理解。'],
  ['Your habit is growing.', '你的习惯正在长大。'],
  ['Listen with patience.', '耐心听，答案会慢慢清楚。'],
  ['A calm mind hears more.', '心静一点，就能听见更多。'],
  ['You are training your ear.', '你在训练自己的小耳朵。'],
  ['Repeat and it gets easier.', '重复几次，就会轻松一点。'],
  ['Every lesson leaves a trace.', '每次学习都会留下痕迹。'],
  ['You are closer than yesterday.', '你比昨天更近一步。'],
  ['Let the sounds settle.', '让今天的声音慢慢留下来。'],
  ['One step, one sentence.', '一步一步，一句一句。'],
  ['Your listening is waking up.', '你的听力正在醒来。'],
  ['Keep going gently.', '轻轻坚持，就很好。']
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
    childCodeText: childCodeReady ? childLoginCode : '未绑定'
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
  applyProfileData(data) {
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      childNicknameInput: (data.child && data.child.nickname) || '',
      dailyEncouragement: getDailyEncouragement()
    }, buildProfilePresentation(data))));
  },
  async onShow() {
    page.syncTheme(this);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }
    if (!page.requireIdentityConfirmed()) {
      return;
    }
    const data = await store.getProfileData((fresh) => this.applyProfileData(fresh));
    this.applyProfileData(data);
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
  async switchStudyRole(event) {
    const role = event.currentTarget.dataset.role === 'student' ? 'student' : 'parent';
    try {
      const data = await store.setStudyRole(role);
      this.applyProfileData(Object.assign({}, this.data, data));
      wx.setStorageSync('lastStudyRole', role);
      wx.showToast({
        title: role === 'student' ? '已切到学生' : '已切到家长',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: '切换失败',
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
  },
  switchTheme(event) {
    const nextTheme = theme.setTheme(event.currentTarget.dataset.theme);
    const themeData = page.syncTheme(this);
    this.setData(themeData);
    wx.showToast({
      title: `${theme.getThemeLabel(nextTheme)}主题`,
      icon: 'none'
    });
  }
});
