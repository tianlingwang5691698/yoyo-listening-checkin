const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('初中、高中和 IELTS 作文详情与练习记录共用完整报告模板', () => {
  const detail = read('pages/writing/detail/index.wxml');
  const history = read('pages/practice-history/index.wxml');
  const report = read('templates/writing-report.wxml');

  assert.match(detail, /templates\/writing-report\.wxml/);
  assert.match(history, /templates\/writing-report\.wxml/);
  assert.equal((detail.match(/template is="writing-report"/g) || []).length, 2);
  assert.equal((history.match(/template is="writing-report"/g) || []).length, 1);
  [
    'criterionDetails',
    'evidence',
    'descriptorMatch',
    'limiters',
    'nextBandActions',
    'grammarCorrections',
    'polishedTitle',
    'polishedStandard',
    'polishedVersion',
    'bandSamples',
    'downloadWritingReportPdf'
  ].forEach((field) => assert.match(report, new RegExp(field)));
  assert.doesNotMatch(history, /history-review-row/);
});

test('PDF 导出包含结构化题目、原图、作文全文和完整批改', () => {
  const page = read('pages/writing/detail/index.js');
  const service = read('cloudfunctions/yoyo/services/writing.service.js');
  const pdf = read('cloudfunctions/yoyo/lib/writing-report-pdf.js');
  const store = read('utils/store.js');

  assert.match(page, /promptDisplay: this\.data\.promptDisplay/);
  ['articleTitle', 'articleParagraphs', 'requirements', 'notices', 'promptStarter', 'promptTable', 'images']
    .forEach((field) => assert.match(service, new RegExp(field)));
  ['写作题目', '题目图片', '学生作文', '批改报告', '原文证据', '卡分原因', '升到下一档', '参考范文', 'polishedStandard']
    .forEach((label) => assert.match(pdf, new RegExp(label)));
  assert.match(pdf, /if \(cleanText\(data\.polishedVersion\)\) \{\s*doc\.addPage\(\)/);
  assert.match(service, /loadWritingAttempt\(ctx, attemptId\)/);
  assert.match(service, /catalog\.getMaterialItem/);
  assert.match(service, /itemId: promptId/);
  assert.match(service, /hydrateAttemptPromptImages/);
  assert.match(service, /writing-report-prompt-source-unavailable/);
  assert.match(service, /writing-report-prompt-image-unavailable/);
  assert.match(service, /writing-reports/);
  assert.match(store, /generateWritingReportPdf/);
  assert.match(read('pages/practice-history/index.wxml'), /class="history-writing-image"/);
  assert.match(read('pages/practice-history/index.js'), /previewWritingPromptImage/);
  assert.match(pdf, /function addStudentEssay[\s\S]*doc\.addPage\(\)/);
  assert.doesNotMatch(pdf, /writeText\(doc, data\.(estimateLabel|weightingNote|feedbackNotice)/);
  const template = read('templates/writing-report.wxml');
  assert.doesNotMatch(template, /estimateLabel|weightingNote|writingTestEstimate|rubricVersion|feedbackNotice/);
  assert.match(service, /review:\s*sanitizeReviewForDisplay\(attempt\.review\)/);
});

test('共享报告保持结果字体层级和主题风格', () => {
  const style = read('styles/writing-report.wxss');
  assert.match(style, /font-size: 48rpx/);
  assert.match(style, /font-size: 32rpx/);
  assert.match(style, /font-size: 28rpx/);
  assert.match(style, /font-size: 26rpx/);
  assert.match(style, /font-size: 23rpx/);
  assert.match(style, /font-size: 21rpx/);
  assert.match(style, /PingFang SC/);
  assert.match(style, /Georgia/);
  assert.match(style, /DIN Alternate/);
  ['theme-library', 'theme-voyage', 'theme-dragon'].forEach((theme) => {
    assert.match(style, new RegExp(`\\.${theme}`));
  });
});

test('详情与记录页共享报告文案同时覆盖中英文', () => {
  const catalog = require('../utils/i18n-catalog-learning');
  const keys = [
    'rubricLabel',
    'evidenceLabel',
    'descriptorLabel',
    'limitersLabel',
    'nextBandLabel',
    'strengthsLabel',
    'bandSampleTitle',
    'pdfGenerating',
    'pdfDownload',
    'pdfFailedToast'
  ];
  ['writing', 'practiceHistory'].forEach((scope) => {
    keys.forEach((key) => {
      assert.ok(catalog[scope]['zh-CN'][key], `${scope}.zh-CN.${key}`);
      assert.ok(catalog[scope].en[key], `${scope}.en.${key}`);
    });
  });
});
