const cloud = require('wx-server-sdk');
const { getWXContext } = require('../adapters/wx-context.adapter');
const familyRepository = require('../repositories/family.repository');
const progressRepository = require('../repositories/progress.repository');
const checkinRepository = require('../repositories/checkin.repository');
const reportRepository = require('../repositories/report.repository');
const dateLib = require('../lib/china-date');
const taskPresenter = require('../lib/task-presenter');
const planLib = require('../lib/plan-runtime');
const taskEngine = require('../lib/task-engine');
const planEngine = require('../lib/plan-engine');
const checkinEngine = require('../lib/checkin-engine');
const reportEngine = require('../lib/report-engine');
const dashboardEngine = require('../lib/dashboard-engine');
const levelEngine = require('../lib/level-engine');
const requestContextEngine = require('../lib/request-context-engine');
const monitor = require('../lib/monitor');
const catalogEngine = require('../lib/catalog-engine');
const familyContextFacade = require('../facades/family-context.facade');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const CLOUD_ENV_ID_RAW = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
const CLOUD_ENV_ID = typeof CLOUD_ENV_ID_RAW === 'string' ? CLOUD_ENV_ID_RAW : '';
const REQUIRED_COLLECTIONS = [
  'users',
  'families',
  'familyMembers',
  'children',
  'dailyTaskProgress',
  'dailyCheckins',
  'dailyReports',
  'subscriptionPreferences'
];
const childTemplate = {
  childId: 'child-yoyo',
  nickname: '佑佑',
  avatarText: 'YY',
  currentLevel: 'A1',
  ageLabel: '启蒙阶段',
  welcomeLine: '今天听三遍，小耳朵慢慢就会越来越灵。'
};

const level = {
  levelId: 'A1',
  name: 'A1 纯音频听力',
  description: '每天三项音频任务，前两遍盲听，第三遍再看文本。'
};

const STORAGE_ROOTS = catalogEngine.STORAGE_ROOTS;
const STORAGE_ROOT_CANDIDATES = catalogEngine.STORAGE_ROOT_CANDIDATES;
const AUDIO_FILE_PATTERN = catalogEngine.AUDIO_FILE_PATTERN;
const songPlaceholder = catalogEngine.songPlaceholder;

function buildCloudAssetUrl(cloudPath) {
  return catalogEngine.buildCloudAssetUrl(cloudPath);
}

function getBaseName(path) {
  return catalogEngine.getBaseName(path);
}

function sortFilesByPath(left, right) {
  return catalogEngine.sortFilesByPath(left, right);
}

function inferNewConceptTaskMeta(category, audioBaseName, index) {
  return catalogEngine.inferNewConceptTaskMeta(category, audioBaseName, index);
}

function buildCloudTask(baseTask, overrides) {
  return catalogEngine.buildCloudTask(baseTask, overrides);
}

function refreshRuntimeCatalogs(force, categories) {
  return catalogEngine.refreshRuntimeCatalogs(force, categories);
}

function getResourceDebugSnapshot() {
  return catalogEngine.getResourceDebugSnapshot();
}

function getCatalog(category) {
  return catalogEngine.getCatalog(category);
}

async function getTranscriptBundle(task) {
  return catalogEngine.getTranscriptBundle(task);
}

function getCategoryLabel(category) {
  return taskPresenter.getCategoryLabel(category);
}

function getMediaDisplayName(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
}

function getTaskPresentation(task) {
  return taskPresenter.getTaskPresentation(task);
}

function getTaskReward(category, progress, task) {
  return taskPresenter.getTaskReward(category, progress, task);
}

function decorateTask(task, progress, category) {
  return taskPresenter.decorateTask(task, progress, category, {
    songPlaceholder,
    getMediaDisplayName
  });
}

async function updateChildProfile(familyId, payload) {
  return familyContextFacade.updateChildProfile(familyId, payload);
}

function normalizeStudyRole(member) {
  return familyContextFacade.normalizeStudyRole(member);
}

async function setExclusiveStudyRole(member, studyRole) {
  return familyContextFacade.setExclusiveStudyRole(member, studyRole);
}

async function upsertFamilyMemberForFamily(openId, userId, familyId, displayName) {
  return familyContextFacade.upsertFamilyMemberForFamily(openId, userId, familyId, displayName);
}

