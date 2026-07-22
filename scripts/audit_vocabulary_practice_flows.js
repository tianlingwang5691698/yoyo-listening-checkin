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
const LEVEL = process.env.VOCABULARY_PRACTICE_LEVEL || 'senior-list-3';
const TITLE = process.env.VOCABULARY_PRACTICE_TITLE || '高中英语词汇 List 3';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await page.data();
    if (predicate(data)) return data;
    await page.waitFor(60);
  }
  return page.data();
}

async function screenshot(miniProgram, name) {
  const output = path.join('/tmp', name);
  await miniProgram.screenshot({ path: output });
  return output;
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT });
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('uiTheme', 'library');
      wx.setStorageSync('yoyoLanguageV1', 'zh-CN');
    });

    const home = await miniProgram.reLaunch('/pages/reading/flashcards/index');
    await home.waitFor(300);
    let data = await home.data();
    assert(data.texts.reviewFolderTitle === '单词背诵', '首页缺少单词背诵入口');
    assert(data.texts.wordPracticeTitle === '单词练习', '首页缺少单词练习入口');
    let current = await miniProgram.reLaunch('/pages/reading/flashcards/practice/index');
    await current.waitFor(250);
    assert(current.path === 'pages/reading/flashcards/practice/index', `单词练习路由错误:${current.path}`);
    data = await current.data();
    assert(data.texts.wordMeaning && data.texts.audioMeaning && data.texts.dictation, '缺少三种练习方式');
    const menuScreenshot = await screenshot(miniProgram, 'vocabulary-practice-menu.png');

    const source = `level=${encodeURIComponent(LEVEL)}&title=${encodeURIComponent(TITLE)}`;
    const recognition = await miniProgram.reLaunch(`/pages/reading/flashcards/recognition/index?${source}&practiceMode=word-meaning`);
    data = await waitForData(recognition, (value) => !value.loading);
    assert(!data.debugLines.length, `看词选义加载失败:${data.debugLines.join('|')}`);
    assert(data.availableCount >= 4, `已背单词不足 4 个:${data.availableCount}`);
    await recognition.callMethod('startPractice');
    data = await waitForData(recognition, (value) => value.mode === 'question');
    assert(data.current && data.current.options.length === 4, '看词选义未生成四个选项');
    assert(new Set(data.current.options.map((item) => item.text)).size === 4, '看词选义选项重复');
    await recognition.waitFor(1100);
    data = await recognition.data();
    assert(data.durationSec >= 1 && data.durationText, '看词选义未显示有效用时');
    const wordScreenshot = await screenshot(miniProgram, 'vocabulary-word-meaning.png');

    const audio = await miniProgram.reLaunch(`/pages/reading/flashcards/recognition/index?${source}&practiceMode=audio-meaning`);
    data = await waitForData(audio, (value) => !value.loading);
    assert(!data.debugLines.length, `听音选义加载失败:${data.debugLines.join('|')}`);
    await audio.callMethod('startPractice');
    data = await waitForData(audio, (value) => value.mode === 'question');
    assert(data.practiceMode === 'audio-meaning' && data.current.options.length === 4, '听音选义未正常开题');
    await audio.waitFor(1100);
    data = await audio.data();
    assert(data.durationSec >= 1 && data.durationText, '听音选义未显示有效用时');
    const audioScreenshot = await screenshot(miniProgram, 'vocabulary-audio-meaning.png');

    const menu = await miniProgram.reLaunch(`/pages/reading/flashcards/practice/index?${source}`);
    await menu.callMethod('chooseMode', { currentTarget: { dataset: { mode: 'dictation' } } });
    await menu.waitFor(250);
    current = await miniProgram.currentPage();
    assert(current.path === 'pages/reading/flashcards/dictation/index', `听音拼写路由错误:${current.path}`);
    data = await waitForData(current, (value) => !value.loading);
    assert(data.sourceId === `dictionary-book-${LEVEL}`, '听音拼写未沿用当前词表');
    await current.callMethod('startAllDictation');
    await current.waitFor(1100);
    data = await current.data();
    assert(data.mode === 'dictation' && data.durationSec >= 1 && data.durationText, '听音拼写未显示有效用时');
    const dictationScreenshot = await screenshot(miniProgram, 'vocabulary-dictation-duration.png');

    console.log(JSON.stringify({ ok: true, level: LEVEL, learnedWords: data.availableCount, screenshots: [menuScreenshot, wordScreenshot, audioScreenshot, dictationScreenshot] }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
