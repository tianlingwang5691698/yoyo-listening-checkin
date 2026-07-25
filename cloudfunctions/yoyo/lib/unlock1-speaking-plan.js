const WORKBOOK_WORD_COUNTS = require('../data/unlock1-workbook-speaking-word-counts.json');
const TEXTBOOK_SENTENCE_COUNTS = require('../data/unlock1-textbook-speaking-paragraph-sentence-counts.json');

const ROUND_TWO_START_DAY = 73;
const DAILY_SENTENCE_COUNT = 20;
const PLAN_STARTED_AT = '2026-07-25';
const START_SENTENCE_OFFSET = 23;

function flattenWorkbookSentences() {
  return WORKBOOK_WORD_COUNTS.flatMap((paragraphs, trackIndex) => paragraphs.flatMap((wordCounts, paragraphOffset) => (
    wordCounts.map((wordCount, sentenceOffset) => ({
      trackIndex,
      paragraphIndex: paragraphOffset + 1,
      sentenceIndex: sentenceOffset + 1,
      wordCount: Number(wordCount || 0),
      audioCategory: 'unlock1workbook',
      phase: 'workbook'
    }))
  )));
}

function flattenTextbookSentences() {
  return TEXTBOOK_SENTENCE_COUNTS.flatMap((paragraphs, trackIndex) => paragraphs.flatMap((sentenceCount, paragraphOffset) => (
    Array.from({ length: Number(sentenceCount || 0) }, (_, sentenceOffset) => ({
      trackIndex,
      paragraphIndex: paragraphOffset + 1,
      sentenceIndex: sentenceOffset + 1,
      wordCount: 0,
      audioCategory: 'unlock1',
      phase: 'textbook'
    }))
  )));
}

function partitionSentencesByWordCount(sentences, dayCount, options = {}) {
  const rows = sentences || [];
  const totalWords = rows.reduce((sum, item) => sum + item.wordCount, 0);
  const targetWords = totalWords / dayCount;
  const minSentences = Math.max(1, Number(options.minSentences || 1));
  const maxSentences = Math.max(minSentences, Number(options.maxSentences || rows.length));
  const prefixWords = [0];
  rows.forEach((item) => prefixWords.push(prefixWords[prefixWords.length - 1] + item.wordCount));
  const costs = Array.from({ length: dayCount + 1 }, () => Array(rows.length + 1).fill(Infinity));
  const previous = Array.from({ length: dayCount + 1 }, () => Array(rows.length + 1).fill(-1));
  costs[0][0] = 0;
  for (let day = 1; day <= dayCount; day += 1) {
    const lastEnd = rows.length - ((dayCount - day) * minSentences);
    for (let end = day * minSentences; end <= lastEnd; end += 1) {
      const firstStart = Math.max((day - 1) * minSentences, end - maxSentences);
      const lastStart = end - minSentences;
      for (let start = firstStart; start <= lastStart; start += 1) {
        const groupWords = prefixWords[end] - prefixWords[start];
        const nextCost = costs[day - 1][start] + ((groupWords - targetWords) ** 2);
        if (nextCost < costs[day][end]) {
          costs[day][end] = nextCost;
          previous[day][end] = start;
        }
      }
    }
  }
  const days = [];
  let end = rows.length;
  for (let day = dayCount; day >= 1; day -= 1) {
    const start = previous[day][end];
    days.push(rows.slice(start, end));
    end = start;
  }
  return days.reverse();
}

function splitDayIntoParagraphSegments(sentences) {
  return (sentences || []).reduce((segments, sentence) => {
    const previous = segments[segments.length - 1];
    if (previous && previous.audioCategory === sentence.audioCategory
      && previous.trackIndex === sentence.trackIndex && previous.paragraphIndex === sentence.paragraphIndex
      && previous.sentenceEndIndex + 1 === sentence.sentenceIndex) {
      previous.sentenceEndIndex = sentence.sentenceIndex;
      previous.sentenceCount += 1;
      previous.wordCount += sentence.wordCount;
    } else {
      segments.push({
        trackIndex: sentence.trackIndex,
        paragraphIndex: sentence.paragraphIndex,
        sentenceStartIndex: sentence.sentenceIndex,
        sentenceEndIndex: sentence.sentenceIndex,
        sentenceCount: 1,
        wordCount: sentence.wordCount,
        audioCategory: sentence.audioCategory,
        phase: sentence.phase
      });
    }
    return segments;
  }, []);
}

