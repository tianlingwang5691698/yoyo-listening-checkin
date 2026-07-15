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
const levelArg = process.argv.find((item) => item.startsWith('--level='));
const LEVEL = String(levelArg ? levelArg.split('=')[1] : 'A2').toUpperCase();
const CONFIGS = {
  A2: { category: 'magictreehouse', count: 28, officialPdfCount: 27, asrFallbackCount: 1, referencePath: '_transcripts/A2/pete-the-cat/bundle-sentence-v1.json' },
  B1: { category: 'magictreehouseb1', count: 24, officialPdfCount: 24, asrFallbackCount: 0, referencePath: '_transcripts/B1/new-concept-3-us-line/bundle.json' }
};
const CONFIG = CONFIGS[LEVEL];
if (!CONFIG) throw new Error(`unsupported level: ${LEVEL}`);
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', LEVEL, 'magic-tree-house');
const MANIFEST_PATH = path.join(BUILD_ROOT, 'manifest.json');
const BUNDLE_PATH = path.join(BUILD_ROOT, 'bundle-sentence-v1.json');
const REPORT_PATH = path.join(BUILD_ROOT, 'clean-report.json');
const CREDENTIAL_PATH = path.join(ROOT, 'SecretKey.csv');
const REFERENCE_PATH = CONFIG.referencePath;

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
  if (!fs.existsSync(CREDENTIAL_PATH)) return {};
  const lines = fs.readFileSync(CREDENTIAL_PATH, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
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
      const result = await app.uploadFile({ cloudPath: item.cloudPath, fileContent: fs.createReadStream(item.localPath) });
      return { cloudPath: item.cloudPath, attempts: attempt, fileID: result.fileID || result.fileId || '' };
    } catch (error) {
      lastError = error;
      if (attempt < 5) await wait(attempt * 1000);
    }
  }
  throw lastError;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
  const cleanReport = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  if (manifest.meta.level !== LEVEL || manifest.meta.category !== CONFIG.category
    || manifest.tracks.length !== CONFIG.count || Object.keys(bundle).length !== CONFIG.count) {
    throw new Error(`expected ${CONFIG.count} Magic Tree House ${LEVEL} tracks`);
  }
  if (cleanReport.validationErrorCount !== 0 || cleanReport.builtTrackCount !== CONFIG.count
    || cleanReport.officialPdfTrackCount !== CONFIG.officialPdfCount
    || cleanReport.asrFallbackTrackCount !== CONFIG.asrFallbackCount) {
    throw new Error(`local Magic Tree House ${LEVEL} validation report is not safe to upload`);
  }

  const audioItems = manifest.tracks.map((track) => ({
    type: 'audio',
    title: track.title,
    localPath: track.sourcePath,
    cloudPath: track.audioCloudPath,
    sha1: track.sha1
  }));
  const transcriptItem = {
    type: 'transcript',
    title: `Magic Tree House ${LEVEL} sentence bundle`,
    localPath: BUNDLE_PATH,
    cloudPath: manifest.meta.transcriptCloudPath,
    sha1: sha1File(BUNDLE_PATH)
  };
  const transcriptTrackItems = manifest.tracks.map((track) => {
    const localPath = path.join(BUILD_ROOT, 'tracks', `${track.trackId}.json`);
    return {
      type: 'transcript-track',
      title: `${track.title} transcript`,
      localPath,
      cloudPath: track.transcriptTrackCloudPath,
      sha1: sha1File(localPath)
    };
  });
  // A2's first immutable bundle has already shipped; direct track files are a
  // new additive performance path and must not replace that legacy object.
  const items = audioItems.concat(transcriptTrackItems, LEVEL === 'A2' ? [] : [transcriptItem]);
  if (items.some((item) => !fs.existsSync(item.localPath))) throw new Error('local upload file missing');
  if (new Set(items.map((item) => item.cloudPath)).size !== items.length) throw new Error('duplicate cloud path');

  const reference = await requestBuffer(REFERENCE_PATH);
  if (reference.status !== 200) throw new Error(`formal ${LEVEL} reference unavailable: ${reference.status}`);
  JSON.parse(reference.body.toString('utf8'));
  const checks = await mapLimit(items, 8, async (item) => Object.assign({}, item, { status: await requestStatus(item.cloudPath) }));
  const existingSame = [];
  const existingDifferent = [];
  for (const item of checks.filter((entry) => entry.status >= 200 && entry.status < 400)) {
    const remote = await requestBuffer(item.cloudPath);
    const remoteSha1 = sha1Buffer(remote.body);
    if (remoteSha1 === item.sha1) existingSame.push(item);
    else existingDifferent.push(Object.assign({}, item, { remoteSha1 }));
  }
  if (existingDifferent.length) throw new Error(`refuse overwrite: ${existingDifferent.map((item) => item.cloudPath).join(' | ')}`);
  const uploadItems = checks.filter((item) => item.status < 200 || item.status >= 400);
  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    level: LEVEL,
    totalCount: items.length,
    audioCount: audioItems.length,
    transcriptCount: transcriptTrackItems.length + (LEVEL === 'A2' ? 0 : 1),
    uploadCount: uploadItems.length,
    existingSameContentCount: existingSame.length,
    existingDifferentContentCount: existingDifferent.length,
    referencePath: REFERENCE_PATH,
    referenceSha1: sha1Buffer(reference.body),
    transcriptPath: transcriptItem.cloudPath,
    transcriptSha1: transcriptItem.sha1
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'upload-preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const credential = readCredential();
  if (!credential.secretId || !credential.secretKey) throw new Error('SecretKey.csv is missing valid SDK credentials');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, secretId: credential.secretId, secretKey: credential.secretKey });
  let completed = 0;
  const uploaded = await mapLimit(uploadItems, 4, async (item) => {
    const result = await uploadItem(app, item);
    completed += 1;
    console.log(`${completed}/${uploadItems.length} ${item.cloudPath}`);
    return result;
  });
  const verify = await mapLimit(items, 8, async (item) => ({ cloudPath: item.cloudPath, status: await requestStatus(item.cloudPath) }));
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) throw new Error(`post-upload HEAD failed: ${failed.map((item) => item.cloudPath).join(' | ')}`);
  const sampleItems = [
    audioItems[0],
    audioItems[Math.floor(audioItems.length / 2)],
    audioItems[audioItems.length - 1],
    transcriptTrackItems[0],
    transcriptTrackItems[transcriptTrackItems.length - 1]
  ].concat(LEVEL === 'A2' ? [] : [transcriptItem]);
  const hashVerify = [];
  for (const item of sampleItems) {
    const remote = await requestBuffer(item.cloudPath);
    const remoteSha1 = sha1Buffer(remote.body);
    hashVerify.push({ cloudPath: item.cloudPath, localSha1: item.sha1, remoteSha1, matched: remote.status === 200 && remoteSha1 === item.sha1 });
  }
  if (hashVerify.some((item) => !item.matched)) throw new Error('post-upload sample hash verification failed');
  const referenceAfter = await requestBuffer(REFERENCE_PATH);
  if (referenceAfter.status !== 200 || sha1Buffer(referenceAfter.body) !== preflight.referenceSha1) {
    throw new Error(`existing ${LEVEL} reference changed during upload`);
  }
  const report = {
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    level: LEVEL,
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
