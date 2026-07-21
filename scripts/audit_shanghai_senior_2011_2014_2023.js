#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2011-2014-2023-page.json');
const SCREENSHOT_DIR = '/tmp/shanghai-senior-2011-2014-2023';
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

const PAPERS = [
  {
    session: 'autumn',
    year: 2011,
    readingSuffixes: ['grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c', 'reading-d'],
    readingQuestions: 44,
    writingSuffixes: ['translation'],
    translationQuestions: 5,
    listeningQuestions: 24,
    listeningSections: 'ABC',
    listeningGroups: 4,
    duration: '15:24',
    form: { number: 17, title: 'Complaint Form', label: 'Caller', value: 'Mary White' }
  },
  {
    session: 'autumn',
    year: 2012,
    readingSuffixes: ['grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c', 'reading-d'],
    readingQuestions: 44,
    writingSuffixes: ['translation', 'writing'],
    translationQuestions: 5,
    writingRequirements: 2,
    listeningQuestions: 24,
    listeningSections: 'ABC',
    listeningGroups: 4,
    duration: '15:41',
    form: { number: 17, title: 'Class Registration Form', label: 'Name', value: 'Andrew Smith' }
  },
  {
    session: 'autumn',
    year: 2013,
    readingSuffixes: [],
    writingSuffixes: ['translation', 'writing'],
    translationQuestions: 5,
    writingRequirements: 2,
    listeningQuestions: 24,
    listeningSections: 'ABC',
    listeningGroups: 4,
    duration: '16:21',
    form: { number: 17, title: 'Latest Conference Information' }
  },
  {
    session: 'autumn',
    year: 2014,
    readingSuffixes: ['grammar-vocabulary-a', 'grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c'],
    readingQuestions: 57,
    clozeQuestions: 16,
    writingSuffixes: ['translation', 'writing'],
    translationQuestions: 5,
    writingRequirements: 2,
    listeningQuestions: 24,
    listeningSections: 'ABC',
    listeningGroups: 4,
    duration: '16:48',
    form: { number: 17, title: "Travellers' Survey Sheet" }
  },
  {
    session: 'spring',
    year: 2023,
    readingSuffixes: ['grammar-vocabulary-a', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c'],
    readingQuestions: 40,
    clozeQuestions: 10,
    writingSuffixes: ['summary-writing', 'translation', 'writing'],
    translationQuestions: 4,
    writingRequirements: 2,
    listeningQuestions: 20,
    listeningSections: 'AB',
    listeningGroups: 3,
    duration: '16:03'
  },
  {
    session: 'autumn',
    year: 2023,
    readingSuffixes: ['grammar-vocabulary-a', 'grammar-vocabulary-b', 'reading-a', 'reading-ba', 'reading-bb', 'reading-bc', 'reading-c'],
    readingQuestions: 50,
    clozeQuestions: 10,
    writingSuffixes: ['summary-writing', 'translation', 'writing'],
    translationQuestions: 4,
    writingRequirements: 2,
    listeningQuestions: 20,
    listeningSections: 'AB',
    listeningGroups: 3,
    duration: '16:19'
  }
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
  const expectedPath = route.split('?')[0].replace(/^\//, '');
  let page = await miniProgram.reLaunch(route);
  if (!page || page.path !== expectedPath) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    page = await miniProgram.reLaunch(route);
  }
  assert(page && page.path === expectedPath, `page-route:${route}:${page && page.path}`);
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

  if (!paper.readingSuffixes.length) {
    const data = await launched.page.data();
    const districts = ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).districts || []);
    assert(!districts.some((item) => item.key === paperId), `reading-${paperId}-must-be-absent`);
    return { paperId, skipped: true, reason: 'source paper has no reading content', shellMs: launched.shellMs, indexReadyMs: ready.ms };
  }

  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: paperId } } });
  const data = await launched.page.data();
  const passages = (data.selectedDistrictNode && data.selectedDistrictNode.passages) || [];
  const expectedIds = paper.readingSuffixes.map((suffix) => `${paperId}-${suffix}`);
  assert(passages.map((item) => item._id).join(',') === expectedIds.join(','), `reading-${paperId}-order`);
  assert(passages.reduce((sum, item) => sum + Number(item.questionCount || 0), 0) === paper.readingQuestions, `reading-${paperId}-count`);

  let clozeReadyMs = 0;
  if (paper.clozeQuestions) {
    const cloze = await relaunch(miniProgram, `/pages/reading/detail/index?passageId=${paperId}-grammar-vocabulary-a`);
    const clozeReady = await waitForData(cloze.page, (current) => current.passage && current.passage._id === `${paperId}-grammar-vocabulary-a` && current.passage.isClozePassage);
    const blanks = (clozeReady.data.passage.clozePassageParts || []).filter((item) => item.type === 'blank');
    const inputs = [].concat(await cloze.page.$$('.library-cloze-inline-input'), await cloze.page.$$('.cloze-inline-input'));
    assert(blanks.length === paper.clozeQuestions, `reading-${paperId}-blank-parts:${blanks.length}`);
    assert(inputs.length === paper.clozeQuestions, `reading-${paperId}-blank-inputs:${inputs.length}`);
    clozeReadyMs = clozeReady.ms;
  }

  return { paperId, shellMs: launched.shellMs, indexReadyMs: ready.ms, sectionIds: expectedIds, questionCount: paper.readingQuestions, clozeReadyMs };
}