const SENTENCES = flattenWorkbookSentences();
const TEXTBOOK_SENTENCES = flattenTextbookSentences();
const CURRICULUM_SENTENCES = SENTENCES.concat(TEXTBOOK_SENTENCES);
const TOTAL_SENTENCES = CURRICULUM_SENTENCES.length;
const greatestCommonDivisor = (left, right) => (right ? greatestCommonDivisor(right, left % right) : left);
const CYCLE_DAYS = TOTAL_SENTENCES / greatestCommonDivisor(TOTAL_SENTENCES, DAILY_SENTENCE_COUNT);
const TOTAL_WORDS = SENTENCES.reduce((sum, item) => sum + item.wordCount, 0);
const TEXTBOOK_PARAGRAPHS = TEXTBOOK_SENTENCE_COUNTS.flatMap((paragraphs, trackIndex) => paragraphs.map((sentenceCount, paragraphOffset) => ({
  trackIndex,
  paragraphIndex: paragraphOffset + 1,
  sentenceCount
})));

function getRoundDay(planDayIndex) {
  return Number(planDayIndex || 0) - ROUND_TWO_START_DAY + 1;
}

function getRoundDayForDate(date, startedAt = PLAN_STARTED_AT) {
  const parse = (value) => Date.parse(`${String(value || '').slice(0, 10)}T12:00:00Z`);
  const elapsedDays = Math.floor((parse(date) - parse(startedAt)) / 86400000);
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) return 0;
  return (elapsedDays % CYCLE_DAYS) + 1;
}

function getDailySentences(roundDay) {
  if (roundDay < 1 || roundDay > CYCLE_DAYS) return [];
  const startIndex = (START_SENTENCE_OFFSET + ((roundDay - 1) * DAILY_SENTENCE_COUNT)) % TOTAL_SENTENCES;
  return Array.from({ length: DAILY_SENTENCE_COUNT }, (_, offset) => (
    CURRICULUM_SENTENCES[(startIndex + offset) % TOTAL_SENTENCES]
  ));
}

function buildDailyTasks(roundDay, planDayIndex, catalogs) {
  const segments = splitDayIntoParagraphSegments(getDailySentences(roundDay));
  return segments.map((segment, slotIndex) => {
    const catalog = segment.audioCategory === 'unlock1workbook'
      ? (catalogs && catalogs.workbook)
      : (catalogs && catalogs.textbook);
    const audioTask = (catalog || [])[segment.trackIndex] || {};
    const audioTaskId = String(audioTask.taskId || `${segment.audioCategory}-${segment.trackIndex + 1}`);
    const paragraphId = `${audioTaskId}-paragraph-${segment.paragraphIndex}`;
    const rangeText = segment.sentenceStartIndex === segment.sentenceEndIndex
      ? `第 ${segment.sentenceStartIndex} 句`
      : `第 ${segment.sentenceStartIndex}–${segment.sentenceEndIndex} 句`;
    return {
      category: 'speaking',
      taskId: `${paragraphId}-sentences-${segment.sentenceStartIndex}-${segment.sentenceEndIndex}`,
      audioCategory: segment.audioCategory,
      audioTaskId,
      paragraphId,
      paragraphIndex: segment.paragraphIndex,
      sentenceStartIndex: segment.sentenceStartIndex,
      sentenceEndIndex: segment.sentenceEndIndex,
      sentenceCount: segment.sentenceCount,
      wordCount: segment.wordCount,
      sentenceTaskIds: Array.from({ length: segment.sentenceCount }, (_, index) => `${paragraphId}-sentence-${segment.sentenceStartIndex + index}`),
      title: `${audioTask.title || `Unlock 1 音频 ${segment.trackIndex + 1}`} · 第 ${segment.paragraphIndex} 段 · ${rangeText}`,
      displayTitle: `${audioTask.title || `Unlock 1 音频 ${segment.trackIndex + 1}`} · 第 ${segment.paragraphIndex} 段 · ${rangeText}`,
      planSlotIndex: slotIndex + 1,
      planSlotCount: segments.length,
      planDayIndex: Number(planDayIndex || 0),
      roundDay,
      phase: segment.phase,
      repeatTarget: 1,
      durationSec: segment.phase === 'workbook'
        ? Math.max(45, segment.wordCount * 7)
        : Math.max(45, segment.sentenceCount * 35)
    };
  });
}

function buildPlanTasks(planDayIndex, catalogs) {
  const roundDay = getRoundDay(planDayIndex);
  if (roundDay < 1 || roundDay > CYCLE_DAYS) return [];
  return buildDailyTasks(roundDay, planDayIndex, catalogs);
}

module.exports = {
  CYCLE_DAYS,
  CURRICULUM_SENTENCES,
  DAILY_SENTENCE_COUNT,
  PLAN_STARTED_AT,
  ROUND_TWO_START_DAY,
  SENTENCES,
  TEXTBOOK_PARAGRAPHS,
  TEXTBOOK_SENTENCES,
  TOTAL_SENTENCES,
  TOTAL_WORDS,
  buildPlanTasks,
  getDailySentences,
  getRoundDay,
  getRoundDayForDate,
  partitionSentencesByWordCount,
  splitDayIntoParagraphSegments
};
