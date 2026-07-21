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

test('settings and profile render warm, library, voyage, and dragon explicitly', () => {
  const settingsJs = read('pages/settings/index.js');
  const settingsWxml = read('pages/settings/index.wxml');
  const profileWxml = read('pages/profile/index.wxml');

  assert.match(settingsJs, /voyageTheme: '伟大航路'/);
  assert.match(settingsJs, /voyageTheme: 'Grand Voyage'/);
  assert.match(settingsJs, /dragonTheme: '龙珠修炼'/);
  assert.match(settingsJs, /dragonTheme: 'Dragon Training'/);
  assert.equal((settingsWxml.match(/data-theme="warm"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="library"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="voyage"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="dragon"/g) || []).length, 3);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'voyage' \|\| theme === 'dragon'\}\}"/);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'voyage' \|\| theme === 'dragon'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.equal(settingsWxml.includes('<block wx:else>'), false);
  assert.equal(profileWxml.includes('<block wx:else>'), false);
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

  assert.match(lesson, /activeColor="\{\{themeSlider\.activeColor\}\}"/);
  assert.equal((listeningMaterial.match(/activeColor="\{\{themeSlider\.activeColor\}\}"/g) || []).length, 8);
  [classroom, flashcards, recognition, dictation].forEach((source) => {
    assert.match(source, /theme === 'dragon'/);
  });
  assert.match(dragonWxss, /max-width:\s*100vw/);
  assert.match(dragonWxss, /overflow-x:\s*hidden/);
  assert.doesNotMatch(read('pages/record/index.wxml'), />修<\/view>/);
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
