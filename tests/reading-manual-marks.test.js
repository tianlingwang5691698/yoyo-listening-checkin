const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  toggleWordMark,
  toggleSentenceMark,
  countReadingMarks,
  buildReadingMarkItems
} = require('../utils/reading-manual-marks');

const root = path.resolve(__dirname, '..');

let words = toggleWordMark({}, '12', 2);
assert.deepStrictEqual(words, { '12:2': 'word' });

words = toggleWordMark(words, '12', 3);
assert.deepStrictEqual(words, { '12:2': 'phrase', '12:3': 'phrase' });

words = toggleWordMark(words, '12', 5);
assert.deepStrictEqual(words, { '12:2': 'phrase', '12:3': 'phrase', '12:5': 'word' });

words = toggleWordMark(words, '12', 3);
assert.deepStrictEqual(words, { '12:2': 'word', '12:5': 'word' });

words = toggleWordMark(words, '30', 0);
assert.deepStrictEqual(words, { '12:2': 'word', '12:5': 'word', '30:0': 'word' });

let sentences = toggleSentenceMark({}, '12');
assert.deepStrictEqual(sentences, { 12: true });
sentences = toggleSentenceMark(sentences, '12');
assert.deepStrictEqual(sentences, {});
assert.strictEqual(countReadingMarks(words, { 12: true }), 4);

const markItems = buildReadingMarkItems(
  'Read this short sentence. Mark the next phrase.',
  { '0:0': 'word', '26:1': 'phrase', '26:2': 'phrase' },
  { 0: true }
);
assert.deepStrictEqual(markItems, [
  { type: 'sentence', text: 'Read this short sentence.' },
  { type: 'word', text: 'Read' },
  { type: 'phrase', text: 'the next' }
]);

const largeMarkMap = {};
for (let index = 0; index < 2000; index += 1) largeMarkMap[`${index}:0`] = 'word';
const performanceStart = process.hrtime.bigint();
const largeResult = toggleWordMark(largeMarkMap, '1000', 1);
const performanceMs = Number(process.hrtime.bigint() - performanceStart) / 1e6;
assert.strictEqual(largeResult['1000:0'], 'phrase');
assert.strictEqual(largeResult['1000:1'], 'phrase');
assert.ok(performanceMs < 30, `large reading mark toggle took ${performanceMs.toFixed(2)}ms`);

const pageSource = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');

assert.match(pageSource, /handleReadingTokenTap/);
assert.match(pageSource, /handleReadingSentenceLongPress/);
assert.match(pageSource, /clearReadingMarks/);
assert.match(pageSource, /manualMarks:[\s\S]*?buildReadingMarkItems/);
assert.doesNotMatch(pageSource, /handleReadingTokenTap[\s\S]*?vibrateShort[\s\S]*?handleReadingSentenceLongPress/);
assert.doesNotMatch(pageSource, /handleReadingSentenceLongPress[\s\S]*?vibrateShort[\s\S]*?clearReadingMarks/);
assert.match(template, /reading-mark-toolbar/);
assert.match(template, /reading-mark-sentence/);
assert.match(template, /reading-mark-' \+ readingTokenMarks/);
assert.match(template, /cloze-reading-token/);
assert.doesNotMatch(template, /data-mark-mode=/);
assert.match(styles, /\.reading-mark-word/);
assert.match(styles, /\.reading-mark-phrase/);
assert.match(styles, /\.reading-mark-sentence/);

console.log('reading manual marks regression passed');
