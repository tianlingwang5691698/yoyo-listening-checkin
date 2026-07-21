#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', 'page-performance-10-21.json');
const SCREENSHOT_DIR = path.join(ROOT, 'output', 'ielts-academic-10-21');
const PORT = Number(process.env.WECHAT_AUTOMATOR_PORT || 9421);
const BOOKS = [21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const NEW_BOOKS = [15, 14, 13, 12, 11, 10];
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

function assertBookOrder(rows, readBook) {
  assert(rows.map(readBook).join(',') === BOOKS.join(','), `book-order:${rows.map(readBook).join(',')}`);
}

function assertSharedTitles(questions, book) {
  const seen = new Set();
  questions.forEach((question) => {
    const title = String(question.formTitle || '').trim();
    if (!title) return;
    assert(question.showFormTitle === !seen.has(title), `shared-title-${book}-${question.number}`);
    seen.add(title);
  });
}

function firstTestNumber(book) {
  return book === 12 ? 5 : 1;
}

async function auditMaterialIndex(miniProgram, moduleId, expectedCount, itemsPerBook) {
  const launched = await relaunch(miniProgram, `/pages/material/index?module=${moduleId}`);
  const ready = await waitForData(launched.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'ielts') || {}).count || 0) === expectedCount);
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'ielts' } } });
  const data = await launched.page.data();
  assertBookOrder(data.exams || [], (item) => Number(String(item.examId || '').replace('cambridge', '')));
  assert((data.exams || []).every((item) => item.count === itemsPerBook), `${moduleId}-items-per-book`);
  return { page: launched.page, shellMs: launched.shellMs, readyMs: ready.ms };
}

async function auditListening(miniProgram) {
  const index = await auditMaterialIndex(miniProgram, 'listening', 48, 4);
  const rounds = [];
  for (const book of NEW_BOOKS) {
    const test = firstTestNumber(book);
    const itemId = `ielts-academic-${book}-test-${test}-listening`;
    for (let round = 1; round <= 3; round += 1) {
      const detail = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
      const ready = await waitForData(detail.page, (data) => data.item && data.item._id === itemId && data.questions.length === 40 && !data.audioLoading);
      assert(ready.data.audioDurationText !== '00:00', `listening-duration-${book}`);
      assertSharedTitles(ready.data.questions, book);
      const startedAt = Date.now();
      await detail.page.callMethod('toggleAudio');
      await waitForData(detail.page, (data) => data.isPlaying, 5000);
      const clickToPlayMs = Date.now() - startedAt;
      await detail.page.callMethod('toggleAudio');
      assert(clickToPlayMs <= 500, `listening-play-${book}-${round}:${clickToPlayMs}`);
      rounds.push({ book, round, shellMs: detail.shellMs, detailReadyMs: ready.ms, clickToPlayMs, durationText: ready.data.audioDurationText });
      if (book === 15 && round === 1) await screenshot(miniProgram, 'listening-15-test-1');
    }
  }
  return { shellMs: index.shellMs, indexReadyMs: index.readyMs, rounds };
}

async function auditWriting(miniProgram) {
  const index = await auditMaterialIndex(miniProgram, 'writing', 96, 8);
  const details = [];
  for (const book of NEW_BOOKS) {
    const test = firstTestNumber(book);
    const itemId = `ielts-academic-${book}-test-${test}-writing-task-1`;
    const detail = await relaunch(miniProgram, `/pages/writing/detail/index?id=${itemId}`);
    const ready = await waitForData(detail.page, (data) => data.prompt && data.prompt._id === itemId && data.promptImages.length === 1 && data.promptImages[0].src);
    assert(Number(ready.data.prompt.minWords) === 150, `writing-min-words-${book}`);
    details.push({ book, shellMs: detail.shellMs, detailReadyMs: ready.ms, cloudPath: ready.data.promptImages[0].cloudPath });
    if (book === 15) {
      await screenshot(miniProgram, 'writing-15-test-1-task-1');
      await detail.page.callMethod('previewPromptImage', { currentTarget: { dataset: { src: ready.data.promptImages[0].src } } });
      await detail.page.waitFor(300);
    }
  }
  return { shellMs: index.shellMs, indexReadyMs: index.readyMs, details, previewInvoked: true };
}

