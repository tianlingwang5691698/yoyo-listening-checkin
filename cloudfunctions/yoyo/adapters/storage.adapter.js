const CloudBaseManager = require('@cloudbase/manager-node');
const https = require('https');
const fs = require('fs');
const { CLOUD_ASSET_BASE_URL, CLOUD_BUCKET } = require('../lib/constants');
const { cloud, getEnvId } = require('./db.adapter');

let storageManager = null;

function normalizeCloudPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
}

function buildCloudAssetUrl(cloudPath) {
  const baseUrl = String(CLOUD_ASSET_BASE_URL || '').replace(/\/+$/, '');
  const normalizedPath = normalizeCloudPath(cloudPath);
  if (!baseUrl || !normalizedPath) {
    return '';
  }
  return `${baseUrl}/${encodeURI(normalizedPath)}`;
}

function buildCloudFileId(cloudPath) {
  const normalizedPath = normalizeCloudPath(cloudPath);
  const envId = getEnvId();
  if (!envId || !CLOUD_BUCKET || !normalizedPath) {
    return '';
  }
  return `cloud://${envId}.${CLOUD_BUCKET}/${normalizedPath}`;
}

function getStorageManager() {
  if (storageManager) {
    return storageManager;
  }
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRETKEY;
  const token = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TOKEN;
  const envId = getEnvId();
  if (!envId || !secretId || !secretKey) {
    return null;
  }
  storageManager = new CloudBaseManager({
    secretId,
    secretKey,
    token,
    envId
  });
  return storageManager;
}

function formatStorageError(error) {
  if (!error) {
    return '';
  }
  return String(error.errMsg || error.message || error);
}

function getBaseName(path) {
  const fileName = normalizeCloudPath(path).split('/').pop() || '';
  return fileName.replace(/\.[^.]+$/i, '');
}

function getParentFolder(path) {
  const parts = normalizeCloudPath(path).split('/');
  parts.pop();
  return parts.join('/');
}

async function listDirectoryFiles(cloudPath) {
  const manager = getStorageManager();
  if (!manager) {
    throw new Error('storage-manager-unavailable');
  }
  const result = await manager.storage.listDirectoryFiles(normalizeCloudPath(cloudPath));
  const rawFiles = Array.isArray(result) ? result : ((((result || {}).data || {}).files || []));
  return rawFiles.map((item) => {
    const normalizedPath = normalizeCloudPath(item.cloud_path || item.cloudPath || item.Key || '');
    return {
      cloudPath: normalizedPath,
      fileId: item.fileid || item.fileID || item.fileId || buildCloudFileId(normalizedPath),
      size: Number(item.size || item.Size || 0)
    };
  });
}

function downloadJsonFromCdn(cloudPath) {
  return new Promise((resolve, reject) => {
    const url = buildCloudAssetUrl(cloudPath);
    if (!url) {
      reject(new Error('cdn-url-unavailable'));
      return;
    }
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`cdn-http-${response.statusCode || 0}`));
        response.resume();
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function downloadCloudJson(cloudPath) {
  try {
    return await downloadJsonFromCdn(cloudPath);
  } catch (error) {
    // fall through
  }
  const tempPath = `/tmp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${normalizeCloudPath(cloudPath).split('/').pop()}`;
  const fileID = buildCloudFileId(cloudPath);
  let localPath = '';
  if (fileID) {
    const result = await cloud.downloadFile({
      fileID
    });
    localPath = result && result.tempFilePath ? result.tempFilePath : '';
  }
  if (!localPath) {
    const manager = getStorageManager();
    if (!manager) {
      throw new Error('storage-manager-unavailable');
    }
    localPath = await manager.storage.downloadFile({
      cloudPath,
      localPath: tempPath
    });
  }
  const text = fs.readFileSync(localPath, 'utf8');
  return JSON.parse(text);
}

module.exports = {
  normalizeCloudPath,
  buildCloudAssetUrl,
  buildCloudFileId,
  getStorageManager,
  formatStorageError,
  getBaseName,
  getParentFolder,
  listDirectoryFiles,
  downloadJsonFromCdn,
  downloadCloudJson
};
