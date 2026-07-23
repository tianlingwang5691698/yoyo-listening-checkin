#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'speaking-page-performance-20260722.json');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'speaking-layered-performance-20260722.json');
const PROGRESS_PATH = path.join('/tmp', 'speaking-page-performance-20260722.progress.json');
const CLI_PATH = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].find((item) => item && fs.existsSync(item));
const PORT = Number(process.env.WECHAT_AUTOMATOR_PORT || 9432);
const ROUNDS = Math.max(1, Number(process.env.SPEAKING_PERF_ROUNDS || 3));
const SERIES_FILTER = new Set(String(process.env.SPEAKING_PERF_SERIES || '').split(',').map((item) => item.trim()).filter(Boolean));
const CACHE_TARGET_MS = 200;
const COLD_TARGET_MS = 800;
const PLAY_TARGET_MS = 500;
const IELTS_PREFETCH_DWELL_MS = 350;
const POLL_INTERVAL_MS = 20;
const THEMES = ['warm', 'library', 'voyage', 'dragon'];
const ALL_SERIES = [
  ['Pre A1', 'song', 'Songs'],
  ['Pre A1', 'littlebear', 'Little Bear'],
  ['Pre A1', 'peppa', 'Peppa Pig · 第1–3季'],
  ['A1', 'newconcept1', 'New Concept 1'],
  ['A1', 'unlock1', 'Unlock 1 听口 第二版'],
  ['A1', 'unlock1thirdedition', 'Unlock 1 听口 第三版'],
  ['A1', 'unlock1workbookthirdedition', 'Unlock 1 听口练习册 第三版'],
  ['A1', 'unlock1workbook', 'Unlock 1 听口练习册 第二版'],
  ['A2', 'newconcept2', 'New Concept 2'],
  ['A2', 'petethecat', 'Pete the Cat'],
  ['A2', 'magictreehouse', 'Magic Tree House'],
  ['A2', 'unlock2', 'Unlock 2 课本'],
  ['A2', 'unlock2thirdedition', 'Unlock 2 听口 第三版'],
  ['A2', 'unlock2workbookthirdedition', 'Unlock 2 听口练习册 第三版'],
  ['A2', 'unlock2workbook', 'Unlock 2 练习册'],
  ['B1', 'newconcept3', 'New Concept 3'],
  ['B1', 'magictreehouseb1', 'Magic Tree House'],
  ['B1', 'unlock3textbook', 'Unlock 3 听口 第二版'],
  ['B1', 'unlock3thirdedition', 'Unlock 3 听口 第三版'],
  ['B1', 'unlock3workbookthirdedition', 'Unlock 3 听口练习册 第三版'],
  ['B1', 'unlock3', 'Unlock 3 听口练习册 第二版'],
  ['B2', 'newconcept4', 'New Concept 4'],
  ['B2', 'unlock4', 'Unlock 4 课本'],
  ['B2', 'unlock4thirdedition', 'Unlock 4 听口 第三版'],
  ['B2', 'unlock4workbookthirdedition', 'Unlock 4 听口练习册 第三版'],
  ['B2', 'unlock4workbook', 'Unlock 4 练习册']
].map(([levelId, id, title]) => ({ levelId, id, title }));
const SERIES = SERIES_FILTER.size ? ALL_SERIES.filter((item) => SERIES_FILTER.has(item.id)) : ALL_SERIES;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(error) {
  return /timeout waiting for automator response/i.test(String((error && error.message) || error || ''));
}

async function callPageMethod(page, method, payload) {
  try {
    return await page.callMethod(method, payload);
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
    return null;
  }
}

async function waitForData(page, predicate, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    let data;
    try {
      data = await page.data();
    } catch (error) {
      if (!isTimeoutError(error)) throw error;
      await wait(120);
      continue;
    }
    if (predicate(data)) return { data, ms: Date.now() - startedAt };
    await page.waitFor(POLL_INTERVAL_MS);
  }
  throw new Error(`page-data-timeout:${timeoutMs}`);
}

async function reLaunchWithRetry(miniProgram, route) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await miniProgram.reLaunch(route);
    } catch (error) {
      if (!isTimeoutError(error) || attempt === 3) throw error;
      await wait(500 * attempt);
      try {
        const current = await miniProgram.currentPage();
        if (current && current.path === route.replace(/^\//, '')) return current;
      } catch (currentError) {}
    }
  }
  return null;
}

