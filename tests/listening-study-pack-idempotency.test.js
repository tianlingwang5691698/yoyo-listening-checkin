const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('听力学习包在前端、云端和日报三层幂等', () => {
  const lesson = fs.readFileSync(path.join(root, 'pages/lesson/index.js'), 'utf8');
  const completion = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/completion.service.js'), 'utf8');
  const listening = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/listening.service.js'), 'utf8');
  const report = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/lib/report-engine.js'), 'utf8');
  const record = fs.readFileSync(path.join(root, 'pages/record/index.js'), 'utf8');
  const repair = fs.readFileSync(path.join(root, 'scripts/repair_duplicate_study_completions.js'), 'utf8');

  assert.match(lesson, /lessonStudyCompletionRecordKeys/);
  assert.match(lesson, /result && result\.generating/);
  assert.match(lesson, /cacheOnly: true, useCache: false/);
  assert.match(completion, /buildCompletionDocumentId\(recordId\)/);
  assert.doesNotMatch(completion, /collection\(COLLECTION\)\.add/);
  assert.match(listening, /runTransaction/);
  assert.match(listening, /modelCallCount/);
  assert.match(listening, /modelUsage/);
  assert.match(report, /dedupeCompletionItems/);
  assert.doesNotMatch(record, /getStudyCompletions|dedupeCompletionItems/);
  assert.match(repair, /completionRowsToDelete/);
  assert.match(repair, /rebuildAffectedReports/);
});
