const { openReportPdf } = require('./report-pdf-download');

async function openListeningReportPdf(result) {
  return openReportPdf(result, {
    fallbackFileName: 'listening-report.pdf',
    errorPrefix: 'listening-report'
  });
}

module.exports = {
  openListeningReportPdf
};
