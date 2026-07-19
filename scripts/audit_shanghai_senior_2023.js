#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2023.json');
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 15000) {
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
  const page = await miniProgram.reLaunch(route);
  return { page, shellMs: Date.now() - startedAt };
}

async function selectSeniorSpring(page) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'spring' } } });
}

async function auditWriting(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 6);
  await selectSeniorSpring(launched.page);
  let data = await launched.page.data();
  assert((data.districts || []).map((item) => item.district).join(',') === '2023年', 'writing-year-group');
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2023年' } } });
  data = await launched.page.data();
  assert(data.items.map((item) => item.materialItemId).join(',') === 'sh-spring-2023-translation,sh-spring-2023-writing', 'writing-paper-order');
  assert(data.selectedDistrictNode.contentSummary === '翻译 4 题 · 作文 1 题', 'writing-year-summary');

  const translation = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-spring-2023-translation');
  const translationReady = await waitForData(translation, (current) => current.isTranslation && (current.translationQuestions || []).length === 4);
  assert(translationReady.data.translationQuestions.map((item) => item.number).join(',') === '72,73,74,75', 'translation-original-numbers');
  assert(!translationReady.data.translationSubmitted, 'translation-answer-hidden');
  const translationRows = [].concat(await translation.$$('.library-translation-item'), await translation.$$('.translation-item'));
  assert(translationRows.length === 4, 'translation-four-rendered-cards');

  const writing = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-spring-2023-writing');
  const writingReady = await waitForData(writing, (current) => current.prompt && current.prompt._id === 'sh-spring-2023-writing');
  assert(writingReady.data.promptDisplay.requirements.length === 2, 'writing-requirements-separated');
  assert(writingReady.data.promptDisplay.promptStarter === 'Dear Tom：', 'writing-starter-preserved');
  assert(writingReady.data.promptImages.length === 0, 'sample-writing-image-excluded');
  assert(Number(writingReady.data.prompt.minWords || 0) === 0 && Number(writingReady.data.prompt.score || 0) === 0, 'writing-no-inferred-metadata');
  const requirementRows = [].concat(await writing.$$('.library-requirement-item'), await writing.$$('.requirement-item'));
  const starter = await writing.$('.library-prompt-starter') || await writing.$('.prompt-starter');
  assert(requirementRows.length === 2, 'writing-two-rendered-requirements');
  assert(starter && await starter.text() === 'Dear Tom：', 'writing-rendered-starter');
  return {
    shellMs: launched.shellMs,
    readyMs: ready.ms,
    translationReadyMs: translationReady.ms,
    writingReadyMs: writingReady.ms
  };
}

async function auditListening(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 1);
  await selectSeniorSpring(launched.page);
  const data = await launched.page.data();
  assert((data.items || []).length === 0, 'listening-incomplete-source-must-stay-hidden');
  return { shellMs: launched.shellMs, readyMs: ready.ms, visibleSets: 0 };
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
      year: 2023,
      session: 'spring',
      writing: await auditWriting(miniProgram),
      listening: await auditListening(miniProgram),
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
