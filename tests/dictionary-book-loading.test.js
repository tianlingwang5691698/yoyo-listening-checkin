const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const cloudSource = fs.readFileSync(path.join(root, 'domain/cloud/index.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.js'), 'utf8');
const pageTemplate = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.wxml'), 'utf8');
const pageStyles = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.wxss'), 'utf8');
const functionSource = fs.readFileSync(path.join(root, 'cloudfunctions/dictionary-book/index.js'), 'utf8');
const dictionaryBookFunction = require('../cloudfunctions/dictionary-book');

test('词书读取使用轻量云函数', () => {
  assert.match(cloudSource, /action === 'getDictionaryBook' \? 'dictionary-book' : 'yoyo'/);
  assert.match(functionSource, /Accept-Encoding': 'gzip, br'/);
  assert.match(functionSource, /keepAlive: true/);
});

test('轻量云函数支持初中、高中和 Unlock 词书', () => {
  const { resolveBook } = dictionaryBookFunction._test;
  assert.equal(resolveBook('junior').cloudPath, 'dictionary_books/word-dictionary-junior.json');
  assert.equal(resolveBook('senior').cloudPath, 'dictionary_books/word-dictionary-senior.json');
  assert.equal(resolveBook('unlock-3-u2-ls').cloudPath, 'dictionary_books/unlock-v2/level-3/unit-2/ls.json');
  assert.equal(resolveBook('unknown'), null);
});

test('Unlock 例句缓存升级并保留页面展示', () => {
  assert.match(pageSource, /FLASHCARD_SOURCE_CACHE_CONTENT_VERSION = 2026071302/);
  assert.match(pageTemplate, /current\.example/);
  assert.match(pageTemplate, /item\.example/);
  assert.match(pageTemplate, /item\.exampleMeaning/);
  assert.match(pageSource, /exampleMeaning:\s*entry\.exampleMeaning \|\| ''/);
});

test('例句只在单词边界换行', () => {
  assert.match(pageStyles, /\.study-example\s*\{[\s\S]*?font-size:\s*28rpx;[\s\S]*?overflow-wrap:\s*normal;[\s\S]*?word-break:\s*normal;/);
  assert.match(pageStyles, /\.library-vocab-example\s*\{[\s\S]*?font-size:\s*28rpx;[\s\S]*?overflow-wrap:\s*normal;[\s\S]*?word-break:\s*normal;/);
});

test('词汇发音只使用统一词典候选与词典专用缓存', () => {
  const voiceSource = fs.readFileSync(path.join(root, 'utils/dictionary-voice.js'), 'utf8');
  assert.match(pageTemplate, /catchtap="speakLibraryCard"/);
  assert.match(pageSource, /speakLibraryCard\(event\)/);
  assert.doesNotMatch(pageSource, /synthesizeReadingAudio/);
  assert.doesNotMatch(pageSource, /store\.getTempFileURL/);
  assert.doesNotMatch(pageSource, /store\.saveFlashcardAudio/);
  assert.match(pageSource, /FLASHCARD_AUDIO_CACHE_PREFIX = 'flashcard-dictionary-audio-v4-'/);
  assert.match(pageSource, /buildDictionaryVoiceUrls\(audioText\)/);
  assert.match(pageSource, /\n\s*audioText,\n/);
  assert.match(pageSource, /canSpeak:\s*canUseDictionaryVoice\(audioText\)/);
  assert.match(voiceSource, /\[2, 1, 0\]/);
  assert.match(voiceSource, /normalizeDictionaryVoiceText/);
  assert.match(pageSource, /removeLocalAudioFile\(filePath\)/);
  assert.match(pageTemplate, /libraryAudioKey === item\.flashcardKey/);
  assert.match(pageStyles, /@keyframes libraryNoteBounce/);
  assert.match(pageStyles, /\.library-vocab-row-speak\.is-active/);
  assert.match(pageTemplate, /class="library-vocab-row-main is-speakable"[^>]*bindtap="speakLibraryCard"/);
  assert.match(pageTemplate, /class="vocab-word-main is-speakable"[^>]*bindtap="speakLibraryCard"/);
});

test('阅读、听力课程和语法查词共用统一词典播放器', () => {
  const reading = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
  const lesson = fs.readFileSync(path.join(root, 'pages/lesson/index.js'), 'utf8');
  const grammar = fs.readFileSync(path.join(root, 'pages/grammar/index.js'), 'utf8');
  [reading, lesson, grammar].forEach((source) => assert.match(source, /createDictionaryVoicePlayer/));
  assert.doesNotMatch(reading, /dict\.youdao\.com\/dictvoice/);
  assert.doesNotMatch(lesson, /dict\.youdao\.com\/dictvoice/);
  assert.doesNotMatch(grammar, /dict\.youdao\.com\/dictvoice/);
});
