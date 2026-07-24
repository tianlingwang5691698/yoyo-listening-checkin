const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('IELTS speaking PDF action is wired through cloud and store with long timeout', () => {
  assert.match(read('cloudfunctions/yoyo/index.js'), /generateIeltsSpeakingReportPdf/);
  assert.match(read('cloudfunctions/yoyo/lib/request-context-engine.js'), /generateIeltsSpeakingReportPdf/);
  assert.match(read('domain/cloud/index.js'), /generateIeltsSpeakingReportPdf/);
  assert.match(read('utils/store.js'), /generateIeltsSpeakingReportPdf/);
  assert.match(read('domain/cloud/index.js'), /generateIeltsSpeakingReportPdf[\s\S]{0,160}320000/);
});

test('both IELTS speaking result layouts expose the complete PDF control', () => {
  const wxml = read('pages/speaking/index.wxml');
  const buttons = wxml.match(/bindtap="downloadIeltsSpeakingReportPdf"/g) || [];
  assert.equal(buttons.length, 2);
  assert.match(wxml, /ieltsPdfGenerating/);
  assert.equal((wxml.match(/练习结果/g) || []).length, 2);
  assert.doesNotMatch(wxml, /练习预估|AI 练习预估/);
  const wxss = read('pages/speaking/index.wxss');
  assert.match(wxss, /\.ielts-pdf-button/);
  assert.match(wxss, /\.theme-library \.ielts-pdf-button/);
  assert.match(wxss, /\.theme-voyage \.ielts-pdf-button/);
  assert.match(wxss, /\.theme-dragon \.ielts-pdf-button/);
  assert.equal((read('pages/parent/detail/index.wxml').match(/bindtap="downloadIeltsSpeakingReportPdf"/g) || []).length, 2);
  assert.match(read('pages/parent/detail/index.js'), /openIeltsSpeakingReportPdf/);
  assert.match(read('pages/parent/detail/index.js'), /ieltsItemMatch/);
  assert.match(read('pages/parent/detail/index.wxss'), /\.speaking-report-pdf/);
});

test('report service enforces official item, family-child scope and no source image dependency', () => {
  const service = read('cloudfunctions/yoyo/services/speaking.service.js');
  assert.match(service, /catalogService\.getMaterialItem/);
  assert.match(service, /findIeltsByTest/);
  assert.match(service, /startsWith\(`\$\{itemId\}-part-`\)/);
  assert.match(read('cloudfunctions/yoyo/repositories/attempt.repository.js'), /db\.RegExp/);
  assert.match(service, /attempt\.familyId === scope\.familyId/);
  assert.match(service, /attempt\.childId === scope\.childId/);
  assert.doesNotMatch(service, /ielts-speaking-report-source-image-unavailable/);
  assert.doesNotMatch(service, /downloadCloudFileBuffer[\s\S]{0,300}buildIeltsSpeakingReportPdf/);
  assert.match(service, /-v2\.pdf/);
});
