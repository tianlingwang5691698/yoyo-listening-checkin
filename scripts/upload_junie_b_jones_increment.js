#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'junie-b-jones', 'A1', 'junie-b-jones');
const MANIFEST_PATH = path.join(BUILD_ROOT, 'manifest.json');
const REPORT_PATH = path.join(BUILD_ROOT, 'clean-report.json');
const PREFLIGHT_PATH = path.join(BUILD_ROOT, 'upload-preflight.json');
const UPLOAD_REPORT_PATH = path.join(BUILD_ROOT, 'upload-report.json');
const CREDENTIAL_PATH = path.join(ROOT, 'SecretKey.csv');
const REFERENCE_PATH = '_transcripts/Pre A1/little-bear/bundle-sentence-v1.json';

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
  const hash = crypto.createHash('sha1');
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let size = 0;
    while ((size = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, size));
    }
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
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
  const lines = fs.readFileSync(CREDENTIAL_PATH, 'utf8').trim().split(/\r?\n/);
  const [secretId, secretKey] = lines[1].split(',').map((item) => item.trim());
  if (!secretId || !secretKey) throw new Error('SecretKey.csv is missing SDK credentials');
  return { secretId, secretKey };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function uploadItem(app, item) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await app.uploadFile({
        cloudPath: item.cloudPath,
        fileContent: fs.createReadStream(item.localPath)
      });
      return { cloudPath: item.cloudPath, type: item.type, attempts: attempt, fileID: result.fileID || result.fileId || '' };
    } catch (error) {
      lastError = error;
      if (attempt < 5) await wait(attempt * 1000);
    }
  }
  throw lastError;
}

