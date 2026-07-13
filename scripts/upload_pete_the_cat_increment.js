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
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'pete-the-cat', 'A2', 'pete-the-cat');
const MANIFEST_PATH = path.join(BUILD_ROOT, 'manifest.json');
const BUNDLE_PATH = path.join(BUILD_ROOT, 'bundle-draft.json');
const REPORT_PATH = path.join(BUILD_ROOT, 'clean-report.json');
const CREDENTIAL_PATH = path.join(ROOT, 'SecretKey.csv');
const REFERENCE_PATH = '_transcripts/A2/new-concept-2-us-line/bundle.json';

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
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: Buffer.concat(chunks),
        etag: String(response.headers.etag || '')
      }));
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
  if (!fs.existsSync(CREDENTIAL_PATH)) return {};
  const lines = fs.readFileSync(CREDENTIAL_PATH, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
      return { cloudPath: item.cloudPath, type: item.type, attempts: attempt, fileID: result.fileID || result.fileId || '' };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await wait(attempt * 1000);
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
  const cleanReport = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  if (manifest.tracks.length !== 40 || Object.keys(bundle).length !== 40) {
    throw new Error('expected 40 audio, cover and transcript tracks');
  }
  if (cleanReport.validationErrorCount !== 0 || cleanReport.asrDoneCount !== 40) {
    throw new Error('local sentence bundle has blocking validation errors');
  }

  const audioItems = manifest.tracks.map((track) => ({
    type: 'audio',
    title: track.title,
    localPath: track.sourcePath,
    cloudPath: track.audioCloudPath,
    sha1: track.sha1
  }));
  const coverItems = manifest.tracks.map((track) => ({
    type: 'cover',
    title: track.title,
    localPath: track.coverSourcePath,
    cloudPath: track.coverCloudPath,
    sha1: track.coverSha1
  }));
  const transcriptItem = {
    type: 'transcript',
    title: 'Pete the Cat sentence bundle',
    localPath: BUNDLE_PATH,
    cloudPath: manifest.meta.transcriptCloudPath,
    sha1: sha1File(BUNDLE_PATH)
  };
  const items = audioItems.concat(coverItems, transcriptItem);
  const missingFiles = items.filter((item) => !fs.existsSync(item.localPath));
  if (missingFiles.length) {
    throw new Error(`missing local files: ${missingFiles.map((item) => item.localPath).join(' | ')}`);
  }
  const badPaths = items.filter((item) => normalizeCloudPath(item.cloudPath).split('/').some((part) => !part || part !== part.trim()));
  if (badPaths.length) {
    throw new Error(`invalid cloud paths: ${badPaths.map((item) => item.cloudPath).join(' | ')}`);
  }

  const reference = await requestBuffer(REFERENCE_PATH);
  if (reference.status !== 200) {
    throw new Error(`formal A2 reference bundle unavailable: ${reference.status}`);
  }
  const referenceJson = JSON.parse(reference.body.toString('utf8'));
  const checks = await mapLimit(items, 8, async (item) => {
    const status = await requestStatus(item.cloudPath);
    return Object.assign({}, item, { status, exists: status >= 200 && status < 400 });
  });
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
    coverCount: coverItems.length,
    transcriptCount: 1,
    uploadCount: uploadItems.length,
    existingSameContentCount: existingSame.length,
    existingDifferentContentCount: existingDifferent.length,
    referencePath: REFERENCE_PATH,
    referenceTrackCount: Object.keys(referenceJson).length,
    referenceSha1: sha1Buffer(reference.body),
    transcriptPath: transcriptItem.cloudPath,
    transcriptSha1: transcriptItem.sha1,
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
  if (!credential.secretId || !credential.secretKey) {
    throw new Error('SecretKey.csv is missing valid SDK credentials');
  }
  const app = cloudbase.init({
    env: appConfig.cloudEnvId,
    secretId: credential.secretId,
    secretKey: credential.secretKey
  });
  let completed = 0;
  const uploaded = await mapLimit(uploadItems, 4, async (item) => {
    const result = await uploadItem(app, item);
    completed += 1;
    console.log(`${completed}/${uploadItems.length} ${item.cloudPath}`);
    return result;
  });

  const verify = await mapLimit(items, 8, async (item) => ({
    cloudPath: item.cloudPath,
    status: await requestStatus(item.cloudPath)
  }));
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) {
    throw new Error(`post-upload HEAD failed: ${failed.map((item) => `${item.cloudPath}:${item.status}`).join(' | ')}`);
  }
  const sampleIndexes = [0, Math.floor(manifest.tracks.length / 2), manifest.tracks.length - 1];
  const hashSamples = sampleIndexes.flatMap((index) => [audioItems[index], coverItems[index]]).concat(transcriptItem);
  const hashVerify = [];
  for (const item of hashSamples) {
    const remote = await requestBuffer(item.cloudPath);
    hashVerify.push({
      cloudPath: item.cloudPath,
      status: remote.status,
      localSha1: item.sha1,
      remoteSha1: sha1Buffer(remote.body),
      matched: remote.status === 200 && sha1Buffer(remote.body) === item.sha1
    });
  }
  if (hashVerify.some((item) => !item.matched)) {
    throw new Error('post-upload sample hash verification failed');
  }
  const referenceAfter = await requestBuffer(REFERENCE_PATH);
  if (referenceAfter.status !== 200 || sha1Buffer(referenceAfter.body) !== preflight.referenceSha1) {
    throw new Error('existing formal A2 reference bundle changed during upload');
  }
  const report = {
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    uploadedCount: uploaded.length,
    reusedSameContentCount: existingSame.length,
    verifiedCount: verify.length,
    sampleHashVerifiedCount: hashVerify.filter((item) => item.matched).length,
    oldReferenceUnchanged: true,
    transcriptUrl: assetUrl(transcriptItem.cloudPath),
    hashVerify
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
