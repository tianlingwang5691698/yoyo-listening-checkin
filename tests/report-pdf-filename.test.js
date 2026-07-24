const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('四类 PDF 下载文件名使用正式题目标题', () => {
  assert.match(read('cloudfunctions/yoyo/services/writing.service.js'), /attempt\.title \|\| 'writing-report'[\s\S]{0,80}\}\.pdf/);
  assert.match(read('cloudfunctions/yoyo/services/listening.service.js'), /item\.title \|\| 'listening-report'[\s\S]{0,80}\}\.pdf/);
  assert.match(read('cloudfunctions/yoyo/services/reading.service.js'), /passage\.title \|\| 'reading-report'[\s\S]{0,80}\}\.pdf/);
  assert.match(read('cloudfunctions/yoyo/services/speaking.service.js'), /item\.title \|\| 'IELTS Speaking'[\s\S]{0,100}口语学习报告\.pdf/);
});
