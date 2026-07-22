const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const { createVocabularySessionTimer, formatDuration } = require('../utils/vocabulary-session-timer');

test('词汇用时格式统一', () => {
  assert.equal(formatDuration(0, 'zh-CN'), '0秒');
  assert.equal(formatDuration(65, 'zh-CN'), '1分5秒');
  assert.equal(formatDuration(65, 'en'), '1m 5s');
});

test('后台停留不计入有效用时', () => {
  const originalNow = Date.now;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  let now = 1000;
  Date.now = () => now;
  global.setInterval = () => 1;
  global.clearInterval = () => {};
  try {
    const timer = createVocabularySessionTimer();
    timer.start();
    now = 2500;
    timer.pause();
    now = 10000;
    assert.equal(timer.getElapsedSec(), 1);
    timer.resume();
    now = 11500;
    assert.equal(timer.stop(), 3);
  } finally {
    Date.now = originalNow;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});

test('背诵和三种练习共用有效计时并暂停后台时间', () => {
  const flashcards = read('pages/reading/flashcards/index.js');
  const recognition = read('pages/reading/flashcards/recognition/index.js');
  const dictation = read('pages/reading/flashcards/dictation/index.js');
  [flashcards, recognition, dictation].forEach((source) => {
    assert.match(source, /createVocabularySessionTimer/);
    assert.match(source, /onHide\(\)[\s\S]*?\.pause\(\)/);
  });
  assert.match(recognition, /practiceMode: this\.data\.practiceMode[\s\S]*?durationSec/);
  assert.match(dictation, /practiceMode: this\.practiceMode[\s\S]*?durationSec/);
  assert.match(flashcards, /latestAttempt:[\s\S]*?durationSec: this\.getVocabularySessionDuration\(\)/);
});

test('选义练习进云端记录和日报，不改写拼写错词本', () => {
  const service = read('cloudfunctions/yoyo/services/flashcard.service.js');
  const history = read('pages/practice-history/index.js');
  const report = read('pages/parent/detail/index.js');
  assert.match(service, /isRecognition \? !!\(item && item\.correct\)/);
  assert.match(service, /if \(isSpellingPractice\) \{/);
  assert.match(service, /section: isSpellingPractice \? 'dictation' : `practice-\$\{practiceMode\}`/);
  assert.match(service, /durationSec: Math\.max/);
  assert.match(history, /durationText: formatDuration\(item\.durationSec\)/);
  assert.match(report, /durationSec/);
  assert.match(report, /durationLabel/);
});
