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
  assert.match(source, /this\.playCompletionSfx\(\);/);
  assert.match(source, /this\.finishJuniorDailyPlan\(\);[\s\S]*?this\.scheduleDictationPrompt\(\);/);
});

test('词书背诵完成弹窗可选取消或直达单词练习', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  assert.match(source, /isBookSource\(this\.data\.activeSourceId\)/);
  assert.match(source, /async openCompletedPractice\(\)/);
  assert.match(source, /await this\.waitForReviewSync\(\)/);
  assert.match(template, /bindtap="dismissDictationPrompt"/);
  assert.match(source, /flashcards\/practice\/index\?level=/);
  assert.match(template, /bindtap="openCompletedPractice"/);
});

test('听写引导弹窗支持两套主题和中英文', () => {
  const styles = read('pages/reading/flashcards/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').flashcards;
  assert.match(styles, /\.dictation-jump-dialog/);
  assert.match(styles, /\.theme-library \.dictation-jump-dialog/);
  assert.ok(catalog['zh-CN'].practicePromptTitle);
  assert.ok(catalog.en.practicePromptTitle);
  assert.ok(catalog['zh-CN'].startPractice);
  assert.ok(catalog.en.startPractice);
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

test('词汇首页保留单词背诵和单词练习两个同级入口', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  assert.match(source, /sourceMode: 'practice-home'/);
  assert.equal((template.match(/bindtap="openReviewFolder"/g) || []).length, 2);
  assert.equal((template.match(/bindtap="openWordPractice"/g) || []).length, 2);
  assert.match(source, /openWordPractice\(\)/);
  assert.doesNotMatch(template, /class="book-card book-dictation"/);
  assert.doesNotMatch(template, /class="library-vocab-book book-dictation"/);
});

test('Unlock 第二版和第三版使用独立词书入口及进度键', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  const dictation = read('pages/reading/flashcards/dictation/library/index.js');
  assert.match(source, /unlockSecondBook/);
  assert.match(source, /unlockThirdBook/);
  assert.match(source, /unlock-v3-\$\{unlockLevel\}-u\$\{unit\}-\$\{section\}/);
  assert.equal((template.match(/wx:for="\{\{unlockEditions\}\}"/g) || []).length, 2);
  assert.match(dictation, /dictionary-book-unlock-v3-/);
  assert.match(dictation, /dictionary-book-unlock-\[1-4\]-/);
});

test('初中、高中和雅思词书按 List 分层进入', () => {
  const source = read('pages/reading/flashcards/index.js');
  const template = read('pages/reading/flashcards/index.wxml');
  const dictation = read('pages/reading/flashcards/dictation/library/index.js');
  assert.match(source, /level: 'junior'[\s\S]*?listCount: 32/);
  assert.match(source, /level: 'senior'[\s\S]*?listCount: 40/);
  assert.match(source, /level: 'ielts'[\s\S]*?listCount: 48/);
  assert.match(template, /sourceMode === 'standard-lists'/);
  assert.match(template, /bindtap="openStandardBook"/);
  assert.match(dictation, /stage: 'standard-lists'/);
  assert.match(dictation, /standardStage: stage, title, subtitle: getTexts\(\)\.chooseList, items/);
  assert.match(source, /isStandardListSource\(sourceId\) && !hasStoredPlanSettings\(sourceId\)/);
  assert.match(source, /return \{ newLimit: total, reviewLimit: total \}/);
});

test('单词背诵和单词练习图标在两套主题中独立设计', () => {
  const styles = read('pages/reading/flashcards/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').flashcards;
  assert.match(styles, /\.folder-symbol/);
  assert.match(styles, /\.practice-hub-symbol/);
  assert.match(styles, /\.theme-library \.folder-symbol/);
  assert.match(styles, /\.theme-library \.practice-hub-symbol/);
  assert.equal(catalog['zh-CN'].reviewFolderTitle, '单词背诵');
  assert.equal(catalog.en.reviewFolderTitle, 'Word Review');
});