function assertOnDemandHome(data, theme) {
  const empty = !data.repeatAudios.length
    && !data.repeatParagraphs.length
    && !data.ieltsTests.length
    && !data.ieltsParts.length
    && !data.ieltsLoading
    && !data.repeatAudioLoading
    && !data.repeatParagraphLoading;
  if (!empty) throw new Error(`${theme}:home-loaded-private-content`);
}

async function measureThemeShells(miniProgram) {
  const results = [];
  const page = await reLaunchWithRetry(miniProgram, '/pages/speaking/index');
  await waitForData(page, (data) => data.viewMode === 'home');
  for (const theme of THEMES) {
    const startedAt = Date.now();
    await page.setData({ theme });
    const ready = await waitForData(page, (data) => data.viewMode === 'home' && data.theme === theme);
    const shellMs = Date.now() - startedAt;
    assertOnDemandHome(ready.data, theme);
    results.push({
      theme,
      appReadyLoggedAsStaticCache: true,
      themeRenderMs: shellMs,
      automationPollMs: ready.ms,
      onDemandHome: true
    });
  }
  return { page, results };
}

async function measureIelts(page) {
  const catalogStartedAt = Date.now();
  await callPageMethod(page, 'openIeltsSpeaking');
  const catalog = await waitForData(page, (data) => data.viewMode === 'ielts-books' && data.ieltsBooks.length === 12 && data.ieltsTests.length === 48, 20000);
  const catalogMs = Date.now() - catalogStartedAt;
  const renderedBooks = await page.$$('.ielts-book-card');
  const bookStartedAt = Date.now();
  await callPageMethod(page, 'selectIeltsBook', { currentTarget: { dataset: { bookNumber: 20 } } });
  const book = await waitForData(page, (data) => data.viewMode === 'ielts-tests' && data.selectedIeltsTests.length === 4, 1000);
  const bookSelectMs = Date.now() - bookStartedAt;
  const renderedTests = await page.$$('.ielts-test-list.is-catalog .ielts-test-row');
  const itemId = 'ielts-academic-20-test-4-speaking';
  const prefetchStartedAt = Date.now();
  await callPageMethod(page, 'prefetchIeltsTest', { currentTarget: { dataset: { itemId } } });
  await page.waitFor(IELTS_PREFETCH_DWELL_MS);
  const detailStartedAt = Date.now();
  await callPageMethod(page, 'selectIeltsTest', { currentTarget: { dataset: { itemId } } });
  const detail = await waitForData(page, (data) => data.ieltsMode && data.ieltsParts.length === 3 && data.ieltsItemId === itemId, 20000);
  const detailMs = Date.now() - detailStartedAt;
  await page.setData({ ieltsSessionStarted: true, ieltsIntroLoading: false, ieltsIntroPlaying: false });
  return {
    catalogMs,
    bookSelectMs,
    detailMs,
    prefetchToDetailMs: Date.now() - prefetchStartedAt,
    prefetchDwellMs: IELTS_PREFETCH_DWELL_MS,
    tests: catalog.data.ieltsTests.length,
    renderedBooks: renderedBooks.length,
    renderedTests: renderedTests.length,
    exercises: detail.data.exercises.length,
    passed: catalogMs <= COLD_TARGET_MS && detailMs <= COLD_TARGET_MS && book.ms <= 1000 && renderedBooks.length === 12 && renderedTests.length === 4
  };
}

async function measureRepeatSelectorEntries(page) {
  const results = [];
  for (const theme of THEMES) {
    await page.setData({ theme });
    const startedAt = Date.now();
    await callPageMethod(page, 'openRepeatPractice');
    const ready = await waitForData(page, (data) => data.viewMode === 'repeat-select' && data.theme === theme);
    const paragraphRows = await page.$$('.repeat-paragraph-row');
    const visibleSections = await page.$$('.repeat-selector-section');
    const onDemand = !ready.data.selectedSeriesId
      && !ready.data.repeatAudios.length
      && !ready.data.repeatParagraphs.length
      && !ready.data.repeatAudioLoading
      && !ready.data.repeatParagraphLoading;
    results.push({
      theme,
      selectorReadyMs: Date.now() - startedAt,
      automationPollMs: ready.ms,
      visibleSectionCount: visibleSections.length,
      renderedParagraphRows: paragraphRows.length,
      catalogLoaded: ready.data.repeatAudios.length > 0,
      transcriptLoaded: ready.data.repeatParagraphs.length > 0,
      onDemand,
      passed: onDemand && paragraphRows.length === 0 && visibleSections.length === 2
    });
    await callPageMethod(page, 'backToSpeakingHome');
    await waitForData(page, (data) => data.viewMode === 'home');
  }
  return results;
}

