const store = require('../../utils/store');
const page = require('../../utils/page');

function normalizeRows(rows) {
  return (rows || []).map((row) => Object.assign({}, row, {
    expanded: false,
    activityText: buildActivityText(row),
    memberCount: (row.members || []).length,
    members: (row.members || []).map((member) => Object.assign({}, member))
  })).map((row) => {
    const parentMembers = (row.members || []).filter((member) => member.isBindingParent);
    return Object.assign({}, row, {
      parentCount: parentMembers.length,
      parentNames: parentMembers.map((member) => member.displayName || '未命名').join('、') || ''
    });
  });
}

function formatDateText(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '未记录';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
}

function buildActivityText(row) {
  const count = Number(row && row.loginCount || 0);
  const activityCount = Number(row && row.activityCount || 0);
  const latestTime = row && (row.lastSeenAt || row.lastActivityAt || row.lastLoginAt);
  if (activityCount > 0) {
    return `登录 ${count} 次 · 学习 ${activityCount} 条 · 最近 ${formatDateText(latestTime)}`;
  }
  return `登录 ${count} 次 · 最近 ${formatDateText(latestTime)}`;
}

function splitRows(rows) {
  const activeRows = (rows || []).filter((row) => row.active);
  const inactiveRows = (rows || []).filter((row) => !row.active);
  return { activeRows, inactiveRows };
}

Page({
  data: page.createCloudPageData({
    loading: true,
    errorText: '',
    rows: [],
    activeRows: [],
    inactiveRows: [],
    visibleRows: [],
    listMode: 'active',
    activeTotal: 0,
    inactiveTotal: 0,
    total: 0
  }),
  onShow() {
    this.adminPerf = page.startPagePerf('admin');
    page.syncTheme(this);
    this.loadAdminData();
  },
  applyAdminData(data) {
    if (!data || !data.isAdmin) return false;
    const rows = normalizeRows(data.rows);
    const groups = splitRows(rows);
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      errorText: '',
      rows,
      activeRows: groups.activeRows,
      inactiveRows: groups.inactiveRows,
      visibleRows: this.data.listMode === 'inactive' ? groups.inactiveRows : groups.activeRows,
      activeTotal: groups.activeRows.length,
      inactiveTotal: groups.inactiveRows.length,
      total: data.total || 0
    }));
    return true;
  },
  async loadAdminData() {
    const cached = store.getCachedReadResult ? store.getCachedReadResult('getAdminFamilyList', {}) : null;
    const hasCached = this.applyAdminData(cached);
    if (hasCached && this.adminPerf) {
      this.adminPerf.ready('pageReady', {
        source: 'cache',
        cacheHit: true,
        rows: (cached.rows || []).length
      });
    } else {
      this.setData({ loading: true, errorText: '' });
    }
    try {
      const data = await store.getAdminFamilyList((fresh) => {
        this.applyAdminData(fresh);
        if (this.adminPerf) {
          this.adminPerf.mark('cloudRefresh', { rows: (fresh.rows || []).length });
        }
      });
      if (!data || !data.isAdmin) {
        const cloudMessage = data && data.cloudError && data.cloudError.message;
        this.setData({
          loading: false,
          errorText: cloudMessage || '当前微信没有后台权限，或云函数还没有部署最新版本。'
        });
        if (this.adminPerf) {
          this.adminPerf.ready('pageReady', { source: 'error', cacheHit: false, rows: 0 });
        }
        return;
      }
      this.applyAdminData(data);
      if (!hasCached && this.adminPerf) {
        this.adminPerf.ready('pageReady', {
          source: data.__cacheHit ? 'cache' : 'cloud',
          cacheHit: !!data.__cacheHit,
          rows: (data.rows || []).length
        });
      }
      if (!data.__cacheHit && this.adminPerf) {
        this.adminPerf.mark('cloudRefresh', { rows: (data.rows || []).length });
      }
    } catch (error) {
      this.setData({
        loading: false,
        errorText: (error && (error.message || error.errMsg)) || '后台数据加载失败，请重新部署 yoyo 云函数后再试。'
      });
      if (this.adminPerf) {
        this.adminPerf.ready('pageReady', { source: 'error', cacheHit: false, rows: 0 });
      }
    }
  },
  toggleRowExpanded(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({
      [`visibleRows[${index}].expanded`]: !this.data.visibleRows[index].expanded
    });
  },
  switchListMode(event) {
    const mode = String(event.currentTarget.dataset.mode || 'active');
    const listMode = mode === 'inactive' ? 'inactive' : 'active';
    this.setData({
      listMode,
      visibleRows: listMode === 'inactive' ? this.data.inactiveRows : this.data.activeRows
    });
  }
});
