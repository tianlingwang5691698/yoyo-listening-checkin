#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function timed(action) {
  const startedAt = Date.now();
  const value = await action();
  return { value, ms: Date.now() - startedAt };
}

async function setTheme(miniProgram, theme) {
  await miniProgram.evaluate((value) => wx.setStorageSync('uiTheme', value), theme);
}

async function setLanguage(miniProgram, language) {
  await miniProgram.evaluate((value) => wx.setStorageSync('yoyoLanguageV1', value), language);
}

async function waitForData(page, predicate, timeoutMs = 1200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await page.data();
    if (predicate(data)) return data;
    await page.waitFor(40);
  }
  return page.data();
}

async function auditTheme(miniProgram, theme, language) {
  await setTheme(miniProgram, theme);
  await setLanguage(miniProgram, language);
  const result = { theme, language };

  let measured = await timed(async () => {
    const page = await miniProgram.reLaunch('/pages/reading/flashcards/index');
    await page.waitFor(150);
    await page.callMethod('openReviewFolder');
    await page.callMethod('openStandardBook', { currentTarget: { dataset: { level: 'ielts' } } });
    return page;
  });
  let page = measured.value;
  let data = await page.data();
  assert(data.theme === theme, `${theme}:flashcards-theme`);
  assert(data.language === language, `${theme}:${language}:flashcards-language`);
  assert(data.sourceMode === 'standard-lists', `${theme}:ielts-list-stage`);
  assert(data.activeStandardLists.length === 48, `${theme}:ielts-list-count`);
  result.flashcardListMs = measured.ms;

  measured = await timed(async () => {
    await page.callMethod('importDictionaryBook', { currentTarget: { dataset: { level: 'ielts-list-1' } } });
    return waitForData(page, (current) => !current.loading && current.planSummary && current.planSummary.total === 76, 4000);
  });
  data = measured.value;
  assert(data.activeSourceId === 'dictionary-book-ielts-list-1', `${theme}:review-source-id`);
  assert(data.planSummary.total === 76, `${theme}:review-list-total`);
  assert(data.settings.newLimit === 76 && data.settings.reviewLimit === 76, `${theme}:${language}:default-list-plan`);
  await page.callMethod('toggleLibraryVisible');
  data = await page.data();
  const firstCard = (((data.libraryGroups || [])[0] || {}).items || [])[0] || {};
  assert(firstCard.example && firstCard.exampleMeaning, `${theme}:${language}:example-pair-missing`);
  assert(/[A-Za-z]/.test(firstCard.example) && /[\u3400-\u9fff]/.test(firstCard.exampleMeaning), `${theme}:${language}:example-language`);
  result.reviewColdMs = measured.ms;
  result.example = firstCard.example;
  result.exampleMeaning = firstCard.exampleMeaning;

  measured = await timed(async () => {
    const shelf = await miniProgram.reLaunch('/pages/reading/flashcards/dictation/library/index');
    await shelf.waitFor(150);
    await shelf.callMethod('showStandardLists', 'ielts');
    return shelf;
  });
  page = measured.value;
  data = await page.data();
  assert(data.theme === theme, `${theme}:dictation-shelf-theme`);
  assert(data.language === language, `${theme}:${language}:dictation-shelf-language`);
  assert(data.stage === 'standard-lists', `${theme}:dictation-list-stage`);
  assert(data.items.length === 48, `${theme}:dictation-list-count:${data.items.length}`);
  result.dictationShelfMs = measured.ms;

  measured = await timed(async () => {
    const spelling = await miniProgram.reLaunch('/pages/reading/flashcards/dictation/index?level=ielts-list-1&title=List%201');
    await waitForData(spelling, (current) => !current.loading);
    return spelling;
  });
  page = measured.value;
  data = await page.data();
  assert(data.theme === theme, `${theme}:dictation-theme`);
  assert(data.language === language, `${theme}:${language}:dictation-language`);
  assert(data.sourceId === 'dictionary-book-ielts-list-1', `${theme}:dictation-source-id`);
  assert(!data.debugLines.length, `${theme}:dictation-debug:${(data.debugLines || []).join('|')}`);
  result.dictationPageMs = measured.ms;
  result.learnedWords = data.availableCount;
  assert(result.flashcardListMs < 800, `${theme}:${language}:flashcard-list-performance:${result.flashcardListMs}`);
  assert(result.reviewColdMs < 800, `${theme}:${language}:review-performance:${result.reviewColdMs}`);
  assert(result.dictationShelfMs < 800, `${theme}:${language}:dictation-shelf-performance:${result.dictationShelfMs}`);
  assert(result.dictationPageMs < 800, `${theme}:${language}:dictation-page-performance:${result.dictationPageMs}`);
  return result;
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT });
  try {
    const warmup = await miniProgram.reLaunch('/pages/reading/flashcards/index');
    await warmup.waitFor(1200);
    await warmup.callMethod('importDictionaryBook', { currentTarget: { dataset: { level: 'ielts-list-1' } } });
    await waitForData(warmup, (current) => !current.loading && current.planSummary && current.planSummary.total === 76, 5000);
    const results = [];
    for (const theme of ['warm', 'library']) {
      for (const language of ['zh-CN', 'en']) results.push(await auditTheme(miniProgram, theme, language));
    }
    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
