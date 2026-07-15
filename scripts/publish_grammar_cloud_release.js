#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const appConfig = require('../app-config');
const { RELEASES_DIR, validateReleaseDirectory, sha256 } = require('./grammar_cloud_release_lib');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (_) {
  cloudbase = require('@cloudbase/node-sdk');
}

const COLLECTION = 'grammarClassroomReleases';
const CLOUD_ROOT = '_content/grammar-classroom/releases';

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : '';
}

function latestReleaseId() {
  if (!fs.existsSync(RELEASES_DIR)) return '';
  const candidates = fs.readdirSync(RELEASES_DIR)
    .filter((name) => /^grammar-[a-f0-9]{20}$/.test(name))
    .map((name) => ({ name, mtime: fs.statSync(path.join(RELEASES_DIR, name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime);
  return candidates[0] && candidates[0].name || '';
}

function credentials() {
  const filePath = path.join(__dirname, '..', 'SecretKey.csv');
  if (!fs.existsSync(filePath)) throw new Error('SecretKey.csv is missing; dry-run is still available');
  const rows = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) throw new Error('SecretKey.csv has no credential row');
  const values = rows[1].split(',').map((value) => value.trim());
  if (!values[0] || !values[1]) throw new Error('SecretKey.csv credentials are incomplete');
  return { secretId: values[0], secretKey: values[1] };
}

function request(cloudPath, method = 'HEAD') {
  const base = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${base}/${cloudPath.replace(/^\/+/, '')}?grammarRelease=${Date.now()}-${Math.random()}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function inspectRemote(upload) {
  const response = await request(upload.cloudPath, 'GET');
  if (response.statusCode === 404) return 'missing';
  if (response.statusCode !== 200) throw new Error(`cloud-path-preflight-http-${response.statusCode}:${upload.cloudPath}`);
  if (sha256(response.body) !== upload.hash) throw new Error(`immutable-cloud-path-conflict:${upload.cloudPath}`);
  return 'verified-existing';
}

async function verifyFile(cloudPath, expectedHash) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await request(cloudPath, 'GET');
    lastStatus = response.statusCode;
    if (response.statusCode === 200 && sha256(response.body) === expectedHash) return;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`cloud-file-verify-failed:${lastStatus}:${cloudPath}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const releaseId = argument('release-id') || latestReleaseId();
  if (!releaseId) throw new Error('No release found. Run build_grammar_cloud_release.js first.');
  const release = validateReleaseDirectory(releaseId);
  const prefix = `${CLOUD_ROOT}/${releaseId}`;
  const uploads = release.files.map((file) => ({
    cloudPath: `${prefix}/${file.relativePath}`,
    body: Buffer.from(file.body),
    hash: file.fileHash
  }));
  uploads.push({
    cloudPath: `${prefix}/release-manifest.json`,
    body: Buffer.from(release.manifestBody),
    hash: sha256(release.manifestBody)
  });
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    releaseId,
    collection: COLLECTION,
    cloudPrefix: `${prefix}/`,
    topicCount: release.manifest.topicCount,
    lessonCount: release.manifest.lessonCount,
    narrationCount: release.manifest.narrationCount,
    uploadCount: uploads.length,
    totalBytes: uploads.reduce((sum, item) => sum + item.body.length, 0)
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!process.argv.includes('--confirm-additive-release')) throw new Error('missing --confirm-additive-release');

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  const db = app.database();
  try {
    await db.collection(COLLECTION).limit(1).get();
  } catch (error) {
    throw new Error(`collection-not-ready:${COLLECTION}:${error.message || error}`);
  }
  const existing = await db.collection(COLLECTION).where({ releaseId }).limit(1).get();
  if (existing && existing.data && existing.data.length) throw new Error(`release-record-exists:${releaseId}`);
  const remoteStates = [];
  for (const upload of uploads) remoteStates.push(await inspectRemote(upload));

  let uploaded = 0;
  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];
    if (remoteStates[index] === 'verified-existing') continue;
    await app.uploadFile({ cloudPath: upload.cloudPath, fileContent: upload.body });
    await verifyFile(upload.cloudPath, upload.hash);
    uploaded += 1;
  }
  const releasedAt = new Date().toISOString();
  await db.collection(COLLECTION).add({
    releaseId,
    schemaVersion: release.manifest.schemaVersion,
    status: 'released',
    active: true,
    releaseHash: release.manifest.releaseHash,
    manifestHash: release.manifest.manifestHash,
    manifestCloudPath: `${prefix}/release-manifest.json`,
    topicCount: release.manifest.topicCount,
    lessonCount: release.manifest.lessonCount,
    narrationCount: release.manifest.narrationCount,
    releasedAt
  });
  console.log(JSON.stringify({ ...report, uploaded, reusedVerified: uploads.length - uploaded, verified: uploads.length, releaseRecordAdded: true, releasedAt }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
