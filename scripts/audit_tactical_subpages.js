const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PORT = Number(process.env.WECHAT_AUTOMATOR_PORT || 9434);
const OUTPUT_DIR = path.join(ROOT, 'output', 'tactical-subpages');
const WAIT_MS = Number(process.env.TACTICAL_AUDIT_WAIT_MS || 1100);

function targetRoutes() {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  return [
    ...app.pages,
    ...app.subPackages.flatMap((pack) => pack.pages.map((page) => `${pack.root}/${page}`)),
  ].filter((route) => route !== 'pages/home/index' && route !== 'pages/admin/index');
}

function screenshotPath(route) {
  return path.join(OUTPUT_DIR, `${route.replace(/\//g, '--')}.png`);
}

function event(dataset = {}) {
  return { currentTarget: { dataset } };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRoute(miniProgram, expected, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await miniProgram.currentPage();
    if (current && current.path === expected) return current;
    await wait(250);
  }
  return miniProgram.currentPage();
}

async function capture(miniProgram, expected, source, results) {
  const current = await miniProgram.currentPage();
  const data = await current.data();
  const output = screenshotPath(expected);
  await miniProgram.screenshot({ path: output });
  const item = {
    route: expected,
    source,
    currentRoute: current.path,
    theme: data.theme || '',
    redirected: current.path !== expected,
    screenshot: output,
  };
  item.ok = !item.redirected && item.theme === 'tactical';
  results.set(expected, item);
  return item;
}

function block(results, route, source, reason) {
  if (results.has(route) && results.get(route).ok) return;
  results.set(route, { route, source, ok: false, blocked: true, reason });
}

async function navigateBackTo(miniProgram, expected) {
  for (let step = 0; step < 5; step += 1) {
    const current = await miniProgram.currentPage();
    if (current.path === expected) return current;
    await miniProgram.navigateBack();
  }
  return miniProgram.currentPage();
}

async function openFromHome(miniProgram, selector, expected, source, results) {
  const home = await miniProgram.reLaunch('/pages/home/index');
  await home.waitFor(WAIT_MS);
  await home.setData({ entryPosterVisible: false, identityConfirmVisible: false, identitySelectedInSession: true });
  const entry = await home.$(selector);
  if (!entry) {
    block(results, expected, source, `missing-selector:${selector}`);
    return null;
  }
  await entry.tap();
  const current = await waitForRoute(miniProgram, expected);
  if (current.path !== expected) {
    block(results, expected, source, `navigation-ended-at:${current.path}`);
    return null;
  }
  await current.waitFor(WAIT_MS);
  await capture(miniProgram, expected, source, results);
  return current;
}

async function descendMaterial(miniProgram, page, detailRoute, results, source) {
  let data = await page.data();
  const stage = (data.stages || [])[0];
  if (!stage) return block(results, detailRoute, source, 'no-material-stage');
  await page.callMethod('selectStage', event({ stageId: stage.stageId }));
  data = await page.data();
  const exam = (data.exams || [])[0];
  if (!exam) return block(results, detailRoute, source, 'no-material-exam');
  await page.callMethod('selectExam', event({ examId: exam.examId }));
  data = await page.data();
  const district = (data.districts || [])[0];
  if (!district) return block(results, detailRoute, source, 'no-material-district');
  await page.callMethod('selectDistrict', event({ district: district.district }));
  data = await page.data();
  const item = (data.items || [])[0];
  if (!item) return block(results, detailRoute, source, 'no-material-item');
  const itemId = item.materialItemId || item.stableId || item._id || item.id;
  await page.callMethod('openItem', event({ itemId }));
  const detail = await waitForRoute(miniProgram, detailRoute);
  if (detail.path !== detailRoute) return block(results, detailRoute, source, `navigation-ended-at:${detail.path}`);
  await detail.waitFor(WAIT_MS);
  await capture(miniProgram, detailRoute, source, results);
}

async function descendReading(miniProgram, page, results) {
  let data = await page.data();
  const stage = (((data.categoryRoot || {}).stages) || [])[0];
  if (!stage) return block(results, 'pages/reading/detail/index', 'reading-directory', 'no-reading-stage');
  await page.callMethod('selectStage', event({ stage: stage.key }));
  data = await page.data();
  const exam = (((data.selectedStageNode || {}).groups) || [])[0];
  if (!exam) return block(results, 'pages/reading/detail/index', 'reading-directory', 'no-reading-exam');
  await page.callMethod('selectExamType', event({ examType: exam.key }));
  data = await page.data();
  const district = (((data.selectedGroup || {}).districts) || [])[0];
  if (!district) return block(results, 'pages/reading/detail/index', 'reading-directory', 'no-reading-district');
  await page.callMethod('selectDistrict', event({ district: district.key }));
  data = await page.data();
  const passage = (((data.selectedDistrictNode || {}).passages) || [])[0];
  if (!passage) return block(results, 'pages/reading/detail/index', 'reading-directory', 'no-reading-passage');
  await page.callMethod('openPassage', event({ passageId: passage._id }));
  const detail = await waitForRoute(miniProgram, 'pages/reading/detail/index');
  if (detail.path !== 'pages/reading/detail/index') return block(results, 'pages/reading/detail/index', 'reading-directory', `navigation-ended-at:${detail.path}`);
  await detail.waitFor(WAIT_MS);
  await capture(miniProgram, 'pages/reading/detail/index', 'reading-directory', results);
}

