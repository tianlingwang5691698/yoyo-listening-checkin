#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'unlock3-3e-textbook', 'B1', 'unlock3');
const manifestPath = path.join(BUILD_ROOT, 'manifest.json');
const bundlePath = path.join(BUILD_ROOT, 'bundle-draft.json');
const cleanReportPath = path.join(BUILD_ROOT, 'clean-report.json');
const credentialPath = path.join(ROOT, 'SecretKey.csv');
const protectedBundles = [
  {
    label: 'second-edition-textbook',
    cloudPath: '_transcripts/B1/unlock3-textbook/bundle.json',
    backupPath: path.join(BUILD_ROOT, 'cloud-backup', 'unlock3-textbook-before-3e-upload-20260711.json')
  },
  {
    label: 'second-edition-workbook',
    cloudPath: '_transcripts/B1/unlock3/bundle.json',
    backupPath: path.join(BUILD_ROOT, 'cloud-backup', 'unlock3-workbook-before-3e-upload-20260711.json')
  }
];

function normalizeCloudPath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function assetUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(normalizeCloudPath(cloudPath))}`;
}

function sha1Buffer(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function sha1File(filePath) {
  return sha1Buffer(fs.readFileSync(filePath));
}

function requestBuffer(cloudPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = https.request(assetUrl(cloudPath), { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function requestStatus(cloudPath) {
  try {
    return (await requestBuffer(cloudPath, 'HEAD')).status;
  } catch (error) {
    return 0;
  }
}

function readCredential() {
  if (!fs.existsSync(credentialPath)) return {};
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadItem(app, item, maxAttempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await app.uploadFile({
        cloudPath: item.cloudPath,
        fileContent: fs.createReadStream(item.localPath)
      });
      return Object.assign({}, item, {
        fileID: result.fileID || result.fileId || '',
        attempts: attempt
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await wait(attempt * 1000);
    }
  }
  throw lastError;
}

async function verifiedStatus(cloudPath, maxAttempts = 6) {
  let status = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    status = await requestStatus(cloudPath);
    if (status >= 200 && status < 400) return status;
    if (attempt < maxAttempts) await wait(attempt * 1000);
  }
  return status;
}

async function verifyProtectedBundles() {
  const results = [];
  for (const item of protectedBundles) {
    if (!fs.existsSync(item.backupPath)) {
      throw new Error(`missing protected bundle backup: ${item.backupPath}`);
    }
    const backup = fs.readFileSync(item.backupPath);
    JSON.parse(backup.toString('utf8'));
    const cloud = await requestBuffer(item.cloudPath);
    const unchanged = cloud.status === 200 && sha1Buffer(cloud.body) === sha1Buffer(backup);
    if (!unchanged) {
      throw new Error(`protected ${item.label} bundle changed after backup`);
    }
    results.push({
      label: item.label,
      cloudPath: item.cloudPath,
      trackCount: Object.keys(JSON.parse(backup.toString('utf8'))).length,
      sha1: sha1Buffer(backup),
      unchanged
    });
  }
  return results;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const cleanReport = JSON.parse(fs.readFileSync(cleanReportPath, 'utf8'));
  if (manifest.meta.series !== 'unlock3thirdedition' || manifest.tracks.length !== 68 || Object.keys(bundle).length !== 68) {
    throw new Error('expected 68 Unlock3 third-edition audio and transcript tracks');
  }
  if (!cleanReport.readyForUpload || cleanReport.missingAsrCount !== 0 || cleanReport.nonLabelEmptyTrackIds.length) {
    throw new Error('local Unlock3 third-edition bundle has blocking validation errors');
  }
  const protectedBefore = await verifyProtectedBundles();

  const audioItems = manifest.tracks.map((track) => ({
    type: 'audio',
    title: track.title,
    localPath: track.sourcePath,
    cloudPath: track.cloudPath,
    sha1: track.sha1
  }));
  const transcriptItem = {
    type: 'transcript',
    title: 'Unlock 3 Listening Speaking Third Edition sentence bundle',
    localPath: bundlePath,
    cloudPath: manifest.meta.transcriptCloudPath,
    sha1: sha1File(bundlePath)
  };
  const items = audioItems.concat(transcriptItem);
  const missing = items.filter((item) => !fs.existsSync(item.localPath));
  if (missing.length) throw new Error(`missing local files: ${missing.map((item) => item.localPath).join(' | ')}`);
  const badPaths = items.filter((item) => normalizeCloudPath(item.cloudPath).split('/').some((part) => part !== part.trim()));
  if (badPaths.length) throw new Error(`cloud path has leading/trailing spaces: ${badPaths.map((item) => item.cloudPath).join(' | ')}`);

  const checks = [];
  for (const item of items) {
    const status = await requestStatus(item.cloudPath);
    checks.push(Object.assign({}, item, { status, exists: status >= 200 && status < 400 }));
  }
  const existingSame = [];
  const existingDifferent = [];
  for (const item of checks.filter((entry) => entry.exists)) {
    const remote = await requestBuffer(item.cloudPath);
    const remoteSha1 = sha1Buffer(remote.body);
    if (remoteSha1 === item.sha1) existingSame.push(item);
    else existingDifferent.push(Object.assign({}, item, { remoteSha1 }));
  }
  if (existingDifferent.length) {
    throw new Error(`target exists with different content: ${existingDifferent.map((item) => item.cloudPath).join(' | ')}`);
  }
  const uploadItems = checks.filter((item) => !item.exists);
  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    totalCount: items.length,
    audioCount: audioItems.length,
    transcriptCount: 1,
    uploadCount: uploadItems.length,
    existingSameContentCount: existingSame.length,
    existingDifferentContentCount: existingDifferent.length,
    transcriptPath: transcriptItem.cloudPath,
    protectedBundles: protectedBefore,
    statusCounts: checks.reduce((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, {})
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const credential = readCredential();
  if (!credential.secretId || !credential.secretKey) throw new Error('SecretKey.csv is missing valid SDK credentials');
  const app = cloudbase.init({
    env: appConfig.cloudEnvId,
    secretId: credential.secretId,
    secretKey: credential.secretKey
  });
  const uploaded = [];
  for (let index = 0; index < uploadItems.length; index += 1) {
    const item = uploadItems[index];
    uploaded.push(await uploadItem(app, item));
    console.log(`${index + 1}/${uploadItems.length} ${item.cloudPath}`);
  }

  const verify = [];
  for (const item of items) verify.push({ cloudPath: item.cloudPath, status: await verifiedStatus(item.cloudPath) });
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) throw new Error(`post-upload HEAD failed: ${failed.map((item) => `${item.cloudPath}:${item.status}`).join(' | ')}`);
  const transcriptCloud = await requestBuffer(transcriptItem.cloudPath);
  const transcriptData = JSON.parse(transcriptCloud.body.toString('utf8'));
  const protectedAfter = await verifyProtectedBundles();
  if (Object.keys(transcriptData).length !== 68) throw new Error('post-upload transcript track count mismatch');

  const report = {
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    desiredCount: items.length,
    uploadedThisRunCount: uploaded.length,
    alreadyPresentSameContentCount: existingSame.length,
    audioCount: audioItems.length,
    transcriptCount: 1,
    transcriptPath: transcriptItem.cloudPath,
    transcriptGetStatus: transcriptCloud.status,
    cloudTrackCount: Object.keys(transcriptData).length,
    headVerifiedCount: verify.length,
    protectedBundles: protectedAfter
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
