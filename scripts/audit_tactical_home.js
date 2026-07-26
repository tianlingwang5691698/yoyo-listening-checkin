const assert = require('assert');
const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const OUTPUT_DIR = path.join(ROOT, 'output', 'tactical-home');

async function captureRoute(miniProgram, route, name) {
  const page = await miniProgram.reLaunch(route);
  await page.waitFor(900);
  const output = path.join(OUTPUT_DIR, `${name}.png`);
  await miniProgram.screenshot({ path: output });
  return output;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const exceptions = [];
  const miniProgram = await automator.launch({
    cliPath: CLI_PATH,
    projectPath: ROOT,
    port: Number(process.env.WECHAT_AUTOMATOR_PORT || 9425)
  });

  miniProgram.on('exception', (event) => exceptions.push(event));

  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('uiTheme', 'tactical');
      wx.setStorageSync('yoyoLanguageV1', 'zh-CN');
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      wx.setStorageSync('yoyoDeviceStudyRoleV1', 'student');
      wx.setStorageSync('lastStudyRole', 'student');
    });

    const page = await miniProgram.reLaunch('/pages/home/index');
    await page.waitFor(2200);
    await page.setData({ entryPosterVisible: true, entryPosterPage: 0, identityConfirmVisible: false });
    await page.waitFor(500);
    const posterOne = path.join(OUTPUT_DIR, 'advertising-page-1.png');
    await miniProgram.screenshot({ path: posterOne });

    await page.setData({ entryPosterPage: 1 });
    await page.waitFor(500);
    const posterTwo = path.join(OUTPUT_DIR, 'advertising-page-2.png');
    await miniProgram.screenshot({ path: posterTwo });

    await page.setData({
      entryPosterVisible: false,
      identityConfirmVisible: false,
      identitySelectedInSession: true
    });
    await page.waitFor(500);

    const root = await page.$('.tactical-home-page');
    const homeArt = await page.$('.tactical-home-art');
    const mission = await page.$('.tactical-mission-card');
    const modules = await page.$$('.tactical-module');
    const tabbar = await miniProgram.currentPage();
    assert.ok(root, 'tactical home root missing');
    assert.ok(homeArt, 'tactical home battlefield art missing');
    assert.ok(mission, 'mission panel missing');
    assert.equal(modules.length, 6, 'expected six learning modules');

    const rootSize = await root.size();
    const missionSize = await mission.size();
    assert.ok(rootSize.width > 0 && rootSize.height > 0, 'home root has invalid size');
    assert.ok(missionSize.width > 0 && missionSize.height > 0, 'mission panel has invalid size');

    await miniProgram.pageScrollTo(0);
    const home = path.join(OUTPUT_DIR, 'home-page.png');
    await miniProgram.screenshot({ path: home });

    const representativePages = [];
    representativePages.push(await captureRoute(miniProgram, '/pages/level/index', 'audio-directory'));
    representativePages.push(await captureRoute(miniProgram, '/pages/level-stage/index', 'listening-stage'));
    representativePages.push(await captureRoute(miniProgram, '/pages/reading/index', 'reading'));
    representativePages.push(await captureRoute(miniProgram, '/pages/grammar/index', 'grammar'));
    representativePages.push(await captureRoute(miniProgram, '/pages/writing/detail/index', 'writing'));
    representativePages.push(await captureRoute(miniProgram, '/pages/speaking/index', 'speaking'));
    representativePages.push(await captureRoute(miniProgram, '/pages/practice-history/index?type=speaking', 'practice-history'));
    representativePages.push(await captureRoute(miniProgram, '/pages/record/index', 'record'));
    representativePages.push(await captureRoute(miniProgram, '/pages/profile/index', 'profile'));

    const data = await tabbar.data();
    assert.equal(data.theme, 'tactical');
    assert.deepEqual(exceptions, [], `developer tool exceptions: ${JSON.stringify(exceptions)}`);
    console.log(JSON.stringify({ ok: true, screenshots: [posterOne, posterTwo, home].concat(representativePages), modules: modules.length, rootSize, missionSize }));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
