#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildReadingParagraphRanges } = require('../utils/reading-paragraph-display');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'pages', 'reading', 'detail', 'ielts-paragraph-metadata.js');
const metadata = {};

for (let book = 10; book <= 21; book += 1) {
  const file = path.join(ROOT, `data/ielts-academic/cambridge-${book}/reading/v2/reading-passages.json`);
  const passages = JSON.parse(fs.readFileSync(file, 'utf8'));
  passages.forEach((passage) => {
    const ranges = buildReadingParagraphRanges(passage._id, passage.passage, passage.questions);
    metadata[passage._id] = ranges.map((range) => [
      range.label,
      range.sourceLabel || '',
      passage.passage.slice(range.start, range.end).trim().split(/\s+/).slice(0, 10).join(' ')
    ]);
  });
}

fs.writeFileSync(OUTPUT, `module.exports=${JSON.stringify(metadata)};\n`);
console.log(JSON.stringify({ output: OUTPUT, passages: Object.keys(metadata).length }, null, 2));
