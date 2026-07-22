const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('家长从学生卡片直达所选学生的阅读做题记录', () => {
  const familySource = read('pages/family/index.js');
  const familyTemplate = read('pages/family/index.wxml');
  const entryBlock = familySource.match(/openStudentPracticeHistory\(event\) \{[\s\S]*?\n  \},/);
  assert.ok(entryBlock);
  assert.match(entryBlock[0], /setSelectedStudentTarget\(target\)/);
  assert.match(entryBlock[0], /setLastParentStudentTarget\(target\)/);
  assert.match(entryBlock[0], /practice-history\/index\?type=reading&parentView=1/);
  assert.equal((familyTemplate.match(/catchtap="openStudentPracticeHistory"/g) || []).length, 2);
});

test('家长记录页只读且学生标记随阅读记录展示', () => {
  const historySource = read('pages/practice-history/index.js');
  const historyTemplate = read('pages/practice-history/index.wxml');
  const readingSource = read('pages/reading/detail/index.js');
  const readingService = read('cloudfunctions/yoyo/services/reading.service.js');
  assert.match(historySource, /getDeviceStudyRole\(\) === 'parent'/);
  assert.match(historySource, /if \(this\.data\.isParentView\) return;/);
  assert.match(historyTemplate, /parentReadOnly/);
  assert.equal((historyTemplate.match(/!isParentView && !question\.correct/g) || []).length, 2);
  assert.match(readingSource, /manualMarks:[\s\S]*?tokenMarks:[\s\S]*?sentenceMarks:[\s\S]*?items:/);
  assert.match(readingService, /manualMarks,[\s\S]*?score: grade\.score/);
  assert.match(historySource, /manualMarkItems: \(attempt\.manualMarks/);
  assert.match(historyTemplate, /history-manual-marks/);
});
