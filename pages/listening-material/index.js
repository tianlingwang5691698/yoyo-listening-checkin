const store = require('../../utils/store');
const page = require('../../utils/page');
const labels = require('../../utils/labels');
const snapshotStore = require('../../utils/snapshot');

const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  return value > 0 ? `${Math.max(1, Math.round(value / 60))} 分钟` : '音频';
}

function buildRows(tasks) {
  return (tasks || []).map((task) => ({
    itemNo: task.itemNo,
    category: task.category,
    taskId: task.taskId,
    title: labels.decodeHtmlEntities(task.displayTitle || task.title || `第 ${task.itemNo} 条`),
    subtitle: labels.decodeHtmlEntities(task.audioCompactTitle || task.subtitle || ''),
    durationText: formatDuration(task.durationSec),
    taskSnapshot: task
  }));
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
    saving: false
  }),
  applyDetail(data) {
    const totalCount = Number(data.totalCount || 0);
    const selected = data.selectedMaterial || {};
    const startNo = Math.max(1, Math.min(totalCount || 1, Number(selected.startNo || 1)));
    const endNo = Math.max(startNo, Math.min(totalCount || 1, Number(selected.endNo || totalCount || 1)));
    this.setData(page.buildCloudPageData(this.data, Object.assign({}, data, {
      totalCount,
      sliderMax: Math.max(totalCount, 1),
      tasks: buildRows(data.tasks || []),
      startNo,
      endNo,
      dailyCount: Number(selected.dailyCount || 1),
      repeatTarget: Number(selected.repeatTarget || 3)
    })));
  },
  async onLoad(query) {
    page.syncTheme(this);
    const category = query.category || '';
    const levelId = query.levelId || 'A1';
    this.setData({ category, levelId });
    const data = await store.getListeningMaterialDetail({ category, levelId }, (fresh) => this.applyDetail(fresh));
    this.applyDetail(data);
  },
  onShow() {
    page.syncTheme(this);
  },
  changeStart(event) {
    const startNo = Number(event.detail.value || 1);
    this.setData({
      startNo,
      endNo: Math.max(startNo, Number(this.data.endNo || startNo))
    });
  },
  changeEnd(event) {
    const endNo = Number(event.detail.value || 1);
    this.setData({
      endNo: Math.max(Number(this.data.startNo || 1), endNo)
    });
  },
  changeDailyCount(event) {
    this.setData({ dailyCount: Number(event.detail.value || 1) });
  },
  changeRepeatTarget(event) {
    this.setData({ repeatTarget: Number(event.detail.value || 1) });
  },
  async savePlan() {
    if (!this.data.category || !this.data.totalCount || this.data.saving) {
      return;
    }
    this.setData({ saving: true });
    try {
      await store.saveListeningPlanMaterial({
        levelId: this.data.levelId,
        category: this.data.category,
        startNo: this.data.startNo,
        endNo: this.data.endNo,
        dailyCount: this.data.dailyCount,
        repeatTarget: this.data.repeatTarget
      });
      wx.showToast({ title: '计划已保存', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' });
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
