function normalizePdfFileName(fileName, fallbackFileName) {
  const fallback = String(fallbackFileName || 'report.pdf').replace(/\.pdf$/i, '');
  const base = String(fileName || fallback)
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || fallback;
  return `${base}.pdf`;
}

function buildPdfFilePath(fileName) {
  const root = wx.env && String(wx.env.USER_DATA_PATH || '').replace(/\/+$/, '');
  return root ? `${root}/${fileName}` : '';
}

function removeExistingFile(filePath) {
  if (!filePath || !wx.getFileSystemManager) return;
  try {
    wx.getFileSystemManager().unlinkSync(filePath);
  } catch (error) {}
}

function downloadPdf(url, fileName, errorPrefix) {
  return new Promise((resolve, reject) => {
    const filePath = buildPdfFilePath(fileName);
    removeExistingFile(filePath);
    wx.downloadFile({
      url,
      ...(filePath ? { filePath } : {}),
      success: (result) => {
        const downloadedPath = result.filePath || result.tempFilePath || '';
        if (Number(result.statusCode || 0) === 200 && downloadedPath) {
          resolve(downloadedPath);
          return;
        }
        reject(new Error(`${errorPrefix}-download-${result.statusCode || 0}`));
      },
      fail: reject
    });
  });
}

function openDocument(filePath) {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      success: resolve,
      fail: reject
    });
  });
}

async function openReportPdf(result, options) {
  const settings = options || {};
  const url = String(result && (result.tempUrl || result.url) || '');
  if (!url) throw new Error(`${settings.errorPrefix || 'report'}-url-missing`);
  const fileName = normalizePdfFileName(result && result.fileName, settings.fallbackFileName);
  const filePath = await downloadPdf(url, fileName, settings.errorPrefix || 'report');
  await openDocument(filePath);
  return filePath;
}

module.exports = {
  normalizePdfFileName,
  openReportPdf
};
