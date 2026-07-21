const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { splitReadingNotePrompt, formatReadingQuestionRange } = require('../utils/reading-question-display');

test('IELTS 阅读题组说明和笔记小标题只显示一次', () => {
  assert.deepEqual(
    splitReadingNotePrompt(
      "Family and early life: their grandfather's wealth came from ______ and transportation businesses",
      'Complete the notes below. Choose ONE WORD ONLY.'
    ),
    {
      heading: 'Family and early life',
      prompt: "their grandfather's wealth came from ______ and transportation businesses"
    }
  );
  assert.deepEqual(
    splitReadingNotePrompt('Animal: has a long tail', 'Complete the table below.'),
    { heading: '', prompt: 'Animal: has a long tail' }
  );
  assert.equal(formatReadingQuestionRange('questions-1-7'), 'Questions 1-7');

  const pageSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'reading', 'detail', 'index.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'reading', 'index.js'), 'utf8');
  const templateSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'reading', 'detail', 'index.wxml'), 'utf8');
  assert.match(pageSource, /showGroupHeader = !!groupKey && groupKey !== lastGroupKey/);
  assert.match(pageSource, /showNoteHeading = !!promptDisplay\.heading && promptDisplay\.heading !== lastNoteHeading/);
  assert.match(templateSource, /item\.showGroupHeader/);
  assert.match(templateSource, /item\.showNoteHeading/);
  assert.match(indexSource, /stageKey === 'ielts' \? 'Cambridge IELTS 10–21'/);
  assert.doesNotMatch(indexSource, /meta: stageGroups\.map\(\(group\) => group\.label\)\.join\('、'\),/);
});
