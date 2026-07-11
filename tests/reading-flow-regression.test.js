const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const readingHomeSource = fs.readFileSync(path.join(root, 'pages/reading/index.js'), 'utf8');
const readingDetailSource = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');

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