async function openVocabularyModes(miniProgram, flashcards, results) {
  await flashcards.callMethod('openWordPractice');
  let practice = await waitForRoute(miniProgram, 'pages/reading/flashcards/practice/index');
  if (practice.path !== 'pages/reading/flashcards/practice/index') {
    block(results, 'pages/reading/flashcards/practice/index', 'vocabulary-practice', `navigation-ended-at:${practice.path}`);
    return;
  }
  await practice.waitFor(WAIT_MS);
  await capture(miniProgram, 'pages/reading/flashcards/practice/index', 'vocabulary-practice', results);

  await practice.callMethod('chooseMode', event({ mode: 'dictation' }));
  let library = await waitForRoute(miniProgram, 'pages/reading/flashcards/dictation/library/index');
  if (library.path !== 'pages/reading/flashcards/dictation/library/index') {
    block(results, 'pages/reading/flashcards/dictation/library/index', 'vocabulary-dictation', `navigation-ended-at:${library.path}`);
    return;
  }
  await library.waitFor(WAIT_MS);
  await capture(miniProgram, 'pages/reading/flashcards/dictation/library/index', 'vocabulary-dictation', results);
  let data = await library.data();
  let first = (data.items || [])[0];
  if (first) await library.callMethod('chooseItem', event({ key: first.key }));
  data = await library.data();
  first = (data.items || [])[0];
  if (first) {
    await library.setData({ countsLoaded: false });
    await library.callMethod('chooseItem', event({ key: first.key }));
  }
  const dictation = await waitForRoute(miniProgram, 'pages/reading/flashcards/dictation/index', 5000);
  if (dictation.path === 'pages/reading/flashcards/dictation/index') {
    await dictation.waitFor(WAIT_MS);
    await capture(miniProgram, 'pages/reading/flashcards/dictation/index', 'vocabulary-dictation', results);
  } else {
    block(results, 'pages/reading/flashcards/dictation/index', 'vocabulary-dictation', 'no-learned-source');
  }

  practice = await miniProgram.reLaunch('/pages/reading/flashcards/practice/index');
  await practice.waitFor(WAIT_MS);
  await practice.callMethod('chooseMode', event({ mode: 'recognition' }));
  library = await waitForRoute(miniProgram, 'pages/reading/flashcards/dictation/library/index');
  if (library.path !== 'pages/reading/flashcards/dictation/library/index') {
    block(results, 'pages/reading/flashcards/recognition/index', 'vocabulary-recognition', `navigation-ended-at:${library.path}`);
    return;
  }
  data = await library.data();
  first = (data.items || [])[0];
  if (first) await library.callMethod('chooseItem', event({ key: first.key }));
  data = await library.data();
  first = (data.items || [])[0];
  if (first) {
    await library.setData({ countsLoaded: false });
    await library.callMethod('chooseItem', event({ key: first.key }));
  }
  const recognition = await waitForRoute(miniProgram, 'pages/reading/flashcards/recognition/index', 5000);
  if (recognition.path === 'pages/reading/flashcards/recognition/index') {
    await recognition.waitFor(WAIT_MS);
    await capture(miniProgram, 'pages/reading/flashcards/recognition/index', 'vocabulary-recognition', results);
  } else {
    block(results, 'pages/reading/flashcards/recognition/index', 'vocabulary-recognition', 'no-learned-source');
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const results = new Map();
  const exceptions = [];
  const miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port: PORT });
  miniProgram.on('exception', (entry) => exceptions.push(entry));

  try {
    let home = await miniProgram.reLaunch('/pages/home/index');
    await home.waitFor(1600);
    await miniProgram.evaluate(() => {
      wx.setStorageSync('uiTheme', 'tactical');
      wx.setStorageSync('yoyoLanguageV1', 'zh-CN');
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      wx.setStorageSync('homeEntryPosterDismissedV1', 'yes');
      wx.setStorageSync('yoyoDeviceStudyRoleV1', 'student');
      wx.setStorageSync('lastStudyRole', 'student');
      wx.setStorageSync('hasUsedStudentMode', 'yes');
      const app = getApp();
      if (app && app.globalData) app.globalData.identityConfirmed = true;
    });
    home = await miniProgram.currentPage();
    if (home.path !== 'pages/home/index') throw new Error(`identity-ended-at:${home.path}`);
    await home.setData({ entryPosterVisible: false, identityConfirmVisible: false, identitySelectedInSession: true });
    console.log(JSON.stringify({ step: 'identity-ready', route: home.path }));

    const listening = await openFromHome(miniProgram, '.tactical-module.module-listening', 'pages/material/index', 'home-listening', results);
    if (listening) {
      await listening.callMethod('openPracticeHistory');
      const history = await waitForRoute(miniProgram, 'pages/practice-history/index');
      if (history.path === 'pages/practice-history/index') await capture(miniProgram, 'pages/practice-history/index', 'listening-history', results);
      await navigateBackTo(miniProgram, 'pages/material/index');
      const material = await miniProgram.currentPage();
      await descendMaterial(miniProgram, material, 'pages/material/detail/index', results, 'listening-directory');
    }

    const writing = await openFromHome(miniProgram, '.tactical-module.module-writing', 'pages/material/index', 'home-writing', results);
    if (writing) await descendMaterial(miniProgram, writing, 'pages/writing/detail/index', results, 'writing-directory');

    const reading = await openFromHome(miniProgram, '.tactical-module.module-reading', 'pages/reading/index', 'home-reading', results);
    if (reading) await descendReading(miniProgram, reading, results);

    const grammar = await openFromHome(miniProgram, '.tactical-module.module-grammar', 'pages/grammar/index', 'home-grammar', results);
    if (grammar) {
      await grammar.callMethod('openPracticeHistory');
      const history = await waitForRoute(miniProgram, 'pages/practice-history/index');
      if (history.path === 'pages/practice-history/index') await capture(miniProgram, 'pages/practice-history/index', 'grammar-history', results);
    }

    const flashcards = await openFromHome(miniProgram, '.tactical-module.module-vocabulary', 'pages/reading/flashcards/index', 'home-vocabulary', results);
    if (flashcards) await openVocabularyModes(miniProgram, flashcards, results);

    const speaking = await openFromHome(miniProgram, '.tactical-module.module-speaking', 'pages/speaking/index', 'home-speaking', results);
    if (speaking) {
      await speaking.callMethod('openSpeakingHistory');
      const history = await waitForRoute(miniProgram, 'pages/practice-history/index');
      if (history.path === 'pages/practice-history/index') await capture(miniProgram, 'pages/practice-history/index', 'speaking-history', results);
    }

    home = await miniProgram.reLaunch('/pages/home/index');
    await home.waitFor(WAIT_MS);
    await home.setData({ entryPosterVisible: false, identityConfirmVisible: false, identitySelectedInSession: true });
    const homeData = await home.data();
    const taskGroups = homeData.groupedDailyTasks || [];
    const grammarGroup = taskGroups.find((group) => group.category === 'grammar');
    const grammarTask = grammarGroup && (grammarGroup.tasks || [])[0];
    if (grammarTask) {
      await home.callMethod('openTask', event({ category: 'grammar', taskId: grammarTask.taskId, disabled: false }));
      const classroom = await waitForRoute(miniProgram, 'grammar-package/pages/classroom/index');
      if (classroom.path === 'grammar-package/pages/classroom/index') await capture(miniProgram, 'grammar-package/pages/classroom/index', 'home-grammar-task', results);
    } else block(results, 'grammar-package/pages/classroom/index', 'home-grammar-task', 'no-grammar-task');
    const lessonGroup = taskGroups.find((group) => group.category !== 'grammar' && (group.tasks || []).length);
    const lessonTask = lessonGroup && lessonGroup.tasks[0];
    if (lessonTask) {
      home = await miniProgram.reLaunch('/pages/home/index');
      await home.waitFor(WAIT_MS);
      await home.setData({ entryPosterVisible: false, identityConfirmVisible: false, identitySelectedInSession: true });
      await home.callMethod('openTask', event({ category: lessonGroup.category, taskId: lessonTask.taskId, disabled: false }));
      const lesson = await waitForRoute(miniProgram, 'pages/lesson/index');
      if (lesson.path === 'pages/lesson/index') await capture(miniProgram, 'pages/lesson/index', 'home-daily-task', results);
    } else block(results, 'pages/lesson/index', 'home-daily-task', 'no-daily-task');

    let tab = await miniProgram.switchTab('/pages/level/index');
    await tab.waitFor(WAIT_MS);
    await capture(miniProgram, 'pages/level/index', 'audio-tab', results);
    await tab.callMethod('openPlanSettings');
    let nested = await waitForRoute(miniProgram, 'pages/listening-plan/index');
    if (nested.path === 'pages/listening-plan/index') await capture(miniProgram, 'pages/listening-plan/index', 'audio-plan', results);
    await navigateBackTo(miniProgram, 'pages/level/index');
    tab = await miniProgram.currentPage();
    let tabData = await tab.data();
    if (tabData.isYoyoFixedPlan) {
      await tab.callMethod('openFixedStage');
      nested = await waitForRoute(miniProgram, 'pages/level-stage/index');
      if (nested.path === 'pages/level-stage/index') await capture(miniProgram, 'pages/level-stage/index', 'audio-fixed-plan', results);
      await navigateBackTo(miniProgram, 'pages/level/index');
      tab = await miniProgram.currentPage();
    } else block(results, 'pages/level-stage/index', 'audio-fixed-plan', 'no-fixed-plan');
    tabData = await tab.data();
    const material = (tabData.materials || []).find((item) => !item.disabled);
    if (material) {
      await tab.callMethod('openMaterial', event({ category: material.category, levelId: material.levelId || tabData.selectedLevel, disabled: false }));
      nested = await waitForRoute(miniProgram, 'pages/listening-material/index');
      if (nested.path === 'pages/listening-material/index') await capture(miniProgram, 'pages/listening-material/index', 'audio-category', results);
    } else block(results, 'pages/listening-material/index', 'audio-category', 'no-listening-material');

    tab = await miniProgram.switchTab('/pages/record/index');
    await tab.waitFor(WAIT_MS);
    await capture(miniProgram, 'pages/record/index', 'record-tab', results);

    tab = await miniProgram.switchTab('/pages/profile/index');
    await tab.waitFor(WAIT_MS);
    await capture(miniProgram, 'pages/profile/index', 'profile-tab', results);
    await tab.callMethod('openSettingsPage');
    let settings = await waitForRoute(miniProgram, 'pages/settings/index');
    if (settings.path === 'pages/settings/index') {
      await capture(miniProgram, 'pages/settings/index', 'profile-settings', results);
      await settings.callMethod('openFamilyPage');
      const family = await waitForRoute(miniProgram, 'pages/family/index');
      if (family.path === 'pages/family/index') await capture(miniProgram, 'pages/family/index', 'settings-family', results);
    }
    tab = await miniProgram.switchTab('/pages/profile/index');
    await tab.waitFor(WAIT_MS);
    await tab.callMethod('openParentPage');
    const parent = await waitForRoute(miniProgram, 'pages/parent/index');
    if (parent.path === 'pages/parent/index') {
      await parent.waitFor(WAIT_MS);
      await capture(miniProgram, 'pages/parent/index', 'profile-report', results);
      const parentData = await parent.data();
      const date = parentData.todayReport && parentData.todayReport.date;
      if (date) {
        await parent.callMethod('openDailyDetail', event({ date }));
        const detail = await waitForRoute(miniProgram, 'pages/parent/detail/index');
        if (detail.path === 'pages/parent/detail/index') await capture(miniProgram, 'pages/parent/detail/index', 'parent-daily-report', results);
      } else block(results, 'pages/parent/detail/index', 'parent-daily-report', 'no-report-date');
    }

    home = await miniProgram.reLaunch('/pages/home/index');
    await home.waitFor(WAIT_MS);
    await home.setData({ entryPosterVisible: false, identityConfirmVisible: false, identitySelectedInSession: true });
    const mission = await home.$('.tactical-mission-card');
    if (mission) {
      await mission.tap();
      const completed = await waitForRoute(miniProgram, 'pages/home/completed/index', 5000);
      if (completed.path === 'pages/home/completed/index') await capture(miniProgram, 'pages/home/completed/index', 'home-mission', results);
      else block(results, 'pages/home/completed/index', 'home-mission', 'home-data-not-ready');
    }

    block(results, 'pages/identity/index', 'navigation-audit', 'no-current-user-entry');
  } finally {
    miniProgram.disconnect();
  }

  const ordered = targetRoutes().map((route) => results.get(route) || { route, ok: false, blocked: true, reason: 'not-reached' });
  const report = {
    total: ordered.length,
    passed: ordered.filter((item) => item.ok).length,
    blocked: ordered.filter((item) => item.blocked).length,
    failed: ordered.filter((item) => !item.ok && !item.blocked),
    exceptions,
    results: ordered,
  };
  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, total: report.total, passed: report.passed, blocked: report.blocked, failed: report.failed }));
  if (report.failed.length || exceptions.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
