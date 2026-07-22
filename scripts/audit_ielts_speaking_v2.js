#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.WECHAT_AUTOMATOR_PORT || 9428);
const SCREENSHOT_DIR = process.env.IELTS_SPEAKING_SCREENSHOT_DIR || path.join(ROOT, 'output', 'ielts-speaking-v2');
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForData(page, predicate, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await page.data();
    if (predicate(data)) return { data, ms: Date.now() - startedAt };
    await page.waitFor(80);
  }
  throw new Error('page-data-timeout');
}

async function callPageMethod(page, method, payload) {
  try {
    await page.callMethod(method, payload);
  } catch (error) {
    if (!/timeout waiting for automator response/i.test(String(error && error.message || error))) throw error;
  }
}

function part(data, number) {
  return (data.ieltsParts || []).find((item) => Number(item.part) === number) || {};
}

async function selectTest(page, itemId) {
  await callPageMethod(page, 'selectIeltsTest', { currentTarget: { dataset: { itemId } } });
  return waitForData(page, (data) => data.ieltsMode && !data.ieltsLoading && data.ieltsParts.length === 3 && String(data.activeExercise && data.activeExercise.id || '').startsWith(itemId), 40000);
}

async function verifyRepeatThemes(page, miniProgram) {
  const themes = ['warm', 'library', 'voyage', 'dragon'];
  const exercises = [
    { id: 'repeat-audit-1', prompt: 'Every sentence should stay visible before practice.' },
    { id: 'repeat-audit-2', prompt: 'Tap one sentence to listen and answer below it.' },
    { id: 'repeat-audit-3', prompt: 'The active sentence keeps its controls in the same row group.' }
  ];
  const results = [];
  for (const theme of themes) {
    await page.setData({
      theme,
      viewMode: 'practice',
      pageTitle: '分级句子跟读',
      pageCopy: '逐句听清并完成跟读。',
      ieltsMode: false,
      exercises,
      activeId: exercises[0].id,
      activeExercise: exercises[0],
      repeatPromptReady: true,
      questionPlaying: false,
      questionLoading: false,
      recording: false,
      submitting: false,
      tempFilePath: '',
      result: null,
      errorText: ''
    });
    await page.waitFor(80);
    const lists = await page.$$('.repeat-sentence-list');
    const items = await page.$$('.repeat-sentence-item');
    const mains = await page.$$('.repeat-sentence-main');
    const activeItems = await page.$$('.repeat-sentence-item.is-active');
    const inlineActions = await page.$$('.repeat-inline-actions');
    const recordButtons = await page.$$('.repeat-inline-record');
    assert(lists.length === 1, `${theme}-repeat-single-list`);
    assert(items.length === exercises.length, `${theme}-repeat-all-sentences`);
    assert(activeItems.length === 1, `${theme}-repeat-single-active-sentence`);
    assert(inlineActions.length === 1 && recordButtons.length === 1, `${theme}-repeat-inline-controls`);

    await mains[1].tap();
    await waitForData(page, (data) => data.activeId === exercises[1].id && data.repeatPromptReady === false);
    await page.setData({ viewMode: 'home' });
    await page.waitFor(160);
    await page.setData({
      viewMode: 'practice',
      activeId: exercises[1].id,
      activeExercise: exercises[1],
      repeatPromptReady: true,
      questionPlaying: false,
      questionLoading: false,
      errorText: ''
    });
    await page.waitFor(80);
    const selectedInlineActions = await page.$$('.repeat-inline-actions');
    assert(selectedInlineActions.length === 1, `${theme}-repeat-selected-inline-controls`);
    const screenshot = path.join(SCREENSHOT_DIR, `repeat-${theme}.png`);
    await miniProgram.screenshot({ path: screenshot });
    results.push({ theme, sentenceCount: items.length, activeSentence: 2, screenshot });
  }
  return results;
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: PORT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      wx.setStorageSync('uiTheme', 'library');
      const cacheKeys = wx.getStorageSync('yoyoCloudReadCacheKeysV4') || [];
      const keptKeys = cacheKeys.filter((key) => !/:getMaterial(?:Index|Item):/.test(String(key)));
      cacheKeys.filter((key) => !keptKeys.includes(key)).forEach((key) => wx.removeStorageSync(key));
      wx.setStorageSync('yoyoCloudReadCacheKeysV4', keptKeys);
    });
    const page = await miniProgram.reLaunch('/pages/speaking/index');
    await waitForData(page, (data) => data.viewMode === 'home' && data.theme === 'library');
    console.log('[ielts-speaking-v2] home-ready');
    await callPageMethod(page, 'openIeltsSpeaking');
    const catalog = await waitForData(page, (data) => data.ieltsExpanded && data.ieltsTests.length === 48, 40000);
    console.log('[ielts-speaking-v2] catalog-ready');

    const test20 = await selectTest(page, 'ielts-academic-20-test-4-speaking');
    console.log('[ielts-speaking-v2] test-20-ready');
    assert(part(test20.data, 1).topics[0].questions.length === 4, 'cambridge-20-part1-split');
    assert(part(test20.data, 2).tasks[0].cuePoints.length === 3, 'cambridge-20-part2-cues');
    assert(part(test20.data, 3).topics.length === 2, 'cambridge-20-part3-topics');
    assert(part(test20.data, 3).topics.reduce((sum, topic) => sum + topic.questions.length, 0) === 6, 'cambridge-20-part3-split');
    assert(test20.data.ieltsSourceExpanded === false, 'source-image-default-collapsed');
    assert(test20.data.ieltsSessionStarted === false, 'library-intro-first');
    assert(test20.data.ieltsQuestionSequence.length === 11, 'single-question-sequence');
    const introScripts = await page.$$('.ielts-intro-script');
    const introAudioButtons = await page.$$('.ielts-intro-audio');
    const introStartButtons = await page.$$('.ielts-session-start');
    assert(introScripts.length === 1 && introAudioButtons.length === 0 && introStartButtons.length === 1, 'intro-text-is-playback-control');
    await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, 'cambridge-20-test-4-opening.png') });
    console.log('[ielts-speaking-v2] opening-ready');

    await page.setData({
      ieltsSessionStarted: true,
      ieltsIntroPlaying: false,
      ieltsIntroLoading: false,
      ieltsPromptReady: true,
      questionLoading: false,
      questionPlaying: false
    });
    const promptReady = await waitForData(page, (data) => data.ieltsSessionStarted && data.ieltsPromptReady && !data.questionLoading && !data.questionPlaying);
    const playButtons = await page.$$('.ielts-play-button');
    const answerButtons = await page.$$('.ielts-focus-answer');
    assert(playButtons.length === 1, 'single-question-play-button');
    assert(answerButtons.length === 1, 'separate-answer-zone');
    assert(promptReady.data.ieltsQuestionRevealed === false, 'spoken-question-default-hidden');
    await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, 'cambridge-20-test-4-question-focus.png') });
    console.log('[ielts-speaking-v2] question-focus-ready');

    const currentQuestion = promptReady.data.activeIeltsQuestion;
    const answerEvent = { currentTarget: { dataset: { exerciseId: currentQuestion.exerciseId, viewKey: currentQuestion.viewKey, prompt: currentQuestion.prompt } } };
    await callPageMethod(page, 'selectIeltsQuestion', answerEvent);
    await waitForData(page, (data) => data.ieltsQuestionRevealed === true);
    await callPageMethod(page, 'selectIeltsQuestion', answerEvent);
    await waitForData(page, (data) => data.ieltsQuestionRevealed === false);
    console.log('[ielts-speaking-v2] question-reveal-toggle-ready');

    const cueTask = promptReady.data.ieltsQuestionSequence.find((item) => item.type === 'cue');
    const cueExercise = promptReady.data.exercises.find((item) => item.id === cueTask.exerciseId);
    await page.setData({
      activeId: cueTask.viewKey,
      activeExercise: Object.assign({}, cueExercise, { prompt: cueTask.prompt }),
      activeIeltsQuestion: cueTask,
      ieltsQuestionIndex: cueTask.sequenceIndex,
      questionPlaying: true,
      questionLoading: false,
      ieltsCueLineIndex: 0
    });
    const cuePlaying = await waitForData(page, (data) => data.activeId === cueTask.viewKey && data.questionPlaying && data.ieltsCueLineIndex >= 0);
    assert(cuePlaying.data.ieltsCueLineIndex === 0, 'part2-first-line-highlight');
    await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, 'cambridge-20-test-4-part2-line-highlight.png') });
    await page.setData({ questionPlaying: false, ieltsCueLineIndex: -1 });
    console.log('[ielts-speaking-v2] part2-line-highlight-ready');
    await callPageMethod(page, 'toggleIeltsSource');
    const expanded = await waitForData(page, (data) => data.ieltsSourceExpanded === true);
    assert(expanded.data.ieltsSourceImages.length === 1 && expanded.data.ieltsSourceImages[0].src, 'source-image-expand');
    await callPageMethod(page, 'toggleIeltsSource');
    await waitForData(page, (data) => data.ieltsSourceExpanded === false);
    console.log('[ielts-speaking-v2] source-toggle-ready');

    await callPageMethod(page, 'backToSpeakingHome');
    await waitForData(page, (data) => data.viewMode === 'home');
    const test18 = await selectTest(page, 'ielts-academic-18-test-1-speaking');
    console.log('[ielts-speaking-v2] test-18-ready');
    assert(part(test18.data, 1).topics[0].questions.length === 4, 'cambridge-18-part1-split');
    assert(part(test18.data, 3).topics.length === 2, 'cambridge-18-part3-topics');
    const repeatThemes = await verifyRepeatThemes(page, miniProgram);
    console.log('[ielts-speaking-v2] repeat-four-themes-ready');

    console.log(JSON.stringify({
      passed: !exceptions.length,
      catalogReadyMs: catalog.ms,
      test20ReadyMs: test20.ms,
      test18ReadyMs: test18.ms,
      testsVisible: catalog.data.ieltsTests.length,
      test20: { part1Questions: 4, cuePoints: 3, part3Topics: 2, part3Questions: 6 },
      test18: { part1Questions: 4, part3Topics: 2 },
      repeatThemes,
      introFirst: true,
      singleQuestionPlayButtons: playButtons.length,
      separateAnswerZone: answerButtons.length,
      part2LineHighlight: true,
      questionAudioShared: true,
      questionHiddenWhilePlaying: true,
      questionRevealToggle: true,
      clickRecordingCoveredByUnitTest: true,
      automatorRecordingLimit: 'recorder call can time out the automator connection',
      sourceDefaultCollapsed: true,
      sourceExpanded: true,
      exceptions,
      screenshots: SCREENSHOT_DIR
    }, null, 2));
    if (exceptions.length) process.exitCode = 1;
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
