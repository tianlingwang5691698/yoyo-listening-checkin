const store = require('../../utils/store');
const page = require('../../utils/page');
const i18n = require('../../utils/i18n');
const accountCatalog = require('../../utils/i18n-catalog-account');

function buildTexts() {
  return Object.keys(accountCatalog.admin['zh-CN']).reduce((texts, key) => {
    texts[key] = i18n.getPageText('admin', key);
    return texts;
  }, {});
}

function formatText(text, values) {
  return Object.keys(values || {}).reduce((result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), String(text || ''));
}

function normalizeRows(rows, texts) {
  return (rows || []).map((row) => Object.assign({}, row, {
    childDisplayNickname: !String(row.childNickname || '').trim() || ['同学', '我'].includes(String(row.childNickname || '').trim()) ? texts.defaultNickname : row.childNickname,
    expanded: false,
    activityText: buildActivityText(row, texts),
    memberCount: (row.members || []).length,
    members: (row.members || []).map((member) => Object.assign({}, member))
  })).map((row) => {
    const parentMembers = (row.members || []).filter((member) => member.isBindingParent);
    return Object.assign({}, row, {
      parentCount: parentMembers.length,
      parentNames: parentMembers.map((member) => member.displayName || texts.unnamed).join(', ') || ''
    });
  });
}

function formatDateText(value, texts) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return texts.notRecorded;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
}

function buildActivityText(row, texts) {
  const count = Number(row && row.loginCount || 0);
  const activityCount = Number(row && row.activityCount || 0);
  const latestTime = row && (row.lastSeenAt || row.lastActivityAt || row.lastLoginAt);
  if (activityCount > 0) {
    return formatText(texts.activitySummary, { count, activity: activityCount, date: formatDateText(latestTime, texts) });
  }
  return formatText(texts.loginSummary, { count, date: formatDateText(latestTime, texts) });
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
    total: 0,
    texts: buildTexts(),
    language: i18n.getLanguage()
  }),
  onShow() {
    this.adminPerf = page.startPagePerf('admin');
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData({ texts, language: i18n.getLanguage() });
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.loadAdminData();
  },
  applyAdminData(data) {
    if (!data || !data.isAdmin) return false;
    const rows = normalizeRows(data.rows, this.data.texts);
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
    this.setData({ loading: true, errorText: '', rows: [], visibleRows: [] });
    await new Promise((resolve) => wx.nextTick(resolve));
    if (this.adminPerf) {
      this.adminPerf.ready('pageReady', { source: 'permission-shell', cacheHit: false, rows: 0 });
    }
    const status = await store.getAdminStatus({ forceRefresh: true });
    if (this.adminPerf) {
      this.adminPerf.mark('adminStatusRefresh', { isAdmin: !!(status && status.isAdmin) });
    }
    if (!status || status.isAdmin !== true) {
      this.setData({
        loading: false,
        errorText: this.data.texts.noPermission
      });
      if (this.adminPerf) {
        this.adminPerf.mark('permissionResolved', { source: 'forbidden', rows: 0 });
      }
      return;
    }
    const cached = store.getCachedReadResult ? store.getCachedReadResult('getAdminFamilyList', {}) : null;
    const hasCached = this.applyAdminData(cached);
    if (hasCached && this.adminPerf) {
      this.adminPerf.mark('cacheRendered', {
        source: 'cache',
        cacheHit: true,
        rows: (cached.rows || []).length
      });
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
          errorText: this.data.texts.permissionOrDeployError
        });
        if (this.adminPerf) {
          this.adminPerf.mark('cloudRefresh', { source: 'error', rows: 0 });
        }
        return;
      }
      this.applyAdminData(data);
      if (!hasCached && this.adminPerf) {
        this.adminPerf.mark('cloudRefresh', {
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
        errorText: this.data.texts.loadFailed
      });
      if (this.adminPerf) {
        this.adminPerf.mark('cloudRefresh', { source: 'error', rows: 0 });
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