function buildItems(manifest) {
  const items = manifest.tracks.flatMap((track) => {
    const full = {
      type: 'audio',
      taskId: track.id,
      title: track.title,
      localPath: track.optimizedPath,
      cloudPath: track.audioCloudPath,
      sha1: track.sha1
    };
    const segments = (track.audioSegments || []).map((segment) => ({
      type: 'segment',
      taskId: track.id,
      title: `${track.title} #${segment.index}`,
      localPath: segment.localPath,
      cloudPath: segment.audioCloudPath,
      sha1: segment.sha1
    }));
    return [full].concat(segments);
  });
  const bundlePath = path.join(BUILD_ROOT, 'bundle-sentence-v1.json');
  if (fs.existsSync(bundlePath)) {
    items.push({
      type: 'transcript-bundle',
      taskId: 'junie-b-jones',
      title: 'Junie B. Jones sentence bundle',
      localPath: bundlePath,
      cloudPath: '_transcripts/A1/junie-b-jones/bundle-sentence-v1.json',
      sha1: sha1File(bundlePath)
    });
  }
  for (const track of manifest.tracks) {
    const localPath = path.join(BUILD_ROOT, 'tracks-v1', `${track.trackId}.json`);
    if (fs.existsSync(localPath)) {
      items.push({
        type: 'transcript-track',
        taskId: track.id,
        title: `${track.title} transcript`,
        localPath,
        cloudPath: `_transcripts/A1/junie-b-jones/tracks-v1/${track.trackId}.json`,
        sha1: sha1File(localPath)
      });
    }
  }
  return items;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const cleanReport = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  if (manifest.meta.level !== 'A1' || manifest.meta.category !== 'juniebjones' || manifest.tracks.length !== 28) {
    throw new Error('expected 28 A1 Junie B. Jones tracks');
  }
  if (cleanReport.validationErrorCount !== 0 || cleanReport.readyTrackCount !== 28) {
    throw new Error('local clean report is not safe to upload');
  }
  const items = buildItems(manifest);
  const missingFiles = items.filter((item) => !fs.existsSync(item.localPath));
  if (missingFiles.length) throw new Error(`missing local files: ${missingFiles.map((item) => item.localPath).join(' | ')}`);
  const badHash = items.filter((item) => sha1File(item.localPath) !== item.sha1);
  if (badHash.length) throw new Error(`local sha1 changed: ${badHash.map((item) => item.localPath).join(' | ')}`);
  const badPaths = items.filter((item) => (item.type === 'audio' || item.type === 'segment') && !item.cloudPath.includes(item.sha1.slice(0, 10)));
  if (badPaths.length) throw new Error(`cloud path missing content fingerprint: ${badPaths.map((item) => item.cloudPath).join(' | ')}`);

  const reference = await requestBuffer(REFERENCE_PATH);
  if (reference.status !== 200) throw new Error(`formal Pre A1 reference unavailable: ${reference.status}`);
  JSON.parse(reference.body.toString('utf8'));

  const checks = await mapLimit(items, 12, async (item) => {
    const status = await requestStatus(item.cloudPath);
    if (status >= 200 && status < 400) {
      const remote = await requestBuffer(item.cloudPath);
      const remoteSha1 = sha1Buffer(remote.body);
      return Object.assign({}, item, { status, remoteSha1, sameContent: remoteSha1 === item.sha1 });
    }
    return Object.assign({}, item, { status, remoteSha1: '', sameContent: false });
  });
  const existingSame = checks.filter((item) => item.status >= 200 && item.status < 400 && item.sameContent);
  const existingDifferent = checks.filter((item) => item.status >= 200 && item.status < 400 && !item.sameContent);
  if (existingDifferent.length) {
    throw new Error(`refuse overwrite existing different content: ${existingDifferent.map((item) => item.cloudPath).join(' | ')}`);
  }
  const uploadItems = checks.filter((item) => item.status < 200 || item.status >= 400);
  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    level: manifest.meta.level,
    category: manifest.meta.category,
    trackCount: manifest.tracks.length,
    totalCount: items.length,
    audioCount: checks.filter((item) => item.type === 'audio').length,
    segmentCount: checks.filter((item) => item.type === 'segment').length,
    transcriptCount: checks.filter((item) => item.type.startsWith('transcript')).length,
    uploadCount: uploadItems.length,
    existingSameContentAddressedCount: existingSame.length,
    existingDifferentContentCount: existingDifferent.length,
    referencePath: REFERENCE_PATH,
    referenceSha1: sha1Buffer(reference.body)
  };
  fs.writeFileSync(PREFLIGHT_PATH, `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...readCredential() });
  let completed = 0;
  const uploaded = await mapLimit(uploadItems, 4, async (item) => {
    const result = await uploadItem(app, item);
    completed += 1;
    console.log(`${completed}/${uploadItems.length} ${item.cloudPath}`);
    return result;
  });
  const verify = await mapLimit(items, 12, async (item) => ({ cloudPath: item.cloudPath, status: await requestStatus(item.cloudPath) }));
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) throw new Error(`post-upload HEAD failed: ${failed.map((item) => item.cloudPath).join(' | ')}`);
  const sampleItems = [
    items[0],
    items[Math.floor(items.length / 2)],
    items[items.length - 1]
  ];
  const hashVerify = [];
  for (const item of sampleItems) {
    const remote = await requestBuffer(item.cloudPath);
    hashVerify.push({
      cloudPath: item.cloudPath,
      status: remote.status,
      localSha1: item.sha1,
      remoteSha1: sha1Buffer(remote.body),
      matched: remote.status === 200 && sha1Buffer(remote.body) === item.sha1
    });
  }
  if (hashVerify.some((item) => !item.matched)) throw new Error('post-upload sample hash verification failed');
  const referenceAfter = await requestBuffer(REFERENCE_PATH);
  if (referenceAfter.status !== 200 || sha1Buffer(referenceAfter.body) !== preflight.referenceSha1) {
    throw new Error('existing Pre A1 reference changed during upload');
  }
  const report = {
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    uploadedCount: uploaded.length,
    reusedSameContentAddressedCount: existingSame.length,
    verifiedCount: verify.length,
    sampleHashVerifiedCount: hashVerify.filter((item) => item.matched).length,
    oldReferenceUnchanged: true,
    hashVerify
  };
  fs.writeFileSync(UPLOAD_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