async function auditReading(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => Number(((data.categoryRoot || {}).stages || []).find((item) => item.key === 'ielts')?.count || 0) === 144);
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stage: 'ielts' } } });
  const data = await launched.page.data();
  assertBookOrder(data.selectedStageNode.groups || [], (item) => item.key === 'IELTS Academic' ? 21 : Number(String(item.key || '').match(/(\d+)$/)?.[1] || 0));
  assert((data.selectedStageNode.groups || []).every((item) => item.count === 12), 'reading-passages-per-book');
  const details = [];
  for (const book of NEW_BOOKS) {
    const test = firstTestNumber(book);
    const itemId = `ielts-academic-${book}-test-${test}-reading-passage-1`;
    const detail = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${itemId}`);
    const detailReady = await waitForData(detail.page, (current) => current.passage && current.passage._id === itemId && current.passage.questions.length >= 13);
    assert(String(detailReady.data.passage.passage || '').length >= 1000, `reading-passage-${book}`);
    assert(detailReady.data.passage.questions[0].showGroupHeader === true, `reading-group-header-${book}`);
    details.push({ book, shellMs: detail.shellMs, detailReadyMs: detailReady.ms, questionCount: detailReady.data.passage.questions.length });
    if (book === 15) await screenshot(miniProgram, 'reading-15-test-1-passage-1');
  }
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, details };
}

async function auditSpeaking(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/speaking/index');
  await waitForData(launched.page, (data) => data.viewMode === 'home');
  await launched.page.callMethod('openIeltsSpeaking');
  const ready = await waitForData(launched.page, (data) => data.ieltsExpanded && data.ieltsTests.length === 48);
  const headers = ready.data.ieltsTests.filter((item) => item.showBookHeader);
  assertBookOrder(headers, (item) => item.bookNumber);
  assert(headers.every((item) => item.bookLabel === `Cambridge IELTS ${item.bookNumber}`), 'speaking-book-labels');
  const details = [];
  for (const book of NEW_BOOKS) {
    const test = firstTestNumber(book);
    const itemId = `ielts-academic-${book}-test-${test}-speaking`;
    await launched.page.callMethod('selectIeltsTest', { currentTarget: { dataset: { itemId } } });
    const detailReady = await waitForData(launched.page, (data) => data.ieltsMode && !data.ieltsLoading && data.exercises.some((item) => String(item.id).includes(`academic-${book}-`)));
    assert([1, 2, 3].every((part) => detailReady.data.exercises.some((item) => item.part === part)), `speaking-parts-${book}`);
    details.push({ book, detailReadyMs: detailReady.ms, exerciseCount: detailReady.data.exercises.length });
    await launched.page.callMethod('backToSpeakingHome');
    await waitForData(launched.page, (data) => data.ieltsExpanded && data.ieltsTests.length === 48);
  }
  await screenshot(miniProgram, 'speaking-books-21-10');
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, details };
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: PORT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      ['readingHomeSnapshotV7', 'readingHomeSnapshotV8', 'materialHomeSnapshotV4', 'materialHomeSnapshotV5', 'materialHomeSnapshotV6', 'currentListeningSetV1', 'currentListeningSetV2', 'currentWritingPromptV2', 'currentWritingPromptV3', 'currentWritingPromptV4', 'readingPassageSnapshotV1', 'readingPassageSnapshotV2'].forEach((key) => wx.removeStorageSync(key));
      const cacheKeys = wx.getStorageSync('yoyoCloudReadCacheKeysV4') || [];
      const keptKeys = cacheKeys.filter((key) => !/:get(?:ReadingHome|ReadingPassage|MaterialIndex|MaterialItem):/.test(String(key)));
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
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), error: error.message }, null, 2)}\n`);
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
