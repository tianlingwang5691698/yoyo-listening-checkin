#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-2010.json');
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

async function reLaunch(miniProgram, route) {
  const startedAt = Date.now();
  const page = await miniProgram.reLaunch(route);
  return { page, shellMs: Date.now() - startedAt };
}

async function selectSeniorAutumn(page) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'autumn' } } });
}

async function auditListening(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/material/index?module=listening');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 1);
  await selectSeniorAutumn(launched.page);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '秋考' } } });
  const data = await launched.page.data();
  assert(data.items.length === 1 && data.items[0].materialItemId === 'sh-autumn-2009-listening-v5', `listening-local-source-policy:${data.items.length}`);
  return { shellMs: launched.shellMs, readyMs: ready.ms, visibleSets: data.items.length, year2010Skipped: true };
}

async function auditWriting(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 4);
  await selectSeniorAutumn(launched.page);
  let data = await launched.page.data();
  assert((data.districts || []).map((item) => item.district).join(',') === '2010年,2009年', 'writing-year-groups');
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2010年' } } });
  data = await launched.page.data();
  assert(data.items.map((item) => item.materialItemId).join(',') === 'sh-autumn-2010-translation,sh-autumn-2010-writing', 'writing-paper-order');
  assert(data.selectedDistrictNode.contentSummary === '翻译 5 题 · 作文 1 题', 'writing-year-summary');

  const translation = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-autumn-2010-translation');
  const translationReady = await waitForData(translation, (current) => current.isTranslation && (current.translationQuestions || []).length === 5);
  assert(!translationReady.data.translationSubmitted, 'translation-answer-hidden');

  const writing = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-autumn-2010-writing');
  const writingReady = await waitForData(writing, (current) => current.prompt && current.prompt._id === 'sh-autumn-2010-writing' && (current.promptImages || []).length === 1 && current.promptImages[0].src);
  assert(writingReady.data.promptDisplay.requirements.length === 3, 'writing-requirements-separated');
  assert(writingReady.data.promptImages[0].cloudPath.includes('sh-autumn-2010-writing-1-f1ee816a23.jpeg'), 'writing-original-image');
  return { shellMs: launched.shellMs, readyMs: ready.ms, translationReadyMs: translationReady.ms, writingReadyMs: writingReady.ms };
}

async function auditReading(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === '秋考') || {}).count === 14));
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: '秋考' } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: 'sh-autumn-2010' } } });
  const data = await launched.page.data();
  const sections = data.selectedDistrictNode.passages || [];
  assert(data.selectedDistrictNode.label === '2010 上海高考秋考英语真题', 'reading-paper-title');
  assert(sections.map((item) => item._id).join(',') === [
    'sh-autumn-2010-grammar-vocabulary-b',
    'sh-autumn-2010-reading-a',
    'sh-autumn-2010-reading-ba',
    'sh-autumn-2010-reading-bb',
    'sh-autumn-2010-reading-bc',
    'sh-autumn-2010-reading-c',
    'sh-autumn-2010-reading-d'
  ].join(','), 'reading-original-order');

  const sectionB = await miniProgram.reLaunch('/pages/reading/detail/index?passageId=sh-autumn-2010-reading-bb');
  const sectionBReady = await waitForData(sectionB, (current) => current.passage && current.passage._id === 'sh-autumn-2010-reading-bb' && current.passage.questions.length === 3);
  const sectionD = await miniProgram.reLaunch('/pages/reading/detail/index?passageId=sh-autumn-2010-reading-d');
  const sectionDReady = await waitForData(sectionD, (current) => current.passage && current.passage._id === 'sh-autumn-2010-reading-d' && current.passage.questions.length === 4);
  assert(sectionDReady.data.passage.questions.every((item) => !Object.keys(item.options || {}).length), 'reading-section-d-open-response');
  return { shellMs: launched.shellMs, readyMs: ready.ms, sectionBReadyMs: sectionBReady.ms, sectionDReadyMs: sectionDReady.ms };
}

async function auditGrammar(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/grammar/index');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 32);
  await selectSeniorAutumn(launched.page);
  let data = await launched.page.data();
  const verb = (data.topics || []).find((item) => item.topicId === 'verb');
  assert(verb && verb.count === 14, 'grammar-verb-count');
  const tense = verb.children.find((item) => item.topicId === 'verb:tense-voice');
  assert(tense && tense.count === 4, 'grammar-tense-count');
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: 'verb' } } });
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: 'verb:tense-voice' } } });
  const topicReady = await waitForData(launched.page, (current) => (current.selectedQuestions || []).length === 4);
  assert(topicReady.data.selectedQuestions.some((item) => Number(item.year) === 2010), 'grammar-2010-tense-question');
  return { shellMs: launched.shellMs, readyMs: ready.ms, topicReadyMs: topicReady.ms, questions: topicReady.data.selectedQuestions.length };
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
      year: 2010,
      session: 'autumn',
      listening: await auditListening(miniProgram),
      writing: await auditWriting(miniProgram),
      reading: await auditReading(miniProgram),
      grammar: await auditGrammar(miniProgram),
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
