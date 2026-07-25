#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'player-performance-report.json');
const LIST_REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'series-list-performance-report.json');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const WS_ENDPOINT = process.env.WECHAT_AUTOMATOR_WS || 'ws://127.0.0.1:9420';
const AUTOMATOR_PORT = Math.max(1, Number(process.env.WECHAT_AUTOMATOR_PORT || 9420));
const FORCE_LAUNCH = process.env.WECHAT_AUTOMATOR_FORCE_LAUNCH === '1';
const TARGET_MS = 500;
const MATERIAL_LIST_TARGET_MS = 800;
const NAVIGATION_PREFETCH_DWELL_MS = 350;
const ROUNDS = Math.max(1, Number(process.env.AUDIO_PERF_ROUNDS || 3));
const LIST_ONLY = process.env.AUDIO_PERF_LIST_ONLY === '1';
const SERIES = [
  ['Pre A1', 'song'], ['Pre A1', 'littlebear'],
  ['A1', 'peppa'], ['A1', 'juniebjones'], ['A1', 'newconcept1'], ['A1', 'unlock1'], ['A1', 'unlock1thirdedition'], ['A1', 'unlock1workbookthirdedition'], ['A1', 'unlock1workbook'],
  ['A2', 'newconcept2'], ['A2', 'petethecat'], ['A2', 'magictreehouse'], ['A2', 'unlock2'], ['A2', 'unlock2thirdedition'], ['A2', 'unlock2workbookthirdedition'], ['A2', 'unlock2workbook'],
  ['B1', 'newconcept3'], ['B1', 'magictreehouseb1'], ['B1', 'unlock3textbook'], ['B1', 'unlock3thirdedition'], ['B1', 'unlock3workbookthirdedition'], ['B1', 'unlock3'],
  ['B2', 'newconcept4'], ['B2', 'unlock4'], ['B2', 'unlock4thirdedition'], ['B2', 'unlock4workbookthirdedition'], ['B2', 'unlock4workbook']
];
const EXTENDED = new Set(['juniebjones', 'magictreehouse', 'magictreehouseb1', 'unlock4', 'unlock1workbookthirdedition']);
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

async function pageDataWithRetry(page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.data();
    } catch (error) {
      if (!isTimeoutError(error) || attempt === 3) throw error;
      await wait(250 * attempt);
    }
  }
  return {};
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

