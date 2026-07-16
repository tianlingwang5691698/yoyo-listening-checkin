#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'player-performance-report.json');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const TARGET_MS = 500;
const ROUNDS = Math.max(1, Number(process.env.AUDIO_PERF_ROUNDS || 3));
const SERIES = [
  ['Pre A1', 'song'], ['Pre A1', 'littlebear'],
  ['A1', 'peppa'], ['A1', 'newconcept1'], ['A1', 'unlock1'], ['A1', 'unlock1thirdedition'], ['A1', 'unlock1workbookthirdedition'], ['A1', 'unlock1workbook'],
  ['A2', 'newconcept2'], ['A2', 'petethecat'], ['A2', 'magictreehouse'], ['A2', 'unlock2'], ['A2', 'unlock2thirdedition'], ['A2', 'unlock2workbookthirdedition'], ['A2', 'unlock2workbook'],
  ['B1', 'newconcept3'], ['B1', 'magictreehouseb1'], ['B1', 'unlock3textbook'], ['B1', 'unlock3thirdedition'], ['B1', 'unlock3workbookthirdedition'], ['B1', 'unlock3'],
  ['B2', 'newconcept4'], ['B2', 'unlock4'], ['B2', 'unlock4thirdedition'], ['B2', 'unlock4workbookthirdedition'], ['B2', 'unlock4workbook']
];
const EXTENDED = new Set(['magictreehouse', 'magictreehouseb1', 'unlock4', 'unlock1workbookthirdedition']);
const FULL_SERIES = new Set(['unlock1workbookthirdedition']);
const SERIES_FILTER = new Set(String(process.env.AUDIO_PERF_SERIES || '').split(',').map((item) => item.trim()).filter(Boolean));
const ACTIVE_SERIES = SERIES_FILTER.size ? SERIES.filter(([, category]) => SERIES_FILTER.has(category)) : SERIES;

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

async function waitFor(check, timeoutMs, intervalMs = 100) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) return result;
    await wait(intervalMs);
  }
  return null;
}

function chooseIndexes(tasks, category) {
  const rows = tasks.map((task, index) => ({ index, durationSec: Number(task.durationSec || 0) }));
  if (FULL_SERIES.has(category)) return rows.map((item) => item.index);
  rows.sort((left, right) => right.durationSec - left.durationSec || left.index - right.index);
  if (!EXTENDED.has(category)) return rows.length ? [rows[0].index] : [];
  return Array.from(new Set([
    rows[0] && rows[0].index,
    rows[Math.floor(rows.length / 2)] && rows[Math.floor(rows.length / 2)].index,
    rows.at(-1) && rows.at(-1).index
  ].filter((index) => index !== undefined)));
}

async function openMaterial(miniProgram, levelId, category) {
  const route = `/pages/listening-material/index?levelId=${encodeURIComponent(levelId)}&category=${encodeURIComponent(category)}`;
  const page = await reLaunchWithRetry(miniProgram, route);
  const tasks = await waitFor(async () => {
    const data = await page.data();
    return Array.isArray(data.tasks) && data.tasks.length ? data.tasks : null;
  }, 12000, 200);
  if (!tasks) throw new Error(`${category} material tasks timeout`);
  return { page, tasks };
}

async function measureTask(miniProgram, materialPage, tasks, index, category, round) {
  const row = tasks[index];
  let openTimedOut = false;
  try {
    await materialPage.callMethod('openTask', { currentTarget: { dataset: { index } } });
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
    openTimedOut = true;
  }
  let lessonPage = await waitFor(async () => {
    const page = await currentPageWithRetry(miniProgram);
    return page && page.path === 'pages/lesson/index' ? page : null;
  }, 8000, 100);
  if (!lessonPage && openTimedOut) {
    await materialPage.callMethod('openTask', { currentTarget: { dataset: { index } } });
    lessonPage = await waitFor(async () => {
      const page = await currentPageWithRetry(miniProgram);
      return page && page.path === 'pages/lesson/index' ? page : null;
    }, 8000, 100);
  }
  if (!lessonPage) throw new Error(`${category}/${row.taskId} lesson route timeout`);
  const prepareStartedAt = Date.now();
  const preparedData = await waitFor(async () => {
    const data = await lessonPage.data();
    return data && data.task && data.task.taskId && data.audioReady ? data : null;
  }, 15000, 50);
  const audioPrepareMs = Date.now() - prepareStartedAt;
  const startedAt = Date.now();
  await lessonPage.callMethod('toggleAudio');
  const playingData = await waitFor(async () => {
    const data = await lessonPage.data();
    return data && data.isPlaying ? data : null;
  }, 15000, 25);
  const clickToPlayMs = playingData ? Date.now() - startedAt : 15000;
  if (playingData) {
    await wait(150);
    await lessonPage.callMethod('toggleAudio');
  }
  return {
    category,
    round,
    taskId: row.taskId,
    title: row.title,
    durationSec: Number(row.durationSec || 0),
    audioPrepareMs,
    clickToPlayMs,
    playbackMode: playingData ? playingData.audioPlaybackMode : 'timeout',
    audioSource: playingData ? playingData.audioSource : 'none',
    passed: !!preparedData && !!playingData && clickToPlayMs <= TARGET_MS
  };
}

async function main() {
  const miniProgram = await automator.launch({
    cliPath: CLI_PATH,
    projectPath: ROOT
  });
  const consoleErrors = [];
  miniProgram.on('exception', (event) => consoleErrors.push(event));
  const results = [];
  try {
    for (let seriesIndex = 0; seriesIndex < ACTIVE_SERIES.length; seriesIndex += 1) {
      const [levelId, category] = ACTIVE_SERIES[seriesIndex];
      const opened = await openMaterial(miniProgram, levelId, category);
      const indexes = chooseIndexes(opened.tasks, category);
      for (const index of indexes) {
        for (let round = 1; round <= ROUNDS; round += 1) {
          results.push(await measureTask(miniProgram, opened.page, opened.tasks, index, category, round));
          if (round < ROUNDS || index !== indexes.at(-1)) {
            const reopened = await openMaterial(miniProgram, levelId, category);
            opened.page = reopened.page;
            opened.tasks = reopened.tasks;
          }
        }
      }
      console.log(`${seriesIndex + 1}/${ACTIVE_SERIES.length} ${category} max=${Math.max(...results.filter((item) => item.category === category).map((item) => item.clickToPlayMs))}ms`);
    }
  } finally {
    miniProgram.disconnect();
  }
  const failures = results.filter((item) => !item.passed);
  const report = {
    passed: failures.length === 0 && consoleErrors.length === 0,
    targetMs: TARGET_MS,
    rounds: ROUNDS,
    seriesCount: ACTIVE_SERIES.length,
    sampleCount: results.length,
    maxClickToPlayMs: Math.max(...results.map((item) => item.clickToPlayMs)),
    maxAudioPrepareMs: Math.max(...results.map((item) => item.audioPrepareMs)),
    failures,
    consoleErrors,
    results
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
