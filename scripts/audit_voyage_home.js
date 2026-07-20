const assert = require('assert');
const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const OUTPUT_DIR = path.join(ROOT, 'output', 'voyage-home');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const exceptions = [];
  const port = Number(process.env.WECHAT_AUTOMATOR_PORT || 9420);
  const miniProgram = process.env.WECHAT_AUTOMATOR_CONNECT === '1'
    ? await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` })
    : await automator.launch({ cliPath: CLI_PATH, projectPath: ROOT, port });

  miniProgram.on('exception', (event) => exceptions.push(event));

  try {
    console.log('audit: storage');
    await miniProgram.evaluate(() => {
      wx.setStorageSync('uiTheme', 'voyage');
      wx.setStorageSync('yoyoLanguageV1', 'zh-CN');
      wx.setStorageSync('yoyoIdentityConfirmedV1', 'yes');
      wx.setStorageSync('yoyoIdentityConfirmedV2', 'yes');
      wx.setStorageSync('yoyoDeviceStudyRoleV1', 'student');
      wx.setStorageSync('lastStudyRole', 'student');
    });

    console.log('audit: relaunch');
    const page = await miniProgram.reLaunch('/pages/home/index');
    await page.waitFor(2200);
    console.log('audit: poster screenshots');
    await page.setData({
      entryPosterVisible: true,
      entryPosterPage: 0,
      identityConfirmVisible: false
    });
    console.log('audit: poster page 1 ready');
    await page.waitFor(1000);
    const posterPage1Screenshot = path.join(OUTPUT_DIR, 'poster-page-1.png');
    await miniProgram.screenshot({ path: posterPage1Screenshot });
    console.log('audit: poster page 1 captured');
    await page.setData({ entryPosterPage: 1 });
    await page.waitFor(600);
    const posterPage2Screenshot = path.join(OUTPUT_DIR, 'poster-page-2.png');
    await miniProgram.screenshot({ path: posterPage2Screenshot });
    console.log('audit: poster page 2 captured');
    console.log('audit: dismiss overlays');
    await page.setData({
      entryPosterVisible: false,
      identityConfirmVisible: false,
      identitySelectedInSession: true
    });
    await page.waitFor(300);

    console.log('audit: page data');
    const data = await page.data();
    console.log('audit: elements');
    const root = await page.$('.voyage-home-page');
    const scroll = await page.$('.voyage-scroll');
    const map = await page.$('.voyage-map');
    const modules = await page.$$('.voyage-module');
    const badges = await page.$$('.voyage-module-sprite');
    const primaryAction = await page.$('.voyage-primary-action');

    assert.equal(page.path, 'pages/home/index');
    assert.equal(data.theme, 'voyage');
    assert.ok(root, 'voyage root missing');
    assert.ok(scroll, 'today listening panel missing');
    assert.ok(map, 'module map missing');
    assert.equal(modules.length, 6, 'expected six learning modules');
    assert.equal(badges.length, 6, 'expected six module badge images');
    assert.ok(primaryAction, 'primary action missing');

    console.log('audit: sizes');
    const rootSize = await root.size();
    const scrollSize = await scroll.size();
    const mapSize = await map.size();
    assert.ok(rootSize.width > 0 && rootSize.height > 0, 'root has invalid size');
    assert.ok(scrollSize.width > 0 && scrollSize.height > 0, 'listening panel has invalid size');
    assert.ok(mapSize.width > 0 && mapSize.height > 0, 'module map has invalid size');

    console.log('audit: screenshots');
    const topScreenshot = path.join(OUTPUT_DIR, 'home-top.png');
    await miniProgram.pageScrollTo(0);
    await miniProgram.screenshot({ path: topScreenshot });

    assert.deepEqual(exceptions, [], `developer tool exceptions: ${JSON.stringify(exceptions)}`);
    console.log(JSON.stringify({
      ok: true,
      theme: data.theme,
      modules: modules.length,
      rootSize,
      scrollSize,
      mapSize,
      screenshots: [posterPage1Screenshot, posterPage2Screenshot, topScreenshot],
      exceptions: exceptions.length
    }));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
