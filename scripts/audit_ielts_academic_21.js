#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', 'cambridge-21', 'page-performance-report.json');
const SCREENSHOT_DIR = path.join(ROOT, 'output', 'ielts-academic-21');
const PORT = Number(process.env.WECHAT_AUTOMATOR_PORT || 9420);
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await page.data();
    if (predicate(data)) return { data, ms: Date.now() - startedAt };
    await page.waitFor(50);
  }
  throw new Error(`page-data-timeout:${page.path}`);
}

async function relaunch(miniProgram, route) {
  const startedAt = Date.now();
  const expectedPath = String(route).split('?')[0].replace(/^\//, '');
  let page = await miniProgram.reLaunch(route);
  if (page.path !== expectedPath) {
    await page.waitFor(500);
    page = await miniProgram.reLaunch(route);
  }
  assert(page.path === expectedPath, `relaunch-route:${page.path}:${expectedPath}`);
  return { page, shellMs: Date.now() - startedAt };
}

async function screenshot(miniProgram, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const target = path.join(SCREENSHOT_DIR, `${name}.png`);
  await miniProgram.screenshot({ path: target });
  return target;
}

async function auditListening(miniProgram) {
  const expectedDurations = { 1: '31:15', 2: '29:36', 3: '29:56', 4: '28:14' };
  console.log('[ielts-audit] listening index');
  const index = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(index.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'ielts') || {}).count || 0) === 4);
  await index.page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'ielts' } } });
  await index.page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'cambridge21' } } });
  let data = await index.page.data();
  assert((data.districts || []).length === 4, 'listening-test-count');
  await index.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: 'Test 1' } } });
  data = await index.page.data();
  assert((data.items || []).length === 1, 'listening-test-1-item');
  const rounds = [];
  const testMeta = [];
  for (let test = 1; test <= 4; test += 1) {
    const itemId = `ielts-academic-21-test-${test}-listening`;
    for (let round = 1; round <= 3; round += 1) {
      console.log(`[ielts-audit] listening test ${test} round ${round}`);
      const detail = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
      const ready = await waitForData(detail.page, (current) => current.item && current.item._id === itemId && current.questions.length === 40 && !current.audioLoading);
      assert(ready.data.questions.filter((question) => question.sourceImages.length).length === 0, `listening-source-pages-test-${test}`);
      assert(ready.data.questions.every((question) => question.prompt && !/original paper|page above|refer to/i.test(question.prompt)), `listening-structured-prompts-test-${test}`);
      if (test === 1) {
        assert(ready.data.questions[0].showFormTitle === true, 'listening-first-form-title');
        assert(ready.data.questions.slice(1, 6).every((question) => question.showFormTitle === false), 'listening-repeated-form-title');
        assert(ready.data.questions.slice(0, 6).every((question) => !question.prompt.startsWith('Oyster Bay Sailing Club Courses')), 'listening-form-title-in-prompt');
      }
      const startedAt = Date.now();
      await detail.page.callMethod('toggleAudio');
      await waitForData(detail.page, (current) => current.isPlaying, 5000);
      const clickToPlayMs = Date.now() - startedAt;
      await detail.page.callMethod('toggleAudio');
      await detail.page.waitFor(250);
      assert(clickToPlayMs <= 500, `listening-play-test-${test}-round-${round}:${clickToPlayMs}`);
      rounds.push({ test, round, shellMs: detail.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
      if (round === 1) {
        assert(ready.data.audioDurationText === expectedDurations[test], `listening-duration-test-${test}:${ready.data.audioDurationText}`);
        testMeta.push({ test, durationText: ready.data.audioDurationText, transcript: !!ready.data.item.transcript });
      }
    }
  }
  return { shellMs: index.shellMs, indexReadyMs: indexReady.ms, rounds, testMeta };
}

async function auditWriting(miniProgram) {
  console.log('[ielts-audit] writing');
  const index = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(index.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'ielts') || {}).count || 0) === 8);
  await index.page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'ielts' } } });
  await index.page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'cambridge21' } } });
  await index.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: 'Test 1' } } });
  const data = await index.page.data();
  assert((data.items || []).map((item) => item.materialItemId).join(',') === 'ielts-academic-21-test-1-writing-task-1,ielts-academic-21-test-1-writing-task-2', 'writing-task-order');
  const detail = await relaunch(miniProgram, '/pages/writing/detail/index?id=ielts-academic-21-test-2-writing-task-1');
  const detailReady = await waitForData(detail.page, (current) => current.prompt && current.prompt._id === 'ielts-academic-21-test-2-writing-task-1' && current.promptImages.length === 1 && current.promptImages[0].src);
  assert(detailReady.data.prompt.minWords === 150, 'writing-task-1-word-count');
  assert(detailReady.data.prompt.contentRevision === 3, 'writing-task-1-revision');
  assert(detailReady.data.promptImages[0].cloudPath.includes('/writing/visuals-v3/'), 'writing-task-1-cropped-visual');
  const pageScreenshot = await screenshot(miniProgram, 'writing-test-2-task-1-hd');
  await detail.page.callMethod('previewPromptImage', { currentTarget: { dataset: { src: detailReady.data.promptImages[0].src } } });
  await detail.page.waitFor(300);
  return { shellMs: index.shellMs, indexReadyMs: ready.ms, detailReadyMs: detailReady.ms, screenshot: pageScreenshot, previewInvoked: true };
}

