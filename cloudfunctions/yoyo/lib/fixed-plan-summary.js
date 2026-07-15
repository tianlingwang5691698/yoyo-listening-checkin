const planRuntime = require('./plan-runtime');

const SUMMARY_VERSION = 1;

function buildSummaryId(scope) {
  return `${String(scope && scope.familyId || '').trim()}_${String(scope && scope.childId || '').trim()}`;
}

function buildSlotKey(category, planSlotIndex) {
  return `${String(category || '').trim()}__${Number(planSlotIndex || 0)}`;
}

function isCompleted(record) {
  return !!(record && (record.completedToday || Number(record.playCount || 0) >= Number(record.repeatTarget || 1)));
}

function isFixedPlanRecord(record) {
  return !!(record
    && record.category
    && Number(record.planSlotIndex || 0) > 0
    && String(record.planSource || 'fixed-yoyo') === 'fixed-yoyo'
    && String(record.planRunType || 'normal') === 'normal'
    && String(record.date || '') >= planRuntime.FIXED_SLOT_PLAN_STARTED_AT);
}

function compareProgress(left, right) {
  const updated = String(left && left.updatedAt || '').localeCompare(String(right && right.updatedAt || ''));
  if (updated) return updated;
  return String(left && left.date || '').localeCompare(String(right && right.date || ''));
}

function compactProgress(record) {
  if (!record) return null;
  return {
    progressId: String(record.progressId || ''),
    childId: String(record.childId || ''),
    category: String(record.category || ''),
    date: String(record.date || ''),
    taskId: String(record.taskId || ''),
    originalTaskId: String(record.originalTaskId || ''),
    planSource: String(record.planSource || 'fixed-yoyo'),
    planRunType: String(record.planRunType || 'normal'),
    planSlotIndex: Number(record.planSlotIndex || 0),
    listeningPlanId: String(record.listeningPlanId || ''),
    playCount: Number(record.playCount || 0),
    repeatTarget: Number(record.repeatTarget || 1),
    completedToday: isCompleted(record),
    textUnlocked: !!record.textUnlocked,
    durationSec: Number(record.durationSec || 0),
    updatedAt: String(record.updatedAt || '')
  };
}

function buildSlotSummary(records, category, planSlotIndex) {
  const scoped = (records || []).filter((record) => (
    isFixedPlanRecord(record)
      && record.category === category
      && Number(record.planSlotIndex || 0) === Number(planSlotIndex || 0)
  ));
  const completed = scoped.filter(isCompleted);
  const lastCompletedDate = completed.reduce((latest, record) => (
    String(record.date || '') > latest ? String(record.date || '') : latest
  ), '');
  const latestProgress = scoped.slice().sort(compareProgress).pop() || null;
  return {
    category,
    planSlotIndex: Number(planSlotIndex || 0),
    completedCount: completed.length,
    lastCompletedDate,
    lastCompletedDateCount: lastCompletedDate
      ? completed.filter((record) => String(record.date || '') === lastCompletedDate).length
      : 0,
    latestProgress: compactProgress(latestProgress),
    sourceRecordCount: scoped.length,
    updatedAt: String(latestProgress && latestProgress.updatedAt || '')
  };
}

function buildSummaryDocument(records, scope, current = null) {
  const fixedRecords = (records || []).filter(isFixedPlanRecord);
  const grouped = fixedRecords.reduce((result, record) => {
    const key = buildSlotKey(record.category, record.planSlotIndex);
    if (!result[key]) result[key] = [];
    result[key].push(record);
    return result;
  }, {});
  const slots = Object.keys(grouped).reduce((result, key) => {
    const first = grouped[key][0];
    result[key] = buildSlotSummary(grouped[key], first.category, first.planSlotIndex);
    return result;
  }, {});
  const now = new Date().toISOString();
  return {
    familyId: String(scope && scope.familyId || ''),
    childId: String(scope && scope.childId || ''),
    version: SUMMARY_VERSION,
    slots,
    sourceRecordCount: fixedRecords.length,
    completedRecordCount: fixedRecords.filter(isCompleted).length,
    sourceMaxUpdatedAt: fixedRecords.reduce((latest, record) => (
      String(record.updatedAt || '') > latest ? String(record.updatedAt || '') : latest
    ), ''),
    createdAt: String(current && current.createdAt || now),
    updatedAt: now
  };
}

function getCompletedCountBeforeDate(summary, category, planSlotIndex, date) {
  const slot = summary && summary.slots && summary.slots[buildSlotKey(category, planSlotIndex)];
  if (!slot) return 0;
  const completedCount = Math.max(0, Number(slot.completedCount || 0));
  if (String(slot.lastCompletedDate || '') === String(date || '')) {
    return Math.max(0, completedCount - Math.max(0, Number(slot.lastCompletedDateCount || 0)));
  }
  return completedCount;
}

function buildProgressRecords(summary, todayRecords) {
  const records = (todayRecords || []).slice();
  Object.values(summary && summary.slots || {}).forEach((slot) => {
    const latest = slot && slot.latestProgress;
    if (!latest || records.some((record) => record.progressId && record.progressId === latest.progressId)) return;
    records.push(latest);
  });
  return records;
}

module.exports = {
  SUMMARY_VERSION,
  buildSummaryId,
  buildSlotKey,
  isCompleted,
  isFixedPlanRecord,
  compactProgress,
  buildSlotSummary,
  buildSummaryDocument,
  getCompletedCountBeforeDate,
  buildProgressRecords
};
