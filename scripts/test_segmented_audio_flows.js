#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const ROOT = path.join(__dirname, '..');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'segmented-player-flow-report.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(error) {
  return /timeout/i.test(String((error && error.message) || error || ''));
}

async function currentPageWithRetry(miniProgram) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await miniProgram.currentPage();
    } catch (error) {
      if (!isTimeoutError(error) || attempt === 3) throw error;
      await wait(500 * attempt);
    }
  }
  return null;
}

async function reLaunchWithRetry(miniProgram, route) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await miniProgram.reLaunch(route);
    } catch (error) {
      if (!isTimeoutError(error)) throw error;
      await wait(800 * attempt);
      const page = await currentPageWithRetry(miniProgram);
      if (page && page.path === route.split('?')[0].replace(/^\//, '')) return page;
      if (attempt === 3) throw error;
    }
  }
  return null;
}

async function waitFor(check, timeoutMs, intervalMs = 50) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) return result;
    await wait(intervalMs);
  }
  return null;
}

async function openLesson(miniProgram, levelId, category, taskIndex, planRunType = 'preview') {
  const material = await reLaunchWithRetry(miniProgram, `/pages/listening-material/index?levelId=${encodeURIComponent(levelId)}&category=${encodeURIComponent(category)}`);
  const tasks = await waitFor(async () => {
    const data = await material.data();
    return Array.isArray(data.tasks) && data.tasks.length ? data.tasks : null;
  }, 12000, 100);
  if (!tasks || !tasks[taskIndex]) throw new Error(`${category} task ${taskIndex} missing`);
  try {
    await material.callMethod('openTask', { currentTarget: { dataset: { index: taskIndex } } });
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
  }
  const snapshotTask = tasks[taskIndex];
  const taskId = snapshotTask.taskId;
  if (planRunType !== 'preview') {
    await reLaunchWithRetry(miniProgram, `/pages/lesson/index?category=${encodeURIComponent(category)}&taskId=${encodeURIComponent(taskId)}&planRunType=${planRunType}`);
  }
  const lesson = await waitFor(async () => {
    const page = await currentPageWithRetry(miniProgram);
    if (!page || page.path !== 'pages/lesson/index') return null;
    const data = await page.data();
    return data.task && data.task.taskId === taskId && data.audioReady ? page : null;
  }, 15000, 100);
  if (!lesson) throw new Error(`${category}/${taskId} lesson ready timeout`);
  return { lesson, taskId };
}

async function testCrossSegment(miniProgram, config) {
  const { lesson, taskId } = await openLesson(miniProgram, config.levelId, config.category, config.taskIndex);
  const before = await lesson.data();
  if (!Array.isArray(before.task.audioSegments) || before.task.audioSegments.length < 2) {
    throw new Error(`${config.category}/${taskId} segments missing`);
  }
  if (config.requiresTranscript) {
    await lesson.callMethod('loadTranscript');
    await waitFor(async () => {
      const data = await lesson.data();
      return Array.isArray(data.transcriptLines) && data.transcriptLines.length ? data : null;
    }, 10000, 100);
  }
  await lesson.callMethod('toggleAudio');
  await waitFor(async () => {
    const data = await lesson.data();
    return data.isPlaying ? data : null;
  }, 5000, 50);
  await lesson.callMethod('handleSegmentedAudioEnded');
  const crossed = await waitFor(async () => {
    const data = await lesson.data();
    const position = await lesson.callMethod('getCurrentAudioPositionSeconds');
    return data.isPlaying && Number(position || 0) >= 30 ? Object.assign({}, data, { position }) : null;
  }, 10000, 100);
  if (!crossed) {
    const data = await lesson.data();
    throw new Error(`${config.category}/${taskId} automatic segment switch timeout ${JSON.stringify({
      isPlaying: data.isPlaying,
      currentTimeMs: data.currentTimeMs,
      audioReady: data.audioReady,
      audioResolving: data.audioResolving,
      audioPlaybackMode: data.audioPlaybackMode,
      audioError: data.audioError
    })}`);
  }
  const position = Number(crossed.position || 0);
  if (position < 30) throw new Error(`${config.category}/${taskId} global time reset`);
  await lesson.callMethod('seekAudioTo', 125, { play: true });
  const sought = await waitFor(async () => {
    const data = await lesson.data();
    const seekPosition = await lesson.callMethod('getCurrentAudioPositionSeconds');
    const transcriptReady = !config.requiresTranscript || !!data.activeLine;
    return data.isPlaying && Number(seekPosition || 0) >= 124 && transcriptReady
      ? Object.assign({}, data, { seekPosition })
      : null;
  }, 10000, 100);
  if (!sought) throw new Error(`${config.category}/${taskId} seek/transcript sync timeout`);
  await lesson.callMethod('toggleAudio');
  return {
    category: config.category,
    taskId,
    segmentCount: before.task.audioSegments.length,
    crossedAtMs: Math.floor(position * 1000),
    seekedAtMs: Math.floor(Number(sought.seekPosition || 0) * 1000),
    activeLineId: sought.activeLineId || '',
    playbackMode: sought.audioPlaybackMode,
    passed: true
  };
}

