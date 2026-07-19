#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2017.json');
const SCREENSHOT_DIR = '/tmp/shanghai-senior-2017';
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

async function screenshot(miniProgram, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const target = path.join(SCREENSHOT_DIR, `${name}.png`);
  await miniProgram.screenshot({ path: target });
  return target;
}

async function selectSeniorExam(page, examId) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId } } });
}

async function auditReading(miniProgram, session) {
  const groupKey = session === 'spring' ? '春考' : '秋考';
  const expectedCount = session === 'spring' ? 21 : 42;
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stage: 'senior' } } });
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).count === expectedCount));
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `sh-${session}-2017` } } });
  const data = await launched.page.data();
  const expectedIds = ['grammar-vocabulary-a', 'grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c']
    .map((suffix) => `sh-${session}-2017-${suffix}`);
  assert(data.selectedDistrictNode.passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${session}-paper-order`);

  const cloze = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=sh-${session}-2017-grammar-vocabulary-a`);
  const clozeReady = await waitForData(cloze.page, (current) => current.passage && current.passage.isClozePassage && current.passage.questions.length === 10);
  const inputs = [].concat(await cloze.page.$$('.library-cloze-inline-input'), await cloze.page.$$('.cloze-inline-input'));
  assert(inputs.length === 10, `reading-${session}-cloze-inputs:${inputs.length}`);

  const sectionC = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=sh-${session}-2017-reading-c`);
  const sectionCReady = await waitForData(sectionC.page, (current) => current.passage && current.passage.questions.length === 4);
  assert(sectionCReady.data.passage.questions.map((item) => item.number).join(',') === '67,68,69,70', `reading-${session}-section-c`);

  let imageReadyMs = 0;
  let imageScreenshot = '';
  if (session === 'spring') {
    const imageQuestion = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-spring-2017-reading-ba');
    const imageReady = await waitForData(imageQuestion.page, (current) => {
      const question = current.passage && current.passage.questions.find((item) => item.number === 57);
      return question && question.optionsList.length === 4 && question.optionsList.every((item) => item.image && item.image.src);
    });
    const optionImages = await imageQuestion.page.$$('.option-source-image');
    assert(optionImages.length === 4, `reading-spring-option-images:${optionImages.length}`);
    imageReadyMs = imageReady.ms;
    imageScreenshot = await screenshot(miniProgram, 'spring-reading-q57');

    const poster = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-spring-2017-reading-bb');
    const posterReady = await waitForData(poster.page, (current) => current.passage && current.passage.images.length === 1 && current.passage.images[0].src);
    const posterImages = await poster.page.$$('.passage-source-image');
    assert(posterImages.length === 1, `reading-spring-poster:${posterImages.length}`);
    imageReadyMs += posterReady.ms;
  }
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, clozeReadyMs: clozeReady.ms, sectionCReadyMs: sectionCReady.ms, imageReadyMs, imageScreenshot };
}

async function auditWriting(miniProgram, session) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 25);
  await selectSeniorExam(launched.page, session);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2017年' } } });
  const data = await launched.page.data();
  const prefix = `sh-${session}-2017`;
  assert(data.items.map((item) => item.materialItemId).join(',') === `${prefix}-summary-writing,${prefix}-translation,${prefix}-writing`, `writing-${session}-paper-order`);

  const summary = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-summary-writing`);
  const summaryReady = await waitForData(summary.page, (current) => current.prompt && current.prompt._id === `${prefix}-summary-writing`);
  assert(Number(summaryReady.data.prompt.maxWords) === 60, `writing-${session}-summary-limit`);

  const translation = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-translation`);
  const translationReady = await waitForData(translation.page, (current) => current.isTranslation && (current.translationQuestions || []).length === 4);
  assert(translationReady.data.translationQuestions.map((item) => item.number).join(',') === '72,73,74,75', `writing-${session}-translation-numbers`);
  assert(!translationReady.data.translationSubmitted, `writing-${session}-translation-hidden`);

  const writing = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-writing`);
  const writingReady = await waitForData(writing.page, (current) => current.prompt && current.prompt._id === `${prefix}-writing`);
  assert(writingReady.data.promptDisplay.requirements.length === 2, `writing-${session}-requirements`);
  if (session === 'autumn') {
    assert(writingReady.data.promptDisplay.promptTable.rows.map((row) => row.label).join(',') === '主题,时间,路线', 'writing-autumn-prompt-table');
  }
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, summaryReadyMs: summaryReady.ms, translationReadyMs: translationReady.ms, writingReadyMs: writingReady.ms };
}

async function auditListening(miniProgram, session) {
  const indexLaunch = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(indexLaunch.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 8);
  await selectSeniorExam(indexLaunch.page, session);
  await indexLaunch.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: session === 'spring' ? '春考' : '秋考' } } });
  const itemId = `sh-${session}-2017-listening`;
  const indexData = await indexLaunch.page.data();
  assert(indexData.items.some((item) => item.materialItemId === itemId), `listening-${session}-index`);
  const expectedDuration = session === 'spring' ? '14:39' : '28:16';
  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const launched = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
    const ready = await waitForData(launched.page, (data) => data.item && data.item._id === itemId && data.questions.length === 20 && data.audioSrc && !data.audioLoading);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'AB', `listening-${session}-sections`);
    assert(ready.data.audioDurationText === expectedDuration, `listening-${session}-duration:${ready.data.audioDurationText}`);
    const startedAt = Date.now();
    await launched.page.callMethod('toggleAudio');
    await waitForData(launched.page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - startedAt;
    await launched.page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-${session}-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs: launched.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }
  return { indexShellMs: indexLaunch.shellMs, indexReadyMs: indexReady.ms, rounds };
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
      year: 2017,
      reading: { spring: await auditReading(miniProgram, 'spring'), autumn: await auditReading(miniProgram, 'autumn') },
      writing: { spring: await auditWriting(miniProgram, 'spring'), autumn: await auditWriting(miniProgram, 'autumn') },
      listening: { spring: await auditListening(miniProgram, 'spring'), autumn: await auditListening(miniProgram, 'autumn') },
      grammar: { accepted: 0, reason: 'Grammar and Vocabulary Section A is an inline reading cloze' },
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
