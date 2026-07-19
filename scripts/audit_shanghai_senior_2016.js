#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2016.json');
const SCREENSHOT_DIR = '/tmp/shanghai-senior-2016';
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await page.data();
    if (predicate(data)) return { data, ms: Date.now() - startedAt };
    await page.waitFor(50);
  }
  const data = await page.data();
  throw new Error(`page-data-timeout:${page.path}:${JSON.stringify({ loading: data.loading, debugLines: data.debugLines })}`);
}

async function relaunch(miniProgram, route) {
  const startedAt = Date.now();
  const page = await miniProgram.reLaunch(route);
  return { page, shellMs: Date.now() - startedAt };
}

async function selectSeniorAutumn(page) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'autumn' } } });
}

async function screenshot(miniProgram, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const output = path.join(SCREENSHOT_DIR, `${name}.png`);
  await miniProgram.screenshot({ path: output });
  return output;
}

async function auditReading(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === '秋考') || {}).count === 35));
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: '秋考' } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: 'sh-autumn-2016' } } });
  const indexData = await launched.page.data();
  const expectedIds = [
    'sh-autumn-2016-grammar-vocabulary-a',
    'sh-autumn-2016-grammar-vocabulary-b',
    'sh-autumn-2016-reading-a',
    'sh-autumn-2016-reading-ba',
    'sh-autumn-2016-reading-bb',
    'sh-autumn-2016-reading-bc',
    'sh-autumn-2016-reading-c'
  ];
  assert(indexData.selectedDistrictNode.label === '2016 上海高考秋考英语真题', 'reading-paper-title');
  assert(indexData.selectedDistrictNode.passages.map((item) => item._id).join(',') === expectedIds.join(','), 'reading-paper-order');

  const cloze = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-autumn-2016-grammar-vocabulary-a');
  const clozeReady = await waitForData(cloze.page, (data) => data.passage && data.passage._id === 'sh-autumn-2016-grammar-vocabulary-a' && data.passage.isClozePassage);
  const blanks = clozeReady.data.passage.clozePassageParts.filter((item) => item.type === 'blank');
  const inputs = [].concat(await cloze.page.$$('.library-cloze-inline-input'), await cloze.page.$$('.cloze-inline-input'));
  assert(clozeReady.data.passage.questions.map((item) => item.number).join(',') === Array.from({ length: 16 }, (_, index) => index + 25).join(','), 'reading-cloze-numbers');
  assert(blanks.length === 16 && inputs.length === 16, `reading-cloze-inputs:${blanks.length}:${inputs.length}`);
  const clozeScreenshot = await screenshot(miniProgram, 'reading-cloze');

  const sectionB = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-autumn-2016-reading-bb');
  const sectionBReady = await waitForData(sectionB.page, (data) => data.passage && data.passage._id === 'sh-autumn-2016-reading-bb' && data.passage.images.length === 1 && data.passage.images[0].src);
  const readingImages = await sectionB.page.$$('.passage-source-image');
  assert(sectionBReady.data.passage.questions.map((item) => item.answer).join('') === 'DDB', 'reading-section-b-answers');
  assert(readingImages.length === 1, `reading-source-image:${readingImages.length}`);
  const imageScreenshot = await screenshot(miniProgram, 'reading-image');

  const sectionC = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-autumn-2016-reading-c');
  const sectionCReady = await waitForData(sectionC.page, (data) => data.passage && data.passage._id === 'sh-autumn-2016-reading-c' && data.passage.questions.length === 4);
  assert(!sectionCReady.data.passage.isClozePassage, 'reading-section-c-not-cloze');
  assert(sectionCReady.data.passage.questions.map((item) => item.number).join(',') === '78,79,80,81', 'reading-section-c-numbers');
  return {
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    clozeReadyMs: clozeReady.ms,
    sectionBReadyMs: sectionBReady.ms,
    sectionCReadyMs: sectionCReady.ms,
    screenshots: [clozeScreenshot, imageScreenshot]
  };
}