test('单词练习下分看词选义、听音选义和听音拼写', () => {
  const app = read('app.json');
  const menu = read('pages/reading/flashcards/practice/index.wxml');
  const menuSource = read('pages/reading/flashcards/practice/index.js');
  const recognition = read('pages/reading/flashcards/recognition/index.js');
  const recognitionTemplate = read('pages/reading/flashcards/recognition/index.wxml');
  assert.match(app, /flashcards\/practice\/index/);
  assert.match(app, /flashcards\/recognition\/index/);
  assert.match(menu, /data-mode="word-meaning"/);
  assert.match(menu, /data-mode="audio-meaning"/);
  assert.match(menu, /data-mode="dictation"/);
  assert.match(menuSource, /dictation\/library\/index\?\$\{query\}/);
  assert.match(recognition, /getVocabularyDictationSourceWords/);
  assert.match(recognition, /createDictionaryVoicePlayer/);
  assert.match(recognitionTemplate, /bindtap="skipAudioQuestion"/);
});

test('识义反馈和练习按键保持高亮居中', () => {
  const template = read('pages/reading/flashcards/recognition/index.wxml');
  const styles = read('pages/reading/flashcards/recognition/index.wxss');
  assert.doesNotMatch(template, /class="recognition-option[^>]*disabled=/);
  assert.match(template, /recognition-option-status is-correct/);
  assert.match(styles, /\.recognition-option\.is-correct\{[^}]*background:#dff2e6/);
  assert.match(styles, /\.recognition-count-controls button\{[^}]*width:76rpx/);
  assert.match(styles, /\.recognition-start,\.recognition-feedback button,\.recognition-again,\.recognition-change\{[^}]*align-items:center[^}]*justify-content:center[^}]*width:100%/);
});

test('看词选义每题自动发音并可手动重播', () => {
  const source = read('pages/reading/flashcards/recognition/index.js');
  const template = read('pages/reading/flashcards/recognition/index.wxml');
  assert.equal((source.match(/\}, \(\) => this\.playCurrent\(\)\);/g) || []).length, 2);
  assert.match(template, /class="recognition-word-audio/);
  assert.match(template, /practiceMode === 'word-meaning' \|\| revealed/);
  assert.match(template, /practiceMode === 'audio-meaning'/);
});

test('三种单词练习答对后自动进入下一题', () => {
  const recognition = read('pages/reading/flashcards/recognition/index.js');
  const recognitionTemplate = read('pages/reading/flashcards/recognition/index.wxml');
  const dictation = read('pages/reading/flashcards/dictation/index.js');
  const dictationTemplate = read('pages/reading/flashcards/dictation/index.wxml');
  assert.match(recognition, /CORRECT_AUTO_ADVANCE_MS = 600/);
  assert.match(recognition, /if \(correct\) this\.scheduleCorrectAdvance\(\)/);
  assert.match(recognitionTemplate, /wx:if="\{\{!current\.correct\}\}" bindtap="nextQuestion"/);
  assert.match(dictation, /CORRECT_AUTO_ADVANCE_MS = 800/);
  assert.match(dictation, /if \(result\.correct\) this\.scheduleCorrectAdvance\(\)/);
  assert.match(dictationTemplate, /wx:elif="\{\{!current\.correct\}\}" bindtap="nextCard"/);
});

