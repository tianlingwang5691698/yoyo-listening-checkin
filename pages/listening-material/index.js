const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');

const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const MATERIAL_DETAIL_SNAPSHOT_KEY = 'listeningMaterialDetailSnapshotV1';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  return value > 0 ? `${Math.max(1, Math.round(value / 60))} 分钟` : '音频';
}

function formatExactDuration(seconds) {
  const value = Math.round(Number(seconds || 0));
  if (value <= 0) {
    return '时长待生成';
  }
  const minutes = Math.floor(value / 60);
  const sec = value % 60;
  if (!minutes) {
    return `${sec}秒`;
  }
  return sec ? `${minutes}分${sec}秒` : `${minutes}分钟`;
}

function formatEstimatedDuration(seconds) {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return '时长待生成';
  }
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) {
    return `预计每日 ${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `预计每日 ${hours} 小时${rest ? `${rest} 分钟` : ''}`;
}

function buildRows(tasks) {
  return (tasks || []).map((task) => ({
    itemNo: task.itemNo,
    category: task.category,
    taskId: task.taskId,
    title: labels.decodeHtmlEntities(task.displayTitle || task.title || `第 ${task.itemNo} 条`),
    subtitle: labels.decodeHtmlEntities(task.audioCompactTitle || task.subtitle || ''),
    durationSec: Number(task.durationSec || 0),
    durationText: formatDuration(task.durationSec),
    exactDurationText: formatExactDuration(task.durationSec),
    taskSnapshot: task
  }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || min)));
}

function getPlanMaterials(plan) {
  return Array.isArray(plan && plan.materials) ? plan.materials : [];
}

function getTargetSnapshotPart() {
  const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
  return `${target.targetFamilyId || 'self'}:${target.targetChildId || 'self'}`;
}

function getDetailSnapshotId(levelId, category) {
  return `${getTargetSnapshotPart()}:${levelId || 'A1'}:${category || ''}`;
}

function rememberDetailSnapshot(snapshotId, data, source) {
  if (!data || data.syncMode === 'cloud-error' || !Array.isArray(data.tasks)) {
    return;
  }
  snapshotStore.write(MATERIAL_DETAIL_SNAPSHOT_KEY, snapshotId, data, { source });
}

function hasPlanMaterial(plan, category) {
  return getPlanMaterials(plan).some((item) => item && item.category === category);
}

function buildDurationSummary(data) {
  const tasks = data.tasks || [];
  const startNo = Number(data.startNo || 1);
  const endNo = Number(data.endNo || startNo);
  const dailyCount = Number(data.dailyCount || 1);
  const repeatTarget = Number(data.repeatTarget || 1);
  const rangeTasks = tasks.filter((item) => Number(item.itemNo || 0) >= startNo && Number(item.itemNo || 0) <= endNo);
  const durations = rangeTasks
    .map((item) => Number(item.durationSec || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!durations.length) {
    return {
      planDurationText: '时长待生成',
      durationReady: false
    };
  }
  const rangeDurationSec = durations.reduce((sum, value) => sum + value, 0);
  const effectiveDailyCount = Math.min(Math.max(1, dailyCount), rangeTasks.length || 1);
  const estimatedSec = (rangeDurationSec / durations.length) * effectiveDailyCount * Math.max(1, repeatTarget);
  const partialText = durations.length < rangeTasks.length ? ' · 部分待生成' : '';
  return {
    planDurationText: `${formatEstimatedDuration(estimatedSec)}${partialText}`,
    durationReady: durations.length === rangeTasks.length
  };
}

function buildSaveDebugLines(result, data) {
  const activePlan = result && result.activePlan;
  const materials = getPlanMaterials(activePlan);
  const cloudError = (result && result.cloudError) || {};
  const syncDebug = (result && result.syncDebug) || {};
  const baseLines = [
    'DEBUG: listening-material.savePlan -> store.saveListeningPlanMaterial -> cloud.saveListeningPlanMaterial -> activePlan.materials',
    `expected.category=${data.category || ''}`,
    `payload.levelId=${data.levelId || ''}`,
    `payload.range=${data.startNo || 1}-${data.endNo || 1}`,
    `payload.dailyCount=${data.dailyCount || 1}`,
    `payload.repeatTarget=${data.repeatTarget || 3}`,
    `returned.materials=${materials.map((item) => item && item.category).filter(Boolean).join(',') || 'empty'}`,
    `returned.planId=${(activePlan && activePlan.planId) || ''}`,
    `returned.active=${activePlan ? String(activePlan.active !== false) : 'no-activePlan'}`,
    `targetChildId=${(activePlan && activePlan.childId) || ''}`,
    `targetFamilyId=${(activePlan && activePlan.familyId) || ''}`,
    `syncMode=${(result && result.syncMode) || ''}`,
    `cloudError.action=${cloudError.action || ''}`,
    `cloudError.message=${cloudError.message || ''}`,
    `syncDebug.reason=${syncDebug.reason || ''}`,
    `syncDebug.envId=${syncDebug.envId || ''}`,
    `releaseStage=${(result && result.releaseStage) || ''}`
  ];
  if (result && result.syncMode === 'cloud-error') {
    return [
      '链路断点：store.saveListeningPlanMaterial 收到 cloud-error，云函数没有返回有效 activePlan。',
      '锁定修复点：utils/store.js callCloudFresh；cloudfunctions/yoyo/index.js saveListeningPlanMaterial action；cloudfunctions/yoyo/services/listening-plan.service.js saveListeningPlanMaterial。'
    ].concat(baseLines);
  }
  return [
    '链路断点：cloud.saveListeningPlanMaterial 返回的 activePlan.materials 未包含当前素材。',
    '锁定修复点：cloudfunctions/yoyo/services/shared.service.js saveListeningPlanMaterial；cloudfunctions/yoyo/repositories/listening-plan.repository.js findActiveByScope/upsertActive。'
  ].concat(baseLines);
}

function buildErrorDebugLines(action, error, data) {
  return [
    `链路断点：cloud.${action === 'cancelPlan' ? 'removeListeningPlanMaterial' : 'saveListeningPlanMaterial'} 调用异常。`,
    `锁定修复点：pages/listening-material/index.js ${action}；utils/store.js；cloudfunctions/yoyo/services/listening-plan.service.js。`,
    `DEBUG: listening-material.${action} -> store.${action === 'cancelPlan' ? 'removeListeningPlanMaterial' : 'saveListeningPlanMaterial'} -> cloud.${action === 'cancelPlan' ? 'removeListeningPlanMaterial' : 'saveListeningPlanMaterial'} -> exception`,
    `expected.category=${data.category || ''}`,
    `payload.levelId=${data.levelId || ''}`,
    `error=${(error && (error.message || error.errMsg)) || String(error || '')}`
  ];
}

Page({
  data: page.createCloudPageData({
    levelId: 'A1',
    category: '',
    categoryLabel: '',
    totalCount: 0,
    sliderMax: 1,
    tasks: [],
    startNo: 1,
    endNo: 1,
    dailyCount: 1,
    repeatTarget: 3,
    selectedMaterial: null,
    isSelected: false,
    debugLines: [],
    planDurationText: '时长待生成',
    durationReady: false,
    saving: false
  }),
  applyDetail(data) {
    const totalCount = Number(data.totalCount || 0);
    const selected = data.selectedMaterial || {};
    const startNo = Math.max(1, Math.min(totalCount || 1, Number(selected.startNo || 1)));
    const endNo = Math.max(startNo, Math.min(totalCount || 1, Number(selected.endNo || totalCount || 1)));
    const nextData = Object.assign({}, data, {
      totalCount,
      sliderMax: Math.max(totalCount, 1),
      tasks: buildRows(data.tasks || []),
      startNo,
      endNo,
      dailyCount: Number(selected.dailyCount || 1),
      repeatTarget: Number(selected.repeatTarget || 3),
      selectedMaterial: data.selectedMaterial || null,
      isSelected: !!data.selectedMaterial
    });
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, nextData, buildDurationSummary(nextData))));
  },
  async onLoad(query) {
    page.syncTheme(this);
    const category = query.category || '';
    const levelId = query.levelId || 'A1';
    this.setData({ category, levelId });
    const snapshotId = getDetailSnapshotId(levelId, category);
    const snapshot = snapshotStore.read(MATERIAL_DETAIL_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: SNAPSHOT_MAX_AGE_MS
    });
    if (snapshot) {
      this.applyDetail(snapshot);
    }
    const data = await store.getListeningMaterialDetail({ category, levelId }, (fresh) => {
      rememberDetailSnapshot(snapshotId, fresh, 'listening-material-refresh');
      this.applyDetail(fresh);
    });
    if (data && data.syncMode === 'cloud-error' && snapshot) {
      return;
    }
    rememberDetailSnapshot(snapshotId, data, 'listening-material-load');
    this.applyDetail(data);
  },
  onShow() {
    page.syncTheme(this);
  },
  changeStart(event) {
    const startNo = clamp(event.detail.value, 1, this.data.sliderMax);
    const nextData = Object.assign({}, this.data, {
      startNo,
      endNo: Math.max(startNo, Number(this.data.endNo || startNo))
    });
    this.setData(Object.assign({
      startNo: nextData.startNo,
      endNo: nextData.endNo
    }, buildDurationSummary(nextData)));
  },
  changeEnd(event) {
    const endNo = clamp(event.detail.value, 1, this.data.sliderMax);
    const nextData = Object.assign({}, this.data, {
      endNo: Math.max(Number(this.data.startNo || 1), endNo)
    });
    this.setData(Object.assign({
      endNo: nextData.endNo
    }, buildDurationSummary(nextData)));
  },
  changeDailyCount(event) {
    const nextData = Object.assign({}, this.data, { dailyCount: clamp(event.detail.value, 1, 10) });
    this.setData(Object.assign({ dailyCount: nextData.dailyCount }, buildDurationSummary(nextData)));
  },
  changeRepeatTarget(event) {
    const nextData = Object.assign({}, this.data, { repeatTarget: clamp(event.detail.value, 1, 5) });
    this.setData(Object.assign({ repeatTarget: nextData.repeatTarget }, buildDurationSummary(nextData)));
  },
  syncPreviousPlanPage(activePlan) {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const previous = pages.length > 1 ? pages[pages.length - 2] : null;
    if (!previous || typeof previous.applyOverview !== 'function') {
      return;
    }
    if (previous.route !== 'pages/listening-plan/index' && previous.route !== 'pages/level/index') {
      return;
    }
    if (typeof previous.syncCachedActivePlan === 'function') {
      previous.syncCachedActivePlan(activePlan || null);
    }
    if (typeof previous.rememberOverview === 'function') {
      previous.rememberOverview(previous.data && previous.data.selectedLevel, Object.assign({}, previous.data || {}, {
        activePlan: activePlan || null
      }));
    }
    previous.applyOverview(Object.assign({}, previous.data || {}, {
      activePlan: activePlan || null
    }));
  },
  syncCurrentSelection(activePlan) {
    const selectedMaterial = getPlanMaterials(activePlan).find((item) => item && item.category === this.data.category) || null;
    this.setData({
      selectedMaterial,
      isSelected: !!selectedMaterial
    });
  },
  stepValue(event) {
    const field = String(event.currentTarget.dataset.field || '');
    const delta = Number(event.currentTarget.dataset.delta || 0);
    if (!field || !delta) {
      return;
    }
    const maxMap = {
      startNo: this.data.sliderMax,
      endNo: this.data.sliderMax,
      dailyCount: 10,
      repeatTarget: 5
    };
    const min = 1;
    const max = maxMap[field] || 1;
    const next = clamp(Number(this.data[field] || 1) + delta, min, max);
    if (field === 'startNo') {
      const nextData = Object.assign({}, this.data, {
        startNo: next,
        endNo: Math.max(next, Number(this.data.endNo || next))
      });
      this.setData(Object.assign({
        startNo: nextData.startNo,
        endNo: nextData.endNo
      }, buildDurationSummary(nextData)));
      return;
    }
    if (field === 'endNo') {
      const nextData = Object.assign({}, this.data, { endNo: Math.max(Number(this.data.startNo || 1), next) });
      this.setData(Object.assign({ endNo: nextData.endNo }, buildDurationSummary(nextData)));
      return;
    }
    const nextData = Object.assign({}, this.data, { [field]: next });
    this.setData(Object.assign({ [field]: next }, buildDurationSummary(nextData)));
  },
  async savePlan() {
    if (!this.data.category || !this.data.totalCount || this.data.saving) {
      return;
    }
    this.setData({ saving: true, debugLines: [] });
    try {
      const result = await store.saveListeningPlanMaterial({
        levelId: this.data.levelId,
        category: this.data.category,
        startNo: this.data.startNo,
        endNo: this.data.endNo,
        dailyCount: this.data.dailyCount,
        repeatTarget: this.data.repeatTarget
      });
      if (!hasPlanMaterial(result.activePlan, this.data.category)) {
        const debugLines = buildSaveDebugLines(result, this.data);
        console.warn('[listening-plan-save-debug]', debugLines.join('\n'));
        this.setData({ debugLines });
        return;
      }
      this.syncCurrentSelection(result.activePlan);
      this.syncPreviousPlanPage(result.activePlan);
      this.setData({ debugLines: [] });
      wx.showToast({ title: '计划已保存', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 350);
    } catch (error) {
      const debugLines = buildErrorDebugLines('savePlan', error, this.data);
      console.warn('[listening-plan-save-error]', debugLines.join('\n'));
      this.setData({ debugLines });
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
  async cancelPlan() {
    if (!this.data.category || this.data.saving) {
      return;
    }
    this.setData({ saving: true, debugLines: [] });
    try {
      const result = await store.removeListeningPlanMaterial({
        category: this.data.category
      });
      this.syncCurrentSelection(result.activePlan);
      this.syncPreviousPlanPage(result.activePlan);
      this.setData({ debugLines: [] });
      wx.showToast({ title: '已取消', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 350);
    } catch (error) {
      const debugLines = buildErrorDebugLines('cancelPlan', error, this.data);
      console.warn('[listening-plan-cancel-error]', debugLines.join('\n'));
      this.setData({ debugLines });
      wx.showToast({ title: '取消失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
  openTask(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const task = (this.data.tasks || [])[index];
    if (!task || !task.taskId) {
      return;
    }
    snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${task.category}:${task.taskId}`, {
      category: task.category,
      taskId: task.taskId,
      task: task.taskSnapshot
    }, { source: 'listening-material' });
    wx.navigateTo({
      url: `/pages/lesson/index?category=${encodeURIComponent(task.category)}&taskId=${encodeURIComponent(task.taskId)}&planRunType=preview&source=catalog`
    });
  }
});
