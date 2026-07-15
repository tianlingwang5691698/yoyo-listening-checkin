#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const appConfig = require('../app-config');
const { sha256, validateReleaseDirectory } = require('./grammar_cloud_release_lib');

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

function credentials() {
  const filePath = path.join(__dirname, '..', 'SecretKey.csv');
  if (!fs.existsSync(filePath)) throw new Error('SecretKey.csv is missing; dry-run is still available');
  const rows = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) throw new Error('SecretKey.csv has no credential row');
  const values = rows[1].split(',').map((value) => value.trim());
  if (!values[0] || !values[1]) throw new Error('SecretKey.csv credentials are incomplete');
  return { secretId: values[0], secretKey: values[1] };
}

function download(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${base}/${cloudPath.replace(/^\/+/, '')}?activateGrammar=${Date.now()}-${Math.random()}`);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const releaseId = argument('release-id');
  if (!releaseId) throw new Error('missing --release-id=<releaseId>');
  const release = validateReleaseDirectory(releaseId);
  const manifestCloudPath = `${CLOUD_ROOT}/${releaseId}/release-manifest.json`;
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    releaseId,
    collection: COLLECTION,
    manifestCloudPath,
    manifestHash: release.manifest.manifestHash,
    action: 'append-global-activation-record',
    uploads: 0
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!process.argv.includes('--confirm-activate-existing-release')) throw new Error('missing --confirm-activate-existing-release');
  if (!process.argv.includes('--confirm-global-switch')) throw new Error('missing --confirm-global-switch');

  const remote = await download(manifestCloudPath);
  if (remote.statusCode !== 200) throw new Error(`release-manifest-http-${remote.statusCode}:${releaseId}`);
  if (sha256(remote.body) !== sha256(release.manifestBody)) throw new Error(`release-manifest-file-hash:${releaseId}`);
  let remoteManifest;
  try {
    remoteManifest = JSON.parse(remote.body.toString('utf8'));
  } catch (error) {
    throw new Error(`release-manifest-json:${releaseId}:${error.message}`);
  }
  if (remoteManifest.releaseId !== releaseId || remoteManifest.manifestHash !== release.manifest.manifestHash) {
    throw new Error(`release-manifest-content-hash:${releaseId}`);
  }

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  const db = app.database();
  try {
    await db.collection(COLLECTION).limit(1).get();
  } catch (error) {
    throw new Error(`collection-not-ready:${COLLECTION}:${error.message || error}`);
  }
  const previous = await db.collection(COLLECTION).where({ releaseId }).limit(1).get();
  if (!previous || !previous.data || !previous.data.length) throw new Error(`release-record-not-found:${releaseId}`);
  const activatedAt = new Date().toISOString();
  await db.collection(COLLECTION).add({
    releaseId,
    schemaVersion: release.manifest.schemaVersion,
    status: 'released',
    active: true,
    activationType: 'existing-release',
    releaseHash: release.manifest.releaseHash,
    manifestHash: release.manifest.manifestHash,
    manifestCloudPath,
    topicCount: release.manifest.topicCount,
    lessonCount: release.manifest.lessonCount,
    narrationCount: release.manifest.narrationCount,
    releasedAt: activatedAt,
    activatedAt
  });
  console.log(JSON.stringify({ ...report, remoteManifestVerified: true, activationRecordAdded: true, activatedAt }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
