#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report.json');
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 10000) {
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

async function waitForPage(miniProgram, expectedPath, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const page = await miniProgram.currentPage();
    if (page && page.path === expectedPath) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`page-navigation-timeout:${expectedPath}`);
}

async function selectSeniorAutumn(page) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'autumn' } } });
  await page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '秋考' } } });
  return page.data();
}

async function auditListening(miniProgram) {
  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const launched = await reLaunch(miniProgram, '/pages/material/index?module=listening');
    const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 1);
    const data = await selectSeniorAutumn(launched.page);
    assert(data.items.length === 1 && data.items[0].materialItemId === 'sh-autumn-2009-listening-v5', `listening-index:${data.items.length}`);
    await launched.page.callMethod('openItem', { currentTarget: { dataset: { itemId: 'sh-autumn-2009-listening-v5' } } });
    const detail = await waitForPage(miniProgram, 'pages/material/detail/index');
    const detailReady = await waitForData(detail, (current) => current.questions && current.questions.length === 24 && current.audioSrc && !current.audioLoading, 30000);
    assert(detailReady.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === 'ABC', 'listening-sections');
    const formQuestion = detailReady.data.questions.find((item) => item.number === 17);
    assert(formQuestion.formTitle === 'Car Rental Information' && formQuestion.givenRows.some((item) => item.label === 'Name' && item.value === 'Amy Toms'), 'listening-form-context');
    const licenseQuestion = detailReady.data.questions.find((question) => Number(question.number) === 19);
    assert(licenseQuestion && licenseQuestion.givenRows.some((item) => item.label === 'License' && item.value === 'AN International Driver’s License'), 'listening-form-license-order');
    const playStartedAt = Date.now();
    await detail.callMethod('toggleAudio');
    const playing = await waitForData(detail, (current) => current.isPlaying, 3000);
    const playMs = Date.now() - playStartedAt;
    await detail.callMethod('toggleAudio');
    assert(playMs <= 500, `listening-play-${round}:${playMs}`);
    rounds.push({ round, shellMs: launched.shellMs, indexReadyMs: ready.ms, detailReadyMs: detailReady.ms, clickToPlayMs: playMs, playingWaitMs: playing.ms });
  }
  return rounds;
}

async function auditWriting(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 2);
  const data = await selectSeniorAutumn(launched.page);
  assert(data.items.length === 2, `writing-index:${data.items.length}`);
  assert(data.items.map((item) => item.materialItemId).join(',') === 'sh-autumn-2009-translation,sh-autumn-2009-writing', 'writing-paper-order');
  const translationDetail = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-autumn-2009-translation');
  const translationReady = await waitForData(translationDetail, (current) => current.isTranslation && current.translationQuestions && current.translationQuestions.length === 6);
  assert(!translationReady.data.translationSubmitted, 'translation-answer-hidden');
  const detail = await miniProgram.reLaunch('/pages/writing/detail/index?id=sh-autumn-2009-writing');
  const detailReady = await waitForData(detail, (current) => current.prompt && current.prompt._id === 'sh-autumn-2009-writing');
  assert(String(detailReady.data.prompt.prompt || '').length === 274, 'writing-prompt');
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, translationReadyMs: translationReady.ms, detailReadyMs: detailReady.ms };
}

async function auditReading(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === '秋考') || {}).count === 7));
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: '秋考' } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: 'sh-autumn-2009' } } });
  const data = await launched.page.data();
  const sections = data.selectedDistrictNode.passages;
  assert(data.selectedDistrictNode.label === '2009 上海高考秋考英语真题', `reading-paper:${data.selectedDistrictNode.label}`);
  assert(sections.length === 7, `reading-index:${sections.length}`);
  assert(sections.map((item) => item.title).join('|').includes('Grammar and Vocabulary Section B|2009 上海高考秋考 · Reading Comprehension Section A'), 'reading-original-order');
  await launched.page.callMethod('openPassage', { currentTarget: { dataset: { passageId: 'sh-autumn-2009-grammar-vocabulary-b' } } });
  const vocabularyDetail = await waitForPage(miniProgram, 'pages/reading/detail/index');
  const vocabularyReady = await waitForData(vocabularyDetail, (current) => current.passage && current.passage._id === 'sh-autumn-2009-grammar-vocabulary-b' && current.passage.questions.length === 9);
  assert(vocabularyReady.data.passage.questions.every((item) => Object.keys(item.options || {}).length === 10), 'vocabulary-word-bank-options');
  const readingDetail = await miniProgram.reLaunch('/pages/reading/detail/index?passageId=sh-autumn-2009-reading-a');
  const readingReady = await waitForData(readingDetail, (current) => current.passage && current.passage._id === 'sh-autumn-2009-reading-a' && current.passage.questions.length === 15);
  assert(String(readingReady.data.passage.passage || '').includes('The best fishermen think like fish!'), 'reading-fishermen-passage');
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, vocabularyReadyMs: vocabularyReady.ms, readingReadyMs: readingReady.ms };
}

async function auditGrammar(miniProgram) {
  const launched = await reLaunch(miniProgram, '/pages/grammar/index');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count === 16, 15000);
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await launched.page.callMethod('selectExam', { currentTarget: { dataset: { examId: 'autumn' } } });
  let data = await launched.page.data();
  const modalCategory = (data.topics || []).find((item) => item.topicId === 'verb');
  assert(modalCategory && modalCategory.children.some((item) => item.topicId === 'verb:modal' && item.count === 1), 'grammar-modal-count');
  assert(modalCategory.children.some((item) => item.topicId === 'verb:tense-voice' && item.count === 2), 'grammar-tense-count');
  const category = (data.topics || []).find((item) => item.children && item.children.length);
  assert(category, 'grammar-category');
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: category.topicId } } });
  data = await launched.page.data();
  const topic = (data.selectedCategory.children || []).find((item) => item.count > 0);
  assert(topic, 'grammar-topic');
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: topic.topicId } } });
  const topicReady = await waitForData(launched.page, (current) => current.selectedQuestions && current.selectedQuestions.length > 0, 10000);
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, topicReadyMs: topicReady.ms, topicId: topic.topicId, questions: topicReady.data.selectedQuestions.length };
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
    });
    const report = {
      passed: false,
      year: 2009,
      session: 'autumn',
      listening: await auditListening(miniProgram),
      writing: await auditWriting(miniProgram),
      reading: await auditReading(miniProgram),
      grammar: await auditGrammar(miniProgram),
      thresholds: { pageReadyCacheMs: 200, pageReadyColdMs: 800, clickToPlayMs: 500 },
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
