#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const appConfig = require('../data/app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'unlock1-3e-textbook', 'A1', 'unlock1');
const manifestPath = path.join(BUILD_ROOT, 'manifest.json');
const bundlePath = path.join(BUILD_ROOT, 'bundle-draft.json');
const cleanReportPath = path.join(BUILD_ROOT, 'clean-report.json');
const backupPath = path.join(BUILD_ROOT, 'cloud-backup', 'unlock1-bundle-before-3e-upload-20260710.json');
const credentialPath = path.join(ROOT, 'SecretKey.csv');

function normalizeCloudPath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function assetUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(normalizeCloudPath(cloudPath))}`;
}

function requestStatus(cloudPath, method = 'HEAD') {
  return new Promise((resolve) => {
    const request = https.request(assetUrl(cloudPath), { method }, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.on('error', () => resolve(0));
    request.end();
  });
}

function downloadJson(cloudPath) {
  return new Promise((resolve, reject) => {
    https.get(assetUrl(cloudPath), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`GET ${cloudPath} returned ${response.statusCode || 0}`));
          return;
        }
        try {
          resolve({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
        } catch (error) {
          reject(new Error(`invalid JSON at ${cloudPath}: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadBuffer(cloudPath) {
  return new Promise((resolve, reject) => {
    https.get(assetUrl(cloudPath), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`GET ${cloudPath} returned ${response.statusCode || 0}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

function sha1Buffer(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function sha1File(filePath) {
  return sha1Buffer(fs.readFileSync(filePath));
}

function readLocalCredential() {
  if (!fs.existsSync(credentialPath)) {
    return {};
  }
  const lines = fs.readFileSync(credentialPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {};
  }
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyHeadStatus(cloudPath, maxAttempts = 6) {
  let status = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    status = await requestStatus(cloudPath);
    if (status >= 200 && status < 400) {
      return status;
    }
    if (attempt < maxAttempts) {
      await wait(1000 * attempt);
    }
  }
  return status;
}

async function uploadItem(app, item, maxAttempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await app.uploadFile({
        cloudPath: item.cloudPath,
        fileContent: fs.createReadStream(item.localPath),
      });
      return Object.assign({}, item, {
        fileID: result.fileID || result.fileId || '',
        attempts: attempt,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await wait(1000 * attempt);
      }
    }
  }
  throw lastError;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const cleanReport = JSON.parse(fs.readFileSync(cleanReportPath, 'utf8'));
  if (!cleanReport.readyForUpload || Object.keys(bundle).length !== 66) {
    throw new Error('local bundle is not upload-ready');
  }
  if (!fs.existsSync(backupPath)) {
    throw new Error('existing Unlock 1 transcript backup is missing');
  }
  JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const audioItems = manifest.tracks
    .filter((track) => track.status === 'eligible')
    .map((track) => ({
      type: 'audio',
      title: track.title,
      localPath: track.sourcePath,
      cloudPath: track.audioCloudPath,
      sha1: track.sha1,
    }));
  const transcriptItem = {
    type: 'transcript',
    title: 'Unlock 1 Third Edition sentence bundle',
    localPath: bundlePath,
    cloudPath: manifest.meta.transcriptCloudPath,
    sha1: sha1File(bundlePath),
  };
  const items = audioItems.concat([transcriptItem]);
  if (audioItems.length !== 66) {
    throw new Error(`expected 66 audio items, got ${audioItems.length}`);
  }

  const missing = items.filter((item) => !fs.existsSync(item.localPath));
  if (missing.length) {
    throw new Error(`missing local files: ${missing.map((item) => item.localPath).join(' | ')}`);
  }

  const checks = [];
  for (const item of items) {
    const status = await requestStatus(item.cloudPath);
    checks.push(Object.assign({}, item, { status, exists: status >= 200 && status < 400 }));
  }
  const existing = checks.filter((item) => item.exists);
  const existingSame = [];
  const existingDifferent = [];
  for (const item of existing) {
    const remoteSha1 = sha1Buffer(await downloadBuffer(item.cloudPath));
    if (remoteSha1 === item.sha1) {
      existingSame.push(Object.assign({}, item, { remoteSha1 }));
    } else {
      existingDifferent.push(Object.assign({}, item, { remoteSha1 }));
    }
  }
  if (existingDifferent.length) {
    throw new Error(`target exists with different content, aborting: ${existingDifferent.map((item) => item.cloudPath).join(' | ')}`);
  }
  const itemsToUpload = checks.filter((item) => !item.exists);

  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    count: items.length,
    uploadCount: itemsToUpload.length,
    audioCount: audioItems.length,
    transcriptCount: 1,
    existingSameContentCount: existingSame.length,
    existingDifferentContentCount: existingDifferent.length,
    transcriptPath: transcriptItem.cloudPath,
    existingBundleBackupPath: backupPath,
    statusCounts: checks.reduce((counts, item) => {
      const key = String(item.status);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const credential = readLocalCredential();
  if (!credential.secretId || !credential.secretKey) {
    throw new Error('SecretKey.csv is missing valid SDK credentials');
  }
  process.env.TENCENTCLOUD_SECRETID = process.env.TENCENTCLOUD_SECRETID || credential.secretId;
  process.env.TENCENTCLOUD_SECRETKEY = process.env.TENCENTCLOUD_SECRETKEY || credential.secretKey;
  const app = cloudbase.init({
    env: appConfig.cloudEnvId,
    secretId: credential.secretId,
    secretKey: credential.secretKey,
  });

  const uploaded = [];
  for (let index = 0; index < itemsToUpload.length; index += 1) {
    const item = itemsToUpload[index];
    uploaded.push(await uploadItem(app, item));
    console.log(`${index + 1}/${itemsToUpload.length} ${item.cloudPath}`);
  }

  const verify = [];
  for (const item of items) {
    verify.push({ cloudPath: item.cloudPath, status: await verifyHeadStatus(item.cloudPath) });
  }
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) {
    throw new Error(`post-upload HEAD failed: ${failed.map((item) => `${item.cloudPath}:${item.status}`).join(' | ')}`);
  }
  const transcriptVerify = await downloadJson(transcriptItem.cloudPath);
  const cloudTrackCount = Object.keys(transcriptVerify.data || {}).length;
  if (cloudTrackCount !== Object.keys(bundle).length) {
    throw new Error(`cloud transcript track count mismatch: ${cloudTrackCount}`);
  }

  const report = {
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    desiredCount: items.length,
    uploadedThisRunCount: uploaded.length,
    alreadyPresentSameContentCount: existingSame.length,
    audioCount: audioItems.length,
    transcriptCount: 1,
    transcriptPath: transcriptItem.cloudPath,
    headVerifiedCount: verify.length,
    transcriptGetStatus: transcriptVerify.status,
    cloudTrackCount,
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