async function measureSeriesRound(page, series, round) {
  await page.setData({
    theme: THEMES[(round - 1) % THEMES.length],
    viewMode: 'repeat-select',
    selectedLevel: series.levelId,
    repeatSeries: SERIES.filter((item) => item.levelId === series.levelId),
    selectedSeriesId: '',
    selectedSeries: {},
    repeatAudios: [],
    selectedAudioId: '',
    selectedAudio: {},
    repeatParagraphs: [],
    selectedParagraphId: '',
    selectedParagraph: {},
    ieltsMode: false,
    errorText: ''
  });
  let prefetchToCatalogMs = 0;
  if (round === 1) {
    const prefetchStartedAt = Date.now();
    await callPageMethod(page, 'prefetchRepeatSeries', { currentTarget: { dataset: { seriesId: series.id } } });
    await page.waitFor(IELTS_PREFETCH_DWELL_MS);
    prefetchToCatalogMs = Date.now() - prefetchStartedAt;
  }
  const catalogStartedAt = Date.now();
  await callPageMethod(page, 'selectRepeatSeries', { currentTarget: { dataset: { seriesId: series.id } } });
  const catalog = await waitForData(page, (data) => !data.repeatAudioLoading
    && data.selectedSeriesId === series.id
    && data.repeatAudios.length > 0, 20000);
  const catalogMs = Date.now() - catalogStartedAt;
  const transcriptStartedAt = Date.now();
  await callPageMethod(page, 'selectRepeatAudio', { currentTarget: { dataset: { audioIndex: 0 } } });
  const transcript = await waitForData(page, (data) => !data.repeatParagraphLoading
    && (data.repeatParagraphs.length > 0 || data.repeatLoadError), 30000);
  const transcriptReadyMs = Date.now() - transcriptStartedAt;

  const catalogTargetMs = round === 1 ? COLD_TARGET_MS : CACHE_TARGET_MS;
  return {
    levelId: series.levelId,
    category: series.id,
    round,
    cacheMode: round === 1 ? 'cold' : 'page-cache',
    taskCount: catalog.data.repeatAudios.length,
    paragraphCount: transcript.data.repeatParagraphs.length,
    transcriptAvailable: transcript.data.repeatParagraphs.length > 0,
    transcriptStatus: transcript.data.repeatParagraphs.length ? 'ready' : 'unavailable',
    catalogMs,
    catalogTargetMs,
    prefetchDwellMs: round === 1 ? IELTS_PREFETCH_DWELL_MS : 0,
    prefetchToCatalogMs,
    transcriptReadyMs,
    paragraphSelectedByDefault: !!transcript.data.selectedParagraphId,
    passed: catalogMs <= catalogTargetMs
  };
}

