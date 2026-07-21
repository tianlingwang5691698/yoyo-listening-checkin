const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { stripRepeatedFormTitle, stripRepeatedQuestionTitles } = require('../utils/listening-question-display');

test('IELTS 听力表格标题只显示一次且不重复进入题干', () => {
  assert.equal(
    stripRepeatedFormTitle(
      'Oyster Bay Sailing Club Courses Name of course: Level 1 What you learn: basic theory',
      'Oyster Bay Sailing Club Courses'
    ),
    'Name of course: Level 1 What you learn: basic theory'
  );
  assert.equal(stripRepeatedFormTitle('General information Bring suitable clothing', 'General information'), 'Bring suitable clothing');
  assert.equal(stripRepeatedFormTitle('Which TWO benefits are mentioned?', ''), 'Which TWO benefits are mentioned?');
  assert.equal(
    stripRepeatedQuestionTitles(
      'Which TWO things does the speaker say about visiting the football stadium with children?',
      '',
      'Which TWO things does the speaker say about visiting the football stadium with children?'
    ),
    ''
  );
  assert.equal(stripRepeatedQuestionTitles('Stoicism is still relevant today.', '', 'Stoicism'), 'Stoicism is still relevant today.');

  const pageSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'material', 'detail', 'index.js'), 'utf8');
  const templateSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'material', 'detail', 'index.wxml'), 'utf8');
  assert.match(pageSource, /showFormTitle = !!formTitle && formTitle !== lastFormTitle/);
  assert.match(templateSource, /item\.showFormTitle \|\| item\.givenRows\.length/);
});
