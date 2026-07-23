function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (result) => {
        if (Number(result.statusCode || 0) === 200 && result.tempFilePath) {
          resolve(result.tempFilePath);
          return;
        }
        reject(new Error(`writing-report-download-${result.statusCode || 0}`));
      },
      fail: reject
    });
  });
}

function openDocument(filePath, fileName) {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType: 'pdf',
      fileName: fileName || 'writing-report.pdf',
      showMenu: true,
      success: resolve,
      fail: reject
    });
  });
}

async function openWritingReportPdf(result) {
  const url = String(result && (result.tempUrl || result.url) || '');
  if (!url) throw new Error('writing-report-url-missing');
  const filePath = await downloadFile(url);
  await openDocument(filePath, result.fileName);
  return filePath;
}

module.exports = {
  openWritingReportPdf
};
