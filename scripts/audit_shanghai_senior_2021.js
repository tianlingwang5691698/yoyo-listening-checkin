#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2021.json');
const PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
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
  throw new Error(`page-data-timeout:${page.path}`);
}

async function auditWriting(miniProgram, session) {
  const startedAt = Date.now();
  const page = await miniProgram.reLaunch('/pages/material/index?module=writing');
  const ready = await waitForData(page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 17);
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: session } } });
  let data = await page.data();
  const expectedYears = session === 'spring' ? '2023年,2022年,2021年' : '2022年,2021年,2010年,2009年';
  assert((data.districts || []).map((item) => item.district).join(',') === expectedYears, `writing-${session}-year-order`);
  await page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2021年' } } });
  data = await page.data();
  const prefix = `sh-${session}-2021`;
  const expectedIds = session === 'spring'
    ? `${prefix}-summary-writing,${prefix}-translation,${prefix}-writing`
    : `${prefix}-translation,${prefix}-writing`;
  assert(data.items.map((item) => item.materialItemId).join(',') === expectedIds, `writing-${session}-paper-order`);

  const translation = await miniProgram.reLaunch(`/pages/writing/detail/index?id=${prefix}-translation`);
  const translationReady = await waitForData(translation, (current) => current.isTranslation && (current.translationQuestions || []).length === 4);
  assert(translationReady.data.translationQuestions.map((item) => item.number).join(',') === '72,73,74,75', `writing-${session}-translation`);

  const writing = await miniProgram.reLaunch(`/pages/writing/detail/index?id=${prefix}-writing`);
  const writingReady = await waitForData(writing, (current) => current.prompt && current.prompt._id === `${prefix}-writing`);
  assert(writingReady.data.promptDisplay.requirements.length === 2, `writing-${session}-requirements`);
  if (session === 'autumn') {
    assert(writingReady.data.promptDisplay.promptTable.headers.join(',') === '课程名称,汉语听说,汉语读写', 'writing-autumn-table-data');
    const rows = [].concat(await writing.$$('.library-prompt-table-row'), await writing.$$('.prompt-table-row'));
    assert(rows.length === 4, 'writing-autumn-table-render');
  }
  return { shellMs: Date.now() - startedAt, indexReadyMs: ready.ms, translationReadyMs: translationReady.ms, writingReadyMs: writingReady.ms };
}

async function auditReading(miniProgram, session) {
  const startedAt = Date.now();
  const page = await miniProgram.reLaunch('/pages/reading/index');
  const groupKey = session === 'spring' ? '春考' : '秋考';
  const expectedCount = session === 'spring' ? 14 : 28;
  const ready = await waitForData(page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).count === expectedCount));
  await page.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  await page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `sh-${session}-2021` } } });
  const data = await page.data();
  const passages = data.selectedDistrictNode.passages || [];
  const expectedIds = ['grammar-vocabulary-a', 'grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c']
    .map((suffix) => `sh-${session}-2021-${suffix}`);
  assert(passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${session}-order`);
  assert(passages.reduce((sum, item) => sum + Number(item.questionCount || 0), 0) === 50, `reading-${session}-count`);
  const detail = await miniProgram.reLaunch(`/pages/reading/detail/index?passageId=sh-${session}-2021-reading-c`);
  const detailReady = await waitForData(detail, (current) => current.passage && current.passage._id === `sh-${session}-2021-reading-c` && current.passage.questions.length === 4);
  assert(detailReady.data.passage.questions.map((item) => item.number).join(',') === '67,68,69,70', `reading-${session}-section-c`);
  return { shellMs: Date.now() - startedAt, indexReadyMs: ready.ms, detailReadyMs: detailReady.ms };
}

async function auditListening(miniProgram, session) {
  const itemId = `sh-${session}-2021-listening`;
  const expectedDuration = session === 'spring' ? '15:53' : '15:54';
  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const shellStartedAt = Date.now();
    const page = await miniProgram.reLaunch(`/pages/material/detail/index?itemId=${itemId}`);
    const shellMs = Date.now() - shellStartedAt;
    const ready = await waitForData(page, (data) => data.item && data.item._id === itemId && data.questions.length === 20 && data.audioSrc && !data.audioLoading);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'AB', `listening-${session}-sections`);
    assert(ready.data.questions.filter((item) => item.showGroupTitle).length === 3, `listening-${session}-groups`);
    assert(ready.data.audioDurationText === expectedDuration, `listening-${session}-duration:${ready.data.audioDurationText}`);
    const playStartedAt = Date.now();
    await page.callMethod('toggleAudio');
    await waitForData(page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - playStartedAt;
    await page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-${session}-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }
  return { rounds };
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
    });
    const report = {
      passed: false,
      year: 2021,
      writing: { spring: await auditWriting(miniProgram, 'spring'), autumn: await auditWriting(miniProgram, 'autumn') },
      reading: { spring: await auditReading(miniProgram, 'spring'), autumn: await auditReading(miniProgram, 'autumn') },
      listening: { spring: await auditListening(miniProgram, 'spring'), autumn: await auditListening(miniProgram, 'autumn') },
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
