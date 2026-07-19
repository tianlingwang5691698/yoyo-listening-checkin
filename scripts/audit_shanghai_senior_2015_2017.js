#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2015-2017-page.json');
const SCREENSHOT_DIR = '/tmp/shanghai-senior-2015-2017';
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

const PAPERS = [
  { session: 'autumn', year: 2015, readingQuestions: 57, clozeQuestions: 16, listeningQuestions: 24, duration: '16:44', translationQuestions: 5, writingRequirements: 2 },
  { session: 'autumn', year: 2016, readingQuestions: 57, clozeQuestions: 16, listeningQuestions: 24, duration: '18:13', translationQuestions: 5, writingRequirements: 2 },
  { session: 'spring', year: 2017, readingQuestions: 50, clozeQuestions: 10, listeningQuestions: 20, duration: '14:39', translationQuestions: 4, writingRequirements: 2 },
  { session: 'autumn', year: 2017, readingQuestions: 50, clozeQuestions: 10, listeningQuestions: 20, duration: '28:16', translationQuestions: 4, writingRequirements: 2 }
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

async function selectSeniorExam(page, session) {
  await page.callMethod('selectStage', { currentTarget: { dataset: { stageId: 'senior' } } });
  await page.callMethod('selectExam', { currentTarget: { dataset: { examId: session } } });
}

async function auditReading(miniProgram, paper) {
  const paperId = `sh-${paper.session}-${paper.year}`;
  const groupKey = paper.session === 'spring' ? '春考' : '秋考';
  const launched = await relaunch(miniProgram, '/pages/reading/index');
  const ready = await waitForData(launched.page, (data) => {
    const group = (((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {});
    return Number(group.count || 0) > 0;
  });
  await launched.page.callMethod('selectStage', { currentTarget: { dataset: { stage: 'senior' } } });
  await launched.page.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: paperId } } });
  const indexData = await launched.page.data();
  const passages = (indexData.selectedDistrictNode && indexData.selectedDistrictNode.passages) || [];
  const expectedIds = READING_SUFFIXES.map((suffix) => `${paperId}-${suffix}`);
  assert(passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${paperId}-order`);
  assert(passages.reduce((sum, item) => sum + Number(item.questionCount || 0), 0) === paper.readingQuestions, `reading-${paperId}-count`);

  const cloze = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-grammar-vocabulary-a`);
  const clozeReady = await waitForData(cloze.page, (data) => data.passage && data.passage._id === `${paperId}-grammar-vocabulary-a` && data.passage.isClozePassage);
  const blanks = clozeReady.data.passage.clozePassageParts.filter((item) => item.type === 'blank');
  const inputs = [].concat(await cloze.page.$$('.library-cloze-inline-input'), await cloze.page.$$('.cloze-inline-input'));
  assert(blanks.length === paper.clozeQuestions, `reading-${paperId}-blank-parts:${blanks.length}`);
  assert(inputs.length === paper.clozeQuestions, `reading-${paperId}-blank-inputs:${inputs.length}`);

  const sectionC = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-reading-c`);
  const sectionCReady = await waitForData(sectionC.page, (data) => data.passage && data.passage._id === `${paperId}-reading-c` && data.passage.questions.length === 4);
  const expectedSectionC = paper.year < 2017 ? '78,79,80,81' : '67,68,69,70';
  assert(sectionCReady.data.passage.questions.map((item) => item.number).join(',') === expectedSectionC, `reading-${paperId}-section-c`);

  let imageReadyMs = 0;
  let imageCount = 0;
  if (paperId === 'sh-autumn-2015') {
    const imagePage = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-reading-bb`);
    const imageReady = await waitForData(imagePage.page, (data) => data.passage && data.passage.images && data.passage.images.length === 1 && data.passage.images[0].src);
    imageCount = (await imagePage.page.$$('.passage-source-image')).length;
    assert(imageCount === 1, `reading-${paperId}-image:${imageCount}`);
    imageReadyMs = imageReady.ms;
  }

  return {
    paperId,
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    clozeReadyMs: clozeReady.ms,
    sectionCReadyMs: sectionCReady.ms,
    imageReadyMs,
    imageCount
  };
}

