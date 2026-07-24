const { openReportPdf } = require('./report-pdf-download');

async function openWritingReportPdf(result) {
  return openReportPdf(result, {
    fallbackFileName: 'writing-report.pdf',
    errorPrefix: 'writing-report'
  });
}

module.exports = {
  openWritingReportPdf
};
