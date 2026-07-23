const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('写作提交先快速落库，再由独立长时调用完成批改', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  const completion = read('cloudfunctions/yoyo/services/completion.service.js');
  const submitBlock = service.match(/async function submitWritingAttempt[\s\S]*?\n}\n\nasync function gradeWritingAttempt/)[0];
  assert.doesNotMatch(submitBlock, /await gradeWritingAttempt/);
  assert.doesNotMatch(submitBlock, /await gradeWriting\(prompt, essay\)/);
  assert.match(submitBlock, /PREVIEW_COLLECTION[\s\S]*?previewDocumentId[\s\S]*?pending: true/);
  assert.match(submitBlock, /attempt: savedAttempt,[\s\S]*?pending: true,[\s\S]*?resumable: true/);
  assert.match(service, /async function gradeWritingAttempt[\s\S]*?review: command\.set\(review\)[\s\S]*?saveWritingCompletion/);
  assert.match(service, /const WRITING_GRADING_STALE_MS = 330000/);
  assert.match(service, /const shouldResume = \['grading-pending', 'grading-failed'\][\s\S]*?gradingAgeMs > WRITING_GRADING_STALE_MS/);
  assert.match(service, /gradeError: command\.remove\(\)/);
  assert.match(completion, /const documentId = current && current\._id[\s\S]*?\.doc\(documentId\)\.set/);
  assert.match(service, /saveWritingCompletion[\s\S]*?upsertStudyCompletion[\s\S]*?upsertDailyReport/);
  assert.match(service, /writing-completion-sync-failed/);
});

test('写作批改使用独立配置并固定 gpt-5.6-terra', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  assert.match(service, /endpoint: process\.env\.WRITING_SCORE_ENDPOINT \|\| ''/);
  assert.match(service, /apiKey: process\.env\.WRITING_SCORE_API_KEY \|\| ''/);
  assert.match(service, /model: process\.env\.WRITING_SCORE_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.doesNotMatch(service, /WRITING_SCORE_(?:ENDPOINT|API_KEY|MODEL)[^\n]*READING_STUDY/);
  assert.doesNotMatch(service, /WRITING_SCORE_FALLBACK_MODEL|fallbackModel/);
});

test('内容评分与学习解析运行时默认统一使用 gpt-5.6-terra', () => {
  const reading = read('cloudfunctions/yoyo/services/reading.service.js');
  const listening = read('cloudfunctions/yoyo/services/listening.service.js');
  const grammar = read('cloudfunctions/yoyo/services/grammar.service.js');
  const speaking = read('cloudfunctions/yoyo/lib/speaking-engine.js');
  assert.match(reading, /READING_STUDY_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(reading, /READING_STUDY_FALLBACK_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(listening, /READING_STUDY_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(grammar, /GRAMMAR_EXPLAIN_MODEL \|\| process\.env\.READING_STUDY_MODEL \|\| 'gpt-5\.6-terra'/);
  assert.match(speaking, /SPEAKING_SCORE_PREFERRED_MODEL'\]\) \|\| 'gpt-5\.6-terra'/);
});

test('阅读提交先保存解析，记录页缺失时自动续接', () => {
  const service = read('cloudfunctions/yoyo/services/reading.service.js');
  const history = read('pages/practice-history/index.js');
  const parent = read('pages/parent/detail/index.js');
  assert.match(service, /async function submitReadingAttempt[\s\S]*?await getOrCreateStudyPack\(passage, cached, false\)[\s\S]*?review: command\.set\(review\)/);
  assert.match(history, /section: 'questions',[\s\S]*?cacheOnly: false,[\s\S]*?attemptId/);
  assert.match(parent, /getReadingStudyPack\(\{ passageId: item\.passageId, section: 'questions', cacheOnly: false, attemptId/);
});

test('语法和写作完成记录会自动补齐云端结果', () => {
  const store = read('utils/store.js');
  const history = read('pages/practice-history/index.js');
  const parent = read('pages/parent/detail/index.js');
  assert.match(history, /resumeGrammarAnalyses\(record\.id, detailQuestions\)/);
  assert.match(history, /store\.explainGrammarQuestion\([\s\S]*?\{ cacheOnly: false \}\)/);
  assert.match(store, /async function getWritingAttempts[\s\S]*?forceRefresh[\s\S]*?useCache: !forceRefresh/);
  assert.match(history, /getWritingAttempts\(\{ limit: 50, summaryOnly: true, forceRefresh: true \}\)/);
  assert.match(history, /resumePendingWritingAttempts\(records\)/);
  assert.match(history, /filter\(\(record\) => isWritingGradingPending\(record\.attempt\)\)[\s\S]*?resumeWritingAttempt/);
  assert.match(history, /syncMode === 'cloud-error'[\s\S]*?writingResumeTimers[\s\S]*?resumeWritingAttempt/);
  assert.match(history, /writingResumeTimers[\s\S]*?this\.loadWritingDetail/);
  assert.match(parent, /store\.explainGrammarQuestion\(question, \{ cacheOnly: false \}\)/);
  assert.match(parent, /needsReview \? await store\.getWritingAttemptDetail\(attemptId\)/);
});

test('家长预览断线后轮询独立任务且不写学生本地完成记录', () => {
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  const page = read('pages/writing/detail/index.js');
  const history = read('pages/practice-history/index.js');
  const shared = read('cloudfunctions/yoyo/services/shared.service.js');

  assert.match(service, /const PREVIEW_COLLECTION = 'writingPreviewAttempts'/);
  assert.match(service, /previewPromise[\s\S]*?PREVIEW_COLLECTION[\s\S]*?isPreview: true/);
  assert.match(service, /if \(!isPreview\) \{[\s\S]*?saveWritingCompletion/);
  assert.match(shared, /'writingPreviewAttempts'/);
  assert.match(page, /continueWritingResultPolling[\s\S]*?scheduleWritingResultPoll/);
  assert.match(page, /getWritingAttemptDetail\(attemptId\)/);
  assert.match(page, /onShow\(\)[\s\S]*?writingPageActive = true[\s\S]*?scheduleWritingResultPoll/);
  assert.match(page, /if \(!attempt\.isPreview\) \{[\s\S]*?completed\.addCompletedItem/);
  assert.match(history, /attempt\.isPreview[\s\S]*?家长预览/);
});
