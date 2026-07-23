const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'pages/parent/detail/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/parent/detail/index.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'pages/parent/detail/index.wxss'), 'utf8');

test('家长口语回放隔离旧播放器错误', () => {
  assert.match(source, /speakingPlaybackRequestId/);
  assert.match(source, /createSpeakingAudioContext\(requestId, attemptKey\)/);
  assert.match(source, /this\.audioContext === audioContext[\s\S]*this\.speakingPlaybackRequestId === requestId/);
  assert.match(source, /onPlay\(\(\) => \{[\s\S]*clearSpeakingPlaybackErrorTimer/);
  assert.match(source, /onError\(\(\) => \{[\s\S]*setTimeout[\s\S]*recordingPlaybackFailed/);
  assert.match(source, /destroySpeakingAudioContext\(\)[\s\S]*audioContext\.destroy\(\)/);
  assert.doesNotMatch(source, /this\.audioContext\.stop\(\);\s*this\.audioContext\.src/);
});

test('家长口语播放按钮在两套模板和四主题中都有明显按压反馈', () => {
  assert.equal((template.match(/hover-class="attempt-play-pressed"/g) || []).length, 2);
  assert.equal((template.match(/hover-stay-time="120"/g) || []).length, 2);
  assert.match(styles, /\.attempt-play-pressed \{[\s\S]*transform: translateY\(4rpx\) scale\(0\.985\)/);
  assert.match(styles, /\.theme-library \.attempt-play-pressed/);
  assert.match(styles, /\.theme-voyage \.attempt-play-pressed/);
  assert.match(styles, /\.theme-dragon \.attempt-play-pressed/);
  assert.match(styles, /\.theme-dragon \.attempt-play-icon::before \{[\s\S]*border-left-color: #102e62/);
  assert.match(styles, /\.attempt-play\.is-loading \{[\s\S]*opacity: 1/);
});
