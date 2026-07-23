const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('听力 PDF 云端 action、长超时和 store 已完整接线', () => {
  const cloudIndex = read('cloudfunctions/yoyo/index.js');
  const requestContext = read('cloudfunctions/yoyo/lib/request-context-engine.js');
  const cloudDomain = read('domain/cloud/index.js');
  const store = read('utils/store.js');
  assert.match(cloudIndex, /generateListeningReportPdf: serviceAction\('listening', 'generateListeningReportPdf'\)/);
  assert.match(requestContext, /'generateListeningReportPdf'/);
  assert.match(cloudDomain, /action === 'generateListeningReportPdf'/);
  assert.match(store, /async function generateListeningReportPdf\(options\)/);
  assert.match(store, /generateListeningReportPdf,/);
});

test('听力完成页和练习记录共用 PDF 下载链路', () => {
  const detailJs = read('pages/material/detail/index.js');
  const detailWxml = read('pages/material/detail/index.wxml');
  const historyJs = read('pages/practice-history/index.js');
  const historyWxml = read('pages/practice-history/index.wxml');
  assert.match(detailJs, /completionId: String\(result\.item\.recordId/);
  assert.match(detailJs, /store\.generateListeningReportPdf\(\{ completionId \}\)/);
  assert.equal((detailWxml.match(/bindtap="downloadListeningReportPdf"/g) || []).length, 2);
  assert.match(historyJs, /type: 'listening'/);
  assert.match(historyJs, /includeQuestionAnalyses: true/);
  assert.match(historyJs, /store\.generateListeningReportPdf\(\{ completionId: record\.id \}\)/);
  assert.match(historyWxml, /完整听力原文|listeningTranscript/);
  assert.match(historyWxml, /listeningEvidenceTranslation/);
});

test('听力目录提供练习与历史入口', () => {
  const materialJs = read('pages/material/index.js');
  const materialWxml = read('pages/material/index.wxml');
  assert.match(materialJs, /\['writing', 'listening'\]\.includes\(this\.data\.moduleId\)/);
  assert.match(materialJs, /practice-history\/index\?type=\$\{this\.data\.moduleId\}/);
  assert.match(materialWxml, /moduleId === 'writing' \|\| moduleId === 'listening'/);
  assert.match(materialWxml, /texts\.practice[\s\S]*?openPracticeHistory/);
});

test('听力报告完整性、旧缓存兼容和 UI 规则已写入门禁', () => {
  const audioRules = read('docs/AUDIO_PAGE_RULES.md');
  const dataRules = read('docs/DATA_CLEANING_RULES.md');
  const uiLog = read('docs/UI_DESIGN_LANGUAGE_LOG.md');
  const catalog = require('../utils/i18n-catalog-learning');
  assert.match(audioRules, /听力套题学习报告[\s\S]*?完整 transcript[\s\S]*?不得输出残缺 PDF/);
  assert.match(dataRules, /旧共享学习包缺 `questionAnalyses`[\s\S]*?题库标准答案必须覆盖模型返回/);
  assert.match(uiLog, /听力套题学习报告 PDF 导出/);
  assert.equal(catalog.materialDetail['zh-CN'].listeningPdfDownload, '下载完整听力 PDF');
  assert.equal(catalog.practiceHistory.en.listeningEvidence, 'Listening Evidence');
});
