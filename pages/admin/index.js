const store = require('../../utils/store');
const page = require('../../utils/page');

function normalizeRows(rows) {
  return (rows || []).map((row) => Object.assign({}, row, {
    memberCount: (row.members || []).length,
    members: (row.members || []).map((member) => Object.assign({}, member, {
      roleText: member.role === 'owner' && member.studyRole === 'student'
        ? '本机学生'
        : (member.studyRole === 'student' ? '学生设备' : '家长'),
      idText: member.userId || member.openId || '无 ID'
    }))
  })).map((row) => {
    const parentMembers = (row.members || []).filter((member) => member.roleText === '家长');
    return Object.assign({}, row, {
      parentCount: parentMembers.length,
      parentMembers,
      otherMembers: (row.members || []).filter((member) => member.roleText !== '家长')
    });
  });
}

async function getCurrentAdminOpenId() {
  try {
    const status = await store.getAdminStatus();
    return status && status.openId ? status.openId : '';
  } catch (error) {
    return '';
  }
}

function buildDiagnosticRows(diagnostic) {
  const item = diagnostic || {};
  return [{
    label: '云函数版本',
    value: item.adminServiceVersion || '未返回'
  }, {
    label: '当前 openId',
    value: item.openId || '未返回'
  }, {
    label: '内置白名单',
    value: item.builtinHit ? '命中' : '未命中'
  }, {
    label: '环境变量白名单',
    value: item.envHit ? '命中' : (item.envConfigured ? `未命中（${item.envCount} 条）` : '未配置/未读取')
  }, {
    label: '权限结论',
    value: item.isAdmin ? '允许' : '拒绝'
  }];
}

Page({
  data: page.createCloudPageData({
    loading: true,
    errorText: '',
    currentOpenId: '',
    diagnosticRows: [],
    rows: [],
    total: 0
  }),
  onShow() {
    page.syncTheme(this);
    this.loadAdminData();
  },
  async loadAdminData() {
    this.setData({ loading: true, errorText: '' });
    let diagnostic = null;
    try {
      diagnostic = await store.getAdminStatus();
      this.setData({
        currentOpenId: diagnostic && diagnostic.openId ? diagnostic.openId : '',
        diagnosticRows: buildDiagnosticRows(diagnostic)
      });
    } catch (diagnosticError) {
      this.setData({
        diagnosticRows: buildDiagnosticRows(null)
      });
    }
    try {
      const data = await store.getAdminFamilyList();
      if (!data || !data.isAdmin) {
        const cloudMessage = data && data.cloudError && data.cloudError.message;
        const currentOpenId = await getCurrentAdminOpenId();
        this.setData({
          loading: false,
          currentOpenId,
          errorText: cloudMessage || '当前微信没有后台权限，或云函数还没有部署最新版本。'
        });
        return;
      }
      diagnostic = data.diagnostic || diagnostic;
      this.setData(page.buildCloudPageData(this.data, {
        loading: false,
        errorText: '',
        diagnosticRows: buildDiagnosticRows(diagnostic),
        rows: normalizeRows(data.rows),
        total: data.total || 0
      }));
    } catch (error) {
      const currentOpenId = await getCurrentAdminOpenId();
      this.setData({
        loading: false,
        currentOpenId,
        errorText: (error && (error.message || error.errMsg)) || '后台数据加载失败，请重新部署 yoyo 云函数后再试。'
      });
    }
  },
  copyValue(event) {
    const value = String(event.currentTarget.dataset.value || '').trim();
    if (!value) return;
    wx.setClipboardData({
      data: value,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  }
});