async function auditWriting(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 19);
  await selectSeniorAutumn(launched.page);
  let data = await launched.page.data();
  assert((data.districts || []).map((item) => item.district).join(',') === '2022年,2021年,2016年,2010年,2009年', 'writing-year-order');
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2016年' } } });
  data = await launched.page.data();
  assert(data.items.map((item) => item.materialItemId).join(',') === 'sh-autumn-2016-translation,sh-autumn-2016-writing', 'writing-paper-order');
  assert(data.selectedDistrictNode.contentSummary === '翻译 5 题 · 作文 1 题', 'writing-year-summary');

  const translation = await relaunch(miniProgram, '/pages/writing/detail/index?id=sh-autumn-2016-translation');
  const translationReady = await waitForData(translation.page, (current) => current.isTranslation && (current.translationQuestions || []).length === 5);
  const translationRows = [].concat(await translation.page.$$('.library-translation-item'), await translation.page.$$('.translation-item'));
  assert(translationRows.length === 5, `writing-translation-rows:${translationRows.length}`);
  assert(!translationReady.data.translationSubmitted, 'writing-translation-hidden');

  const writing = await relaunch(miniProgram, '/pages/writing/detail/index?id=sh-autumn-2016-writing');
  const writingReady = await waitForData(writing.page, (current) => current.prompt && current.prompt._id === 'sh-autumn-2016-writing' && current.promptImages.length === 1 && current.promptImages[0].src);
  const requirementRows = [].concat(await writing.page.$$('.library-requirement-item'), await writing.page.$$('.requirement-item'));
  const writingImages = [].concat(await writing.page.$$('.library-prompt-image'), await writing.page.$$('.prompt-image'));
  assert(writingReady.data.promptDisplay.requirements.length === 2 && requirementRows.length === 2, 'writing-requirements-separated');
  assert(writingImages.length === 1, `writing-source-image:${writingImages.length}`);
  const writingScreenshot = await screenshot(miniProgram, 'writing');
  return {
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    translationReadyMs: translationReady.ms,
    writingReadyMs: writingReady.ms,
    screenshot: writingScreenshot
  };
}

async function auditListening(miniProgram) {
  const indexLaunch = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(indexLaunch.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 6);
  await selectSeniorAutumn(indexLaunch.page);
  await indexLaunch.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '秋考' } } });
  const indexData = await indexLaunch.page.data();
  assert(indexData.items.some((item) => item.materialItemId === 'sh-autumn-2016-listening'), 'listening-index');

  const rounds = [];
  let listeningScreenshot = '';
  for (let round = 1; round <= 3; round += 1) {
    const launched = await relaunch(miniProgram, '/pages/material/detail/index?itemId=sh-autumn-2016-listening');
    const ready = await waitForData(launched.page, (data) => data.item && data.item._id === 'sh-autumn-2016-listening' && data.questions.length === 24 && data.audioSrc && !data.audioLoading);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'ABC', 'listening-sections');
    assert(ready.data.questions.filter((item) => item.showGroupTitle).length === 4, 'listening-group-titles');
    assert(ready.data.audioDurationText === '18:13', `listening-duration:${ready.data.audioDurationText}`);
    assert(ready.data.questions[16].formTitle === 'Class Diary (June 13-19)', 'listening-class-diary');
    assert(ready.data.questions[20].prompt.includes('Sue Walter'), 'listening-sue-walter');
    if (round === 1) listeningScreenshot = await screenshot(miniProgram, 'listening');
    const startedAt = Date.now();
    await launched.page.callMethod('toggleAudio');
    await waitForData(launched.page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - startedAt;
    await launched.page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs: launched.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }
  return { indexShellMs: indexLaunch.shellMs, indexReadyMs: indexReady.ms, rounds, screenshot: listeningScreenshot };
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: AUTOMATOR_PORT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
    });
    const report = {
      passed: false,
      year: 2016,
      session: 'autumn',
      reading: await auditReading(miniProgram),
      writing: await auditWriting(miniProgram),
      listening: await auditListening(miniProgram),
      grammar: { accepted: 0, reason: 'Grammar and Vocabulary Section A has no selectable options' },
      thresholds: { clickToPlayMs: 500 },
      exceptions
    };
    report.passed = !exceptions.length;
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
