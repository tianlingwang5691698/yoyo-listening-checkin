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

test('settings and profile render warm, library, and voyage explicitly', () => {
  const settingsJs = read('pages/settings/index.js');
  const settingsWxml = read('pages/settings/index.wxml');
  const profileWxml = read('pages/profile/index.wxml');

  assert.match(settingsJs, /voyageTheme: '伟大航路'/);
  assert.match(settingsJs, /voyageTheme: 'Grand Voyage'/);
  assert.equal((settingsWxml.match(/data-theme="warm"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="library"/g) || []).length, 3);
  assert.equal((settingsWxml.match(/data-theme="voyage"/g) || []).length, 3);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'voyage'\}\}"/);
  assert.match(settingsWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'voyage'\}\}"/);
  assert.match(profileWxml, /wx:elif="\{\{theme === 'warm'\}\}"/);
  assert.equal(settingsWxml.includes('<block wx:else>'), false);
  assert.equal(profileWxml.includes('<block wx:else>'), false);
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