test('三种单词练习完成后统一显示庆祝特效并播放完成音效', () => {
  const flashcards = read('pages/reading/flashcards/index.js');
  const recognition = read('pages/reading/flashcards/recognition/index.js');
  const recognitionTemplate = read('pages/reading/flashcards/recognition/index.wxml');
  const recognitionStyles = read('pages/reading/flashcards/recognition/index.wxss');
  const dictation = read('pages/reading/flashcards/dictation/index.js');
  const dictationTemplate = read('pages/reading/flashcards/dictation/index.wxml');
  assert.match(recognition, /effects\.playComplete\(/);
  assert.match(dictation, /effects\.playComplete\(/);
  assert.match(flashcards, /playCompletionSfx\(\)[\s\S]*?studentOnly: false/);
  assert.match(flashcards, /onceKey: this\.data\.previewMode \? '' : buildCompletionRewardKey/);
  assert.match(recognition, /effects\.playComplete\(\{[^}]*studentOnly: false/);
  assert.match(dictation, /effects\.playComplete\(\{[\s\S]*?studentOnly: false/);
  assert.match(recognitionTemplate, /class="confetti-layer"/);
  assert.match(recognitionTemplate, /class="celebrate-burst"/);
  assert.match(dictationTemplate, /class="confetti-layer"/);
  assert.match(dictationTemplate, /class="celebrate-burst"/);
  assert.match(recognitionStyles, /@keyframes vocabConfettiFall/);
  assert.match(recognitionStyles, /@keyframes vocabCompletePop/);
});

test('完成提示音保持原音量，后续英文鼓励语音提高音量', () => {
  const effects = read('utils/effects.js');
  assert.match(effects, /COMPLETE_SFX_VOLUME = 0\.55/);
  assert.match(effects, /COMPLETE_VOICE_VOLUME = 0\.9/);
  assert.match(effects, /options && options\.voiceKey[\s\S]*?!item\.includesVoice/);
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
  assert.equal((template.match(/\{\{audioPlaying \? 'is-active' : ''\}\}/g) || []).length, 2);
  assert.match(styles, /\.study-speak\.is-active/);
  assert.match(styles, /\.library-vocab-study-speak\.is-active/);
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
  assert.match(source, /onPlay\(\(\) => \{[\s\S]*this\.clearCardAudioStartTimer\(\)/);
  assert.match(source, /startCardAudioStartTimer\(audioRequestId\)/);
  assert.match(source, /FLASHCARD_AUDIO_TOTAL_TIMEOUT_MS = 5000/);
  assert.match(source, /_flashcardAudioDeadlineAt/);
  assert.match(source, /attemptTimeoutMs/);
  assert.match(source, /if \(!canUseDictionaryVoice\(audioText\)\)/);
  assert.match(source, /buildDictionaryVoiceUrls\(audioText\)/);
  assert.match(source, /_flashcardAudioFallbackUrls/);
  assert.match(source, /tryNextDictionaryVoiceFallback\(\)/);
  assert.match(source, /startDictionaryVoiceSegmentFallback\(\)/);
  assert.match(source, /playNextDictionaryVoiceSegment\(\)/);
  assert.match(source, /cancelCurrentAudio\(\)/);
  assert.match(source, /if \(this\.data\.audioLoading \|\| this\.data\.audioPlaying\) return;/);
});

test('听写美英音总计 5 秒失败后显示词义提示', () => {
  const source = read('pages/reading/flashcards/dictation/index.js');
  const voiceSource = read('utils/dictionary-voice.js');
  const template = read('pages/reading/flashcards/dictation/index.wxml');
  const styles = read('pages/reading/flashcards/dictation/index.wxss');
  const catalog = require('../utils/i18n-catalog-learning').vocabularyDictation;
  assert.match(source, /DICTATION_AUDIO_TOTAL_TIMEOUT_MS = 5000/);
  assert.match(voiceSource, /\[2, 1, 0\]/);
  assert.match(source, /tryNextDictationAudioFallback\(\)/);
  assert.match(source, /startDictationAudioSegmentFallback\(\)/);
  assert.match(source, /playNextDictationAudioSegment\(\)/);
  assert.match(source, /markDictationAudioFailed\(\)/);
  assert.match(source, /onPlay\(\(\) => this\.clearAudioStartTimer\(\)\)/);
  assert.match(template, /audioFailed && !revealed/);
  assert.match(template, /current\.meaning/);
  assert.match(template, /disabled="\{\{revealed\}\}"/);
  assert.doesNotMatch(template, /disabled="\{\{audioFailed/);
  assert.match(styles, /\.dictation-audio-hint/);
  assert.ok(catalog['zh-CN'].audioFailedHint);
  assert.ok(catalog.en.audioFailedHint);
});
