#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  analyzeOriginalIeltsParagraphLabels,
  buildReadingParagraphRanges
} = require('../utils/reading-paragraph-display');
const ieltsParagraphMetadata = require('../pages/reading/detail/ielts-paragraph-metadata');

const ROOT = path.resolve(__dirname, '..');
const GROUPS = [
  { key: 'junior-em1', file: 'data/reading-em1/reading-passages.json' },
  { key: 'junior-em2', file: 'data/reading/reading-passages.json' },
  { key: 'senior-spring', file: 'data/reading-senior-spring/reading-passages.json' },
  { key: 'senior-autumn', file: 'data/reading-senior-autumn/reading-passages.json' }
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function assertCoverage(item, ranges) {
  if (!ranges.length || ranges[0].start !== 0 || ranges[ranges.length - 1].end !== item.passage.length) {
    throw new Error(`paragraph-coverage:${item._id}`);
  }
  ranges.forEach((range, index) => {
    if (range.end <= range.start || (index && ranges[index - 1].end !== range.start)) {
      throw new Error(`paragraph-range:${item._id}:${index}`);
    }
  });
}

const POLLUTION_PATTERNS = {
  directions: /^\s*Directions\b/i,
  sectionHeading: /^\s*(?:(?:[IVX]+|[Ⅰ-Ⅹ])\.?\s*)?(?:Reading Comprehension|Grammar and Vocabulary|Section\s+[A-D])\b/i,
  questionDirections: /^\s*(?:answer\b|根据(?:短文|文章|对话|以下)内容|[A-D][.、)]\s*(?:Choose|Read|Answer)\b)/i,
  scorePrefix: /^\s*(?:\d+\s*[.．、]\s*)?[（(][^）)]*分[^）)]*[）)]/,
  pageWatermark: /(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?/i
};

const report = { passed: true, groups: {}, ielts: { total: 0, naturalParagraphs: 0, originalLetterLabels: 0, questionDeclaredLabels: 0, questionDeclaredRestored: 0, flattenedRestored: 0, byBook: {} } };

GROUPS.forEach((group) => {
  const items = readJson(group.file);
  const pollution = Object.fromEntries(Object.keys(POLLUTION_PATTERNS).map((key) => [key, []]));
  let structured = 0;
  const counts = items.map((item) => {
    Object.entries(POLLUTION_PATTERNS).forEach(([key, regex]) => {
      if (regex.test(String(item.passage || ''))) pollution[key].push(item._id);
    });
    if (item.dataFormat === 'reading-structured-v1') {
      structured += 1;
      if (!Array.isArray(item.passageParagraphs) || !item.passageParagraphs.length) {
        throw new Error(`structured-paragraphs:${item._id}`);
      }
      if (item.passageParagraphs.join('\n\n') !== item.passage) {
        throw new Error(`structured-passage-mismatch:${item._id}`);
      }
      ['directions', 'sectionHeading', 'articleTitle', 'articleSubtitle'].forEach((key) => {
        if (typeof item[key] !== 'string') throw new Error(`structured-field:${item._id}:${key}`);
      });
    }
    const ranges = buildReadingParagraphRanges(item._id, item.passage, item.questions);
    assertCoverage(item, ranges);
    return ranges.length;
  });
  Object.entries(pollution).forEach(([key, ids]) => {
    if (ids.length) throw new Error(`reading-pollution:${group.key}:${key}:${ids.join(',')}`);
  });
  report.groups[group.key] = {
    passages: items.length,
    structured,
    pollution: Object.fromEntries(Object.keys(pollution).map((key) => [key, 0])),
    minParagraphs: Math.min(...counts),
    maxParagraphs: Math.max(...counts),
    averageParagraphs: Number((counts.reduce((sum, count) => sum + count, 0) / counts.length).toFixed(2))
  };
});

for (let book = 10; book <= 21; book += 1) {
  const items = readJson(`data/ielts-academic/cambridge-${book}/reading/v2/reading-passages.json`);
  let originalLetterLabels = 0;
  items.forEach((item) => {
    const analysis = analyzeOriginalIeltsParagraphLabels(item.passage);
    const ranges = buildReadingParagraphRanges(item._id, item.passage, item.questions);
    const flattened = item.passage.replace(/\s+/g, ' ');
    const restoredRanges = buildReadingParagraphRanges(item._id, flattened, item.questions, ieltsParagraphMetadata[item._id]);
    const instructions = (item.questions || []).map((question) => question.groupInstruction || '').join(' ');
    const declaredMatch = instructions.match(/paragraphs?\s*,?\s*A\s*[-–—]\s*([B-Z])/i);
    assertCoverage(item, ranges);
    if (restoredRanges.map((range) => range.label).join('|') !== ranges.map((range) => range.label).join('|')) {
      throw new Error(`flattened-labels:${item._id}`);
    }
    report.ielts.flattenedRestored += 1;
    if (declaredMatch) {
      report.ielts.questionDeclaredLabels += 1;
      const finalLabel = `Paragraph ${declaredMatch[1].toUpperCase()}`;
      if (!restoredRanges.some((range) => range.label === 'Paragraph A') || !restoredRanges.some((range) => range.label === finalLabel)) {
        throw new Error(`question-declared-labels:${item._id}`);
      }
      report.ielts.questionDeclaredRestored += 1;
    }
    report.ielts.total += 1;
    if (analysis.naturalParagraphCount > 1) report.ielts.naturalParagraphs += 1;
    if (analysis.hasOriginalLabels) {
      originalLetterLabels += 1;
      report.ielts.originalLetterLabels += 1;
      if (!ranges.some((range) => range.label === 'Paragraph A') || !ranges.some((range) => range.label === 'Paragraph B')) {
        throw new Error(`original-label-display:${item._id}`);
      }
    }
  });
  report.ielts.byBook[`Cambridge ${book}`] = originalLetterLabels;
}

console.log(JSON.stringify(report, null, 2));