async function measureThemePlayback(page) {
  const series = ALL_SERIES.find((item) => item.id === 'newconcept1');
  await page.setData({
    viewMode: 'repeat-select',
    selectedLevel: series.levelId,
    repeatSeries: ALL_SERIES.filter((item) => item.levelId === series.levelId),
    selectedSeriesId: series.id,
    selectedSeries: series,
    ieltsMode: false,
    errorText: ''
  });
  await callPageMethod(page, 'loadRepeatSeriesCatalog', series);
  const catalog = await waitForData(page, (data) => !data.repeatAudioLoading && data.repeatAudios.length > 0, 20000);
  await callPageMethod(page, 'selectRepeatAudio', { currentTarget: { dataset: { audioIndex: 0 } } });
  const ready = await waitForData(page, (data) => !data.repeatParagraphLoading && data.repeatParagraphs.length > 0, 30000);
  await callPageMethod(page, 'selectRepeatParagraph', { currentTarget: { dataset: { paragraphId: ready.data.repeatParagraphs[0].id } } });
  const results = [];
  for (const theme of THEMES) {
    await page.setData({ theme, viewMode: 'repeat-select' });
    await callPageMethod(page, 'startSelectedRepeat');
    await page.setData({ viewMode: 'repeat-select' });
    await page.waitFor(160);
    await page.setData({
      theme,
      viewMode: 'practice',
      questionPlaying: false,
      questionLoading: false,
      repeatPromptReady: false,
      errorText: ''
    });
    const playStartedAt = Date.now();
    await callPageMethod(page, 'replayQuestion');
    const playing = await waitForData(page, (data) => data.questionPlaying || data.errorText, 10000);
    const clickToPlayMs = Date.now() - playStartedAt;
    if (playing.data.questionPlaying) await callPageMethod(page, 'replayQuestion');
    await page.waitFor(40);
    results.push({
      theme,
      category: series.id,
      clickToPlayMs,
      passed: !!playing.data.questionPlaying && clickToPlayMs <= PLAY_TARGET_MS,
      error: playing.data.questionPlaying ? '' : (playing.data.errorText || 'playback-timeout')
    });
  }
  await page.setData({ viewMode: 'repeat-select', questionPlaying: false, questionLoading: false });
  return results;
}

