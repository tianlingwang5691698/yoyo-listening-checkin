const { openReportPdf } = require('./report-pdf-download');

async function openReadingReportPdf(result) {
  return openReportPdf(result, {
    fallbackFileName: 'reading-report.pdf',
    errorPrefix: 'reading-report'
  });
}

module.exports = {
  openReadingReportPdf
};
