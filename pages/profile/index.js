const store = require('../../utils/store');
const page = require('../../utils/page');
const theme = require('../../utils/theme');
const snapshotStore = require('../../utils/snapshot');

const ADMIN_OPEN_IDS = ['om8JT3Zhqe1zeAiKUGGkU0ACjAWs'];
const PROFILE_SNAPSHOT_KEY = 'profileHomeSnapshotV1';
const PROFILE_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  const nickname = String(child.nickname || '').trim();
  return {
    childCodeReady,
    childCodeText: childCodeReady ? childLoginCode : '未绑定',
    nicknameRequired: !!child.nicknameRequired || !nickname || ['同学', '我'].includes(nickname) || (nickname === '佑佑' && childLoginCode !== '317613')
  };
}

function buildCurrentProfileSnapshotId() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  const familyId = String((target && target.targetFamilyId) || '').trim();
  const childId = String((target && target.targetChildId) || '').trim();
  if (familyId || childId) {
    return `target:${familyId}:${childId}`;
  }
  return 'self';
}

function hasDisplayableProfile(data) {
  const child = (data && data.child) || {};
  const nickname = String(child.nickname || '').trim();
  const childLoginCode = String(child.childLoginCode || '').trim();
  if (!nickname || ['同学', '我'].includes(nickname) || (nickname === '佑佑' && childLoginCode !== '317613')) {
    return false;
  }
  return true;
}

function isAdminProfile(data) {
  const user = (data && (data.currentUser || data.user)) || {};
  const member = (data && data.currentMember) || {};
  const ids = [
    user.openId,
    member.openId,
    user.userId,
    member.userId
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return ADMIN_OPEN_IDS.some((openId) => ids.includes(openId) || ids.includes(`user-${openId}`));
}

Page({
  profileSnapshotData: null,
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
    childCodeText: '待同步',
    nicknameRequired: false,
    profileHydrated: false,
    adminVisible: false
  }),
  applyProfileData(data) {
    const profileData = Object.assign({}, data || {});
    this.profileSnapshotData = profileData;
    if (data && data.syncMode !== 'cloud-error') {
      snapshotStore.write(PROFILE_SNAPSHOT_KEY, buildCurrentProfileSnapshotId(), profileData, { source: 'profile-home' });
    }
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      profileHydrated: true,
      childNicknameInput: (data.child && data.child.nickname) || '',
      dailyEncouragement: getDailyEncouragement(),
      adminVisible: !!(data && data.isAdmin)
        || isAdminProfile(data)
        || (data.currentMember && data.currentMember.studyRole === 'parent')
        || !!this.data.adminVisible
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
    const snapshotId = buildCurrentProfileSnapshotId();
    const snapshot = snapshotStore.read(PROFILE_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: PROFILE_SNAPSHOT_MAX_AGE_MS
    });
    if (snapshot && hasDisplayableProfile(snapshot)) {
      this.applyProfileData(snapshot);
    } else {
      const cachedProfile = store.getCachedReadResult
        ? store.getCachedReadResult('getProfileData', store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {})
        : null;
      if (cachedProfile && hasDisplayableProfile(cachedProfile)) {
        this.applyProfileData(cachedProfile);
      }
    }
    const data = await store.getProfileData((fresh) => this.applyProfileData(fresh));
    this.applyProfileData(data);
    this.loadAdminStatus();
  },
  async loadAdminStatus() {
    try {
      const data = await store.getAdminStatus();
      const adminVisible = !!(data && data.isAdmin) || this.data.adminVisible;
      this.setData({ adminVisible });
      const profileData = Object.assign({}, this.profileSnapshotData || {}, {
        isAdmin: !!(data && data.isAdmin)
      });
      this.profileSnapshotData = profileData;
      snapshotStore.write(PROFILE_SNAPSHOT_KEY, buildCurrentProfileSnapshotId(), profileData, { source: 'profile-admin' });
    } catch (error) {
      this.setData({ adminVisible: !!this.data.adminVisible });
    }
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
    if (['同学', '我'].includes(nickname) || (nickname === '佑佑' && String((this.data.child && this.data.child.childLoginCode) || '').trim() !== '317613')) {
      wx.showToast({
        title: '请更换其他名字',
        icon: 'none'
      });
      return;
    }
    try {
      const data = await store.updateChildProfile(nickname);
      this.applyProfileData(Object.assign({}, data, {
        childNicknameInput: (data.child && data.child.nickname) || nickname
      }));
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
      page.setIdentityConfirmed(true);
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
  openAdminPage() {
    wx.navigateTo({ url: '/pages/admin/index' });
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