async function testResume(miniProgram) {
  const enableResume = () => {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    current.planRunType = 'normal';
    current.setData({ isPreviewMode: false });
  };
  const opened = await openLesson(miniProgram, 'A2', 'magictreehouse', 0);
  await miniProgram.evaluate(enableResume);
  await opened.lesson.callMethod('seekAudioTo', 125, { play: false });
  await opened.lesson.callMethod('saveListeningResumeCheckpoint', { force: true, positionSec: 125 });
  const openedData = await opened.lesson.data();
  const storageKey = await opened.lesson.callMethod('getListeningResumeStorageKey', openedData.task);
  const savedSnapshot = await miniProgram.callWxMethod('getStorageSync', storageKey);
  const reopened = await openLesson(miniProgram, 'A2', 'magictreehouse', 0);
  await miniProgram.evaluate(enableResume);
  await reopened.lesson.callMethod('restoreListeningResumeCheckpoint', { force: true });
  const restored = await waitFor(async () => {
    const data = await reopened.lesson.data();
    const position = Number(data.currentTimeMs || 0);
    return position >= 124000 && position <= 126000 && !data.isPlaying ? data : null;
  }, 8000, 100);
  if (!restored) {
    const data = await reopened.lesson.data();
    const snapshot = await miniProgram.callWxMethod('getStorageSync', storageKey);
    throw new Error(`${opened.taskId} resume restore timeout ${JSON.stringify({
      currentTimeMs: data.currentTimeMs,
      isPlaying: data.isPlaying,
      isPreviewMode: data.isPreviewMode,
      savedSnapshot,
      snapshot
    })}`);
  }
  await reopened.lesson.callMethod('clearListeningResumeCheckpoint', restored.task);
  return { category: 'magictreehouse', taskId: opened.taskId, restoredAtMs: restored.currentTimeMs, savedSnapshot: !!savedSnapshot, passed: true };
}

async function main() {
  const miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT });
  const consoleErrors = [];
  miniProgram.on('exception', (event) => consoleErrors.push(event));
  const results = [];
  try {
    results.push(await testCrossSegment(miniProgram, { levelId: 'A2', category: 'magictreehouse', taskIndex: 0, requiresTranscript: true }));
    console.log('1/4 magictreehouse flow passed');
    results.push(await testCrossSegment(miniProgram, { levelId: 'B1', category: 'magictreehouseb1', taskIndex: 0, requiresTranscript: true }));
    console.log('2/4 magictreehouseb1 flow passed');
    results.push(await testCrossSegment(miniProgram, { levelId: 'B2', category: 'unlock4', taskIndex: 0, requiresTranscript: false }));
    console.log('3/4 unlock4 flow passed');
    results.push(await testResume(miniProgram));
    console.log('4/4 resume flow passed');
  } finally {
    miniProgram.disconnect();
  }
  const report = { passed: consoleErrors.length === 0, consoleErrors, results };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
