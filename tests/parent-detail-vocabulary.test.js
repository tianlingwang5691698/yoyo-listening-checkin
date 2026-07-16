const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'pages/parent/detail/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/parent/detail/index.wxml'), 'utf8');
const catalog = require('../utils/i18n-catalog-account').parentDetail;

test('日报内容档案按模块加载听力、口语和词汇明细', () => {
  assert.match(source, /\['listening', 'speaking', 'vocabulary', 'reading', 'grammar', 'writing'\]/);
  assert.match(source, /store\.getStudyCompletions\(\{[\s\S]*?types: getArchiveModuleTypes\(key\)/);
  assert.match(source, /reportOptions = \{ summaryOnly: true, detailVersion: 'actual-records-v1' \}/);
  assert.match(source, /getDailyReportByDate\(this\.data\.date,[\s\S]*?reportOptions/);
  assert.match(source, /store\.getSpeakingAttempts\(\{ targetDate: this\.data\.date \}/);
  assert.match(source, /if \(type === 'vocabulary'\) return tr\('vocabulary'\)/);
  assert.match(source, /const isVocabulary = safeItem\.type === 'vocabulary'/);
  assert.match(source, /recordLabel,[\s\S]*?isVocabulary,/);
  assert.equal((template.match(/bindtap="loadArchiveModule"/g) || []).length, 2);
  assert.equal((template.match(/activeArchiveModule === 'speaking'/g) || []).length, 2);
  assert.equal((template.match(/wx:if="\{\{!item\.isVocabulary\}\}"/g) || []).length, 2);
  assert.match(source, /current && current\.isGrammarMicroLesson[\s\S]*?buildGrammarClassroomUrl\(current, \{ review: true \}\)/);
  assert.doesNotMatch(template, /\{\{item\.typeLabel\}\}/);
  assert.equal((template.match(/\{\{item\.recordLabel\}\}/g) || []).length, 4);
  assert.match(catalog['zh-CN'].dossierCopy, /按模块/);
  assert.equal(catalog['zh-CN'].vocabulary, '词汇');
  assert.equal(catalog['zh-CN'].speaking, '口语');
  assert.equal(catalog['zh-CN'].memorizationProgress, '复习 {reviewed} 词 · 不熟 {unfamiliar} 词');
  assert.equal(catalog['zh-CN'].dictationProgress, '正确 {correct}/{total} · 错词 {wrong}');
  assert.equal(catalog.en.vocabulary, 'Vocabulary');
});

test('云端完成记录支持按模块类型过滤', () => {
  const service = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/completion.service.js'), 'utf8');
  const reportService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/report.service.js'), 'utf8');
  const speakingService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/speaking.service.js'), 'utf8');
  assert.match(service, /Array\.isArray\(payload\.types\)/);
  assert.match(service, /where\.type = command\.in\(types\)/);
  assert.match(reportService, /if \(payload\.summaryOnly\)/);
  assert.match(reportService, /completionItemCount: completionItems\.length/);
  assert.match(reportService, /speakingAttempts: speakingAttempts\.map/);
  assert.match(speakingService, /attempt\.category && attempt\.taskId[\s\S]*?attemptRepository\.findByDate/);
});

test('日报首屏摘要不返回完整练习和录音内容', async () => {
  const study = require('../cloudfunctions/yoyo/facades/study.facade');
  const reportService = require('../cloudfunctions/yoyo/services/report.service');
  const originalPrepare = study.prepareRequestContext;
  const originalScope = study.getUserScope;
  const originalUpsert = study.upsertDailyReport;
  const originalProgress = study.getChildProgressRecordsByDate;
  const originalCompletions = study.getCompletionItemsByDate;
  const largeText = 'detail-'.repeat(1000);
  const fullReport = {
    date: '2026-07-13',
    items: [],
    completionItems: [{
      recordId: 'vocabulary-1',
      type: 'vocabulary',
      section: 'dictation',
      title: 'Unlock 1',
      latestAttempt: { questions: [{ word: 'hello', analysis: largeText }] }
    }],
    speakingAttempts: [{
      attemptId: 'speaking-1',
      score: 90,
      status: 'scored',
      studentTranscript: largeText,
      feedback: largeText
    }]
  };
  try {
    study.prepareRequestContext = async () => ({ ctx: {}, today: '2026-07-13' });
    study.getUserScope = () => ({});
    study.upsertDailyReport = async () => fullReport;
    study.getChildProgressRecordsByDate = async () => [];
    study.getCompletionItemsByDate = async () => fullReport.completionItems;
    const result = await reportService.getDailyReportByDate({
      payload: { date: '2026-07-13', summaryOnly: true }
    });
    const summaryText = JSON.stringify(result.report);
    assert.ok(summaryText.length < JSON.stringify(fullReport).length / 5);
    assert.doesNotMatch(summaryText, /studentTranscript|questions|analysis|feedback/);
    assert.equal(result.report.completionItemCount, 1);
  } finally {
    study.prepareRequestContext = originalPrepare;
    study.getUserScope = originalScope;
    study.upsertDailyReport = originalUpsert;
    study.getChildProgressRecordsByDate = originalProgress;
    study.getCompletionItemsByDate = originalCompletions;
  }
});
