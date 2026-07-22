const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'pages/reading/flashcards/index.js'), 'utf8');

test('家长试背无到期词时按计划数重新取词', () => {
  assert.match(source, /function buildPreviewReviewQueue[\s\S]*?if \(dueCards\.length\) return dueCards;[\s\S]*?rows\.slice/);
  assert.match(source, /previewMode[\s\S]*?buildPreviewReviewQueue\(this\.getFlashcardLibrary\(\), this\.data\.settings, this\.data\.today\)/);
});

test('家长试背仍保留快照恢复且不写学生进度', () => {
  assert.match(source, /if \(previewMode\) \{[\s\S]*?this\.previewSourceSnapshot/);
  assert.match(source, /if \(this\.data\.previewMode \|\| !current/);
  assert.match(source, /if \(this\.data\.previewMode && this\.previewSourceSnapshot\)/);
});
