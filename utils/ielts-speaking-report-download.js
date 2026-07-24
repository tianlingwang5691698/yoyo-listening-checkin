const { openReportPdf } = require('./report-pdf-download');

async function openIeltsSpeakingReportPdf(result) {
  return openReportPdf(result, {
    fallbackFileName: 'ielts-speaking-report.pdf',
    errorPrefix: 'ielts-speaking-report'
  });
}

module.exports = {
  openIeltsSpeakingReportPdf
};
