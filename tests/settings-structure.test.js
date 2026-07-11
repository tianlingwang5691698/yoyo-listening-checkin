const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('settings page is registered and profile has one settings entry', () => {
  const app = JSON.parse(read('app.json'));
  const profile = read('pages/profile/index.wxml');
  assert.ok(app.pages.includes('pages/settings/index'));
  assert.equal((profile.match(/bindtap="openSettingsPage"/g) || []).length, 2);
  assert.equal(profile.includes('openAdminPage'), false);
  assert.equal(profile.includes("studyRole === 'parent')}}\" bindtap=\"openAdminPage"), false);
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