async function auditWriting(miniProgram, paper) {
  const paperId = `sh-${paper.session}-${paper.year}`;
  const launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  const ready = await waitForData(launched.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'senior') || {}).count || 0) >= 71);
  await selectSeniorExam(launched.page, paper.session);
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: `${paper.year}年` } } });
  const data = await launched.page.data();
  const expectedIds = paper.writingSuffixes.map((suffix) => `${paperId}-${suffix}`);
  assert(data.items.map((item) => item.materialItemId).join(',') === expectedIds.join(','), `writing-${paperId}-order`);

  const translation = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-translation`);
  const translationReady = await waitForData(translation.page, (current) => current.isTranslation && (current.translationQuestions || []).length === paper.translationQuestions);
  assert(!translationReady.data.translationSubmitted, `writing-${paperId}-translation-hidden`);
  const translationRows = [].concat(await translation.page.$$('.library-translation-item'), await translation.page.$$('.translation-item'));
  assert(translationRows.length === paper.translationQuestions, `writing-${paperId}-translation-rows:${translationRows.length}`);

  let summaryReadyMs = 0;
  if (paper.writingSuffixes.includes('summary-writing')) {
    const summary = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-summary-writing`);
    const summaryReady = await waitForData(summary.page, (current) => current.prompt && current.prompt._id === `${paperId}-summary-writing`);
    assert(Number(summaryReady.data.prompt.maxWords) === 60, `writing-${paperId}-summary-limit`);
    summaryReadyMs = summaryReady.ms;
  }

  let writingReadyMs = 0;
  let requirementCount = 0;
  if (paper.writingSuffixes.includes('writing')) {
    const writing = await relaunch(miniProgram, `/pages/writing/detail/index?id=${paperId}-writing`);
    const writingReady = await waitForData(writing.page, (current) => current.prompt && current.prompt._id === `${paperId}-writing`);
    const requirementRows = [].concat(await writing.page.$$('.library-requirement-item'), await writing.page.$$('.requirement-item'));
    assert(writingReady.data.promptDisplay.requirements.length === paper.writingRequirements, `writing-${paperId}-requirements`);
    assert(requirementRows.length === paper.writingRequirements, `writing-${paperId}-requirement-rows:${requirementRows.length}`);
    writingReadyMs = writingReady.ms;
    requirementCount = requirementRows.length;
  }

  return {
    paperId,
    shellMs: launched.shellMs,
    indexReadyMs: ready.ms,
    itemIds: expectedIds,
    translationReadyMs: translationReady.ms,
    translationCount: translationRows.length,
    summaryReadyMs,
    writingReadyMs,
    requirementCount
  };
}

async function auditListening(miniProgram, paper) {
  const paperId = `sh-${paper.session}-${paper.year}`;
  const itemId = `${paperId}-listening`;
  const index = await relaunch(miniProgram, '/pages/material/index?module=listening');
  const indexReady = await waitForData(index.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'senior') || {}).count || 0) >= 24);
  await selectSeniorExam(index.page, paper.session);
  await index.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: paper.session === 'spring' ? '春考' : '秋考' } } });
  const indexData = await index.page.data();
  assert(indexData.items.some((item) => item.materialItemId === itemId), `listening-${paperId}-index`);

  const rounds = [];
  for (let round = 1; round <= 3; round += 1) {
    const detail = await relaunch(miniProgram, `/pages/material/detail/index?itemId=${itemId}`);
    const ready = await waitForData(
      detail.page,
      (data) => data.item && data.item._id === itemId && data.questions.length === paper.listeningQuestions && data.audioSrc && !data.audioLoading,
      60000
    );
    assert(ready.data.questions.map((item) => item.number).join(',') === Array.from({ length: paper.listeningQuestions }, (_, index) => index + 1).join(','), `listening-${paperId}-numbers`);
    assert(ready.data.questions.filter((item) => item.showSectionTitle).map((item) => item.sectionKey).join('') === paper.listeningSections, `listening-${paperId}-sections`);
    assert(ready.data.questions.filter((item) => item.showGroupTitle).length === paper.listeningGroups, `listening-${paperId}-groups`);
    assert(ready.data.audioDurationText === paper.duration, `listening-${paperId}-duration:${ready.data.audioDurationText}`);
    if (paper.form) {
      const formQuestion = ready.data.questions.find((item) => item.number === paper.form.number);
      assert(formQuestion && formQuestion.formTitle === paper.form.title, `listening-${paperId}-form-title`);
      if (paper.form.label) {
        assert((formQuestion.givenRows || []).some((item) => item.label === paper.form.label && item.value === paper.form.value), `listening-${paperId}-form-row`);
      }
    }
    const startedAt = Date.now();
    await detail.page.callMethod('toggleAudio');
    await waitForData(detail.page, (data) => data.isPlaying, 3000);
    const clickToPlayMs = Date.now() - startedAt;
    await detail.page.callMethod('toggleAudio');
    assert(clickToPlayMs <= 500, `listening-${paperId}-play-${round}:${clickToPlayMs}`);
    rounds.push({ round, shellMs: detail.shellMs, detailReadyMs: ready.ms, clickToPlayMs });
  }
  return { paperId, itemId, shellMs: index.shellMs, indexReadyMs: indexReady.ms, duration: paper.duration, rounds };
}

