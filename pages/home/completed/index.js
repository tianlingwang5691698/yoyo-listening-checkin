const page = require('../../../utils/page');
const store = require('../../../utils/store');
const appConfig = require('../../../app-config');
const snapshotStore = require('../../../utils/snapshot');
const i18n = require('../../../utils/i18n');
const TODAY_COMPLETED_CACHE_KEY = 'todayCompletedItemsV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';

function t(key, variables) {
  const template = i18n.getPageText('completed', key);
  return Object.keys(variables || {}).reduce((text, name) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), variables[name]), template);
}

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

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
      displayTitle: t('attempt', { n: attemptIndex + 1 }),
      scoreText: attempt.status === 'score-pending' ? t('pendingScore') : `${Number(attempt.score || 0)} ${t('points')}`
    }));
    const latestAttempt = attempts.length ? attempts[attempts.length - 1] : null;
    return Object.assign({}, item, {
      index: index + 1,
      typeLabel: getTypeLabel(item.type),
      actionText: getActionText(item.type),
      expanded: false,
      attempts,
      attemptCount: attempts.length,
      latestAttemptScore: latestAttempt ? Number(latestAttempt.score || 0) : 0
    });
  });
}

function getTypeLabel(type) {
  if (type === 'reading') return t('reading');
  if (type === 'reading-study') return t('readingStudy');
  if (type === 'grammar') return t('grammar');
  if (type === 'writing') return t('writing');
  if (type === 'speaking') return t('speaking');
  if (type === 'listening-study') return t('listeningStudy');
  if (type === 'vocabulary') return t('vocabulary');
  return t('listening');
}

function getActionText(type) {
  if (type === 'reading') return t('viewAnalysis');
  if (type === 'reading-study') return t('viewStudyPack');
  if (type === 'grammar') return t('viewGrammar');
  if (type === 'writing') return t('viewCorrection');
  if (type === 'speaking') return t('viewAnswer');
  if (type === 'listening-study') return t('viewStudyPack');
  if (type === 'vocabulary') return t('viewVocabulary');
  return t('viewTask');
}

function normalizeTarget(target) {
  const source = target || {};
  return {
    targetFamilyId: String(source.targetFamilyId || source.familyId || '').trim(),
    targetChildId: String(source.targetChildId || source.childId || '').trim(),
    childLoginCode: String(source.childLoginCode || '').trim()
  };
}

function sameTarget(left, right) {
  const a = normalizeTarget(left);
  const b = normalizeTarget(right);
  if (a.targetChildId && b.targetChildId) {
    return a.targetChildId === b.targetChildId;
  }
  if (a.childLoginCode && b.childLoginCode) {
    return a.childLoginCode === b.childLoginCode;
  }
  return !a.targetChildId && !b.targetChildId && !a.childLoginCode && !b.childLoginCode;
}

function readScopedCachedItems(date, target) {
  try {
    const cached = wx.getStorageSync(TODAY_COMPLETED_CACHE_KEY) || null;
    if (Array.isArray(cached)) {
      return target && (target.targetChildId || target.childLoginCode) ? [] : cached;
    }
    if (!cached || cached.date !== date || !sameTarget(cached.target, target)) {
      return [];
    }
    return Array.isArray(cached.items) ? cached.items : [];
  } catch (error) {
    return [];
  }
}

function isListeningItem(item) {
  return item
    && (item.type === 'listening' || item.type === 'speaking')
    && !!item.category
    && !!item.taskId;
}

function filterItemsByScope(items, scope) {
  const list = items || [];
  if (scope !== 'listening') {
    return list;
  }
  return list.filter(isListeningItem);
}

function buildDebugLines(scope, date, target, source, rawItems, filteredItems) {
  if (scope !== 'listening') return [];
  const removed = (rawItems || []).filter((item) => !isListeningItem(item));
  if (!removed.length) return [];
  const types = Array.from(new Set(removed.map((item) => item.type || 'unknown'))).join(',');
  const titles = removed.map((item) => item.title || item.targetId || '').filter(Boolean).slice(0, 3).join(' / ');
  const chain = source === 'cache'
    ? 'pages/home/completed.onShow -> wx.getStorageSync(todayCompletedItemsV1)'
    : 'pages/home/completed.onShow -> store.getStudyCompletions -> cloud.getStudyCompletions.items';
  return [
    `DEBUG: ${chain} 发现非听力项；source=${source}`,
    `DEBUG: targetChildId=${target.targetChildId || ''}; childLoginCode=${target.childLoginCode || ''}; date=${date}; scope=${scope}`,
    `DEBUG: rawCount=${(rawItems || []).length}; filteredCount=${(filteredItems || []).length}; removedTypes=${types}; removedTitles=${titles}`,
    'DEBUG: 修复点 pages/home/index buildCompletedUrl 带 scope=listening；pages/home/completed/index scope=listening 不调用 getStudyCompletions'
  ];
}

function buildMissingListeningCacheDebugLines(date, target) {
  return [
    'DEBUG: pages/home/completed.onShow -> wx.getStorageSync(todayCompletedItemsV1) 未找到听力缓存项',
    `DEBUG: targetChildId=${target.targetChildId || ''}; childLoginCode=${target.childLoginCode || ''}; date=${date}; scope=listening`,
    'DEBUG: 修复点 pages/home/index writeTodayCompletedCache 必须在 openCompleted 前写入当前听力任务'
  ];
}