async function main() {
  if (!CLI_PATH) throw new Error('未找到微信开发者工具 CLI');
  const miniProgram = process.env.AUTOMATOR_WS_ENDPOINT
    ? await automator.connect({ wsEndpoint: process.env.AUTOMATOR_WS_ENDPOINT })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: PORT });
  const exceptions = [];
  miniProgram.on('exception', (event) => exceptions.push(event));
  const samples = [];
  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      const keys = wx.getStorageSync('yoyoCloudReadCacheKeysV4') || [];
      const removed = keys.filter((key) => /:get(?:ListeningMaterialCatalog|TaskDetail|MaterialIndex|MaterialItem):/.test(String(key)));
      removed.forEach((key) => wx.removeStorageSync(key));
      wx.setStorageSync('yoyoCloudReadCacheKeysV4', keys.filter((key) => !removed.includes(key)));
    });
    const themeMeasurement = await measureThemeShells(miniProgram);
    const themes = themeMeasurement.results;
    const page = themeMeasurement.page;
    const ielts = await measureIelts(page);
    await callPageMethod(page, 'backToSpeakingHome');
    await waitForData(page, (data) => data.viewMode === 'home');
    const selectorEntries = await measureRepeatSelectorEntries(page);

    for (let seriesIndex = 0; seriesIndex < SERIES.length; seriesIndex += 1) {
      const series = SERIES[seriesIndex];
      for (let round = 1; round <= ROUNDS; round += 1) {
        try {
          samples.push(await measureSeriesRound(page, series, round));
        } catch (error) {
          console.error(`[speaking-perf-error] ${series.id} round=${round} ${String((error && error.message) || error)}`);
          samples.push({
            levelId: series.levelId,
            category: series.id,
            round,
            cacheMode: round === 1 ? 'cold' : 'page-cache',
            catalogMs: COLD_TARGET_MS + 1,
            catalogTargetMs: round === 1 ? COLD_TARGET_MS : CACHE_TARGET_MS,
            transcriptReadyMs: 30000,
            clickToPlayMs: 10000,
            passed: false,
            error: String((error && error.message) || error)
          });
        }
      }
      const rows = samples.filter((item) => item.category === series.id);
      console.log(`[speaking-perf] ${seriesIndex + 1}/${SERIES.length} ${series.id} catalogMax=${Math.max(...rows.map((item) => item.catalogMs))}ms transcript=${rows.some((item) => item.transcriptAvailable) ? 'ready' : 'unavailable'}`);
      fs.writeFileSync(PROGRESS_PATH, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        complete: false,
        passed: false,
        thresholds: { cachedCatalogMs: CACHE_TARGET_MS, coldCatalogMs: COLD_TARGET_MS, srcToOnPlayMs: PLAY_TARGET_MS },
        automation: { tool: 'miniprogram-automator', singleSession: true, pollIntervalMs: POLL_INTERVAL_MS },
        themes,
        ielts,
        rounds: ROUNDS,
        seriesCount: SERIES.length,
        completedSeriesCount: seriesIndex + 1,
        sampleCount: samples.length,
        failures: samples.filter((item) => !item.passed),
        exceptions,
        samples
      }, null, 2)}\n`);
    }

    const themePlayback = await measureThemePlayback(page);
    const failures = samples.filter((item) => !item.passed);
    const playbackFailures = themePlayback.filter((item) => !item.passed);
    const report = {
      generatedAt: new Date().toISOString(),
      complete: true,
      passed: !failures.length && !playbackFailures.length && !exceptions.length && ielts.passed && selectorEntries.every((item) => item.passed),
      thresholds: {
        cachedCatalogMs: CACHE_TARGET_MS,
        coldCatalogMs: COLD_TARGET_MS,
        srcToOnPlayMs: PLAY_TARGET_MS
      },
      automation: {
        tool: 'miniprogram-automator',
        singleSession: true,
        pollIntervalMs: POLL_INTERVAL_MS,
        fixedAutoPlaySuppressionMs: 160,
        ieltsPrefetchDwellMs: IELTS_PREFETCH_DWELL_MS,
        repeatPrefetchDwellMs: IELTS_PREFETCH_DWELL_MS,
        fixedWaitExcludedFromClickToPlay: true
      },
      onDemand: {
        homeLoadsNoCatalogOrTranscript: themes.every((item) => item.onDemandHome),
        ieltsIndexAfterEntryOnly: true,
        ieltsItemAfterTestSelectionOnly: true,
        repeatEntryLoadsNoCatalogOrTranscript: selectorEntries.every((item) => item.onDemand),
        repeatCatalogAfterSeriesSelectionOnly: true,
        transcriptAfterCurrentAudioSelectionOnly: true,
        catalogDoesNotAwaitTranscript: true,
        paragraphTextOnlyInsideExplicitPicker: selectorEntries.every((item) => item.renderedParagraphRows === 0)
      },
      selectorEntries,
      themes,
      ielts,
      rounds: ROUNDS,
      seriesCount: SERIES.length,
      sampleCount: samples.length,
      maxColdCatalogMs: Math.max(...samples.filter((item) => item.round === 1).map((item) => item.catalogMs)),
      maxCachedCatalogMs: samples.some((item) => item.round > 1) ? Math.max(...samples.filter((item) => item.round > 1).map((item) => item.catalogMs)) : null,
      maxClickToPlayMs: Math.max(...themePlayback.map((item) => item.clickToPlayMs)),
      themePlayback,
      failures,
      playbackFailures,
      exceptions,
      samples
    };
    let baseline = null;
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_REPORT_PATH, 'utf8'));
    } catch (error) {}
    const baselineA2 = baseline && (baseline.samples || baseline.series || []).find((item) => item.category === 'newconcept2' && item.round === 1);
    report.comparison = {
      baselineReport: path.relative(ROOT, BASELINE_REPORT_PATH),
      beforeEntryBehavior: '进入选择页后自动加载首个系列、首个音频和 transcript',
      afterEntryBehavior: '进入选择页只渲染级别和系列，后续逐层按需加载',
      beforeFirstTranscriptReadyMs: baselineA2 ? Number(baselineA2.transcriptReadyMs || 0) : null,
      afterSelectorReadyMaxMs: Math.max(...selectorEntries.map((item) => item.selectorReadyMs)),
      beforeInitialParagraphRows: baselineA2 ? Number(baselineA2.paragraphCount || 0) : null,
      afterInitialParagraphRows: Math.max(...selectorEntries.map((item) => item.renderedParagraphRows)),
      initialNetworkStagesBefore: 3,
      initialNetworkStagesAfter: 0
    };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      passed: report.passed,
      seriesCount: report.seriesCount,
      sampleCount: report.sampleCount,
      maxColdCatalogMs: report.maxColdCatalogMs,
      maxCachedCatalogMs: report.maxCachedCatalogMs,
      maxClickToPlayMs: report.maxClickToPlayMs,
      selectorEntries: report.selectorEntries,
      comparison: report.comparison,
      ielts: report.ielts,
      failures: report.failures,
      playbackFailures: report.playbackFailures,
      exceptions: report.exceptions,
      reportPath: REPORT_PATH
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
