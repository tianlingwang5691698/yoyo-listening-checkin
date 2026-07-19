#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal', 'page-performance-report-grammar-cloze-2021-2022.json');
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

async function waitForPage(miniProgram, expectedPath, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const page = await miniProgram.currentPage();
    if (page && page.path === expectedPath) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`page-navigation-timeout:${expectedPath}`);
}

async function auditPaper(miniProgram, session, year) {
  const itemId = `sh-${session}-${year}-grammar-vocabulary-a`;
  const indexPage = await miniProgram.reLaunch('/pages/reading/index');
  const groupKey = session === 'spring' ? '春考' : '秋考';
  await waitForData(indexPage, (data) => ((((data.categoryRoot || {}).groups || []).find((item) => item.key === groupKey) || {}).count === (session === 'spring' ? 14 : 28)));
  await indexPage.callMethod('selectExamType', { currentTarget: { dataset: { examType: groupKey } } });
  await indexPage.callMethod('selectDistrict', { currentTarget: { dataset: { district: `sh-${session}-${year}` } } });
  const indexData = await indexPage.data();
  assert(indexData.selectedDistrictNode.passages[0]._id === itemId, `${itemId}-paper-order`);
  await indexPage.callMethod('openPassage', { currentTarget: { dataset: { passageId: itemId } } });
  const page = await waitForPage(miniProgram, 'pages/reading/detail/index');
  const ready = await waitForData(page, (data) => data.passage && data.passage._id === itemId && data.passage.isClozePassage);
  const blankParts = ready.data.passage.clozePassageParts.filter((item) => item.type === 'blank');
  assert(ready.data.passage.questions.length === 10, `${itemId}-questions`);
  assert(blankParts.length === 10, `${itemId}-parts`);
  assert(ready.data.passage.passage.includes('Grammar and Vocabulary') === false, `${itemId}-heading-duplicate`);
  const inputs = [].concat(await page.$$('.library-cloze-inline-input'), await page.$$('.cloze-inline-input'));
  assert(inputs.length === 10, `${itemId}-rendered-inputs:${inputs.length}`);
  if (session === 'spring' && year === 2022) {
    assert(ready.data.passage.passage.includes('(come)') || ready.data.passage.passage.includes('（come）'), `${itemId}-given-word`);
    assert(ready.data.passage.questions.find((item) => item.number === 27).acceptedAnswers.join(',') === 'when,as', `${itemId}-alternatives`);
  }
  if (session === 'spring' && year === 2021) {
    assert(ready.data.passage.questions.map((item) => item.number).join(',') === '1,2,3,4,5,6,7,8,9,10', `${itemId}-original-numbers`);
  } else {
    assert(ready.data.passage.questions.map((item) => item.number).join(',') === '21,22,23,24,25,26,27,28,29,30', `${itemId}-original-numbers`);
  }
  return { readyMs: ready.ms, renderedInputs: inputs.length };
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: Number(process.env.WECHAT_AUTOMATOR_PORT || 9420) });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
    });
    const report = { passed: false, papers: {}, exceptions };
    for (const year of [2021, 2022]) {
      for (const session of ['spring', 'autumn']) {
        report.papers[`${year}-${session}`] = await auditPaper(miniProgram, session, year);
      }
    }
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
