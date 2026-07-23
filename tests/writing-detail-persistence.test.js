const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('写作详情重进后恢复本身份最近作文、批改状态和结果', () => {
  const page = read('pages/writing/detail/index.js');
  assert.match(page, /WRITING_SESSION_STORAGE_PREFIX = 'writingDetailSessionV1'/);
  assert.match(page, /getWritingSessionStorageKey[\s\S]*?getSelectedStudentTarget[\s\S]*?getDeviceStudyRole/);
  assert.match(page, /restoreLatestWritingAttempt[\s\S]*?getWritingAttempts\(\{[\s\S]*?promptId,[\s\S]*?forceRefresh: true/);
  assert.match(page, /role === 'parent' \? attempt && attempt\.isPreview : attempt && !attempt\.isPreview/);
  assert.match(page, /applyRestoredWritingAttempt[\s\S]*?essayText,[\s\S]*?submittedEssayText,[\s\S]*?currentAttemptId:[\s\S]*?review/);
  assert.match(page, /scheduleWritingResultPoll\(attemptId, prompt, attempt, 500\)/);
  assert.match(page, /onUnload\(\)[\s\S]*?saveWritingSession/);
});

test('同一篇作文批改中或未修改时禁止再次提交', () => {
  const page = read('pages/writing/detail/index.js');
  const template = read('pages/writing/detail/index.wxml');
  assert.match(page, /if \(this\.writingSubmitInFlight \|\| this\.data\.submitting\) return/);
  assert.match(page, /if \(this\.data\.grading\)[\s\S]*?正在批改/);
  assert.match(page, /function normalizeEssayIdentityText[\s\S]*?replace\(\/\\s\+\/g, ' '\)\.trim\(\)/);
  assert.match(page, /this\.data\.currentAttemptId && !hasEssayContentChanged\(essay, this\.data\.submittedEssayText\)/);
  assert.match(page, /essayDirty && this\.data\.currentAttemptId[\s\S]*?内容已修改，需重新批改/);
  assert.equal((template.match(/disabled="\{\{restoringAttempt \|\| submitting \|\| submitLocked\}\}"/g) || []).length, 2);
  assert.equal((template.match(/disabled="\{\{restoringAttempt \|\| grading \|\| submitting\}\}"/g) || []).length, 2);
});

test('云端复用当前评分版本的同题同文任务', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  assert.match(service, /async function findReusableWritingAttempt/);
  assert.match(service, /\['grading-pending', 'grading', 'grading-failed', 'graded'\]\.includes\(item\.status\)/);
  assert.match(service, /const reusableAttempt = await findReusableWritingAttempt/);
  assert.match(service, /reusedAttempt: true/);
  assert.match(service, /async function getWritingAttemptDetail[\s\S]*?resumable: shouldResume/);
  assert.doesNotMatch(
    service.match(/async function getWritingAttemptDetail[\s\S]*?\n}\n\nmodule\.exports/)[0],
    /gradeWritingAttempt\(/
  );
});
