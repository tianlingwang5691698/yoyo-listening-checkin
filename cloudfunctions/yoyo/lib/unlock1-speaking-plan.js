const TRACK_PARAGRAPH_SENTENCE_COUNTS = [
  [5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 3],
  [5, 5, 5, 5, 5, 5],
  [3, 3, 4],
  [5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 3],
  [5, 5, 5, 3, 3, 5, 5, 4],
  [4, 5, 1],
  [5, 5, 5, 5, 5, 4, 5],
  [3, 3, 2],
  [5, 5, 5, 4, 5, 4, 1],
  [3, 3],
  [5, 5, 4, 5, 5, 5, 3],
  [4, 3, 3],
  [4, 4, 4, 3, 4, 4, 5, 5],
  [4, 5, 4, 3, 5, 4, 5],
  [3, 5, 3],
  [5, 5, 2],
  [3, 5, 5, 5, 3, 5, 3, 4],
  [5, 5, 3, 3, 4, 3, 3],
  [3, 5],
  [3, 4, 4, 4, 5, 5, 4],
  [5, 4, 5, 5, 4, 3, 1],
  [3, 3, 2]
];

const ROUND_TWO_START_DAY = 73;
const CYCLE_DAYS = 72;
const PLAN_STARTED_AT = '2026-07-23';

function flattenParagraphs() {
  return TRACK_PARAGRAPH_SENTENCE_COUNTS.flatMap((paragraphs, trackIndex) => (
    paragraphs.map((sentenceCount, paragraphOffset) => ({
      trackIndex,
      paragraphIndex: paragraphOffset + 1,
      sentenceCount
    }))
  ));
}

const PARAGRAPHS = flattenParagraphs();

function getRoundDay(planDayIndex) {
  return Number(planDayIndex || 0) - ROUND_TWO_START_DAY + 1;
}

function getParagraphOffsets(planDayIndex) {
  const roundDay = getRoundDay(planDayIndex);
  if (roundDay < 1 || roundDay > CYCLE_DAYS) return [];
  if (roundDay <= 67) return [(roundDay - 1) * 2, (roundDay - 1) * 2 + 1];
  if (roundDay === 68) return [PARAGRAPHS.length - 1];
  const reviewStart = (roundDay - 69) * 2;
  return [reviewStart, reviewStart + 1];
}

function getRoundDayForDate(date, startedAt = PLAN_STARTED_AT) {
  const parse = (value) => Date.parse(`${String(value || '').slice(0, 10)}T12:00:00Z`);
  const elapsedDays = Math.floor((parse(date) - parse(startedAt)) / 86400000);
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) return 0;
  return (elapsedDays % CYCLE_DAYS) + 1;
}

function buildPlanTasks(planDayIndex, catalog) {
  const roundDay = getRoundDay(planDayIndex);
  const review = roundDay >= 69;
  return getParagraphOffsets(planDayIndex).map((offset, slotIndex, rows) => {
    const paragraph = PARAGRAPHS[offset];
    const audioTask = (catalog || [])[paragraph.trackIndex] || {};
    const audioTaskId = String(audioTask.taskId || `unlock1-${paragraph.trackIndex + 1}`);
    const paragraphId = `${audioTaskId}-paragraph-${paragraph.paragraphIndex}`;
    return {
      category: 'speaking',
      taskId: paragraphId,
      audioCategory: 'unlock1',
      audioTaskId,
      paragraphId,
      paragraphIndex: paragraph.paragraphIndex,
      sentenceCount: paragraph.sentenceCount,
      sentenceTaskIds: Array.from({ length: paragraph.sentenceCount }, (_, index) => `${paragraphId}-sentence-${index + 1}`),
      title: `${review ? '巩固复习 · ' : ''}${audioTask.title || `Unlock 1 音频 ${paragraph.trackIndex + 1}`} · 第 ${paragraph.paragraphIndex} 段`,
      displayTitle: `${audioTask.title || `Unlock 1 音频 ${paragraph.trackIndex + 1}`} · 第 ${paragraph.paragraphIndex} 段`,
      planSlotIndex: slotIndex + 1,
      planSlotCount: rows.length,
      planDayIndex: Number(planDayIndex || 0),
      roundDay,
      isReviewTask: review,
      repeatTarget: 1,
      durationSec: Math.max(120, paragraph.sentenceCount * 35)
    };
  });
}

module.exports = {
  CYCLE_DAYS,
  PLAN_STARTED_AT,
  PARAGRAPHS,
  ROUND_TWO_START_DAY,
  TRACK_PARAGRAPH_SENTENCE_COUNTS,
  buildPlanTasks,
  getParagraphOffsets,
  getRoundDay,
  getRoundDayForDate
};
