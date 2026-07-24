const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('四类 PDF 页眉页脚和元数据不显示产品名称', () => {
  [
    'cloudfunctions/yoyo/lib/writing-report-pdf.js',
    'cloudfunctions/yoyo/lib/reading-report-pdf.js',
    'cloudfunctions/yoyo/lib/listening-report-pdf.js',
    'cloudfunctions/yoyo/lib/ielts-speaking-report-pdf.js'
  ].forEach((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /佑佑英语/);
  });
});
