const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('计划完成和当天重复背诵使用独立音效键', () => {
  const source = read('pages/reading/flashcards/index.js');
  assert.match(source, /repeat-today-\$\{current\.repeatSessionId/);
  assert.match(source, /repeatSessionId: String\(Date\.now\(\)\)/);
  assert.match(source, /this\.playCompletionSfx\(\);\s*this\.scheduleDictationPrompt\(\);/);
});

test('词书背诵完成弹窗可选取消或直达听写', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  assert.match(source, /isBookSource\(this\.data\.activeSourceId\)/);
  assert.match(source, /async openCompletedDictation\(\)/);
  assert.match(source, /await this\.waitForReviewSync\(\)/);
  assert.match(template, /bindtap="dismissDictationPrompt"/);
  assert.match(template, /bindtap="openCompletedDictation"/);
});

test('听写引导弹窗支持两套主题和中英文', () => {
  const styles = read('pages/reading/flashcards/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').flashcards;
  assert.match(styles, /\.dictation-jump-dialog/);
  assert.match(styles, /\.theme-library \.dictation-jump-dialog/);
  assert.ok(catalog['zh-CN'].dictationPromptTitle);
  assert.ok(catalog.en.dictationPromptTitle);
  assert.ok(catalog['zh-CN'].goDictation);
  assert.ok(catalog.en.goDictation);
});

test('弹窗按钮等宽对称，弹窗前锁定完成页返回', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  const styles = read('pages/reading/flashcards/index.wxss');
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.dictation-jump-actions button[^}]*width: 100%[^}]*min-width: 0/);
  assert.match(source, /dictationPromptPending: true/);
  assert.match(source, /if \(this\.data\.dictationPromptPending \|\| this\.data\.dictationPromptVisible\) return;/);
  assert.match(template, /disabled="\{\{dictationPromptPending \|\| dictationPromptVisible\}\}"/);
});

test('长单词缩小且不在单词内断行，短语只按空格换行', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  const styles = read('pages/reading/flashcards/index.wxss');
  assert.match(source, /longestTokenLength >= 18/);
  assert.match(source, /longestTokenLength >= 12/);
  assert.match(source, /is-word-extra-long/);
  assert.match(template, /current\.displaySizeClass/);
  assert.match(styles, /word-break: keep-all/);
  assert.match(styles, /overflow-wrap: normal/);
});

test('词汇首页只保留单词背诵和听音拼写两个同级入口', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  assert.match(source, /sourceMode: 'practice-home'/);
  assert.equal((template.match(/bindtap="openReviewFolder"/g) || []).length, 2);
  assert.equal((template.match(/bindtap="openDictationShelf"/g) || []).length, 2);
  assert.doesNotMatch(template, /class="book-card book-dictation"/);
  assert.doesNotMatch(template, /class="library-vocab-book book-dictation"/);
});

test('单词背诵文件夹和听写图标在两套主题中独立设计', () => {
  const styles = read('pages/reading/flashcards/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').flashcards;
  assert.match(styles, /\.folder-symbol/);
  assert.match(styles, /\.listen-spell-symbol/);
  assert.match(styles, /\.headphone-band/);
  assert.match(styles, /\.theme-library \.folder-symbol/);
  assert.match(styles, /\.theme-library \.listen-spell-symbol/);
  assert.equal(catalog['zh-CN'].reviewFolderTitle, '单词背诵');
  assert.equal(catalog.en.reviewFolderTitle, 'Word Review');
});

test('背词卡与词库列表发音入口统一为小音符', () => {
  const template = read('pages/reading/flashcards/index.wxml');
  const styles = read('pages/reading/flashcards/index.wxss');
  assert.equal((template.match(/aria-label="\{\{texts\.listen\}\}"/g) || []).length, 6);
  assert.equal((template.match(/>♪<\/view>/g) || []).length, 4);
  assert.doesNotMatch(template, />\{\{texts\.listen\}\}<\/view>/);
  assert.match(styles, /\.study-speak[^}]*display: flex[^}]*align-items: center[^}]*justify-content: center/);
  assert.match(styles, /\.library-vocab-study-speak[^}]*display: flex[^}]*align-items: center[^}]*justify-content: center/);
  assert.match(styles, /\.vocab-row-speak/);
  assert.match(styles, /\.library-vocab-row-speak/);
});

test('听写记录入口在双语下使用较大字号且不换行', () => {
  const styles = read('pages/reading/flashcards/dictation/library/index.wxss');
  assert.match(styles, /\.dictation-library-record[^}]*font-size:26rpx[^}]*white-space:nowrap/);
  assert.match(styles, /\.theme-library \.dictation-library-record/);
});

test('当日重复练习支持滑动快速选择数量', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  const styles = read('pages/reading/flashcards/index.wxss');
  assert.equal((template.match(/class="today-repeat-slider"/g) || []).length, 2);
  assert.equal((template.match(/bindchanging="handleRepeatSlider"/g) || []).length, 2);
  assert.match(source, /handleRepeatSlider\(event\)/);
  assert.match(styles, /\.today-repeat-slider/);
});

test('背诵正常发音结束后继续，失败或超时则解锁', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  assert.equal((template.match(/disabled="\{\{audioLoading \|\| audioPlaying\}\}"/g) || []).length, 2);
  assert.match(source, /onPlay\(\(\) => this\.clearCardAudioStartTimer\(\)\)/);
  assert.match(source, /startCardAudioStartTimer\(audioRequestId\)/);
  assert.match(source, /\}, 3000\);/);
  assert.match(source, /if \(!canUseDictionaryVoice\(audioText\)\)/);
  assert.match(source, /buildDictionaryVoiceUrl\(audioText\)/);
  assert.match(source, /cancelCurrentAudio\(\)/);
  assert.match(source, /if \(this\.data\.audioLoading \|\| this\.data\.audioPlaying\) return;/);
});

test('听写发音失败立即显示词义提示', () => {
  const source = read('pages/reading/flashcards/dictation/index.js');
  const template = read('pages/reading/flashcards/dictation/index.wxml');
  const styles = read('pages/reading/flashcards/dictation/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').vocabularyDictation;
  assert.match(source, /onError\(\(\) => \{[\s\S]*audioFailed: true/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*audioFailed: true[\s\S]*\}, 3000\)/);
  assert.match(source, /onPlay\(\(\) => this\.clearAudioStartTimer\(\)\)/);
  assert.match(template, /audioFailed && !revealed/);
  assert.match(template, /current\.meaning/);
  assert.match(styles, /\.dictation-audio-hint/);
  assert.ok(catalog['zh-CN'].audioFailedHint);
  assert.ok(catalog.en.audioFailedHint);
});
