#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2024-2026-page.json');
const SCREENSHOT_DIR = '/tmp/shanghai-senior-2024-2026';
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

const PAPERS = {
  spring: [2024, 2025, 2026],
  autumn: [2024, 2025]
};
const LISTENING = [
  { session: 'spring', year: 2024, duration: '20:49' },
  { session: 'spring', year: 2025, duration: '15:22' },
  { session: 'autumn', year: 2024, duration: '17:31' }
];
const READING_SUFFIXES = [
  'grammar-vocabulary-a',
  'grammar-vocabulary-b',
  'reading-a',
  'reading-ba',
  'reading-bb',
  'reading-bc',
  'reading-c'
];

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
  const expectedCount = session === 'spring' ? 42 : 56;
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).count === expectedCount));
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stage: 'senior' } } });
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  const result = { shellMs: launched.shellMs, indexReadyMs: ready.ms, papers: [] };

  for (const year of PAPERS[session]) {
    const paperId = `sh-${session}-${year}`;
    await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: paperId } } });
    const data = await launched.page.data();
    const expectedIds = READING_SUFFIXES.map((suffix) => `${paperId}-${suffix}`);
    const passages = (data.selectedDistrictNode && data.selectedDistrictNode.passages) || [];
    assert(passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${session}-${year}-paper-order`);
    assert(passages.reduce((sum, item) => sum + Number(item.questionCount || 0), 0) === 50, `reading-${session}-${year}-question-count`);
    result.papers.push({ year });
  }

  if (session === 'autumn') {
    const data = await launched.page.data();
    const groups = (((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).districts || [];
    assert(!groups.some((item) => item.key === 'sh-autumn-2026'), 'reading-autumn-2026-must-be-absent');
  }

  for (const paper of result.papers) {
    const year = paper.year;
    const paperId = `sh-${session}-${year}`;
    const cloze = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-grammar-vocabulary-a`);
    const clozeReady = await waitForData(cloze.page, (current) => current.passage && current.passage.isClozePassage && current.passage.questions.length === 10);
    const inputs = [].concat(await cloze.page.$$('.library-cloze-inline-input'), await cloze.page.$$('.cloze-inline-input'));
    assert(inputs.length === 10, `reading-${session}-${year}-cloze-inputs:${inputs.length}`);

    const sectionC = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-reading-c`);
    const sectionCReady = await waitForData(sectionC.page, (current) => current.passage && current.passage.questions && current.passage.questions.length === 4);
    assert(sectionCReady.data.passage.questions.map((item) => item.number).join(',') === '67,68,69,70', `reading-${session}-${year}-section-c-numbers`);
    paper.clozeReadyMs = clozeReady.ms;
    paper.sectionCReadyMs = sectionCReady.ms;
  }
  return result;
}

async function auditWriting(miniProgram, session) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 40);
  await selectSeniorExam(launched.page, session);
  const result = { shellMs: launched.shellMs, indexReadyMs: ready.ms, papers: [] };

  for (const year of PAPERS[session]) {
    const prefix = `sh-${session}-${year}`;
    await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `${year}年` } } });
    const data = await launched.page.data();
    assert(data.items.map((item) => item.materialItemId).join(',') === `${prefix}-summary-writing,${prefix}-translation,${prefix}-writing`, `writing-${session}-${year}-paper-order`);
    result.papers.push({ year });
  }

  const indexData = await launched.page.data();
  if (session === 'autumn') {
    assert(!(indexData.districts || []).some((item) => item.district === '2026年'), 'writing-autumn-2026-must-be-absent');
  }

  for (const paper of result.papers) {
    const year = paper.year;
    const prefix = `sh-${session}-${year}`;
    const summary = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-summary-writing`);
    const summaryReady = await waitForData(summary.page, (current) => current.prompt && current.prompt._id === `${prefix}-summary-writing`);
    assert(Number(summaryReady.data.prompt.maxWords) === 60, `writing-${session}-${year}-summary-limit`);

    const translation = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-translation`);
    const translationReady = await waitForData(translation.page, (current) => current.isTranslation && (current.translationQuestions || []).length === 4);
    assert(translationReady.data.translationQuestions.map((item) => item.number).join(',') === '72,73,74,75', `writing-${session}-${year}-translation-numbers`);
    assert(!translationReady.data.translationSubmitted, `writing-${session}-${year}-translation-hidden`);
    const translationRows = [].concat(await translation.page.$$('.library-translation-item'), await translation.page.$$('.translation-item'));
    assert(translationRows.length === 4, `writing-${session}-${year}-translation-rows:${translationRows.length}`);

    const writing = await relaunch(miniProgram, `/pages/writing/detail/index?id=${prefix}-writing`);
    const writingReady = await waitForData(writing.page, (current) => current.prompt && current.prompt._id === `${prefix}-writing`);
    assert(writingReady.data.promptDisplay.requirements.length >= 1, `writing-${session}-${year}-requirements`);
    const requirementRows = [].concat(await writing.page.$$('.library-requirement-item'), await writing.page.$$('.requirement-item'));
    assert(requirementRows.length === writingReady.data.promptDisplay.requirements.length, `writing-${session}-${year}-rendered-requirements`);
    paper.summaryReadyMs = summaryReady.ms;
    paper.translationReadyMs = translationReady.ms;
    paper.writingReadyMs = writingReady.ms;
    paper.requirementCount = requirementRows.length;
  }
  return result;
}

async function auditListeningIndex(miniProgram, session) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 11);
  await selectSeniorExam(launched.page, session);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: session === 'spring' ? '春考' : '秋考' } } });
  const data = await launched.page.data();
  const ids = data.items.map((item) => item.materialItemId);
  for (const target of LISTENING.filter((item) => item.session === session)) {
    assert(ids.includes(`sh-${session}-${target.year}-listening`), `listening-${session}-${target.year}-index`);
  }
  assert(!ids.includes(`sh-${session}-2026-listening`), `listening-${session}-2026-must-be-absent`);
  if (session === 'autumn') assert(!ids.includes('sh-autumn-2025-listening'), 'listening-autumn-2025-must-be-absent');
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, targetIds: ids.filter((item) => /202[456]/.test(item)) };
}

async function auditListeningItem(miniProgram, target) {
  const itemId = `sh-${target.session}-${target.year}-listening`;
  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const launched = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
    const ready = await waitForData(launched.page, (data) => data.item && data.item._id === itemId && data.questions.length === 20 && data.audioSrc && !data.audioLoading);
    assert(ready.data.questions.map((item) => item.number).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20', `listening-${target.session}-${target.year}-numbers`);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'AB', `listening-${target.session}-${target.year}-sections`);
    assert(ready.data.questions.filter((item) => item.showGroupTitle).length === 3, `listening-${target.session}-${target.year}-group-titles`);
    assert(ready.data.audioDurationText === target.duration, `listening-${target.session}-${target.year}-duration:${ready.data.audioDurationText}`);
    const startedAt = Date.now();
    await launched.page.callMethod('toggleAudio');
    await waitForData(launched.page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - startedAt;
    await launched.page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-${target.session}-${target.year}-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs: launched.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }
  return { itemId, duration: target.duration, rounds };
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
      checkedAt: new Date().toISOString(),
      sourceMissing: [{ session: 'autumn', year: 2026, reason: 'source-paper-missing' }],
      reading: {},
      writing: {},
      listening: { index: {}, items: [] },
      screenshots: {},
      thresholds: { clickToPlayMs: 500 },
      exceptions
    };
    report.reading.spring = await auditReading(miniProgram, 'spring');
    report.reading.autumn = await auditReading(miniProgram, 'autumn');
    report.screenshots.reading = await screenshot(miniProgram, 'reading-2025-autumn-section-c');
    report.writing.spring = await auditWriting(miniProgram, 'spring');
    report.writing.autumn = await auditWriting(miniProgram, 'autumn');
    report.screenshots.writing = await screenshot(miniProgram, 'writing-2025-autumn-guided');
    report.listening.index.spring = await auditListeningIndex(miniProgram, 'spring');
    report.listening.index.autumn = await auditListeningIndex(miniProgram, 'autumn');
    for (const target of LISTENING) report.listening.items.push(await auditListeningItem(miniProgram, target));
    report.screenshots.listening = await screenshot(miniProgram, 'listening-2024-autumn');
    report.listening.maxClickToPlayMs = Math.max(...report.listening.items.flatMap((item) => item.rounds.map((round) => round.clickToPlayMs)));
    report.passed = !exceptions.length && report.listening.maxClickToPlayMs <= report.thresholds.clickToPlayMs;
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
