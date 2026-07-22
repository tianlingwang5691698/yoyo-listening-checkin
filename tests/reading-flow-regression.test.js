const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const readingHomeSource = fs.readFileSync(path.join(root, 'pages/reading/index.js'), 'utf8');
const readingDetailSource = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
const recordSource = fs.readFileSync(path.join(root, 'pages/record/index.js'), 'utf8');
const parentDetailSource = fs.readFileSync(path.join(root, 'pages/parent/detail/index.js'), 'utf8');
const practiceHistorySource = fs.readFileSync(path.join(root, 'pages/practice-history/index.js'), 'utf8');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

test('阅读保持普通分包且详情路径参数安全传递', () => {
  const readingPackage = (appConfig.subPackages || []).find((item) => item.root === 'pages/reading');
  assert.ok(readingPackage, '阅读模块应保留在分包，避免主包超过 2MB');
  assert.notEqual(readingPackage.independent, true, '阅读依赖主包公共模块，不能设为独立分包');
  assert.deepEqual(readingPackage.pages, [
    'index',
    'detail/index',
    'flashcards/index',
    'flashcards/practice/index',
    'flashcards/recognition/index',
    'flashcards/dictation/index',
    'flashcards/dictation/library/index'
  ]);
  assert.match(readingHomeSource, /encodeURIComponent\(targetPassageId\)/);
  assert.match(readingDetailSource, /decodeURIComponent\(passageId\)/);
});

test('阅读首页不显示不完整的学段说明', () => {
  const template = fs.readFileSync(path.join(root, 'pages/reading/index.wxml'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'utils/i18n-catalog-learning.js'), 'utf8');
  assert.doesNotMatch(template, /texts\.subtitle|catalogue-subtitle|reading-copy/);
  assert.doesNotMatch(catalog, /初中、高中|Junior and Senior High/);
});