function writeLessonTaskSnapshot(item) {
  const category = String((item && item.category) || '').trim();
  const taskId = String((item && item.taskId) || '').trim();
  const sourceTask = (item && (item.taskSnapshot || item.task)) || {};
  if (!category || !taskId) return false;
  snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
    category,
    taskId,
    task: Object.assign({}, sourceTask, {
      category: sourceTask.category || category,
      taskId: sourceTask.taskId || taskId,
      title: sourceTask.title || item.title || '',
      displayTitle: sourceTask.displayTitle || item.title || '',
      categoryLabel: sourceTask.categoryLabel || item.meta || '',
      audioUrl: sourceTask.audioUrl || '',
      audioCloudPath: sourceTask.audioCloudPath || '',
      audioFileId: sourceTask.audioFileId || '',
      audioSource: sourceTask.audioSource || '',
      playCount: Number(sourceTask.playCount || 1),
      repeatTarget: Number(sourceTask.repeatTarget || 1),
      completedToday: true
    })
  }, { source: 'home-completed' });
  return true;
}

Page({
  data: page.createCloudPageData({
    items: [],
    date: '',
    target: {},
    scope: '',
    debugLines: [],
    texts: i18n.getPageTexts('completed')
  }),
  onLoad(options = {}) {
    this.setData({
      date: String(options.date || todayString()),
      target: normalizeTarget(options),
      scope: String(options.scope || '')
    });
  },
  async onShow() {
    this.completedPerf = page.startPagePerf('home-completed');
    page.syncTheme(this);
    const texts = i18n.getPageTexts('completed');
    wx.setNavigationBarTitle({ title: texts.navTitle });
    this.setData({ texts, items: normalizeItems(this.data.items) });
    const date = this.data.date || todayString();
    const target = normalizeTarget(this.data.target || store.getSelectedStudentTarget());
    const scope = String(this.data.scope || '');
    const cachedItems = readScopedCachedItems(date, target);
    const cachedDisplayItems = filterItemsByScope(cachedItems, scope);
    let debugLines = buildDebugLines(scope, date, target, 'cache', cachedItems, cachedDisplayItems);
    if (scope === 'listening') {
      if (!cachedDisplayItems.length) {
        debugLines = debugLines.concat(buildMissingListeningCacheDebugLines(date, target));
      }
      this.setData({
        items: normalizeItems(cachedDisplayItems),
        debugLines
      });
      this.completedPerf.ready('pageReady', {
        source: 'cache',
        cacheHit: true,
        items: cachedDisplayItems.length
      });
      return;
    }
    if (cachedDisplayItems.length) {
      this.setData({
        items: normalizeItems(cachedDisplayItems),
        debugLines
      });
      this.completedPerf.ready('pageReady', {
        source: 'cache',
        cacheHit: true,
        items: cachedDisplayItems.length
      });
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      this.completedPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        items: 0
      });
    }
    try {
      const data = await store.getStudyCompletions(Object.assign({ date }, target), (fresh) => {
        const freshItems = filterItemsByScope((fresh && fresh.items) || [], scope);
        this.setData({ items: normalizeItems(freshItems.length ? freshItems : cachedDisplayItems) });
        if (this.completedPerf) {
          this.completedPerf.mark('cloudRefresh', { items: freshItems.length });
        }
      });
      const cloudItems = data && Array.isArray(data.items) ? data.items : [];
      const cloudDisplayItems = filterItemsByScope(cloudItems, scope);
      debugLines = debugLines.concat(buildDebugLines(scope, date, target, 'cloud', cloudItems, cloudDisplayItems));
      const items = cloudDisplayItems.length
        ? cloudDisplayItems
        : cachedDisplayItems;
      this.setData({
        items: normalizeItems(items),
        debugLines
      });
      this.completedPerf.mark('cloudRefresh', {
        source: data && data.__cacheHit ? 'cache' : 'cloud',
        cacheHit: !!(data && data.__cacheHit),
        items: items.length
      });
      if (data && !data.__cacheHit) {
        this.completedPerf.mark('cloudRefresh', { items: cloudDisplayItems.length });
      }
    } catch (error) {
      if (!cachedDisplayItems.length) {
        this.setData({
          items: [],
          debugLines
        });
      }
      this.completedPerf.mark('cloudRefresh', {
        source: 'error',
        cacheHit: false,
        items: cachedDisplayItems.length
      });
    }
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
      writeLessonTaskSnapshot(item);
      const routeStartedAt = Date.now();
      wx.navigateTo({
        url: `/pages/lesson/index?category=${item.category}&taskId=${item.taskId}&routeStartedAt=${routeStartedAt}`
      });
      return;
    }
    wx.showToast({ title: t('noDetails'), icon: 'none' });
  },
  async playAttempt(event) {
    const itemIndex = Number(event.currentTarget.dataset.itemIndex || 0);
    const attemptIndex = Number(event.currentTarget.dataset.attemptIndex || 0);
    const audioType = String(event.currentTarget.dataset.audioType || 'answer');
    const item = this.data.items[itemIndex] || {};
    const attempt = (item.attempts || [])[attemptIndex] || null;
    if (!attempt) return;
    const fileId = audioType === 'feedback'
      ? (attempt.feedbackAudioFileId || buildCloudFileId(attempt.feedbackAudioCloudPath))
      : (attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath));
    if (!fileId) {
      wx.showToast({ title: audioType === 'feedback' ? t('noFeedbackAudio') : t('noRecording'), icon: 'none' });
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
      wx.showToast({ title: t('playFailed'), icon: 'none' });
    }
  }
});
