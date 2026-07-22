const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  analyzeOriginalIeltsParagraphLabels,
  buildReadingParagraphRanges
} = require('../utils/reading-paragraph-display');
const ieltsParagraphMetadata = require('../pages/reading/detail/ielts-paragraph-metadata');

const root = path.resolve(__dirname, '..');

test('无原始换段的中高考阅读会按句群拆成清晰段落', () => {
  const source = Array.from({ length: 9 }, (_, index) => `Sentence ${index + 1} explains one complete idea with enough detail for the reader to understand it clearly.`).join(' ');
  const ranges = buildReadingParagraphRanges('sh-em1-2020-test-reading-a', source);
  assert.ok(ranges.length >= 2);
  assert.equal(ranges[0].label, '第 1 段');
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[ranges.length - 1].end, source.length);
});

test('IELTS 优先保留原文 A-F 字母段标', () => {
  const source = ['Introduction text.', 'A First section.', 'B Second section.', 'C Third section.', 'D Fourth section.', 'E Fifth section.', 'F Sixth section.'].join('\n\n');
  const analysis = analyzeOriginalIeltsParagraphLabels(source);
  const ranges = buildReadingParagraphRanges('ielts-academic-demo', source);
  assert.equal(analysis.hasOriginalLabels, true);
  assert.deepEqual(analysis.labels, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(ranges.map((item) => item.label), ['Introduction', 'Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D', 'Paragraph E', 'Paragraph F']);
  assert.equal(ranges[1].hasOriginalSourceLabel, true);
});

test('IELTS 单独占行的 A-F 段标会与正文合并', () => {
  const source = ['A', 'First section opening.', 'First section continuation.', 'B', 'Second section.'].join('\n\n');
  const ranges = buildReadingParagraphRanges('ielts-academic-standalone-labels', source);
  assert.deepEqual(ranges.map((item) => item.label), ['Paragraph A', 'Paragraph B']);
  assert.deepEqual(ranges.map((item) => item.sourceLabelText), ['A', 'B']);
  assert.match(source.slice(ranges[0].contentStart, ranges[0].end), /^First section opening/);
});

test('IELTS Cambridge 10-21 原始分段符号统计稳定', () => {
  let total = 0;
  let naturalParagraphs = 0;
  let originalLetterLabels = 0;
  for (let book = 10; book <= 21; book += 1) {
    const file = path.join(root, `data/ielts-academic/cambridge-${book}/reading/v2/reading-passages.json`);
    JSON.parse(fs.readFileSync(file, 'utf8')).forEach((item) => {
      const analysis = analyzeOriginalIeltsParagraphLabels(item.passage);
      total += 1;
      if (analysis.naturalParagraphCount > 1) naturalParagraphs += 1;
      if (analysis.hasOriginalLabels) originalLetterLabels += 1;
    });
  }
  assert.equal(total, 144);
  assert.equal(naturalParagraphs, 144);
  assert.equal(originalLetterLabels, 54);
});

test('IELTS 144 篇在线上空行被压平后仍恢复原卷段落', () => {
  let restored = 0;
  for (let book = 10; book <= 21; book += 1) {
    const file = path.join(root, `data/ielts-academic/cambridge-${book}/reading/v2/reading-passages.json`);
    JSON.parse(fs.readFileSync(file, 'utf8')).forEach((item) => {
      const expected = buildReadingParagraphRanges(item._id, item.passage, item.questions);
      const flattened = item.passage.replace(/\s+/g, ' ');
      const actual = buildReadingParagraphRanges(item._id, flattened, item.questions, ieltsParagraphMetadata[item._id]);
      assert.deepEqual(actual.map((range) => range.label), expected.map((range) => range.label), item._id);
      assert.equal(actual[0].start, 0, item._id);
      assert.equal(actual[actual.length - 1].end, flattened.length, item._id);
      restored += 1;
    });
  }
  assert.equal(restored, 144);
});

test('题目声明 A-F 时，压平的灭绝物种文章不得显示数字段号', () => {
  const file = path.join(root, 'data/ielts-academic/cambridge-15/reading/v2/reading-passages.json');
  const item = JSON.parse(fs.readFileSync(file, 'utf8')).find((passage) => passage._id === 'ielts-academic-15-test-2-reading-passage-2');
  const flattened = item.passage.replace(/\s+/g, ' ');
  const ranges = buildReadingParagraphRanges(item._id, flattened, item.questions, ieltsParagraphMetadata[item._id]);
  assert.deepEqual(ranges.map((range) => range.label), ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D', 'Paragraph E', 'Paragraph F']);
});

test('初中和高中 934 篇阅读全部覆盖成完整段落', () => {
  const files = [
    'data/reading-em1/reading-passages.json',
    'data/reading/reading-passages.json',
    'data/reading-senior-spring/reading-passages.json',
    'data/reading-senior-autumn/reading-passages.json'
  ];
  let total = 0;
  files.forEach((relativePath) => {
    JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')).forEach((item) => {
      const ranges = buildReadingParagraphRanges(item._id, item.passage);
      total += 1;
      assert.ok(ranges.length >= 1, item._id);
      assert.equal(ranges[0].start, 0, item._id);
      assert.equal(ranges[ranges.length - 1].end, item.passage.length, item._id);
      ranges.slice(1).forEach((range, index) => assert.equal(ranges[index].end, range.start, item._id));
    });
  });
  assert.equal(total, 934);
});

test('普通阅读和文内填空都使用段落区块', () => {
  const template = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.match(template, /passageParagraphs/);
  assert.match(template, /passage\.clozePassageParagraphs/);
  assert.doesNotMatch(template, /passage\.clozePassageParts/);
  assert.match(template, /!paragraph\.hasOriginalSourceLabel/);
  assert.match(template, /passage-source-label/);
  assert.equal((template.match(/passage-source-label/g) || []).length, 6);
  assert.doesNotMatch(template, /passage-paragraph-content">\s*<text class="passage-source-label"/);
  assert.match(styles, /\.passage-paragraph-content\s*\{[^}]*display:\s*block/);
  assert.match(styles, /\.passage-paragraph-main\s*\{[^}]*width:\s*100%/);
});
