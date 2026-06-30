const page = require('../../../utils/page');
const store = require('../../../utils/store');

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeItems(items) {
  return (items || []).map((item, index) => {
    const attempts = (item.attempts || []).map((attempt, attemptIndex) => Object.assign({}, attempt, {
      displayTitle: `第 ${attemptIndex + 1} 次回答`,
      scoreText: attempt.status === 'score-pending' ? '待评分' : `${Number(attempt.score || 0)} 分`
    }));
    const latestAttempt = attempts.length ? attempts[attempts.length - 1] : null;
    return Object.assign({}, item, {
    index: index + 1,
    typeLabel: item.type === 'reading' ? '阅读' : (item.type === 'reading-study' ? '阅读学习' : (item.type === 'grammar' ? '语法' : (item.type === 'writing' ? '写作' : (item.type === 'speaking' ? '回答' : '听力')))),
    actionText: item.type === 'reading' ? '查看解析' : (item.type === 'reading-study' ? '查看学习包' : (item.type === 'grammar' ? '查看语法' : (item.type === 'writing' ? '查看批改' : (item.type === 'speaking' ? '查看回答' : '查看任务')))),
    expanded: false,
    attempts,
    attemptCount: attempts.length,
    latestAttemptScore: latestAttempt ? Number(latestAttempt.score || 0) : 0
  });
  });
}

Page({
  data: page.createCloudPageData({
    items: []
  }),
  async onShow() {
    page.syncTheme(this);
    let items = [];
    try {
      const data = await store.getStudyCompletions();
      items = data && Array.isArray(data.items) && data.items.length
        ? data.items
        : (wx.getStorageSync('todayCompletedItemsV1') || []);
    } catch (error) {
      try {
        items = wx.getStorageSync('todayCompletedItemsV1') || [];
      } catch (innerError) {
        items = [];
      }
    }
    this.setData({
      items: normalizeItems(items)
    });
  },
  openItem(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const item = this.data.items[index];
    if (!item) return;
    if (['reading', 'reading-study', 'grammar', 'writing'].includes(item.type)) {
      wx.navigateTo({
        url: `/pages/parent/detail/index?date=${item.date || todayString()}`
      });
      return;
    }
    if (item.category && item.taskId) {
      if (item.type === 'speaking' && item.attempts && item.attempts.length) {
        const items = this.data.items.slice();
        items[index] = Object.assign({}, item, { expanded: !item.expanded });
        this.setData({ items });
        return;
      }
      wx.navigateTo({
        url: `/pages/lesson/index?category=${item.category}&taskId=${item.taskId}`
      });
      return;
    }
    wx.showToast({ title: '暂无详情', icon: 'none' });
  },
  async playAttempt(event) {
    const itemIndex = Number(event.currentTarget.dataset.itemIndex || 0);
    const attemptIndex = Number(event.currentTarget.dataset.attemptIndex || 0);
    const audioType = String(event.currentTarget.dataset.audioType || 'answer');
    const item = this.data.items[itemIndex] || {};
    const attempt = (item.attempts || [])[attemptIndex] || null;
    if (!attempt) return;
    const fileId = audioType === 'feedback'
      ? (attempt.feedbackAudioFileId || '')
      : (attempt.answerAudioFileId || '');
    if (!fileId) {
      wx.showToast({ title: audioType === 'feedback' ? '暂无建议语音' : '暂无录音', icon: 'none' });
      return;
    }
    try {
      const url = await store.getTempFileURL(fileId);
      if (!this.audioContext) {
        this.audioContext = wx.createInnerAudioContext();
        this.audioContext.obeyMuteSwitch = false;
      }
      this.audioContext.stop();
      this.audioContext.src = url;
      this.audioContext.play();
    } catch (error) {
      wx.showToast({ title: '播放失败', icon: 'none' });
    }
  }
});
