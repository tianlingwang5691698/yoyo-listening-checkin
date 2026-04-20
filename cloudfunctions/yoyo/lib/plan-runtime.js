const { addDays, formatChinaDateFromDate } = require('./date');

const PLAN_SLOT_COUNT = 24;
const PLAN_PHASES = [
  { key: 'round-1', label: '第1轮', startDay: 1, length: 72, batchSize: 1 }
];
const TOTAL_PLAN_DAYS = PLAN_PHASES.reduce((sum, phase) => sum + phase.length, 0);

function getPlanPhase(dayIndex) {
  return PLAN_PHASES.find((phase) => dayIndex >= phase.startDay && dayIndex < phase.startDay + phase.length) || PLAN_PHASES[0];
}

function getPlanCategoryOrder() {
  return ['newconcept1', 'peppa', 'unlock1', 'song'];
}

function getPlanDayIndex(checkins) {
  const completedDays = Array.isArray(checkins) ? checkins.length : 0;
  return (completedDays % TOTAL_PLAN_DAYS) + 1;
}

function getPlanDayIndexForDate(checkins, date) {
  const records = Array.isArray(checkins) ? checkins : [];
  const sameDay = records.find((item) => item.date === date && item.planDayIndex);
  if (sameDay) {
    return Number(sameDay.planDayIndex) || 1;
  }
  const previousCount = records.filter((item) => String(item.date || '') < date).length;
  return (previousCount % TOTAL_PLAN_DAYS) + 1;
}

function getDatePart(value) {
  return formatChinaDateFromDate(value) || String(value || '').slice(0, 10);
}

function getCompletedDateSet(checkins) {
  return new Set((Array.isArray(checkins) ? checkins : []).map((item) => item.date).filter(Boolean));
}

function getEarliestMissedDate(checkins, today, planStartDate) {
  if (!planStartDate) {
    return '';
  }
  const completedDates = getCompletedDateSet(checkins);
  let cursor = planStartDate;
  while (cursor < today) {
    if (!completedDates.has(cursor)) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return '';
}

function hasCatchupToday(checkins, today) {
  return (Array.isArray(checkins) ? checkins : []).some((item) => item.planRunType === 'catchup' && getDatePart(item.completedAt) === today);
}

function getPlanStartDate(ctx, today, checkins) {
  const records = (Array.isArray(checkins) ? checkins : [])
    .map((item) => String(item.date || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  return records[0] || '';
}

function buildCatchupState(checkins, today, planStartDate, todayDone) {
  const missedDate = getEarliestMissedDate(checkins, today, planStartDate);
  const usedToday = hasCatchupToday(checkins, today);
  const canCatchup = !!(todayDone && missedDate && !usedToday);
  const planDayIndex = canCatchup ? getPlanDayIndexForDate(checkins, missedDate) : 0;
  return {
    canCatchup,
    missedDate,
    planDayIndex,
    usedToday,
    reason: canCatchup ? 'ready' : (!todayDone ? 'finish-current-plan-first' : usedToday ? 'catchup-used-today' : 'no-missed-date')
  };
}

function buildLoopingIndices(startIndex, count, totalCount) {
  if (!totalCount || count <= 0) {
    return [];
  }
  const indices = [];
  for (let step = 0; step < count; step += 1) {
    indices.push((startIndex + step) % totalCount);
  }
  return indices;
}

function getRound1IndicesForCategory(dayIndex, category, catalogLength) {
  if (!catalogLength) {
    return [];
  }
  if (category === 'newconcept1') {
    return buildLoopingIndices((dayIndex - 1) * 2, 2, catalogLength);
  }
  if (category === 'unlock1') {
    const unlockCount = Math.min(PLAN_SLOT_COUNT, catalogLength);
    if (dayIndex <= unlockCount) {
      return [dayIndex - 1];
    }
    return buildLoopingIndices((dayIndex - unlockCount - 1) * 3, 3, unlockCount);
  }
  return buildLoopingIndices(dayIndex - 1, 1, catalogLength);
}

module.exports = {
  PLAN_SLOT_COUNT,
  PLAN_PHASES,
  TOTAL_PLAN_DAYS,
  getPlanPhase,
  getPlanCategoryOrder,
  getPlanDayIndex,
  getPlanDayIndexForDate,
  getDatePart,
  getCompletedDateSet,
  getEarliestMissedDate,
  hasCatchupToday,
  getPlanStartDate,
  buildCatchupState,
  buildLoopingIndices,
  getRound1IndicesForCategory
};