async function auditReading(miniProgram) {
  console.log('[ielts-audit] reading');
  const index = await relaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(index.page, (data) => Number(((data.categoryRoot || {}).stages || []).find((item) => item.key === 'ielts')?.count || 0) === 12);
  await index.page.callMethod('selectStage', { currentTarget: { dataset: { stage: 'ielts' } } });
  await index.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: 'IELTS Academic' } } });
  const data = await index.page.data();
  assert((data.selectedGroup.districts || []).length === 4, 'reading-test-count');
  const test1 = data.selectedGroup.districts.find((item) => item.key === 'ielts-academic-21-test-1');
  assert(test1 && test1.passages.length === 3, 'reading-test-1-passages');
  const detail = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=ielts-academic-21-test-1-reading-passage-1');
  const detailReady = await waitForData(detail.page, (current) => current.passage && current.passage._id === 'ielts-academic-21-test-1-reading-passage-1' && current.passage.questions.length === 13);
  assert(detailReady.data.passage.images.length === 0, 'reading-passage-pages');
  assert(detailReady.data.passage.passage.length > 4000, 'reading-structured-passage');
  assert(detailReady.data.passage.questions.every((question) => question.prompt && !/original paper|page above|refer to/i.test(question.prompt)), 'reading-structured-questions');
  assert(detailReady.data.passage.questions[0].showGroupHeader === true, 'reading-first-group-header');
  assert(detailReady.data.passage.questions[1].showGroupHeader === false, 'reading-repeated-group-header');
  assert(detailReady.data.passage.questions[0].showNoteHeading === true && detailReady.data.passage.questions[0].noteHeading === 'Family and early life', 'reading-first-note-heading');
  assert(detailReady.data.passage.questions[1].showNoteHeading === false, 'reading-repeated-note-heading');
  assert(detailReady.data.passage.questions[3].showNoteHeading === true && detailReady.data.passage.questions[3].noteHeading === 'The sisters as art collectors', 'reading-next-note-heading');
  return { shellMs: index.shellMs, indexReadyMs: ready.ms, detailReadyMs: detailReady.ms, screenshot: await screenshot(miniProgram, 'reading-test-1-passage-1') };
}

async function auditSpeaking(miniProgram) {
  console.log('[ielts-audit] speaking');
  const launched = await relaunch(miniProgram, '/pages/speaking/index');
  await waitForData(launched.page, (data) => data.viewMode === 'home');
  await launched.page.callMethod('openIeltsSpeaking');
  const indexReady = await waitForData(launched.page, (data) => data.ieltsTests.length === 4 && data.ieltsExpanded);
  await launched.page.callMethod('selectIeltsTest', { currentTarget: { dataset: { itemId: 'ielts-academic-21-test-1-speaking' } } });
  const detailReady = await waitForData(launched.page, (data) => data.ieltsMode && data.exercises.length === 11 && data.ieltsSourceImages.length === 1);
  assert(new Set(detailReady.data.exercises.map((item) => item.part)).size === 3, 'speaking-parts');
  return { shellMs: launched.shellMs, indexReadyMs: indexReady.ms, detailReadyMs: detailReady.ms, screenshot: await screenshot(miniProgram, 'speaking-test-1') };
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: PORT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      ['readingHomeSnapshotV7', 'readingHomeSnapshotV8', 'materialHomeSnapshotV4', 'materialHomeSnapshotV5', 'currentListeningSetV1', 'currentListeningSetV2', 'currentWritingPromptV2', 'currentWritingPromptV3', 'currentWritingPromptV4', 'readingPassageSnapshotV1', 'readingPassageSnapshotV2'].forEach((key) => wx.removeStorageSync(key));
      const cacheKeys = wx.getStorageSync('yoyoCloudReadCacheKeysV4') || [];
      const keptKeys = cacheKeys.filter((key) => !String(key).includes(':getReadingHome:') && !String(key).includes(':getMaterialIndex:') && !String(key).includes(':getMaterialItem:'));
      cacheKeys.filter((key) => !keptKeys.includes(key)).forEach((key) => wx.removeStorageSync(key));
      wx.setStorageSync('yoyoCloudReadCacheKeysV4', keptKeys);
    });
    const report = {
      passed: false,
      checkedAt: new Date().toISOString(),
      listening: await auditListening(miniProgram),
      writing: await auditWriting(miniProgram),
      reading: await auditReading(miniProgram),
      speaking: await auditSpeaking(miniProgram),
      threshold: { clickToPlayMs: 500 },
      exceptions
    };
    report.maxClickToPlayMs = Math.max(...report.listening.rounds.map((item) => item.clickToPlayMs));
    report.passed = !exceptions.length && report.maxClickToPlayMs <= report.threshold.clickToPlayMs;
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