async function fastReLaunch(miniProgram, route) {
  const expectedPath = route.split('?')[0].replace(/^\//, '');
  miniProgram.evaluate((url) => {
    wx.reLaunch({ url });
    return true;
  }, route).catch(() => null);
  const page = await waitFor(async () => {
    const current = await currentPageWithRetry(miniProgram);
    return current && current.path === expectedPath ? current : null;
  }, 5000, 50);
  return page || reLaunchWithRetry(miniProgram, route);
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

async function openMaterialFromLevelPage(miniProgram, levelPage, levelId, category) {
  const levelStartedAt = Date.now();
  const initialLevelData = await pageDataWithRetry(levelPage);
  if (initialLevelData.selectedLevel !== levelId) {
    levelPage.callMethod('chooseLevel', {
      currentTarget: { dataset: { enabled: true, levelId } }
    }).catch(() => null);
  }
  const selectedData = await waitFor(async () => {
    const data = await pageDataWithRetry(levelPage);
    const hasCategory = (data.materials || []).some((item) => item.category === category);
    return data.selectedLevel === levelId && hasCategory ? data : null;
  }, 12000, 100);
  if (!selectedData) throw new Error(`${category} level navigation timeout`);
  const levelSwitchMs = Date.now() - levelStartedAt;
  await wait(NAVIGATION_PREFETCH_DWELL_MS);
  const event = { currentTarget: { dataset: { category, levelId, disabled: false } } };
  const flowStartedAt = Date.now();
  levelPage.callMethod('prefetchMaterial', event).catch(() => null);
  levelPage.callMethod('openMaterial', event).catch(() => null);
  const page = await waitFor(async () => {
    const current = await currentPageWithRetry(miniProgram);
    return current && current.path === 'pages/listening-material/index' ? current : null;
  }, 8000, 50);
  const materialPage = page || await reLaunchWithRetry(miniProgram, `/pages/listening-material/index?levelId=${encodeURIComponent(levelId)}&category=${encodeURIComponent(category)}`);
  const tasks = await waitFor(async () => {
    const data = await pageDataWithRetry(materialPage);
    return Array.isArray(data.tasks) && data.tasks.length ? data.tasks : null;
  }, 12000, 200);
  if (!tasks) throw new Error(`${category} material tasks timeout`);
  return {
    levelPage,
    page: materialPage,
    tasks,
    flowStartedAt,
    levelSwitchMs,
    materialListMs: Date.now() - flowStartedAt
  };
}

async function openMaterial(miniProgram, levelId, category) {
  const levelPage = await fastReLaunch(miniProgram, '/pages/level/index');
  return openMaterialFromLevelPage(miniProgram, levelPage, levelId, category);
}

async function measureTask(miniProgram, opened, index, category, round) {
  const { tasks } = opened;
  const row = tasks[index];
  console.log(`[sample] ${category}/${row.taskId} round=${round} stage=open-lesson`);
  const lessonStartedAt = Date.now();
  const taskSnapshot = row.taskSnapshot || row;
  const lessonSnapshot = {
    savedAt: Date.now(),
    id: `${row.category}:${row.taskId}`,
    data: {
      category: row.category,
      taskId: row.taskId,
      task: taskSnapshot
    }
  };
  const lessonRoute = `/pages/lesson/index?category=${encodeURIComponent(row.category)}&taskId=${encodeURIComponent(row.taskId)}&planRunType=preview&source=catalog`;
  miniProgram.evaluate((snapshot, url) => {
    wx.setStorageSync('lessonTaskSnapshotV1', snapshot);
    wx.reLaunch({ url });
    return true;
  }, lessonSnapshot, lessonRoute).catch(() => null);
  const lessonPage = await waitFor(async () => {
    const current = await currentPageWithRetry(miniProgram);
    return current && current.path === 'pages/lesson/index' ? current : null;
  }, 5000, 50) || await reLaunchWithRetry(miniProgram, lessonRoute);
  if (!lessonPage) {
    const current = await currentPageWithRetry(miniProgram).catch(() => null);
    const source = row.taskSnapshot || row;
    throw new Error(`${category}/${row.taskId} lesson route timeout current=${current ? current.path : 'unknown'} audio=${!!(source.audioUrl || source.audioCloudPath || source.audioFileId)}`);
  }
  console.log(`[sample] ${category}/${row.taskId} round=${round} stage=prepare-audio`);
  const prepareStartedAt = Date.now();
  const preparedData = await waitFor(async () => {
    const data = await pageDataWithRetry(lessonPage);
    return data && data.task && data.task.taskId ? data : null;
  }, 5000, 50);
  const audioPrepareMs = Date.now() - prepareStartedAt;
  const lessonReadyMs = Date.now() - lessonStartedAt;
  const startedAt = Date.now();
  try {
    await lessonPage.callMethod('toggleAudio');
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
  }
  const playingData = await waitFor(async () => {
    const data = await pageDataWithRetry(lessonPage);
    return data && data.isPlaying ? data : null;
  }, 15000, 25);
  const clickToPlayMs = playingData ? Date.now() - startedAt : 15000;
  const navigationToPlayMs = playingData ? Date.now() - opened.flowStartedAt : 30000;
  if (playingData) {
    await wait(150);
    try {
      await lessonPage.callMethod('toggleAudio');
    } catch (error) {
      if (!isTimeoutError(error)) throw error;
    }
  }
  console.log(`[sample] ${category}/${row.taskId} round=${round} stage=done list=${opened.materialListMs} ready=${lessonReadyMs} play=${clickToPlayMs}`);
  return {
    category,
    round,
    taskId: row.taskId,
    title: row.title,
    durationSec: Number(row.durationSec || 0),
    levelSwitchMs: opened.levelSwitchMs,
    materialListMs: opened.materialListMs,
    lessonReadyMs,
    audioPrepareMs,
    audioReadyBeforeTap: !!(preparedData && preparedData.audioReady),
    clickToPlayMs,
    navigationToPlayMs,
    playbackMode: playingData ? playingData.audioPlaybackMode : 'timeout',
    audioSource: playingData ? playingData.audioSource : 'none',
    passed: !!preparedData
      && !!playingData
      && opened.materialListMs <= MATERIAL_LIST_TARGET_MS
      && clickToPlayMs <= TARGET_MS
  };
}

async function connectAutomation() {
  if (!FORCE_LAUNCH) {
    try {
      const miniProgram = await automator.connect({ wsEndpoint: WS_ENDPOINT });
      console.log(`connected ${WS_ENDPOINT}`);
      return miniProgram;
    } catch (error) {
      console.log(`launching devtools because ${WS_ENDPOINT} is unavailable`);
    }
  }
  return automator.launch({
    cliPath: CLI_PATH,
    projectPath: ROOT,
    port: AUTOMATOR_PORT
  });
}

async function main() {
  const miniProgram = await connectAutomation();
  const consoleErrors = [];
  miniProgram.on('exception', (event) => {
    consoleErrors.push(event);
    console.error('[miniprogram-exception]', JSON.stringify(event));
  });
  const results = [];
  try {
    for (let seriesIndex = 0; seriesIndex < ACTIVE_SERIES.length; seriesIndex += 1) {
      const [levelId, category] = ACTIVE_SERIES[seriesIndex];
      let opened = await openMaterial(miniProgram, levelId, category);
      if (LIST_ONLY) {
        for (let round = 1; round <= ROUNDS; round += 1) {
          results.push({
            category,
            round,
            levelSwitchMs: opened.levelSwitchMs,
            materialListMs: opened.materialListMs,
            passed: opened.materialListMs <= MATERIAL_LIST_TARGET_MS
          });
          if (round < ROUNDS) {
            opened = await openMaterial(miniProgram, levelId, category);
          }
        }
        console.log(`${seriesIndex + 1}/${ACTIVE_SERIES.length} ${category} listMax=${Math.max(...results.filter((item) => item.category === category).map((item) => item.materialListMs))}ms`);
        continue;
      }
      const indexes = chooseIndexes(opened.tasks, category);
      for (const index of indexes) {
        for (let round = 1; round <= ROUNDS; round += 1) {
          try {
            results.push(await measureTask(miniProgram, opened, index, category, round));
          } catch (error) {
            results.push({
              category,
              round,
              taskId: opened.tasks[index] && opened.tasks[index].taskId,
              title: opened.tasks[index] && opened.tasks[index].title,
              durationSec: Number(opened.tasks[index] && opened.tasks[index].durationSec || 0),
              levelSwitchMs: opened.levelSwitchMs,
              materialListMs: opened.materialListMs,
              lessonReadyMs: 15000,
              audioPrepareMs: 15000,
              clickToPlayMs: 15000,
              navigationToPlayMs: 30000,
              playbackMode: 'error',
              audioSource: 'none',
              passed: false,
              error: String((error && error.message) || error)
            });
            console.error(`[sample-error] ${category} round=${round} ${error.message || error}`);
          }
          if (round < ROUNDS || index !== indexes.at(-1)) {
            const reopened = await openMaterial(miniProgram, levelId, category);
            Object.assign(opened, reopened);
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
    mode: LIST_ONLY ? 'series-list' : 'full-player',
    passed: failures.length === 0 && consoleErrors.length === 0,
    targetMs: TARGET_MS,
    materialListTargetMs: MATERIAL_LIST_TARGET_MS,
    navigationPrefetchDwellMs: NAVIGATION_PREFETCH_DWELL_MS,
    rounds: ROUNDS,
    seriesCount: ACTIVE_SERIES.length,
    sampleCount: results.length,
    maxClickToPlayMs: LIST_ONLY ? null : Math.max(...results.map((item) => item.clickToPlayMs)),
    maxMaterialListMs: Math.max(...results.map((item) => item.materialListMs)),
    maxLessonReadyMs: LIST_ONLY ? null : Math.max(...results.map((item) => item.lessonReadyMs)),
    maxNavigationToPlayMs: LIST_ONLY ? null : Math.max(...results.map((item) => item.navigationToPlayMs)),
    maxAudioPrepareMs: LIST_ONLY ? null : Math.max(...results.map((item) => item.audioPrepareMs)),
    failures,
    consoleErrors,
    results
  };
  const reportPath = LIST_ONLY ? LIST_REPORT_PATH : REPORT_PATH;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
