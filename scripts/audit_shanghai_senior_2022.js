#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2022.json');
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
  const data = await page.data();
  throw new Error(`page-data-timeout:${page.path}:${JSON.stringify({ loading: data.loading, debugLines: data.debugLines })}`);
}

async function relaunch(miniProgram, route) {
  const startedAt = Date.now();
  const page = await miniProgram.reLaunch(route);
  return { page, shellMs: Date.now() - startedAt };
}

async function selectSeniorExam(page, examId) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId } } });
}

async function auditWritingSession(miniProgram, session) {
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 12);
  await selectSeniorExam(launched.page, session);
  let data = await launched.page.data();
  const expectedYears = session === 'spring' ? '2023年,2022年' : '2022年,2010年,2009年';
  assert((data.districts || []).map((item) => item.district).join(',') === expectedYears, `writing-${session}-year-order`);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2022年' } } });
  data = await launched.page.data();
  const prefix = `sh-${session}-2022`;
  assert(data.items.map((item) => item.materialItemId).join(',') === `${prefix}-summary-writing,${prefix}-translation,${prefix}-writing`, `writing-${session}-paper-order`);
  assert(data.selectedDistrictNode.contentSummary === '概要写作 1 题 · 翻译 4 题 · 作文 1 题', `writing-${session}-summary`);

  const summary = await miniProgram.reLaunch(`/pages/writing/detail/index?id=${prefix}-summary-writing`);
  const summaryReady = await waitForData(summary, (current) => current.prompt && current.prompt._id === `${prefix}-summary-writing`);
  assert(Number(summaryReady.data.prompt.maxWords) === 60, `writing-${session}-summary-limit`);
  const rules = await summary.$('.library-file-rules') || await summary.$('.meta');
  assert(rules && (await rules.text()).includes('不超过 60 词'), `writing-${session}-summary-rendered-limit`);

  const translation = await miniProgram.reLaunch(`/pages/writing/detail/index?id=${prefix}-translation`);
  const translationReady = await waitForData(translation, (current) => current.isTranslation && (current.translationQuestions || []).length === 4);
  assert(translationReady.data.translationQuestions.map((item) => item.number).join(',') === '72,73,74,75', `writing-${session}-translation-numbers`);
  assert(!translationReady.data.translationSubmitted, `writing-${session}-translation-hidden`);
  const translationRows = [].concat(await translation.$$('.library-translation-item'), await translation.$$('.translation-item'));
  assert(translationRows.length === 4, `writing-${session}-translation-cards`);

  const writing = await miniProgram.reLaunch(`/pages/writing/detail/index?id=${prefix}-writing`);
  const writingReady = await waitForData(writing, (current) => current.prompt && current.prompt._id === `${prefix}-writing`);
  assert(Number(writingReady.data.prompt.minWords) === 120, `writing-${session}-guided-limit`);
  assert(writingReady.data.promptDisplay.requirements.length === 2, `writing-${session}-guided-requirements`);
  const requirementRows = [].concat(await writing.$$('.library-requirement-item'), await writing.$$('.requirement-item'));
  assert(requirementRows.length === 2, `writing-${session}-guided-rendered-requirements`);
  return {
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    summaryReadyMs: summaryReady.ms,
    translationReadyMs: translationReady.ms,
    writingReadyMs: writingReady.ms
  };
}

async function auditReadingSession(miniProgram, session) {
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  const groupKey = session === 'spring' ? '春考' : '秋考';
  const expectedGroupCount = session === 'spring' ? 14 : 28;
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).count === expectedGroupCount), 30000);
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `sh-${session}-2022` } } });
  const data = await launched.page.data();
  const passages = data.selectedDistrictNode.passages || [];
  const expectedIds = [
    `sh-${session}-2022-grammar-vocabulary-a`,
    `sh-${session}-2022-grammar-vocabulary-b`,
    `sh-${session}-2022-reading-a`,
    `sh-${session}-2022-reading-ba`,
    `sh-${session}-2022-reading-bb`,
    `sh-${session}-2022-reading-bc`,
    `sh-${session}-2022-reading-c`
  ];
  assert(passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${session}-paper-order`);
  assert(passages.reduce((sum, item) => sum + Number(item.questionCount || (item.questions || []).length), 0) === 50, `reading-${session}-question-count`);
  const detail = await miniProgram.reLaunch(`/pages/reading/detail/index?passageId=sh-${session}-2022-reading-c`);
  const detailReady = await waitForData(detail, (current) => current.passage && current.passage._id === `sh-${session}-2022-reading-c` && current.passage.questions.length === 4, 30000);
  assert(detailReady.data.passage.questions.map((item) => item.number).join(',') === '67,68,69,70', `reading-${session}-section-c-numbers`);
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, detailReadyMs: detailReady.ms };
}

async function auditListeningSession(miniProgram, session) {
  const indexLaunch = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(indexLaunch.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 3);
  await selectSeniorExam(indexLaunch.page, session);
  await indexLaunch.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: session === 'spring' ? '春考' : '秋考' } } });
  const indexData = await indexLaunch.page.data();
  const itemId = `sh-${session}-2022-listening`;
  assert(indexData.items.some((item) => item.materialItemId === itemId), `listening-${session}-index`);
  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const launched = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
    const ready = await waitForData(launched.page, (data) => data.item && data.item._id === itemId && data.questions.length === 20 && data.audioSrc && !data.audioLoading, 30000);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'AB', `listening-${session}-sections`);
    assert(ready.data.questions.filter((item) => item.showGroupTitle).length === 3, `listening-${session}-group-titles`);
    assert(ready.data.audioDurationText === (session === 'spring' ? '15:27' : '16:17'), `listening-${session}-duration`);
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
      year: 2022,
      writing: {
        spring: await auditWritingSession(miniProgram, 'spring'),
        autumn: await auditWritingSession(miniProgram, 'autumn')
      },
      reading: {
        spring: await auditReadingSession(miniProgram, 'spring'),
        autumn: await auditReadingSession(miniProgram, 'autumn')
      },
      listening: {
        spring: await auditListeningSession(miniProgram, 'spring'),
        autumn: await auditListeningSession(miniProgram, 'autumn')
      },
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
