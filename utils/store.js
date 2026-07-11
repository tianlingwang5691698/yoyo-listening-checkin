const cloud = require('../domain/cloud/index');
const contracts = require('./contracts');
const monitor = require('./monitor');
const inflightCloudRequests = {};
const inflightTempFileUrlRequests = {};
const memoryCloudCache = {};
const tempFileUrlCache = {};
const wordLookupCache = {};
const CACHE_INDEX_KEY = 'yoyoCloudReadCacheKeysV3';
const SELECTED_STUDENT_KEY = 'yoyoSelectedStudentTargetV1';
const LAST_PARENT_STUDENT_KEY = 'yoyoLastParentStudentTargetV1';
const DEVICE_ID_KEY = 'yoyoDeviceIdV1';
const DEVICE_STUDY_ROLE_KEY = 'yoyoDeviceStudyRoleV1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECORD_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const LISTENING_PLAN_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const TEMP_FILE_URL_MAX_AGE_MS = 20 * 60 * 1000;
const WORD_LOOKUP_MAX_AGE_MS = 30 * 60 * 1000;
const FLASHCARD_SOURCE_CACHE_VERSION_KEY = 'flashcardSourceCacheVersion';
const PENDING_FLASHCARDS_KEY = 'pendingStudyFlashcardsV1';
let cloudReadCacheVersion = 0;
const MUTATION_ACTIONS = {
  updateFlashcardReview: true,
  saveFlashcardSettings: true,
  addDictionaryBook: true,
  saveFlashcardAudio: true,
  markTaskListened: true,
  saveListeningPlanMaterial: true,
  removeListeningPlanMaterial: true,
  submitSpeakingAttempt: true,
  evaluateSpeakingPronunciation: true,
  rescoreSpeakingAttempt: true,
  completeTodayCheckin: true,
  submitReadingAttempt: true,
  submitWritingAttempt: true,
  gradeWritingAttempt: true,
  addDictionaryWord: true,
  recordGrammarWrong: true,
  addPracticeWrongQuestion: true,
  recordGrammarProgress: true,
  recordStudyCompletion: true,
  refreshInviteCode: true,
  joinFamily: true,
  joinFamilyByChildCode: true,
  updateBindingProfile: true,
  leaveFamily: true,
  setStudyRole: true,
  undoLastListened: true,
  updateChildProfile: true,
  updateSubscription: true
};
const READ_CACHE_CONFIG = {
  getDashboard: { persist: true },
  getMaterialIndex: { persist: true },
  getMaterialItem: { persist: true },
  getLevelOverview: { persist: true },
  getListeningPlanOverview: { persist: true, maxAgeMs: LISTENING_PLAN_CACHE_MAX_AGE_MS },
  getListeningMaterialDetail: { persist: true },
  getTaskDetail: { persist: true },
  getTaskTranscript: { persist: false },
  getSpeakingAttempts: { persist: false },
  getProfileData: { persist: true },
  getHeatmap: { persist: true },
  getMonthHeatmap: { persist: true, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getDailyReportByDate: { persist: true, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getParentDashboard: { persist: true, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getStudyCompletions: { persist: true, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getStudyCompletionDetail: { persist: false, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getFamilyPage: { persist: true },
  getReadingHome: { persist: true },
  getReadingPassage: { persist: true },
  getReadingStudyPack: { persist: true },
  getListeningStudyPack: { persist: true },
  getFlashcardDue: { persist: true },
  getFlashcardReview: { persist: true },
  getDictionaryBook: { persist: false },
  getGrammarHome: { persist: true },
  getGrammarTopic: { persist: true },
  getGrammarWrongBook: { persist: true },
  getPracticeWrongQuestions: { persist: false, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getGrammarProgress: { persist: true },
  getWritingAttempts: { persist: true },
  getWritingAttemptDetail: { persist: false, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getAdminStatus: { persist: false, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  getAdminFamilyList: { persist: true, maxAgeMs: RECORD_CACHE_MAX_AGE_MS },
  explainGrammarQuestion: { persist: false }
};

function normalizeStudyRoleValue(role) {
  return String(role || '').trim() === 'student' ? 'student' : 'parent';
}

function makeDeviceId() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceId() {
  try {
    let deviceId = String(wx.getStorageSync(DEVICE_ID_KEY) || '').trim();
    if (!deviceId) {
      deviceId = makeDeviceId();
      wx.setStorageSync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    return '';
  }
}

function getDeviceStudyRole() {
  try {
    return normalizeStudyRoleValue(wx.getStorageSync(DEVICE_STUDY_ROLE_KEY) || wx.getStorageSync('lastStudyRole') || 'parent');
  } catch (error) {
    return 'parent';
  }
}

function setDeviceStudyRole(studyRole) {
  const nextRole = normalizeStudyRoleValue(studyRole);
  try {
    wx.setStorageSync(DEVICE_STUDY_ROLE_KEY, nextRole);
    wx.setStorageSync('lastStudyRole', nextRole);
  } catch (error) {}
  return nextRole;
}

function withDeviceContext(action, payload) {
  const next = Object.assign({}, payload || {});
  const deviceId = String(next.deviceId || getDeviceId()).trim();
  const deviceStudyRole = normalizeStudyRoleValue(next.deviceStudyRole || next.studyRole || getDeviceStudyRole());
  if (deviceId) {
    next.deviceId = deviceId;
  }
  next.deviceStudyRole = deviceStudyRole;
  return next;
}

function normalizeStudentTarget(target) {
  const next = target || {};
  return {
    targetFamilyId: String(next.targetFamilyId || next.familyId || '').trim(),
    targetChildId: String(next.targetChildId || next.childId || '').trim()
  };
}

function getSelectedStudentTarget() {
  return normalizeStudentTarget(wx.getStorageSync(SELECTED_STUDENT_KEY) || {});
}

function setSelectedStudentTarget(target) {
  const next = normalizeStudentTarget(target);
  if (next.targetFamilyId || next.targetChildId) {
    wx.setStorageSync(SELECTED_STUDENT_KEY, next);
  }
  return next;
}

function setLastParentStudentTarget(target) {
  const next = normalizeStudentTarget(target);
  if (next.targetFamilyId || next.targetChildId) {
    wx.setStorageSync(LAST_PARENT_STUDENT_KEY, next);
  }
  return next;
}

function getLastParentStudentTarget() {
  return normalizeStudentTarget(wx.getStorageSync(LAST_PARENT_STUDENT_KEY) || {});
}

function clearSelectedStudentTarget() {
  wx.removeStorageSync(SELECTED_STUDENT_KEY);
}

function withSelectedStudent(payload) {
  const next = Object.assign({}, payload || {});
  if (next.targetFamilyId || next.targetChildId) {
    return next;
  }
  return Object.assign(next, getSelectedStudentTarget());
}

function syncSelectedStudentFromData(data) {
  const current = (data && data.studentLinks || []).find((item) => item && item.isCurrent);
  const child = current || (data && data.child) || null;
  if (child && (child.familyId || child.childId)) {
    setSelectedStudentTarget(child);
  }
}

/**
 * @typedef {import('./contracts').DashboardData} DashboardData
 * @typedef {import('./contracts').TaskDetailData} TaskDetailData
 * @typedef {import('./contracts').FamilyPageData} FamilyPageData
 * @typedef {import('./contracts').ReportData} ReportData
 */

function formatCloudReason(error) {
  if (!error) {
    return 'unknown';
  }
  if (error.errMsg) {
    return error.errMsg;
  }
  if (error.message) {
    return error.message;
  }
  return String(error);
}

function buildResourceDebugLines(resourceDebug) {
  if (!resourceDebug) {
    return [];
  }
  const lines = [];
  if (resourceDebug.storageScanMode) {
    lines.push(`资源扫描：${resourceDebug.storageScanMode}`);
  }
  if (resourceDebug.unlock1Root || resourceDebug.unlock1AudioCount) {
    lines.push(`Unlock1：${resourceDebug.unlock1AudioCount || 0} 个音频，目录 ${resourceDebug.unlock1Root || '未识别'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolReady === 'boolean') {
    if (resourceDebug.unlock1ListMode === 'training-pool') {
      lines.push(`Unlock1 训练池已启用，eligible ${resourceDebug.unlock1TrainingPoolEligibleCount || 0} 条`);
    } else {
      lines.push(`Unlock1 训练池未就绪，当前回退原始目录`);
    }
  }
  if (typeof resourceDebug.unlock1TrainingPoolCollectionReady === 'boolean') {
    lines.push(`Unlock1 训练池集合：${resourceDebug.unlock1TrainingPoolCollectionReady ? 'ready' : 'not-ready'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolEligibleReady === 'boolean') {
    lines.push(`Unlock1 eligible 就绪：${resourceDebug.unlock1TrainingPoolEligibleReady ? 'yes' : 'no'}`);
  }
  if (typeof resourceDebug.unlock1TrainingPoolTotalCount === 'number') {
    lines.push(`Unlock1 训练池总记录：${resourceDebug.unlock1TrainingPoolTotalCount} 条`);
  }
  if (typeof resourceDebug.unlock1MinDurationRule === 'number') {
    lines.push(`Unlock1 回退过滤阈值：${resourceDebug.unlock1MinDurationRule} 秒`);
  }
  if (typeof resourceDebug.unlock1RawAudioCount === 'number') {
    lines.push(`Unlock1 原始扫描数量：${resourceDebug.unlock1RawAudioCount} 条`);
  }
  if (typeof resourceDebug.unlock1FilteredAudioCount === 'number') {
    lines.push(`Unlock1 进入训练列表：${resourceDebug.unlock1FilteredAudioCount} 条`);
  }
  if (typeof resourceDebug.unlock1ExcludedShortCount === 'number') {
    lines.push(`Unlock1 被排除短音频：${resourceDebug.unlock1ExcludedShortCount} 条`);
  }
  if (resourceDebug.unlock1TrainingPoolError) {
    lines.push(`Unlock1 训练池告警：${resourceDebug.unlock1TrainingPoolError}`);
  }
  if (resourceDebug.unlock1BootstrapResult) {
    lines.push(`Unlock1 自动补建：${resourceDebug.unlock1BootstrapResult}`);
  }
  if (resourceDebug.unlock1BootstrapMode) {
    lines.push(`Unlock1 自动补建模式：${resourceDebug.unlock1BootstrapMode}`);
  }
  if (resourceDebug.unlock1BootstrapError) {
    lines.push(`Unlock1 自动补建错误：${resourceDebug.unlock1BootstrapError}`);
  }
  if (resourceDebug.unlock1BootstrapFinishedAt) {
    lines.push(`Unlock1 最近补建：${new Date(resourceDebug.unlock1BootstrapFinishedAt).toLocaleString('zh-CN', { hour12: false })}`);
  }
  if (resourceDebug.unlock1SamplePath) {
    lines.push(`Unlock1 样例：${resourceDebug.unlock1SamplePath}`);
  }
  if (resourceDebug.songRoot || resourceDebug.songAudioCount) {
    lines.push(`Song：${resourceDebug.songAudioCount || 0} 个音频，目录 ${resourceDebug.songRoot || '未识别'}`);
  }
  if (resourceDebug.songSamplePath) {
    lines.push(`Song 样例：${resourceDebug.songSamplePath}`);
  }
  if (resourceDebug.storageScanError) {
    lines.push(`扫描告警：${resourceDebug.storageScanError}`);
  }
  if (resourceDebug.rawStorageShape) {
    lines.push(`SDK 字段：${resourceDebug.rawStorageShape}`);
  }
  return lines;
}

function buildSyncMeta(mode, error, resourceDebug) {
  const envId = cloud.getCloudEnvId();
  const reason = mode === 'cloud-error' ? formatCloudReason(error) : '';
  const publicReason = mode === 'cloud-error'
    ? '云端服务暂时不可用，请稍后再试。'
    : '';
  const releaseStage = cloud.getReleaseStage();
  const resourceLines = buildResourceDebugLines(resourceDebug);
  return {
    syncMode: mode,
    releaseStage,
    isReviewBuild: cloud.isReviewBuild(),
    showCloudDebug: cloud.shouldShowCloudDebug(),
    syncDebug: {
      mode,
      envId,
      show: cloud.shouldShowCloudDebug(),
      reason,
      publicReason,
      resourceDebug: resourceDebug || null,
      resourceLines,
      text: mode === 'cloud'
        ? `云环境已连接：${envId}`
        : `云端调用失败，目标云环境：${envId}${reason ? `，失败原因：${reason}` : ''}`
    }
  };
}

function buildCloudErrorPayload(action, error, defaults) {
  const resourceDebug = null;
  return Object.assign({}, defaults || {}, buildSyncMeta('cloud-error', error, resourceDebug), {
    cloudError: {
      action,
      message: formatCloudReason(error)
    }
  });
}

function hashText(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function getReadCacheKey(action, payload) {
  return `yoyoCloudReadCacheV3:${action}:${hashText(JSON.stringify(payload || {}))}`;
}

function getCachedCloudResult(action, payload) {
  const config = READ_CACHE_CONFIG[action];
  if (!config) {
    return null;
  }
  const key = getReadCacheKey(action, payload);
  let entry = memoryCloudCache[key] || null;
  if (!entry && config.persist) {
    try {
      entry = wx.getStorageSync(key) || null;
      if (entry) {
        memoryCloudCache[key] = entry;
      }
    } catch (error) {
      entry = null;
    }
  }
  const maxAgeMs = Number(config.maxAgeMs || CACHE_MAX_AGE_MS);
  if (!entry || !entry.data || Date.now() - Number(entry.savedAt || 0) > maxAgeMs) {
    return null;
  }
  return entry.data;
}

function getCachedReadResult(action, payload) {
  return getCachedCloudResult(action, withDeviceContext(action, payload || {}));
}

function cacheCloudResult(action, payload, data) {
  const config = READ_CACHE_CONFIG[action];
  if (!config || !data || data.syncMode === 'cloud-error') {
    return;
  }
  const key = getReadCacheKey(action, payload);
  const entry = { savedAt: Date.now(), data };
  memoryCloudCache[key] = entry;
  if (!config.persist) {
    return;
  }
  try {
    wx.setStorageSync(key, entry);
    const keys = wx.getStorageSync(CACHE_INDEX_KEY) || [];
    if (!keys.includes(key)) {
      wx.setStorageSync(CACHE_INDEX_KEY, keys.concat(key));
    }
  } catch (error) {
    monitor.logError('store', 'cache-write', error, { action });
  }
}

function clearCloudReadCache() {
  cloudReadCacheVersion += 1;
  Object.keys(memoryCloudCache).forEach((key) => delete memoryCloudCache[key]);
  try {
    const keys = wx.getStorageSync(CACHE_INDEX_KEY) || [];
    keys.forEach((key) => wx.removeStorageSync(key));
    wx.removeStorageSync(CACHE_INDEX_KEY);
  } catch (error) {
    monitor.logError('store', 'cache-clear', error, {});
  }
}

function bumpFlashcardSourceCacheVersion() {
  try {
    wx.setStorageSync(FLASHCARD_SOURCE_CACHE_VERSION_KEY, Date.now());
  } catch (error) {}
}

async function callCloudFresh(action, payload, defaults) {
  const inflightKey = READ_CACHE_CONFIG[action]
    ? `${action}:${JSON.stringify(payload || {})}`
    : '';
  if (inflightKey && inflightCloudRequests[inflightKey]) {
    return inflightCloudRequests[inflightKey];
  }
  const request = (async () => {
    const startedAt = Date.now();
    try {
      const result = await cloud.callYoyo(action, payload);
      return Object.assign(buildSyncMeta('cloud', null, result.resourceDebug), result, {
        __cacheHit: false,
        __elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      monitor.logError('store', action, error, { reason: formatCloudReason(error) });
      return Object.assign(buildCloudErrorPayload(action, error, defaults), {
        __elapsedMs: Date.now() - startedAt
      });
    } finally {
      if (inflightKey) {
        delete inflightCloudRequests[inflightKey];
      }
    }
  })();
  if (inflightKey) {
    inflightCloudRequests[inflightKey] = request;
  }
  return request;
}

async function callCloud(action, payload, defaults, options = {}) {
  const cloudPayload = withDeviceContext(action, payload);
  if (MUTATION_ACTIONS[action]) {
    clearCloudReadCache();
  }
  const cacheVersion = cloudReadCacheVersion;
  const cached = options.useCache === false ? null : getCachedCloudResult(action, cloudPayload);
  if (cached) {
    callCloudFresh(action, cloudPayload, defaults).then((fresh) => {
      if (fresh && fresh.syncMode !== 'cloud-error') {
        if (cacheVersion === cloudReadCacheVersion) {
          cacheCloudResult(action, cloudPayload, fresh);
        }
        if (typeof options.onRefresh === 'function') {
          options.onRefresh(fresh);
        }
      }
    });
    return Object.assign({}, cached, { __cacheHit: true });
  }
  const result = await callCloudFresh(action, cloudPayload, defaults);
  if (READ_CACHE_CONFIG[action]) {
    if (cacheVersion === cloudReadCacheVersion) {
      cacheCloudResult(action, cloudPayload, result);
    }
  } else if (result && result.syncMode !== 'cloud-error') {
    clearCloudReadCache();
  }
  return result;
}

async function ensureState() {
  cloud.initCloud();
  return callCloud('bootstrap', {}, {
    family: null,
    child: contracts.createChildDefaults()
  });
}

/**
 * @param {Object=} options
 * @returns {Promise<DashboardData>}
 */
async function getDashboard(options, onRefresh) {
  const payload = Object.assign({}, options || {});
  const forceRefresh = payload.forceRefresh === true;
  delete payload.forceRefresh;
  return callCloud('getDashboard', payload.view === 'home' || payload.view === 'record' ? withSelectedStudent(payload) : payload, contracts.createDashboardDefaults(), {
    onRefresh,
    useCache: !forceRefresh
  });
}

async function getMaterialIndex(options, onRefresh) {
  let payload = {};
  let refreshHandler = onRefresh;
  if (typeof options === 'function') {
    refreshHandler = options;
  } else {
    payload = Object.assign({}, options || {});
  }
  return callCloud('getMaterialIndex', payload, {
    writingEm1: [],
    writingEm2: [],
    listeningEm1: [],
    listeningEm2: []
  }, { onRefresh: refreshHandler });
}

async function getMaterialItem(options, onRefresh) {
  return callCloud('getMaterialItem', Object.assign({}, options || {}), {
    item: null
  }, { onRefresh });
}

async function getLevelOverview(options, onRefresh) {
  return callCloud('getLevelOverview', withSelectedStudent(Object.assign({}, options || {})), {
    user: {},
    currentUser: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    child: null,
    level: null,
    stats: contracts.createStatsDefaults(),
    planDayIndex: 1,
    planPhaseLabel: '第1轮',
    categories: [],
    a2Categories: [],
    b1Categories: [],
    b2Categories: []
  }, { onRefresh });
}

async function getListeningPlanOverview(options, onRefresh) {
  return callCloud('getListeningPlanOverview', withSelectedStudent(Object.assign({}, options || {})), {
    child: null,
    stats: contracts.createStatsDefaults(),
    selectedLevel: 'A1',
    levelTabs: [],
    materials: [],
    activePlan: null,
    planSource: 'fixed-yoyo',
    isYoyoFixedPlan: false,
    fixedPlan: null
  }, { onRefresh });
}

async function getListeningMaterialDetail(options, onRefresh) {
  return callCloud('getListeningMaterialDetail', withSelectedStudent(Object.assign({}, options || {})), {
    child: null,
    category: '',
    levelId: 'A1',
    categoryLabel: '',
    totalCount: 0,
    tasks: [],
    activePlan: null,
    selectedMaterial: null
  }, { onRefresh });
}

async function saveListeningPlanMaterial(options) {
  return callCloud('saveListeningPlanMaterial', withSelectedStudent(Object.assign({}, options || {})), {
    saved: false,
    activePlan: null
  }, { useCache: false });
}

async function removeListeningPlanMaterial(options) {
  return callCloud('removeListeningPlanMaterial', withSelectedStudent(Object.assign({}, options || {})), {
    removed: false,
    activePlan: null
  }, { useCache: false });
}

/**
 * @param {string} category
 * @param {string} taskId
 * @param {Object=} options
 * @returns {Promise<TaskDetailData>}
 */
async function getTaskDetail(category, taskId, options, onRefresh) {
  return callCloud('getTaskDetail', withSelectedStudent(Object.assign({ category, taskId }, options || {})), contracts.createTaskDetailDefaults(), { onRefresh });
}

async function getTaskTranscript(category, taskId, options, onRefresh) {
  return callCloud('getTaskTranscript', withSelectedStudent(Object.assign({ category, taskId }, options || {})), {
    task: null,
    scriptSource: null,
    transcriptTrack: null,
    transcriptLines: [],
    transcriptPendingLoad: false
  }, { onRefresh });
}

async function getListeningStudyPack(item, options, onRefresh) {
  const opts = typeof options === 'function' ? {} : (options || {});
  const refresh = typeof options === 'function' ? options : onRefresh;
  const payload = {
    listeningId: item && (item._id || item.id),
    item,
    cacheOnly: !!opts.cacheOnly
  };
  return callCloud('getListeningStudyPack', withSelectedStudent(payload), {
    listeningId: payload.listeningId || '',
    studyPack: {
      vocabularyCards: [],
      phraseCards: [],
      sentencePatternCards: [],
      source: ''
    }
  }, { onRefresh: refresh, useCache: opts.useCache !== false });
}

async function getFlashcardReview(options, onRefresh) {
  const payload = typeof options === 'function' ? {} : (options || {});
  const refresh = typeof options === 'function' ? options : onRefresh;
  const result = await callCloud('getFlashcardReview', withSelectedStudent(payload), {
    today: '',
    settings: { newLimit: 10, reviewLimit: 20 },
    library: [],
    cards: [],
    progress: { total: 0, mastered: 0, reviewing: 0, fresh: 0 },
    logs: [],
    dueCount: 0,
    newDueCount: 0,
    reviewDueCount: 0
  }, { onRefresh: refresh });
  if (result && result.syncMode === 'cloud') {
    try {
      wx.removeStorageSync(PENDING_FLASHCARDS_KEY);
    } catch (error) {}
  }
  return result;
}

async function getFlashcardDue(onRefresh) {
  return callCloud('getFlashcardDue', withSelectedStudent({}), {
    today: '',
    settings: { newLimit: 10, reviewLimit: 20 },
    library: [],
    cards: [],
    progress: { total: 0, mastered: 0, reviewing: 0, fresh: 0 },
    logs: [],
    dueCount: 0,
    newDueCount: 0,
    reviewDueCount: 0,
    partial: true
  }, { onRefresh });
}

async function updateFlashcardReview(flashcardKey, result, card) {
  return callCloud('updateFlashcardReview', withSelectedStudent({ flashcardKey, result, card: card || null }), { saved: false }, { useCache: false });
}

async function saveFlashcardSettings(settings) {
  return callCloud('saveFlashcardSettings', withSelectedStudent(settings || {}), {
    settings: Object.assign({ newLimit: 10, reviewLimit: 20 }, settings || {})
  }, { useCache: false });
}

async function addDictionaryBook(level, options) {
  return callCloud('addDictionaryBook', withSelectedStudent(Object.assign({ level }, options || {})), { saved: false }, { useCache: false });
}

async function getDictionaryBook(level) {
  return callCloud('getDictionaryBook', { level }, {
    level,
    title: '',
    cloudPath: '',
    total: 0,
    rows: []
  });
}

async function saveFlashcardAudio(options) {
  return callCloud('saveFlashcardAudio', withSelectedStudent(options || {}), { saved: false }, { useCache: false });
}

async function getTempFileURL(fileId) {
  const key = String(fileId || '');
  const cached = key ? tempFileUrlCache[key] : null;
  if (cached && cached.url && Date.now() - cached.savedAt < TEMP_FILE_URL_MAX_AGE_MS) {
    return cached.url;
  }
  if (key && inflightTempFileUrlRequests[key]) {
    return inflightTempFileUrlRequests[key];
  }
  const request = (async () => {
    try {
      const url = await cloud.getTempFileURL(fileId);
      if (key && url) {
        tempFileUrlCache[key] = {
          savedAt: Date.now(),
          url
        };
      }
      return url;
    } catch (error) {
      monitor.logError('store', 'getTempFileURL', error, { fileId: fileId ? 'set' : 'empty' });
      throw error;
    } finally {
      if (key) {
        delete inflightTempFileUrlRequests[key];
      }
    }
  })();
  if (key) {
    inflightTempFileUrlRequests[key] = request;
  }
  return request;
}

async function markTaskListened(options) {
  return callCloud('markTaskListened', withSelectedStudent(options || {}), contracts.createTaskDetailDefaults());
}

async function createSpeakingUploadUrl(options) {
  return callCloud('createSpeakingUploadUrl', withSelectedStudent(options || {}), {
    cloudPath: '',
    fileId: ''
  });
}

async function uploadSpeakingAudio(cloudPath, filePath) {
  return cloud.uploadFile(cloudPath, filePath);
}

async function submitSpeakingAttempt(options) {
  return callCloud('submitSpeakingAttempt', withSelectedStudent(options || {}), {
    attempt: null,
    attempts: [],
    summary: {}
  });
}

async function evaluateSpeakingPronunciation(options) {
  return callCloud('evaluateSpeakingPronunciation', withSelectedStudent(options || {}), {
    pronunciation: null
  });
}

async function rescoreSpeakingAttempt(options) {
  return callCloud('rescoreSpeakingAttempt', withSelectedStudent(options || {}), {
    attempt: null,
    attempts: [],
    summary: {}
  });
}

async function getSpeakingAttempts(options, onRefresh) {
  return callCloud('getSpeakingAttempts', withSelectedStudent(options), {
    attempts: [],
    summary: {}
  }, { onRefresh });
}

async function completeTodayCheckin() {
  return callCloud('completeTodayCheckin', withSelectedStudent({}), {
    child: null,
    stats: contracts.createStatsDefaults(),
    todayRecord: null,
    checkinReady: false
  });
}

async function getProfileData(onRefresh) {
  return callCloud('getProfileData', withSelectedStudent({}), {
    child: {
      nickname: '',
      avatarText: '',
      childLoginCode: ''
    },
    level: null,
    familyReady: false,
    family: null,
    members: [],
    user: {},
    currentUser: {},
    currentMember: {},
    subscriptionPreference: null
  }, { onRefresh });
}

async function getHeatmap(days, onRefresh) {
  return callCloud('getHeatmap', withSelectedStudent({ days }), {
    heatmap: [],
    catchupState: contracts.createCatchupStateDefaults(),
    catchupTasks: []
  }, { onRefresh });
}

async function getMonthHeatmap(year, month, onRefresh) {
  return callCloud('getMonthHeatmap', withSelectedStudent({ year, month }), {
    year,
    month,
    heatmap: [],
    catchupState: contracts.createCatchupStateDefaults()
  }, { onRefresh });
}

/**
 * @param {string} date
 * @returns {Promise<{report: ReportData}>}
 */
async function getDailyReportByDate(date, onRefresh) {
  return callCloud('getDailyReportByDate', withSelectedStudent({ date }), {
    report: contracts.createReportDefaults(date)
  }, { onRefresh });
}

async function getParentDashboard(options, onRefresh) {
  if (typeof options === 'function') {
    onRefresh = options;
    options = {};
  }
  return callCloud('getParentDashboard', withSelectedStudent(options || {}), {
    family: null,
    child: null,
    stats: contracts.createStatsDefaults(),
    todayReport: contracts.createReportDefaults(),
    recentReports: [],
    user: {},
    currentUser: {},
    currentMember: contracts.createCurrentMemberDefaults(),
    members: [],
    subscriptionPreference: null
  }, { onRefresh });
}

async function getReadingHome(options, onRefresh) {
  return callCloud('getReadingHome', withSelectedStudent(Object.assign({}, options || {})), {
    today: '',
    dailyCount: 0,
    passage: null,
    passages: [],
    categoryTree: [],
    memoryPlan: null,
    completedCount: 0,
    totalCount: 0,
    completedToday: false,
    latestAttempt: null
  }, { onRefresh });
}

async function getReadingPassage(options, onRefresh) {
  return callCloud('getReadingPassage', withSelectedStudent(Object.assign({}, options || {})), {
    today: '',
    passage: null,
    latestAttempt: null
  }, { onRefresh });
}

async function getReadingStudyPack(options, onRefresh) {
  const opts = Object.assign({}, options || {});
  const useCache = opts.useCache !== false;
  delete opts.useCache;
  return callCloud('getReadingStudyPack', withSelectedStudent(opts), {
    passageId: '',
    studyPack: null
  }, { onRefresh, useCache });
}

async function synthesizeReadingAudio(options) {
  const result = await callCloud('synthesizeReadingAudio', Object.assign({}, options || {}), {
    text: '',
    fileId: ''
  }, { useCache: false });
  if (result && result.syncMode === 'cloud-error') {
    throw new Error((result.cloudError && result.cloudError.message) || '发音生成失败');
  }
  return result;
}

async function lookupWord(word) {
  const key = String(word || '').trim().toLowerCase();
  const cached = key ? wordLookupCache[key] : null;
  if (cached && cached.data && Date.now() - cached.savedAt < WORD_LOOKUP_MAX_AGE_MS) {
    return Object.assign({}, cached.data, { __cacheHit: true });
  }
  const data = await callCloud('lookupWord', { word }, {
    word: '',
    wordLower: '',
    phonetic: '',
    definitions: [],
    audioUrl: '',
    audioFileId: '',
    audioCloudPath: ''
  }, { useCache: false });
  if (key && data && data.syncMode !== 'cloud-error') {
    wordLookupCache[key] = { savedAt: Date.now(), data };
  }
  return data;
}

async function addDictionaryWord(entry) {
  const result = await callCloud('addDictionaryWord', withSelectedStudent(entry || {}), { saved: false }, { useCache: false });
  if (!result || result.saved !== true) {
    const message = result && result.cloudError && result.cloudError.message
      ? result.cloudError.message
      : 'addDictionaryWord-not-saved';
    throw new Error(message);
  }
  bumpFlashcardSourceCacheVersion();
  return result;
}

async function submitReadingAttempt(options) {
  return callCloud('submitReadingAttempt', withSelectedStudent(options || {}), {
    passage: null,
    attempt: null,
    review: null
  }, { useCache: false });
}

async function submitWritingAttempt(options) {
  return callCloud('submitWritingAttempt', withSelectedStudent(options || {}), {
    prompt: null,
    attempt: null,
    review: null
  }, { useCache: false });
}

async function gradeWritingAttempt(attemptId) {
  return callCloud('gradeWritingAttempt', withSelectedStudent({ attemptId }), {
    attempt: null,
    review: null,
    pending: true
  }, { useCache: false });
}

async function getWritingAttempts(options, onRefresh) {
  return callCloud('getWritingAttempts', withSelectedStudent(Object.assign({}, options || {})), {
    attempts: []
  }, { onRefresh });
}

async function getWritingAttemptDetail(attemptId) {
  return callCloud('getWritingAttemptDetail', withSelectedStudent({ attemptId }), {
    attempt: null
  }, { useCache: false });
}

async function getGrammarHome(options, onRefresh) {
  return callCloud('getGrammarHome', Object.assign({}, options || {}), {
    topicTypes: [],
    byTopic: [],
    questions: [],
    source: ''
  }, { onRefresh });
}

async function getGrammarTopic(topicId, options) {
  return callCloud('getGrammarTopic', Object.assign({ topicId }, options || {}), {
    topic: null,
    questions: [],
    source: ''
  });
}

async function recordGrammarWrong(question, selectedAnswer) {
  return callCloud('recordGrammarWrong', withSelectedStudent({ question, selectedAnswer }), { saved: false }, { useCache: false });
}

async function getGrammarWrongBook() {
  return callCloud('getGrammarWrongBook', {}, {
    topicTypes: [],
    questions: [],
    source: ''
  });
}

async function addPracticeWrongQuestion(options) {
  return callCloud('addPracticeWrongQuestion', withSelectedStudent(options || {}), {
    saved: false,
    reason: ''
  }, { useCache: false });
}

async function getPracticeWrongQuestions(options) {
  return callCloud('getPracticeWrongQuestions', withSelectedStudent(options || {}), {
    type: String(options && options.type || ''),
    items: []
  });
}

async function getGrammarProgress(topicId) {
  return callCloud('getGrammarProgress', withSelectedStudent({ topicId }), {
    topicId,
    nextIndex: 0,
    answeredQuestions: []
  });
}

async function recordGrammarProgress(topicId, nextIndex, answeredQuestions) {
  return callCloud('recordGrammarProgress', withSelectedStudent({ topicId, nextIndex, answeredQuestions: answeredQuestions || [] }), { saved: false }, { useCache: false });
}

async function recordStudyCompletion(item) {
  return callCloud('recordStudyCompletion', withSelectedStudent(item || {}), { saved: false }, { useCache: false });
}

async function getStudyCompletions(options, onRefresh) {
  return callCloud('getStudyCompletions', withSelectedStudent(options || {}), { items: [] }, { onRefresh });
}

async function getStudyCompletionDetail(recordId) {
  return callCloud('getStudyCompletionDetail', withSelectedStudent({ recordId }), { item: null }, { useCache: false });
}

async function explainGrammarQuestion(question, options = {}) {
  return callCloud('explainGrammarQuestion', { question, force: Boolean(options.force), cacheOnly: Boolean(options.cacheOnly) }, {
    explanation: null,
    source: ''
  }, { useCache: false });
}

/**
 * @returns {Promise<FamilyPageData>}
 */
async function getFamilyPageData(onRefresh) {
  const data = await callCloud('getFamilyPage', withSelectedStudent({}), contracts.createFamilyPageDefaults(), {
    onRefresh: (fresh) => {
      syncSelectedStudentFromData(fresh);
      if (typeof onRefresh === 'function') {
        onRefresh(fresh);
      }
    }
  });
  syncSelectedStudentFromData(data);
  return data;
}

async function refreshInviteCode() {
  return callCloud('refreshInviteCode', withSelectedStudent({}), contracts.createFamilyPageDefaults());
}

async function joinFamily(inviteCode, displayName) {
  const data = await callCloud('joinFamily', { inviteCode, displayName }, contracts.createFamilyPageDefaults());
  syncSelectedStudentFromData(data);
  return data;
}

async function joinFamilyByChildCode(childLoginCode, displayName, options = {}) {
  const data = await callCloud('joinFamilyByChildCode', {
    childLoginCode,
    displayName,
    studyRole: options.studyRole
  }, contracts.createFamilyPageDefaults());
  syncSelectedStudentFromData(data);
  return data;
}

async function updateBindingProfile(selfChildNickname, relationName) {
  const data = await callCloud('updateBindingProfile', withSelectedStudent({
    selfChildNickname,
    relationName
  }), contracts.createFamilyPageDefaults());
  syncSelectedStudentFromData(data);
  return data;
}

async function leaveFamily() {
  const data = await callCloud('leaveFamily', withSelectedStudent({}), contracts.createFamilyPageDefaults());
  syncSelectedStudentFromData(data);
  return data;
}

async function setStudyRole(studyRole) {
  const deviceStudyRole = setDeviceStudyRole(studyRole);
  if (studyRole === 'student') {
    clearSelectedStudentTarget();
    clearCloudReadCache();
    return callCloud('setStudyRole', { studyRole, deviceStudyRole, forceSelf: true }, contracts.createFamilyPageDefaults());
  }
  const lastParentTarget = getLastParentStudentTarget();
  const hasLastParentTarget = !!(lastParentTarget.targetFamilyId || lastParentTarget.targetChildId);
  const payload = hasLastParentTarget
    ? Object.assign({ studyRole, deviceStudyRole }, lastParentTarget)
    : withSelectedStudent({ studyRole, deviceStudyRole });
  let data = await callCloud('setStudyRole', payload, contracts.createFamilyPageDefaults());
  syncSelectedStudentFromData(data);
  if (!hasLastParentTarget) {
    const fallbackTarget = (data.studentLinks || []).find((item) => item && item.role !== 'owner' && (item.familyId || item.childId));
    if (fallbackTarget) {
      setSelectedStudentTarget(fallbackTarget);
      setLastParentStudentTarget(fallbackTarget);
      data = await callCloud('getFamilyPage', normalizeStudentTarget(fallbackTarget), contracts.createFamilyPageDefaults(), { useCache: false });
      syncSelectedStudentFromData(data);
    }
  }
  return data;
}

async function undoLastListened() {
  return callCloud('undoLastListened', withSelectedStudent({}), Object.assign({}, contracts.createFamilyPageDefaults(), {
    cleared: null
  }));
}

async function updateSubscription(enabled) {
  return callCloud('updateSubscription', withSelectedStudent({ enabled }), contracts.createFamilyPageDefaults());
}

async function updateChildProfile(nickname) {
  return callCloud('updateChildProfile', withSelectedStudent({ nickname }), contracts.createFamilyPageDefaults());
}

async function getAdminFamilyList(onRefresh) {
  return callCloud('getAdminFamilyList', {}, {
    isAdmin: false,
    rows: [],
    total: 0
  }, { onRefresh });
}

async function getAdminStatus(options, onRefresh) {
  let opts = Object.assign({}, options || {});
  let refreshHandler = onRefresh;
  if (typeof options === 'function') {
    refreshHandler = options;
    opts = {};
  }
  const forceRefresh = opts.forceRefresh === true;
  return callCloud('getAdminStatus', {}, {
    isAdmin: false,
    openId: '',
    userId: '',
    adminServiceVersion: '',
    builtinHit: false,
    envHit: false,
    envConfigured: false,
    envCount: 0
  }, { useCache: !forceRefresh, onRefresh: refreshHandler });
}

module.exports = {
  ensureState,
  getMaterialIndex,
  getMaterialItem,
  getDashboard,
  getHeatmap,
  getMonthHeatmap,
  getDailyReportByDate,
  getLevelOverview,
  getListeningPlanOverview,
  getListeningMaterialDetail,
  saveListeningPlanMaterial,
  removeListeningPlanMaterial,
  getProfileData,
  getTaskDetail,
  getTaskTranscript,
  getListeningStudyPack,
  getFlashcardReview,
  getFlashcardDue,
  updateFlashcardReview,
  saveFlashcardSettings,
  addDictionaryBook,
  getDictionaryBook,
  saveFlashcardAudio,
  getTempFileURL,
  markTaskListened,
  createSpeakingUploadUrl,
  uploadSpeakingAudio,
  submitSpeakingAttempt,
  evaluateSpeakingPronunciation,
  rescoreSpeakingAttempt,
  getSpeakingAttempts,
  completeTodayCheckin,
  getParentDashboard,
  getReadingHome,
  getReadingPassage,
  getReadingStudyPack,
  synthesizeReadingAudio,
  lookupWord,
  addDictionaryWord,
  submitReadingAttempt,
  submitWritingAttempt,
  gradeWritingAttempt,
  getWritingAttempts,
  getWritingAttemptDetail,
  getGrammarHome,
  getGrammarTopic,
  recordGrammarWrong,
  getGrammarWrongBook,
  addPracticeWrongQuestion,
  getPracticeWrongQuestions,
  getGrammarProgress,
  recordGrammarProgress,
  recordStudyCompletion,
  getStudyCompletions,
  getStudyCompletionDetail,
  getCachedReadResult,
  getDeviceId,
  getDeviceStudyRole,
  getSelectedStudentTarget,
  setSelectedStudentTarget,
  setLastParentStudentTarget,
  clearSelectedStudentTarget,
  explainGrammarQuestion,
  getFamilyPageData,
  refreshInviteCode,
  joinFamily,
  joinFamilyByChildCode,
  updateBindingProfile,
  leaveFamily,
  setStudyRole,
  undoLastListened,
  updateSubscription,
  updateChildProfile,
  getAdminStatus,
  getAdminFamilyList
};
