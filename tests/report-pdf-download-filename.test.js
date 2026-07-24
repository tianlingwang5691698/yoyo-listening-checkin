const assert = require('node:assert/strict');
const test = require('node:test');

const downloads = [];
const opened = [];
global.wx = {
  env: { USER_DATA_PATH: '/wx-user-data' },
  getFileSystemManager() {
    return { unlinkSync() {} };
  },
  downloadFile(options) {
    downloads.push(options);
    options.success({ statusCode: 200, filePath: options.filePath });
  },
  openDocument(options) {
    opened.push(options);
    options.success();
  }
};

const { normalizePdfFileName } = require('../utils/report-pdf-download');
const { openWritingReportPdf } = require('../utils/writing-report-download');
const { openReadingReportPdf } = require('../utils/reading-report-download');
const { openListeningReportPdf } = require('../utils/listening-report-download');
const { openIeltsSpeakingReportPdf } = require('../utils/ielts-speaking-report-download');

test('PDF 下载先写入题目标题命名的用户文件', async () => {
  const fixtures = [
    [openWritingReportPdf, 'Cambridge IELTS 19 Test 1 Task 1.pdf'],
    [openReadingReportPdf, '2020 上海松江一模阅读 D.pdf'],
    [openListeningReportPdf, 'Cambridge IELTS 21 Test 1 Listening.pdf'],
    [openIeltsSpeakingReportPdf, 'Cambridge IELTS 21 Test 1 Speaking 口语学习报告.pdf']
  ];
  for (const [openPdf, fileName] of fixtures) {
    const filePath = await openPdf({ tempUrl: 'https://example.com/report.pdf', fileName });
    assert.equal(filePath, `/wx-user-data/${fileName}`);
  }
  assert.deepEqual(downloads.map((item) => item.filePath), fixtures.map((item) => `/wx-user-data/${item[1]}`));
  assert.deepEqual(opened.map((item) => item.filePath), fixtures.map((item) => `/wx-user-data/${item[1]}`));
  assert.equal(opened.some((item) => Object.hasOwn(item, 'fileName')), false);
});

test('PDF 文件名清理路径字符并保留扩展名', () => {
  assert.equal(normalizePdfFileName('2026/上海:阅读 D', 'reading-report.pdf'), '2026 上海 阅读 D.pdf');
});
