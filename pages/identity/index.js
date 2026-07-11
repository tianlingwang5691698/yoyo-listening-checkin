const store = require('../../utils/store');
const page = require('../../utils/page');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');

function buildTexts() {
  return Object.keys(accountCatalog.identity['zh-CN']).reduce((texts, key) => {
    texts[key] = i18n.getPageText('identity', key);
    return texts;
  }, {});
}

Page({
  data: page.createCloudPageData({
    role: 'parent',
    childCode: '',
    displayName: '',
    child: {},
    currentMember: {},
    texts: buildTexts(),
    language: i18n.getLanguage()
  }),
  applyProfileData(data) {
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      childCode: '',
      displayName: (data.currentMember && data.currentMember.displayName) || ''
    })));
  },
  async onShow() {
    this.identityPerf = page.startPagePerf('identity');
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData({ texts, language: i18n.getLanguage() });
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.identityPerf.ready('pageReady', {
      source: 'static',
      cacheHit: true,
      role: this.data.role
    });
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const cached = store.getCachedReadResult ? store.getCachedReadResult('getProfileData', target) : null;
    if (cached) {
      this.applyProfileData(cached);
    }
    const data = await store.getProfileData((fresh) => {
      this.applyProfileData(fresh);
      if (this.identityPerf) {
        this.identityPerf.mark('cloudRefresh', { hasChild: !!(fresh && fresh.child) });
      }
    });
    this.applyProfileData(data);
    if (data && !data.__cacheHit) {
      this.identityPerf.mark('cloudRefresh', { hasChild: !!data.child });
    }
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
  async submitIdentity() {
    if (this.data.role === 'student') {
      return;
    }
    if (!/^\d{6}$/.test(String(this.data.childCode || ''))) {
      wx.showToast({
        title: this.data.texts.enterSixDigitId,
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
        title: this.data.texts.joinedChildRecord,
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: this.data.texts.bindFailed,
        icon: 'none'
      });
    }
  }
});
