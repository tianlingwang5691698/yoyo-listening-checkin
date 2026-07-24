const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('阅读 PDF 云端 action、长超时和 store 已完整接线', () => {
  const cloudIndex = read('cloudfunctions/yoyo/index.js');
  const requestContext = read('cloudfunctions/yoyo/lib/request-context-engine.js');
  const cloudDomain = read('domain/cloud/index.js');
  const store = read('utils/store.js');
  assert.match(cloudIndex, /generateReadingReportPdf: serviceAction\('reading', 'generateReadingReportPdf'\)/);
  assert.match(cloudIndex, /'generateReadingReportPdf'/);
  assert.match(requestContext, /'generateReadingReportPdf'/);
  assert.match(cloudDomain, /action === 'generateReadingReportPdf'/);
  assert.match(store, /async function generateReadingReportPdf\(options\)/);
  assert.match(store, /generateReadingReportPdf,/);
});

test('阅读完成页和练习记录使用同一 PDF 下载链路', () => {
  const detailJs = read('pages/reading/detail/index.js');
  const detailWxml = read('pages/reading/detail/index.wxml');
  const historyJs = read('pages/practice-history/index.js');
  const historyWxml = read('pages/practice-history/index.wxml');
  assert.match(detailJs, /openReadingReportPdf/);
  assert.match(detailJs, /store\.generateReadingReportPdf\(\{ attemptId, passageId \}\)/);
  assert.equal((detailWxml.match(/bindtap="downloadReadingReportPdf"/g) || []).length, 2);
  assert.match(historyJs, /completionId: record\.id/);
  assert.match(historyJs, /attemptId: record\.attempt/);
  assert.match(historyJs, /passageId: record\.targetId/);
  assert.match(historyWxml, /viewMode === 'history'[\s\S]*?bindtap="downloadReadingReportPdf"/);
});

test('旧阅读记录保留真实 attempt 并允许 completionId 回退导出', () => {
  const historyJs = read('pages/practice-history/index.js');
  const service = read('cloudfunctions/yoyo/services/reading.service.js');
  assert.match(historyJs, /aiAnalysisStatus:[\s\S]*?\n\s+attempt,\n\s+passageText:/);
  assert.match(service, /async function loadReadingReportAttempt[\s\S]*?readingAttempts[\s\S]*?familyId === ctx\.family\.familyId[\s\S]*?childId === ctx\.child\.childId/);
  assert.match(service, /completionId[\s\S]*?studyCompletedItems[\s\S]*?recordId: completionId[\s\S]*?latestAttempt/);
});

test('阅读学习包共享持久化，PDF 超时后只轮询稳定成品', () => {
  const service = read('cloudfunctions/yoyo/services/reading.service.js');
  const storage = read('cloudfunctions/yoyo/adapters/storage.adapter.js');
  const store = read('utils/store.js');
  assert.match(service, /saveStudyPack[\s\S]*?runTransaction[\s\S]*?doc\(cacheKey\)[\s\S]*?mergeStudyPacks/);
  assert.match(service, /buildLearningPackWithModel\(passage, 'cards', \{ allowPartial: true \}\)/);
  assert.match(service, /Promise\.allSettled\(missingSections\.map[\s\S]*?saveStudyPack\(passage, generated/);
  assert.match(service, /getCachedReadingReportPdf\(reportMeta\)[\s\S]*?payload\.cacheOnly/);
  assert.match(storage, /function cloudFileExists\(/);
  assert.match(store, /shouldPollReadingReportPdf[\s\S]*?cacheOnly: true[\s\S]*?cached\.tempUrl/);
});

test('阅读报告完整性与 UI 规则已写入门禁', () => {
  const dataRules = read('docs/DATA_CLEANING_RULES.md');
  const uiLog = read('docs/UI_DESIGN_LANGUAGE_LOG.md');
  const catalog = require('../utils/i18n-catalog-learning');
  assert.match(dataRules, /阅读 PDF[\s\S]*?作答说明[\s\S]*?原题图片[\s\S]*?生词、短语和句型/);
  assert.match(dataRules, /无法完整取得时，不得输出残缺 PDF/);
  assert.match(dataRules, /阅读 PDF 补齐生词、短语、句型[\s\S]*?确定性共享缓存/);
  assert.match(dataRules, /客户端连接超时后只能轮询该路径的成品状态/);
  assert.match(uiLog, /阅读学习报告 PDF 导出/);
  assert.equal(catalog.readingDetail['zh-CN'].readingPdfDownload, '下载完整阅读 PDF');
  assert.equal(catalog.practiceHistory.en.readingPdfGenerating, 'Generating PDF');
});

test('阅读结果和历史记录不显示技术来源措辞', () => {
  const catalog = require('../utils/i18n-catalog-learning');
  const readingZh = catalog.readingDetail['zh-CN'];
  const readingEn = catalog.readingDetail.en;
  const historyZh = catalog.practiceHistory['zh-CN'];
  assert.equal(readingZh.viewAnalysis, '查看逐题解析');
  assert.equal(readingZh.analysisReady, '逐题解析已加载');
  assert.equal(readingEn.viewAnalysis, 'View Question Analysis');
  assert.equal(historyZh.analysisLoaded, '逐题解析已加载');
  assert.doesNotMatch([
    readingZh.viewAnalysis,
    readingZh.loadingAnalysis,
    readingZh.analysisReady,
    historyZh.analysisLoaded,
    historyZh.viewAnalysis,
    historyZh.noAnalysis
  ].join(' '), /AI|模型|云端/);
});
