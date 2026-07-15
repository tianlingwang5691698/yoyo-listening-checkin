const { addDays, formatChinaDateFromDate } = require('./date');

const PLAN_SLOT_COUNT = 24;
const GRAMMAR_PLAN_START_DAY = 86;
const FIXED_SLOT_PLAN_DAY = 86;
const FIXED_SLOT_PLAN_STARTED_AT = '2026-07-15';
const GRAMMAR_DAILY_COUNT = 3;
const GRAMMAR_TOPICS = [
  ['noun', '名词', 10],
  ['pronoun', '代词', 15],
  ['numeral', '数词', 12],
  ['article', '冠词', 15],
  ['verb', '动词', 36],
  ['adjective', '形容词', 15],
  ['adverb', '副词', 16],
  ['preposition', '介词', 25],
  ['conjunction', '连词', 14],
  ['interjection', '感叹词', 10]
];
const PLAN_PHASES = [
  { key: 'round-1', label: '第1轮', startDay: 1, length: 72, batchSize: 1 },
  { key: 'round-2', label: '阶段二', startDay: 73, length: 72, batchSize: 1 }
];
const TOTAL_PLAN_DAYS = PLAN_PHASES.reduce((sum, phase) => sum + phase.length, 0);

function getPlanPhase(dayIndex) {
  return PLAN_PHASES.find((phase) => dayIndex >= phase.startDay && dayIndex < phase.startDay + phase.length) || PLAN_PHASES[0];
}

function getPlanCategoryOrder(dayIndex = 1) {
  if (getPlanPhase(dayIndex).key === 'round-2') {
    return dayIndex >= GRAMMAR_PLAN_START_DAY
      ? ['grammar', 'newconcept1', 'peppa', 'unlock1']
      : ['newconcept1', 'peppa', 'unlock1'];
  }
  return ['newconcept1', 'peppa', 'unlock1', 'song'];
}

function buildGrammarCatalog() {
  return GRAMMAR_TOPICS.flatMap(([topic, topicLabel, count]) => (
    Array.from({ length: count }, (_, index) => ({
      taskId: `grammar-${topic}-${index + 1}`,
      category: 'grammar',
      topic,
      topicLabel,
      lessonNumber: index + 1,
      title: `${topicLabel}第 ${index + 1} 节`,
      repeatTarget: 1,
      durationSec: 0
    }))
  ));
}

function getGrammarIndicesForDay(dayIndex, catalogLength = 168) {
  if (dayIndex < GRAMMAR_PLAN_START_DAY) return [];
  const start = (dayIndex - GRAMMAR_PLAN_START_DAY) * GRAMMAR_DAILY_COUNT;
  return buildLinearIndices(start, GRAMMAR_DAILY_COUNT, catalogLength);
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

function getNextPlanDayIndexForDate(checkins, date) {
  const records = Array.isArray(checkins) ? checkins : [];
  const sameDayRecords = records
    .filter((item) => item.date === date && String(item.planRunType || 'normal') === 'normal' && item.planDayIndex)
    .map((item) => Number(item.planDayIndex || 0))
    .filter(Boolean);
  if (sameDayRecords.length) {
    return (Math.max(...sameDayRecords) % TOTAL_PLAN_DAYS) + 1;
  }
  return getPlanDayIndexForDate(records, date);
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

function getCatchupPlanDayIndex(checkins, today, todayDone) {
  const records = Array.isArray(checkins) ? checkins : [];
  const hasNormalToday = records.some((item) => (
    item.date === today && String(item.planRunType || 'normal') === 'normal'
  ));
  const completedCount = records.length + (todayDone && !hasNormalToday ? 1 : 0);
  return (completedCount % TOTAL_PLAN_DAYS) + 1;
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
  const planDayIndex = canCatchup ? getCatchupPlanDayIndex(checkins, today, todayDone) : 0;
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

function buildLinearIndices(startIndex, count, totalCount) {
  if (!totalCount || count <= 0) {
    return [];
  }
  const indices = [];
  for (let step = 0; step < count; step += 1) {
    const index = startIndex + step;
    if (index < totalCount) {
      indices.push(index);
    }
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

function getRound2IndicesForCategory(dayIndex, category, catalogLength) {
  if (!catalogLength) {
    return [];
  }
  const roundDay = dayIndex - PLAN_PHASES[1].startDay + 1;
  if (category === 'newconcept1') {
    return buildLoopingIndices((roundDay - 1) * 3, 3, catalogLength);
  }
  if (category === 'unlock1') {
    const unlockCount = Math.min(PLAN_SLOT_COUNT, catalogLength);
    return buildLoopingIndices((roundDay - 1) * 3, 3, unlockCount);
  }
  if (category === 'peppa') {
    return buildLoopingIndices(72 + (roundDay - 1) * 5, 5, catalogLength);
  }
  if (category === 'song') {
    return buildLoopingIndices(72 + (roundDay - 1) * 3, 3, catalogLength);
  }
  return buildLoopingIndices((roundDay - 1) * 3, 3, catalogLength);
}

function getPlanIndicesForCategory(dayIndex, category, catalogLength) {
  if (category === 'grammar') {
    return getGrammarIndicesForDay(dayIndex, catalogLength);
  }
  const phase = getPlanPhase(dayIndex);
  if (phase.key === 'round-2') {
    return getRound2IndicesForCategory(dayIndex, category, catalogLength);
  }
  return getRound1IndicesForCategory(dayIndex, category, catalogLength);
}

module.exports = {
  PLAN_SLOT_COUNT,
  GRAMMAR_PLAN_START_DAY,
  FIXED_SLOT_PLAN_DAY,
  FIXED_SLOT_PLAN_STARTED_AT,
  GRAMMAR_DAILY_COUNT,
  GRAMMAR_TOPICS,
  PLAN_PHASES,
  TOTAL_PLAN_DAYS,
  getPlanPhase,
  getPlanCategoryOrder,
  getPlanDayIndex,
  getPlanDayIndexForDate,
  getNextPlanDayIndexForDate,
  getDatePart,
  getCompletedDateSet,
  getEarliestMissedDate,
  hasCatchupToday,
  getCatchupPlanDayIndex,
  getPlanStartDate,
  buildCatchupState,
  buildLoopingIndices,
  buildLinearIndices,
  buildGrammarCatalog,
  getGrammarIndicesForDay,
  getRound1IndicesForCategory,
  getRound2IndicesForCategory,
  getPlanIndicesForCategory
};
