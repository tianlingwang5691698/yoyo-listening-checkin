const page = require('../../../utils/page');
const store = require('../../../utils/store');
const appConfig = require('../../../data/app-config');
const snapshotStore = require('../../../utils/snapshot');
const TODAY_COMPLETED_CACHE_KEY = 'todayCompletedItemsV1';
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const NEW_CONCEPT_AUDIO_ROOTS = {
  newconcept1: 'A1/NewConcept1-US',
  newconcept2: 'A2/NewConcept2-US',
  newconcept3: 'B1/NewConcept3-US',
  newconcept4: 'B2/NewConcept4-US'
};

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#39;|&apos;|&#x27;/gi, '\'')
    .replace(/&#34;|&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}

function getTaskTextTitle(task, item) {
  return decodeHtmlEntities(String(
    (task && (task.audioTitle || task.title || task.displayTitle || task.audioCompactTitle))
    || (item && item.title)
    || ''
  )).trim();
}

function inferPeppaAudioCloudPath(task, item) {
  const title = getTaskTextTitle(task, item);
  const taskId = String((task && task.taskId) || (item && item.taskId) || '').trim();
  const titleCode = title.match(/^S(\d)(\d{2})\s+(.+)$/i);
  if (titleCode) {
    return `A1/Peppa/第${Number(titleCode[1])}季/${title}.mp3`;
  }
  const s1Match = taskId.match(/^peppa-(\d+)$/);
  const seasonMatch = taskId.match(/^peppa-s(\d+)-(\d+)$/);
  const season = s1Match ? 1 : (seasonMatch ? Number(seasonMatch[1]) : 0);
  const episode = s1Match ? Number(s1Match[1]) : (seasonMatch ? Number(seasonMatch[2]) : 0);
  if (!season || !episode || !title) return '';
  return `A1/Peppa/第${season}季/S${season}${String(episode).padStart(2, '0')} ${title}.mp3`;
}

function inferNewConceptAudioCloudPath(task, item) {
  const category = String((task && task.category) || (item && item.category) || '').trim();
  const root = NEW_CONCEPT_AUDIO_ROOTS[category] || '';
  const title = getTaskTextTitle(task, item);
  const match = title.match(/^(\d{3}&\d{3})\s*(?:[-–—－]\s*)?(.+)$/);
  if (!root || !match) return '';
  return `${root}/${match[1]}－${String(match[2] || '').trim().replace(/'/g, '&#39;')}.mp3`;
}

function inferAudioCloudPath(task, item) {
  const category = String((task && task.category) || (item && item.category) || '').trim();
  if (category === 'peppa') return inferPeppaAudioCloudPath(task, item);
  if (NEW_CONCEPT_AUDIO_ROOTS[category]) return inferNewConceptAudioCloudPath(task, item);
  return '';
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
      displayTitle: `第 ${attemptIndex + 1} 次回答`,
      scoreText: attempt.status === 'score-pending' ? '待评分' : `${Number(attempt.score || 0)} 分`
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
  if (type === 'reading') return '阅读';
  if (type === 'reading-study') return '阅读学习';
  if (type === 'grammar') return '语法';
  if (type === 'writing') return '写作';
  if (type === 'speaking') return '回答';
  if (type === 'listening-study') return '听力学习包';
  if (type === 'vocabulary') return '词汇';
  return '听力';
}

function getActionText(type) {
  if (type === 'reading') return '查看解析';
  if (type === 'reading-study') return '查看学习包';
  if (type === 'grammar') return '查看语法';
  if (type === 'writing') return '查看批改';
  if (type === 'speaking') return '查看回答';
  if (type === 'listening-study') return '查看学习包';
  if (type === 'vocabulary') return '查看词汇';
  return '查看任务';
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
  const inferredAudioCloudPath = sourceTask.audioCloudPath || inferAudioCloudPath(sourceTask, item);
  const inferredAudioFileId = sourceTask.audioFileId || buildCloudFileId(inferredAudioCloudPath);
  snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
    category,
    taskId,
    task: Object.assign({}, sourceTask, {
      category: sourceTask.category || category,
      taskId: sourceTask.taskId || taskId,
      title: sourceTask.title || item.title || '',
      displayTitle: sourceTask.displayTitle || item.title || '',
      categoryLabel: sourceTask.categoryLabel || item.meta || '',
      audioCloudPath: inferredAudioCloudPath || sourceTask.audioCloudPath || '',
      audioFileId: inferredAudioFileId || sourceTask.audioFileId || '',
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
    debugLines: []
  }),
  onLoad(options = {}) {
    this.setData({
      date: String(options.date || todayString()),
      target: normalizeTarget(options),
      scope: String(options.scope || '')
    });
  },
  async onShow() {
    page.syncTheme(this);
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
      return;
    }
    if (cachedDisplayItems.length) {
      this.setData({
        items: normalizeItems(cachedDisplayItems),
        debugLines
      });
    }
    try {
      const data = await store.getStudyCompletions(Object.assign({ date }, target));
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
    } catch (error) {
      if (!cachedDisplayItems.length) {
        this.setData({
          items: [],
          debugLines
        });
      }
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
      ? (attempt.feedbackAudioFileId || buildCloudFileId(attempt.feedbackAudioCloudPath))
      : (attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath));
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