test('阅读学习包术语解析不会覆盖翻译函数', () => {
  assert.match(readingDetailSource, /function termEntries[\s\S]*?const termText = pickText/);
  assert.doesNotMatch(readingDetailSource, /function termEntries[\s\S]*?const text = pickText/);
  assert.match(readingDetailSource, /label = `\$\{text\('questionPrefix'/);
});

test('统一日报详情补全阅读旧解析快照', () => {
  assert.match(recordSource, /dailyReportRoute\.buildDailyReportDetailUrl\(date\)/);
  assert.doesNotMatch(recordSource, /pages\/reading\/detail\/index/);
  assert.match(parentDetailSource, /function readingCompletionNeedsHydration[\s\S]*?!analysesReady[\s\S]*?item\.phraseCards/);
  assert.match(parentDetailSource, /if \(!readingCompletionNeedsHydration\(item\) \|\| !item\.passageId\)/);
  assert.match(parentDetailSource, /getReadingPassage\(\{ passageId: item\.passageId, attemptId \}\)/);
  assert.match(parentDetailSource, /analysis: isPlaceholderAnalysis\(analysisText\) \? '' : analysisText/);
});

test('阅读目录重进取最近提交且历史记录按 attemptId 精确读取', () => {
  const serviceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/reading.service.js'), 'utf8');
  const latestAttemptBlock = serviceSource.match(/async function getLatestAttempt\([\s\S]*?\n\}/);
  assert.ok(latestAttemptBlock);
  assert.doesNotMatch(latestAttemptBlock[0], /date:/);
  assert.match(serviceSource, /async function getAttemptById[\s\S]*?attempt\.familyId !== ctx\.family\.familyId[\s\S]*?attempt\.childId !== ctx\.child\.childId/);
  assert.match(readingDetailSource, /getReadingPassage\(\{ passageId, attemptId \}/);
});

test('阅读练习记录自动续接云端解析并输出可定位 DEBUG', () => {
  const detailBlock = practiceHistorySource.match(/async loadReadingDetail\(record\) \{[\s\S]*?\n  \},\n  async loadGrammarDetail/);
  assert.ok(detailBlock);
  assert.equal((detailBlock[0].match(/store\.getReadingStudyPack\(/g) || []).length, 1);
  assert.match(detailBlock[0], /store\.getReadingPassage\(\{ passageId: record\.targetId, attemptId \}\)/);
  assert.match(detailBlock[0], /section: 'questions'[\s\S]*?cacheOnly: false[\s\S]*?attemptId/);
  assert.match(detailBlock[0], /isPendingReadingAnalysis\(analysisText\) \? '' : analysisText/);
  assert.match(practiceHistorySource, /stage=\$\{stage\}[\s\S]*?studyPack=\$\{studyPack \? 'present' : 'missing'\}[\s\S]*?targetChildId=/);
});

test('阅读练习记录使用面向学生的中英答案称呼', () => {
  const catalog = require('../utils/i18n-catalog-learning').practiceHistory;
  const lesson = require('../utils/i18n-catalog-learning').lesson;
  assert.equal(catalog['zh-CN'].childAnswer, '你的');
  assert.equal(catalog['zh-CN'].childAnswerLabel, '你的：');
  assert.equal(catalog.en.childAnswer, 'Yours');
  assert.equal(catalog.en.childAnswerLabel, 'Yours: ');
  assert.equal(lesson['zh-CN'].studentAnswer, '你的：');
  assert.equal(lesson.en.studentAnswer, 'Yours: ');
  const parent = require('../utils/i18n-catalog-account').parentDetail;
  assert.equal(parent['zh-CN'].childChoicePrefix, '孩子选择：');
  assert.equal(parent.en.childChoicePrefix, 'Student choice: ');
});

test('阅读错题集同时保存并展示原文章', () => {
  const grammarServiceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/grammar.service.js'), 'utf8');
  assert.match(practiceHistorySource, /passage: this\.data\.type === 'reading' \? record\.passageText : ''/);
  assert.match(grammarServiceSource, /sourcePassage: sourceType === 'reading' \? String\(payload\.passage \|\| ''\) : ''/);
  assert.match(practiceHistorySource, /passageText: item\.sourceType === 'reading' \? String\(item\.sourcePassage \|\| ''\) : ''/);
  assert.match(practiceHistorySource, /async function hydrateWrongReadingPassages[\s\S]*?store\.getReadingPassage\(\{ passageId \}\)/);
  assert.match(practiceHistorySource, /await hydrateWrongReadingPassages\(normalizedRecords\)/);
});

test('阅读目录摘要不会被写入或读取为完整文章快照', () => {
  assert.match(readingHomeSource, /function isCompletePassageSnapshot\(passage\)[\s\S]*?passage\.passage[\s\S]*?passage\.questions/);
  assert.match(readingHomeSource, /isCompletePassageSnapshot\(passage\)[\s\S]*?snapshotStore\.write\(READING_PASSAGE_SNAPSHOT_KEY/);
  assert.match(readingDetailSource, /passage\._id === passageId && isCompletePassageSnapshot\(passage\)/);
});

test('阅读提交后自动衔接题目 AI 解析并优先使用缓存', () => {
  assert.match(readingDetailSource, /wx\.nextTick\(\(\) => this\.ensureQuestionAnalysis\(this\.data\.passage && this\.data\.passage\._id\)\)/);
  assert.match(readingDetailSource, /getPhoneStudyPack\(passageId\)[\s\S]*?isQuestionStudyPack\(cached\.studyPack\)/);
  const phoneCacheCheck = readingDetailSource.indexOf('isQuestionStudyPack(cached.studyPack)');
  const cloudCacheRequest = readingDetailSource.indexOf('const result = await store.getReadingStudyPack({', phoneCacheCheck);
  assert.ok(phoneCacheCheck >= 0 && cloudCacheRequest > phoneCacheCheck, '应先检查有效本机解析，再请求云端缓存');
  assert.doesNotMatch(readingDetailSource, /section: 'questions'[^}]*force:\s*true/);
});

test('阅读题目解析占位内容不会被当成有效 AI 解析', () => {
  assert.match(readingDetailSource, /analysisText !== '生成解析中'/);
  assert.match(readingDetailSource, /analysisText !== '点击“查看 AI 解析”后按需加载'/);
});

test('阅读重新解析只保存当前学生且不覆盖公共学习包', () => {
  const serviceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/reading.service.js'), 'utf8');
  assert.match(readingDetailSource, /questionAnalysisReady[\s\S]*?\{ force: true, personalOnly: true \}/);
  assert.match(readingDetailSource, /if \(!personalOnly\) \{\s*mergePhoneStudyPack/);
  assert.match(serviceSource, /force && personalOnly[\s\S]*?buildStudyPackWithModel\(passage\)[\s\S]*?savePersonalQuestionStudyPack/);
  assert.match(serviceSource, /readingAttempts[\s\S]*?review: command\.set\(review\)/);
});

test('阅读旧提交记录即使只有占位解析也会续接 AI 生成', () => {
  assert.match(readingDetailSource, /const latestAttempt = data\.latestAttempt \|\| null/);
  assert.doesNotMatch(readingDetailSource, /rawLatestAttempt && isModelReview/);
  assert.match(readingDetailSource, /if \(submitted && !questionAnalysisReady\)/);
});

test('阅读英文正确与作答标签保持小号单行', () => {
  const wxss = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.match(wxss, /\.language-en \.option-badge[\s\S]*?font-size: 16rpx[\s\S]*?white-space: nowrap/);
});

test('阅读文章纸张背景覆盖四套主题', () => {
  const wxss = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.match(wxss, /\.reading-detail[\s\S]*?\.reading-paper[\s\S]*?\.paper-body/);
  assert.match(wxss, /\.library-reading-detail[\s\S]*?\.library-article-paper[\s\S]*?\.library-article-body/);
  assert.match(wxss, /\.theme-voyage \.paper-body[\s\S]*?#fff8e6/);
  assert.match(wxss, /\.theme-dragon\.reading-detail[\s\S]*?#fff2c8[\s\S]*?\.theme-dragon \.paper-body[\s\S]*?#fffdf1/);
});

test('阅读标准答案与正确项保持同一绿色语义', () => {
  const detailTemplate = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
  const detailStyle = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  const historyTemplate = fs.readFileSync(path.join(root, 'pages/practice-history/index.wxml'), 'utf8');
  const historyStyle = fs.readFileSync(path.join(root, 'pages/practice-history/index.wxss'), 'utf8');
  assert.equal((detailTemplate.match(/cloze-answer-box is-standard-answer/g) || []).length, 2);
  assert.match(detailStyle, /\.cloze-answer-box\.is-standard-answer \{[\s\S]*?background: rgba\(134, 170, 161, 0\.18\)/);
  assert.equal((historyTemplate.match(/class="history-standard-answer"/g) || []).length, 2);
  assert.match(historyStyle, /\.history-standard-answer \{[\s\S]*?background: rgba\(134, 170, 161, 0\.18\)/);
  assert.match(historyStyle, /\.theme-library \.history-standard-answer,[\s\S]*?background: rgba\(127, 140, 120, 0\.18\)/);
});

test('阅读生词、短语、句型和答案句在两套主题使用独立颜色', () => {
  const wxml = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.equal((wxml.match(/highlight-\{\{item\.key\}\}/g) || []).length, 2);
  ['word', 'phrase', 'pattern', 'answer'].forEach((tone) => {
    assert.match(wxss, new RegExp(`\\.reading-detail \\.highlight-${tone}`));
    assert.match(wxss, new RegExp(`\\.library-reading-detail \\.highlight-${tone}`));
  });
  assert.match(wxss, /\.reading-detail \.word-card[\s\S]*?\.reading-detail \.phrase-card[\s\S]*?\.reading-detail \.pattern-card/);
  assert.match(wxss, /\.library-reading-detail \.word-card[\s\S]*?\.library-reading-detail \.phrase-card[\s\S]*?\.library-reading-detail \.pattern-card/);
  assert.match(wxss, /\.reading-detail \.answer-sentence,[\s\S]*?\.reading-detail \.cloze-evidence/);
  assert.match(wxss, /\.library-reading-detail \.answer-sentence,[\s\S]*?\.library-reading-detail \.cloze-evidence/);
});

test('阅读学生每次成功提交都能看到并听到完成反馈', () => {
  const wxss = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.match(readingDetailSource, /playReadingCompleteEffect\(result\.studyWriteAllowed !== false\)/);
  assert.match(readingDetailSource, /playReadingCompleteEffect\(rewardAllowed\)[\s\S]*?studentOnly: false/);
  const effectsSource = fs.readFileSync(path.join(root, 'utils/effects.js'), 'utf8');
  assert.match(effectsSource, /playVoice\(options\.voiceKey,[\s\S]*?studentOnly: options\.studentOnly/);
  assert.doesNotMatch(readingDetailSource, /onceKey: `reading:/);
  assert.match(wxss, /\.reading-result-effect[\s\S]*?position: fixed[\s\S]*?z-index: 90/);
});
