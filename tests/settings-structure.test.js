const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('settings page is registered and every profile theme has one settings entry', () => {
  const app = JSON.parse(read('app.json'));
  const profileJs = read('pages/profile/index.js');
  const profile = read('pages/profile/index.wxml');
  assert.ok(app.pages.includes('pages/settings/index'));
  assert.equal((profile.match(/bindtap="openSettingsPage"/g) || []).length, 3);
  assert.equal(profile.includes('openAdminPage'), false);
  assert.equal(profile.includes("studyRole === 'parent')}}\" bindtap=\"openAdminPage"), false);
  assert.match(profileJs, /openParentPage\(\)[\s\S]*url: '\/pages\/parent\/index',[\s\S]*animationType: 'none',[\s\S]*animationDuration: 0/);
  assert.match(profileJs, /openSettingsPage\(\)[\s\S]*url: '\/pages\/settings\/index',[\s\S]*animationType: 'none',[\s\S]*animationDuration: 0/);
});

test('settings and profile render all five themes explicitly', () => {
  const settingsJs = read('pages/settings/index.js');
  const settingsWxml = read('pages/settings/index.wxml');
  const profileWxml = read('pages/profile/index.wxml');

  assert.match(settingsJs, /voyageTheme: '伟大航路'/);
  assert.match(settingsJs, /voyageTheme: 'Grand Voyage'/);
  assert.match(settingsJs, /dragonTheme: '龙珠修炼'/);
  assert.match(settingsJs, /dragonTheme: 'Dragon Training'/);
  assert.match(settingsJs, /tacticalTheme: '战术行动'/);
  assert.match(settingsJs, /tacticalTheme: 'Tactical Ops'/);
  assert.equal((settingsWxml.match(/data-theme="warm"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="library"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="voyage"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="dragon"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="tactical"/g) || []).length, 3);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'voyage' \|\| theme === 'dragon' \|\| theme === 'tactical'\}\}"/);
  assert.match(settingsWxml, /tactical-control-icon/);
  assert.match(settingsWxml, /tactical-family-icon/);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'voyage' \|\| theme === 'dragon' \|\| theme === 'tactical'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.equal(settingsWxml.includes('<block wx:else>'), false);
  assert.equal(profileWxml.includes('<block wx:else>'), false);
});