async function auditGrammar(miniProgram) {
  const launched = await relaunch(miniProgram, '/pages/grammar/index');
  const ready = await waitForData(launched.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'senior') || {}).count || 0) === 64);
  await selectSeniorExam(launched.page, 'autumn');
  let data = await launched.page.data();
  const leafTopics = (data.topics || []).flatMap((category) => (category.children || []).map((topic) => ({ categoryId: category.topicId, topicId: topic.topicId, count: topic.count })));
  assert(leafTopics.reduce((sum, item) => sum + Number(item.count || 0), 0) === 64, 'grammar-topic-total');
  const preposition = leafTopics.find((item) => item.topicId === 'lexical:preposition');
  assert(preposition && preposition.count === 4, `grammar-preposition-count:${preposition && preposition.count}`);
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: preposition.categoryId } } });
  await launched.page.callMethod('selectTopic', { currentTarget: { dataset: { topicId: preposition.topicId } } });
  const topicReady = await waitForData(launched.page, (current) => current.selectedTopicId === preposition.topicId && (current.selectedQuestions || []).length === preposition.count);
  const years = topicReady.data.selectedQuestions.map((question) => Number(question.year)).sort();
  assert(years.join(',') === '2009,2010,2011,2012', `grammar-preposition-years:${years.join(',')}`);
  return { shellMs: launched.shellMs, indexReadyMs: ready.ms, total: 64, sampledTopicId: preposition.topicId, sampledYears: years };
}

async function captureScreenshots(miniProgram) {
  const screenshots = {};

  let launched = await relaunch(miniProgram, '/pages/reading/detail/index?passageId=sh-spring-2023-grammar-vocabulary-a');
  await waitForData(launched.page, (data) => data.passage && data.passage._id === 'sh-spring-2023-grammar-vocabulary-a');
  screenshots.reading2023SpringCloze = await screenshot(miniProgram, 'reading-2023-spring-cloze');

  launched = await relaunch(miniProgram, '/pages/material/index?module=writing');
  await waitForData(launched.page, (data) => Number(((data.stages || []).find((item) => item.stageId === 'senior') || {}).count || 0) >= 71);
  await selectSeniorExam(launched.page, 'autumn');
  await launched.page.callMethod('selectDistrict', { currentTarget: { dataset: { district: '2023年' } } });
  screenshots.writing2023AutumnOrder = await screenshot(miniProgram, 'writing-2023-autumn-order');

  launched = await relaunch(miniProgram, '/pages/material/detail/index?itemId=sh-autumn-2011-listening');
  await waitForData(launched.page, (data) => data.item && data.questions.length === 24 && data.audioDurationText === '15:24');
  screenshots.listening2011 = await screenshot(miniProgram, 'listening-2011');

  return screenshots;
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
      grammar: null,
      screenshots: {},
      thresholds: { clickToPlayMs: 500 },
      exceptions
    };

    for (const paper of PAPERS) {
      console.log(`[audit] ${paper.session}-${paper.year} reading`);
      const reading = await auditReading(miniProgram, paper);
      console.log(`[audit] ${paper.session}-${paper.year} writing`);
      const writing = await auditWriting(miniProgram, paper);
      console.log(`[audit] ${paper.session}-${paper.year} listening`);
      const listening = await auditListening(miniProgram, paper);
      report.papers.push({
        session: paper.session,
        year: paper.year,
        reading,
        writing,
        listening
      });
    }
    console.log('[audit] grammar');
    report.grammar = await auditGrammar(miniProgram);
    console.log('[audit] screenshots');
    report.screenshots = await captureScreenshots(miniProgram);
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
