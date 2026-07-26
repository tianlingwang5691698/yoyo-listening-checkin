const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('五主题口语首页均提供练习记录入口', () => {
  const template = read('pages/speaking/index.wxml');
  const source = read('pages/speaking/index.js');
  ['warm', 'library', 'voyage', 'dragon', 'tactical'].forEach((theme) => {
    assert.match(template, new RegExp(`class="${theme}-speaking-section-tabs"`));
  });
  assert.equal((template.match(/bindtap="openSpeakingHistory"/g) || []).length, 5);
  assert.doesNotMatch(template, /class="speaking-section-tabs"/);
  assert.match(source, /practice-history\/index\?type=speaking/);
});

test('口语记录页直接混排两类记录并支持评分详情和录音回放', () => {
  const source = read('pages/practice-history/index.js');
  const template = read('pages/practice-history/index.wxml');
  const style = read('pages/practice-history/index.wxss');
  assert.match(source, /getSpeakingAttempts\(\{ historyMode: 'recent', limit: 100 \}\)/);
  assert.match(source, /playSpeakingRecording/);
  assert.doesNotMatch(template, /history-speaking-tabs/);
  assert.match(source, /filterKey: isIelts \? 'ielts-speaking' : 'graded-repeat'/);
  assert.match(template, /ieltsFluencyCoherenceBand/);
  assert.match(template, /pronunciationAccuracyScore/);
  assert.match(template, /bindtap="playSpeakingRecording"/);
  assert.match(style, /\.history-speaking \.history-speaking-play/);
  assert.match(style, /\.theme-library\.history-speaking \.history-speaking-play/);
  assert.match(style, /\.theme-voyage\.history-speaking \.history-speaking-play/);
  assert.match(style, /\.theme-dragon\.history-speaking \.history-speaking-play/);
  assert.match(style, /\.theme-tactical \.history-speaking \.history-speaking-play/);
});