async function leaveCurrentFamily(ctx) {
  return familyContextFacade.leaveCurrentFamily(ctx);
}

async function ensureBootstrap(openId) {
  return familyContextFacade.ensureBootstrap(openId);
}

function getUserScope(ctx) {
  return {
    userId: ctx.user.userId,
    openId: ctx.user.openId,
    memberId: ctx.member.memberId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId
  };
}

async function getProgressRecord(scope, category, date) {
  const progressId = `${scope.familyId}_${scope.childId}_${date}_${category}`;
  return progressRepository.findByProgressId(progressId);
}

async function saveProgressRecord(record) {
  await progressRepository.upsert({
    familyId: record.familyId,
    childId: record.childId
  }, record);
}

async function getChildProgressRecords(scope) {
  return progressRepository.findByScope(scope);
}

async function getCheckins(scope) {
  return checkinRepository.findByScope(scope);
}

const addDays = dateLib.addDays;
const getTodayString = dateLib.getTodayString;
const computeStreak = dateLib.computeStreak;

const PLAN_SLOT_COUNT = planLib.PLAN_SLOT_COUNT;
const PLAN_PHASES = planLib.PLAN_PHASES;
const TOTAL_PLAN_DAYS = planLib.TOTAL_PLAN_DAYS;

function getPlanPhase(dayIndex) {
  return planLib.getPlanPhase(dayIndex);
}

function getPlanCategoryOrder(dayIndex) {
  return planLib.getPlanCategoryOrder(dayIndex);
}

function getPlanDayIndex(checkins) {
  return planLib.getPlanDayIndex(checkins);
}

function getPlanDayIndexForDate(checkins, date) {
  return planLib.getPlanDayIndexForDate(checkins, date);
}

function getPlanStartDate(ctx, today, checkins) {
  return planLib.getPlanStartDate(ctx, today, checkins);
}

function buildCatchupState(checkins, today, planStartDate, todayDone) {
  return planLib.buildCatchupState(checkins, today, planStartDate, todayDone);
}

function getPlanCatalog(category) {
  return planEngine.getPlanCatalog(category, {
    getCatalog,
    planSlotCount: PLAN_SLOT_COUNT
  });
}

function buildLevelCategoryOverview(progressRecords, childId, category, date, options = {}) {
  const tasks = getCatalog(category).slice(0, options.limit || PLAN_SLOT_COUNT);
  const plannedTasks = decoratePlannedTasks(progressRecords, childId, category, date, tasks, {
    planRunType: options.planRunType || 'level',
    targetDate: date,
    planDayIndex: options.planDayIndex || 1
  });
  const todayTask = buildCategorySummary(plannedTasks, category);
  return {
    category,
    categoryLabel: getCategoryLabel(category),
    totalCount: tasks.length,
    completedCount: plannedTasks.filter((item) => item.completedToday).length,
    todayTask,
    isPendingAsset: todayTask.isPendingAsset,
    todayTaskCount: todayTask.plannedTaskCount || 0
  };
}

function buildLevelCatalogEntry(category, options = {}) {
  return levelEngine.buildLevelCatalogEntry(category, options, {
    getCatalog,
    decorateTask,
    buildEmptyProgress,
    buildCategorySummary,
    getCategoryLabel
  });
}

async function resolveStandaloneCategoryTasks(category, childId, date) {
  return levelEngine.resolveStandaloneCategoryTasks(category, childId, date, {
    storageRootCandidates: STORAGE_ROOT_CANDIDATES,
    storageRoots: STORAGE_ROOTS,
    listDirectoryFiles,
    audioFilePattern: AUDIO_FILE_PATTERN,
    sortFilesByPath,
    getBaseName,
    inferNewConceptTaskMeta,
    buildCloudTask,
    buildCloudAssetUrl
  });
}

function buildPlanForDay(dayIndex) {
  return planEngine.buildPlanForDay(dayIndex, {
    getCatalog,
    planSlotCount: PLAN_SLOT_COUNT,
    planLib
  });
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}) {
  return planEngine.decoratePlanTasks(progressRecords, childId, date, plan, options, {
    decoratePlannedTasks,
    planLib
  });
}

function buildEmptyProgress() {
  return taskEngine.buildEmptyProgress();
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  return taskEngine.getTaskProgressForDate(progressRecords, childId, category, date, taskId, options);
}

