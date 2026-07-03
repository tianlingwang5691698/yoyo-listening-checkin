const store = require('../../utils/store');
const page = require('../../utils/page');

function normalizeRows(rows) {
  return (rows || []).map((row) => Object.assign({}, row, {
    memberCount: (row.members || []).length,
    members: (row.members || []).map((member) => Object.assign({}, member, {
      roleText: member.studyRole === 'student' ? '学生' : '家长'
    }))
  }));
}

Page({
  data: page.createCloudPageData({
    loading: true,
    rows: [],
    total: 0
  }),
  onShow() {
    page.syncTheme(this);
    this.loadAdminData();
  },
  async loadAdminData() {
    this.setData({ loading: true });
    try {
      const data = await store.getAdminFamilyList();
      if (!data || !data.isAdmin) {
        wx.showToast({ title: '无权限', icon: 'none' });
        wx.navigateBack();
        return;
      }
      this.setData(page.buildCloudPageData(this.data, {
        loading: false,
        rows: normalizeRows(data.rows),
        total: data.total || 0
      }));
    } catch (error) {
      wx.showToast({ title: '无权限', icon: 'none' });
      wx.navigateBack();
    }
  }
});