test('tactical theme has a dedicated advertising page and home command surface', () => {
  const themeJs = read('utils/theme.js');
  const themeEntry = read('styles/theme-current.wxss');
  const tacticalWxss = read('styles/themes/tactical.wxss');
  const homeWxml = read('pages/home/index.wxml');
  const homeWxss = read('pages/home/index.wxss');
  const tabbarWxss = read('custom-tab-bar/index.wxss');
  const projectConfig = JSON.parse(read('project.config.json'));

  assert.match(themeJs, /key: 'tactical', label: '战术行动'/);
  assert.match(themeEntry, /themes\/tactical\.wxss/);
  assert.match(tacticalWxss, /\.theme-tactical/);
  assert.match(homeWxml, /theme === 'tactical'/);
  assert.match(homeWxml, /class="tactical-ad/);
  assert.match(homeWxml, />战术行动</);
  assert.match(homeWxml, /_assets\/themes\/tactical\/20260727-daylight-v2\/ad-zero-dam-v2\.jpg/);
  assert.match(homeWxml, /_assets\/themes\/tactical\/20260727-daylight-v2\/ad-space-base-v2\.jpg/);
  assert.match(homeWxml, /_assets\/themes\/tactical\/20260727-daylight-v2\/home-longbow-valley-v2\.jpg/);
  assert.ok(fs.existsSync(path.join(root, 'assets/tactical/ad-zero-dam-v2.jpg')));
  assert.ok(fs.existsSync(path.join(root, 'assets/tactical/ad-space-base-v2.jpg')));
  assert.ok(fs.existsSync(path.join(root, 'assets/tactical/home-longbow-valley-v2.jpg')));
  assert.equal(homeWxml.includes('tactical-scan-line'), false);
  assert.equal(homeWxml.includes('tactical-ad-scan'), false);
  assert.equal(homeWxml.includes('tactical-map-grid'), false);
  assert.equal(homeWxml.includes('tactical-ad-grid'), false);
  assert.equal(homeWxss.includes('@keyframes tacticalScan'), false);
  assert.match(homeWxss, /\.tactical-ad-shade\s*\{\s*display:\s*none/);
  assert.match(homeWxss, /\.tactical-role-index\s*\{\s*display:\s*none/);
  assert.match(homeWxss, /\.tactical-role-grid\s*\{[^}]*display:\s*flex/);
  assert.match(homeWxss, /\.tactical-role-grid button\s*\{[^}]*width:\s*0/);
  assert.match(tacticalWxss, /--bg-cream:\s*#d1dbcf/);
  assert.match(tacticalWxss, /--surface:\s*#e8ede6/);
  assert.match(themeJs, /tactical:\s*\{\s*backgroundColor:\s*'#a7b7a4',\s*frontColor:\s*'#000000'/);
  assert.match(tabbarWxss, /\.custom-tabbar\.theme-tactical\s*\{[^}]*background:\s*#a7b7a4/);
  assert.match(tabbarWxss, /\.custom-tabbar\.theme-tactical \.tabbar-item\s*\{[^}]*color:\s*#35433a/);
  assert.ok(projectConfig.packOptions.ignore.some((item) => item.type === 'folder' && item.value === 'assets/tactical'));
  assert.equal((homeWxml.match(/class="tactical-module /g) || []).length, 6);
  assert.match(homeWxss, /\.tactical-command-shell/);
  assert.match(homeWxss, /\.tactical-ad-briefing/);
  assert.match(tabbarWxss, /\.custom-tabbar\.theme-tactical/);
});

test('dragon theme uses dedicated home art and global theme tokens', () => {
  const themeJs = read('utils/theme.js');
  const themeEntry = read('styles/theme-current.wxss');
  const homeWxml = read('pages/home/index.wxml');
  const dragonWxss = read('styles/themes/dragon.wxss');

  assert.match(themeJs, /key: 'dragon', label: '龙珠修炼'/);
  assert.match(themeEntry, /themes\/dragon\.wxss/);
  assert.match(homeWxml, /assets\/dragon\/shenron-home\.jpg/);
  assert.match(homeWxml, /assets\/dragon\/goku\.png/);
  assert.match(homeWxml, /assets\/dragon\/tournament-hero\.jpg/);
  assert.match(dragonWxss, /\.theme-dragon/);
});

test('dragon theme covers the deep-customized learning and report pages', () => {
  const themedPages = [
    'grammar-package/pages/classroom/index.wxml',
    'pages/reading/flashcards/index.wxml',
    'pages/reading/flashcards/practice/index.wxml',
    'pages/reading/flashcards/recognition/index.wxml',
    'pages/reading/flashcards/dictation/index.wxml',
    'pages/reading/flashcards/dictation/library/index.wxml',
    'pages/lesson/index.wxml',
    'pages/listening-material/index.wxml',
    'pages/material/index.wxml',
    'pages/material/detail/index.wxml',
    'pages/parent/detail/index.wxml',
    'pages/practice-history/index.wxml',
    'pages/home/completed/index.wxml',
    'pages/record/index.wxml',
  ];

  themedPages.forEach((file) => {
    assert.match(read(file), /theme-\{\{theme\}\}/, `${file} must expose the theme class`);
  });

  const lesson = read('pages/lesson/index.wxml');
  const listeningMaterial = read('pages/listening-material/index.wxml');
  const classroom = read('grammar-package/pages/classroom/index.wxml');
  const flashcards = read('pages/reading/flashcards/index.wxml');
  const recognition = read('pages/reading/flashcards/recognition/index.wxml');
  const dictation = read('pages/reading/flashcards/dictation/index.wxml');
  const dragonWxss = read('styles/themes/dragon.wxss');

  assert.match(lesson, /activeColor="\{\{theme === 'tactical' \? '#8DA52F' : themeSlider\.activeColor\}\}"/);
  assert.equal((listeningMaterial.match(/activeColor="\{\{themeSlider\.activeColor\}\}"/g) || []).length, 8);
  [classroom, flashcards, recognition, dictation].forEach((source) => {
    assert.match(source, /theme === 'dragon'/);
  });
  assert.match(dragonWxss, /max-width:\s*100vw/);
  assert.match(dragonWxss, /overflow-x:\s*hidden/);
  assert.doesNotMatch(read('pages/record/index.wxml'), />修<\/view>/);
});

test('tactical subpages keep the comfortable daylight contrast palette', () => {
  const styles = [
    'grammar-package/pages/classroom/index.wxss',
    'pages/grammar/index.wxss',
    'pages/reading/index.wxss',
    'pages/reading/detail/index.wxss',
    'pages/reading/flashcards/index.wxss',
    'pages/writing/detail/index.wxss',
    'pages/level/index.wxss',
    'pages/level-stage/index.wxss',
    'pages/listening-plan/index.wxss',
    'pages/listening-material/index.wxss',
    'pages/lesson/index.wxss',
    'pages/material/index.wxss',
    'pages/material/detail/index.wxss',
    'pages/speaking/index.wxss',
    'pages/practice-history/index.wxss',
    'pages/record/index.wxss',
    'pages/parent/index.wxss',
    'pages/parent/detail/index.wxss',
    'pages/profile/index.wxss',
    'pages/settings/index.wxss',
    'pages/identity/index.wxss',
    'pages/family/index.wxss',
  ];

  styles.forEach((file) => {
    const source = read(file);
    assert.match(source, /#d1dbcf/, `${file} must keep the daylight page background`);
    assert.match(source, /#e8ede6/, `${file} must keep the comfortable card surface`);
    assert.match(source, /#172019/, `${file} must keep high-contrast primary text`);
    assert.match(source, /#4f5d53/, `${file} must keep readable secondary text`);
  });

  const levelSource = read('pages/level/index.wxss');
  assert.match(levelSource, /\.theme-tactical \.voyage-harbor-point\s*\{[^}]*background:\s*#668000/);
  assert.match(levelSource, /\.theme-tactical \.voyage-harbor-state\s*\{[^}]*background:\s*#e4efbd[^}]*color:\s*#405500/);
  assert.match(levelSource, /\.theme-tactical \.voyage-level-head\s*\{[^}]*display:\s*block[^}]*overflow:\s*hidden/);
  const stageSource = read('pages/level-stage/index.wxss');
  assert.match(stageSource, /\.theme-tactical \.voyage-checkpoint-state\s*\{[^}]*color:\s*#405500/);
  assert.match(stageSource, /\.theme-tactical \.voyage-checkpoint-order,[\s\S]*?color:\s*#526900/);
  const lessonSource = read('pages/lesson/index.wxss');
  assert.match(lessonSource, /\.theme-tactical \.player-status,[\s\S]*?color:\s*#526900/);
  assert.match(lessonSource, /\.theme-tactical \.player-toggle\s*\{[^}]*border-color:\s*#8da52f[^}]*background:\s*#d7ff45/);
  assert.match(lessonSource, /\.theme-tactical \.pass-step\.is-current\s*\{[^}]*background:\s*#e4efbd[^}]*color:\s*#314000/);
  assert.match(lessonSource, /\.theme-tactical \.player-toggle-icon\.is-pause::before,[\s\S]*?background:\s*#172019/);
  const settingsSource = read('pages/settings/index.wxss');
  assert.match(settingsSource, /\.theme-tactical \.tactical-control-line\s*\{[^}]*background:\s*#526900/);
  assert.match(settingsSource, /\.theme-tactical \.tactical-control-line::after\s*\{[^}]*background:\s*#d7ff45/);
  assert.match(settingsSource, /\.theme-tactical \.tactical-family-icon\s*\{[^}]*background:\s*#e4efbd/);
  assert.match(settingsSource, /\.theme-tactical \.tactical-account-shield\s*\{[^}]*background:\s*#d7ff45/);
  const planSource = read('pages/listening-plan/index.wxss');
  assert.match(planSource, /\.theme-tactical \.voyage-plan-material \.voyage-plan-link,[\s\S]*?background:\s*#e4efbd[^}]*color:\s*#314000/);
  assert.match(planSource, /\.theme-tactical \.voyage-plan-clear\.is-disabled\s*\{[^}]*opacity:\s*1[^}]*color:\s*#77837a/);
  assert.match(planSource, /\.theme-tactical \.voyage-material-port,[\s\S]*?background:\s*#668000[^}]*box-shadow:\s*inset 0 0 0 1rpx #d7ff45/);
  const materialSource = read('pages/material/index.wxss');
  assert.match(materialSource, /\.theme-tactical\.material-module-listening \.directory-back-icon\s*\{[^}]*background:\s*#e4efbd[^}]*color:\s*#314000/);
  assert.match(materialSource, /\.theme-tactical\.material-module-listening \.task-state\s*\{[^}]*border:\s*1rpx solid #668000[^}]*background:\s*#e4efbd[^}]*color:\s*#314000/);
});

test('tactical subpage images keep their dedicated sources and fixed display sizes', () => {
  const release = '_assets/themes/tactical/20260727-subpages-v1/';
  const cases = [
    ['pages/level/index.wxml', 'pages/level/index.wxss', 'listening-comms.jpg', 'tactical-subpage-banner', '268rpx'],
    ['pages/reading/index.wxml', 'pages/reading/index.wxss', 'reading-intel.jpg', 'tactical-subpage-banner', '280rpx'],
    ['pages/grammar/index.wxml', 'pages/grammar/index.wxss', 'grammar-briefing.jpg', 'tactical-subpage-banner', '280rpx'],
    ['pages/writing/detail/index.wxml', 'pages/writing/detail/index.wxss', 'writing-field-notes.jpg', 'tactical-subpage-banner', '280rpx'],
    ['pages/speaking/index.wxml', 'pages/speaking/index.wxss', 'speaking-radio.jpg', 'tactical-subpage-banner', '280rpx'],
    ['pages/reading/flashcards/index.wxml', 'pages/reading/flashcards/index.wxss', 'vocabulary-inventory.jpg', 'tactical-vocab-banner', '260rpx'],
    ['pages/record/index.wxml', 'pages/record/index.wxss', 'growth-after-action.jpg', 'tactical-growth-image', '470rpx'],
    ['pages/parent/index.wxml', 'pages/parent/index.wxss', 'growth-after-action.jpg', 'tactical-parent-image', '468rpx'],
  ];

  cases.forEach(([wxmlFile, wxssFile, asset, className, height]) => {
    assert.match(read(wxmlFile), new RegExp(`${release}${asset}`));
    assert.match(read(wxmlFile), new RegExp(`class="${className}"[^>]*mode="aspectFill"`));
    assert.match(read(wxssFile), new RegExp(`\\.${className}\\s*\\{[^}]*height:\\s*${height}`));
    assert.ok(fs.existsSync(path.join(root, 'assets/tactical/subpages-v1', asset)));
  });

  const profileWxml = read('pages/profile/index.wxml');
  const profileWxss = read('pages/profile/index.wxss');
  assert.match(profileWxml, new RegExp(`${release}profile-operator.jpg`));
  assert.match(profileWxml, /class="tactical-profile-photo"[^>]*mode="aspectFill"/);
  assert.match(profileWxss, /\.tactical-profile-photo\s*\{[^}]*width:\s*126rpx[^}]*height:\s*210rpx/);
  assert.ok(fs.existsSync(path.join(root, 'assets/tactical/subpages-v1/profile-operator.jpg')));
});

test('voyage settings emblem stays outside the title flow', () => {
  const settingsWxss = read('pages/settings/index.wxss');
  const emblemRules = [...settingsWxss.matchAll(/\.voyage-settings-emblem\s*\{([^}]*)\}/g)];
  assert.ok(emblemRules.length > 0);
  assert.match(emblemRules.at(-1)[1], /position:\s*absolute/);
  assert.doesNotMatch(
    settingsWxss,
    /\.voyage-settings-emblem\s*,\s*\.voyage-row-icon\s*\{[^}]*position:\s*relative/
  );
});

test('voyage entry poster keeps the design and content credit', () => {
  const homeWxml = read('pages/home/index.wxml');
  const homeWxss = read('pages/home/index.wxss');
  const voyagePoster = homeWxml.match(/<view class="voyage-entry-poster[\s\S]*?<\/view>\s*<\/view>\s*\n\s*<view wx:elif=/);
  assert.ok(voyagePoster);
  assert.match(voyagePoster[0], /voyage-poster-credit/);
  assert.match(voyagePoster[0], /\{\{texts\.posterCreditName\}\}/);
  assert.match(homeWxss, /\.voyage-poster-credit-seal/);
});

test('settings is local-first and admin visibility is cloud-authoritative', () => {
  const settings = read('pages/settings/index.js');
  assert.match(settings, /ready\('pageReady',[\s\S]*cacheHit: true/);
  assert.match(settings, /getAdminStatus\(\{ forceRefresh: true \}\)/);
  assert.match(settings, /adminVisible: !!\(status && status\.isAdmin\)/);
});

test('nickname editing lives in the identity section for students and parents', () => {
  const profileJs = read('pages/profile/index.js');
  const profileWxml = read('pages/profile/index.wxml');
  const familyJs = read('pages/family/index.js');
  const familyWxml = read('pages/family/index.wxml');
  assert.equal(profileJs.includes('saveChildProfile'), false);
  assert.equal(profileWxml.includes('bindtap="saveChildProfile"'), false);
  assert.match(familyJs, /async saveIdentityNickname\(\)/);
  assert.match(familyJs, /isParent \? texts\.myNickname : texts\.studentNickname/);
  assert.match(familyWxml, /wx:if="\{\{!childJoinRequired && currentMember\}\}"[\s\S]*bindtap="saveIdentityNickname"/);
});