function decoratePlannedTasks(progressRecords, childId, category, date, tasks, options = {}) {
  return taskEngine.decoratePlannedTasks(progressRecords, childId, category, date, tasks, options, {
    getPlanPhase,
    decorateTask
  });
}

function buildCategorySummary(categoryTasks, category) {
  return taskEngine.buildCategorySummary(categoryTasks, category, {
    decorateTask
  });
}

function buildStats(progressRecords, checkins, childId) {
  return taskEngine.buildStats(progressRecords, checkins, childId, {
    getCatalog,
    computeStreak
  });
}

async function maybeCreateCheckin(scope, progressRecords, date, options = {}) {
  return checkinEngine.maybeCreateCheckin(scope, progressRecords, date, options, {
    getCheckins,
    getPlanDayIndex,
    buildPlanForDay,
    getTaskProgressForDate,
    computeStreak,
    upsertCheckin: (existing, next) => checkinRepository.upsertByRecordId(existing, next),
    upsertDailyReport
  });
}

async function clearTodayUnconfirmedListens(ctx) {
  const today = getTodayString();
  const scope = getUserScope(ctx);
  const todayRecord = (await getCheckins(scope)).find((item) => item.date === today);
  if (todayRecord) {
    throw new Error('今天已经打卡，不能清掉记录');
  }
  const progressRecords = await getChildProgressRecords(scope);
  const candidates = progressRecords
    .filter((item) => item.date === today && Number(item.playCount || 0) > 0)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (!candidates.length) {
    throw new Error('今天没有可清掉的播放记录');
  }
  const now = new Date().toISOString();
  await progressRepository.bulkResetByIds(candidates.map((item) => item._id), {
    playCount: 0,
    textUnlocked: false,
    completedToday: false,
    updatedAt: now,
    lastUndoAt: now,
    lastUndoByMemberId: scope.memberId
  });
  await upsertDailyReport(scope, today);
  return {
    cleared: {
      date: today,
      taskCount: candidates.length,
      playCount: candidates.reduce((sum, item) => sum + Number(item.playCount || 0), 0)
    }
  };
}

async function upsertDailyReport(scope, date) {
  return reportEngine.upsertDailyReport(scope, date, {
    getChildProgressRecords,
    getCheckins,
    buildPlanForDay,
    getPlanDayIndexForDate,
    getPlanCategoryOrder,
    decoratePlannedTasks,
    getCatalog,
    findFamilyMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    upsertReport: (nextScope, nextDate, report) => reportRepository.upsert(nextScope, nextDate, report)
  });
}

async function getDashboardData(ctx, options = {}) {
  return dashboardEngine.getDashboardData(ctx, {
    getTodayString,
    getUserScope,
    getChildProgressRecords,
    getCheckins,
    getPlanDayIndexForDate,
    buildPlanForDay,
    getPlanCategoryOrder,
    decoratePlannedTasks,
    buildCategorySummary,
    decoratePlanTasks,
    buildStats,
    buildCatchupState,
    getPlanStartDate,
    getCatalog,
    getCategoryLabel
  }, options);
}

async function prepareRequestContext(event) {
  return requestContextEngine.prepareRequestContext(event, {
    refreshRuntimeCatalogs,
    ensureRequiredCollectionsReady,
    getWXContext,
    ensureBootstrap,
    getTodayString
  });
}

module.exports = {
  getResourceDebugSnapshot,
  prepareRequestContext,
  getDashboardData,
  getUserScope,
  getChildProgressRecords,
  getCheckins,
  getPlanDayIndex,
  getPlanDayIndexForDate,
  buildPlanForDay,
  decoratePlannedTasks,
  decoratePlanTasks,
  resolveStandaloneCategoryTasks,
  buildCategorySummary,
  getPlanCatalog,
  getCatalog,
  getCategoryLabel,
  addDays,
  getTodayString,
  buildLevelCatalogEntry,
  buildEmptyProgress,
  decorateTask,
  getTranscriptBundle,
  upsertDailyReport,
  buildCatchupState,
  getPlanStartDate,
  normalizeStudyRole,
  maybeCreateCheckin,
  saveProgressRecord,
  level,
  ensureBootstrap,
  updateChildProfile,
  setExclusiveStudyRole,
  upsertFamilyMemberForFamily,
  leaveCurrentFamily,
  clearTodayUnconfirmedListens
};