async function auditWriting(miniProgram, paper) {
  const paperId = `sh-${paper.session}-${paper.year}`;
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count > 0);
  await selectSeniorExam(launched.page, paper.session);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `${paper.year}年` } } });
  const indexData = await launched.page.data();
  const expectedIds = paper.year === 2017
    ? [`${paperId}-summary-writing`, `${paperId}-translation`, `${paperId}-writing`]
    : [`${paperId}-translation`, `${paperId}-writing`];
  assert(indexData.items.map((item) => item.materialItemId).join(',') === expectedIds.join(','), `writing-${paperId}-order`);

  const translation = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-translation`);
  const translationReady = await waitForData(translation.page, (data) => data.isTranslation && (data.translationQuestions || []).length === paper.translationQuestions);
  const translationRows = [].concat(await translation.page.$$('.library-translation-item'), await translation.page.$$('.translation-item'));
  assert(translationRows.length === paper.translationQuestions, `writing-${paperId}-translation-rows:${translationRows.length}`);
  assert(!translationReady.data.translationSubmitted, `writing-${paperId}-translation-hidden`);

  let summaryReadyMs = 0;
  if (paper.year === 2017) {
    const summary = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-summary-writing`);
    const summaryReady = await waitForData(summary.page, (data) => data.prompt && data.prompt._id === `${paperId}-summary-writing`);
    assert(Number(summaryReady.data.prompt.maxWords) === 60, `writing-${paperId}-summary-limit`);
    summaryReadyMs = summaryReady.ms;
  }

  const writing = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-writing`);
  const writingReady = await waitForData(writing.page, (data) => data.prompt && data.prompt._id === `${paperId}-writing`);
  const requirementRows = [].concat(await writing.page.$$('.library-requirement-item'), await writing.page.$$('.requirement-item'));
  assert(writingReady.data.promptDisplay.requirements.length === paper.writingRequirements, `writing-${paperId}-requirements`);
  assert(requirementRows.length === paper.writingRequirements, `writing-${paperId}-requirement-rows:${requirementRows.length}`);

  let imageCount = 0;
  if (paperId === 'sh-autumn-2015') {
    imageCount = [].concat(await writing.page.$$('.library-prompt-image'), await writing.page.$$('.prompt-image')).length;
    assert(imageCount === 1, `writing-${paperId}-image:${imageCount}`);
  }

  return {
    paperId,
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    translationReadyMs: translationReady.ms,
    summaryReadyMs,
    writingReadyMs: writingReady.ms,
    translationCount: translationRows.length,
    requirementCount: requirementRows.length,
    imageCount
  };
}

async function auditListening(miniProgram, paper) {
  const paperId = `sh-${paper.session}-${paper.year}`;
  const itemId = `${paperId}-listening`;
  const launched = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(launched.page, (data) => ((data.stages || []).find((item) => item.stageId === 'senior') || {}).count > 0);
  await selectSeniorExam(launched.page, paper.session);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: paper.session === 'spring' ? '春考' : '秋考' } } });
  const indexData = await launched.page.data();
  assert(indexData.items.some((item) => item.materialItemId === itemId), `listening-${paperId}-index`);

  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const detail = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
    const ready = await waitForData(detail.page, (data) => data.item && data.item._id === itemId && data.questions.length === paper.listeningQuestions && data.audioSrc && !data.audioLoading);
    const expectedSections = paper.year < 2017 ? 'ABC' : 'AB';
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === expectedSections, `listening-${paperId}-sections`);
    assert(ready.data.audioDurationText === paper.duration, `listening-${paperId}-duration:${ready.data.audioDurationText}`);
    if (paperId === 'sh-autumn-2015') {
      assert(ready.data.questions.filter((item) => item.showGroupTitle).length === 4, `listening-${paperId}-groups`);
      assert(ready.data.questions[16].formTitle === 'SRT Service Notes', `listening-${paperId}-form-title`);
      assert(ready.data.questions[16].groupInstruction.includes('NO MORE THAN ONE WORD'), `listening-${paperId}-limit-17-20`);
      assert(ready.data.questions[20].groupInstruction.includes('NO MORE THAN THREE WORDS'), `listening-${paperId}-limit-21-24`);
    }
    const startedAt = Date.now();
    await detail.page.callMethod('toggleAudio');
    await waitForData(detail.page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - startedAt;
    await detail.page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-${paperId}-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs: detail.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }

  return { paperId, itemId, shellMs: launched.shellMs, indexReadyMs: indexReady.ms, duration: paper.duration, rounds };
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
      papers: [],
      screenshots: {},
      grammar: { accepted: 0, reason: 'These papers use inline Grammar and Vocabulary Section A cloze passages' },
      thresholds: { clickToPlayMs: 500 },
      exceptions
    };
    for (const paper of PAPERS) {
      report.papers.push({
        session: paper.session,
        year: paper.year,
        reading: await auditReading(miniProgram, paper),
        writing: await auditWriting(miniProgram, paper),
        listening: await auditListening(miniProgram, paper)
      });
    }
    report.screenshots.reading2015 = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-autumn-2015-reading-bb').then(() => screenshot(miniProgram, 'reading-2015-poster'));
    report.screenshots.writing2015 = await relaunch(miniProgram, '/pages/writing/detail/index?id=sh-autumn-2015-writing').then(() => screenshot(miniProgram, 'writing-2015-guided'));
    report.screenshots.listening2015 = await relaunch(miniProgram, '/pages/material/detail/index?itemId=sh-autumn-2015-listening').then(() => screenshot(miniProgram, 'listening-2015'));
    report.maxClickToPlayMs = Math.max(...report.papers.flatMap((paper) => paper.listening.rounds.map((round) => round.clickToPlayMs)));
    report.passed = !exceptions.length && report.maxClickToPlayMs <= report.thresholds.clickToPlayMs;
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
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
