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
const EPISODE = 1;
const TRACK_ID = 'track-magic-tree-house-001';
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'A2', 'magic-tree-house');
const LOCAL_PATH = path.join(BUILD_ROOT, 'tracks-v5', `${TRACK_ID}.json`);
const REPORT_PATH = path.join(BUILD_ROOT, 'v5-reports', 'episode-001.json');
const PREFLIGHT_PATH = path.join(BUILD_ROOT, 'upload-preflight-v5-episode-001.json');
const UPLOAD_REPORT_PATH = path.join(BUILD_ROOT, 'upload-report-v5-episode-001.json');
const CLOUD_PATH = `_transcripts/A2/magic-tree-house/tracks-v5/${TRACK_ID}.json`;
const OLD_PATH = `_transcripts/A2/magic-tree-house/tracks-v4/${TRACK_ID}.json`;

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function assetUrl(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  return `${base}/${encodeURI(String(cloudPath).replace(/^\/+/, ''))}`;
}

function request(cloudPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request(`${assetUrl(cloudPath)}?v5=${Date.now()}-${Math.random()}`, {
      method,
      headers: { 'Cache-Control': 'no-cache' }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const localBody = fs.readFileSync(LOCAL_PATH);
  const track = JSON.parse(localBody.toString('utf8'));
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  if (track.trackId !== TRACK_ID || track.source !== 'whisperx-direct-segment-word-alignment-asr-primary'
    || !Array.isArray(track.lines) || track.lines.length !== 778 || localBody.length >= 1024 * 1024) {
    throw new Error('local v5 episode 001 track is invalid');
  }
  if ((report.validationErrors || []).length || report.lineCount !== 778 || report.meanWordScore < 0.78) {
    throw new Error('local v5 episode 001 report is not safe to upload');
  }

  const oldRemote = await request(OLD_PATH);
  if (oldRemote.status !== 200) throw new Error(`existing v4 track unavailable: ${oldRemote.status}`);
  JSON.parse(oldRemote.body.toString('utf8'));
  const oldSha1 = sha1(oldRemote.body);
  const targetRemote = await request(CLOUD_PATH);
  const localSha1 = sha1(localBody);
  if (targetRemote.status === 200 && sha1(targetRemote.body) !== localSha1) {
    throw new Error(`refuse overwrite: ${CLOUD_PATH}`);
  }

  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    episode: EPISODE,
    cloudPath: CLOUD_PATH,
    bytes: localBody.length,
    sha1: localSha1,
    existingV4Path: OLD_PATH,
    existingV4Sha1: oldSha1,
    targetStatus: targetRemote.status,
    uploadRequired: targetRemote.status !== 200
  };
  fs.writeFileSync(PREFLIGHT_PATH, `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  if (preflight.uploadRequired) {
    const keys = credentials();
    const app = cloudbase.init({ env: appConfig.cloudEnvId, secretId: keys.secretId, secretKey: keys.secretKey });
    await app.uploadFile({ cloudPath: CLOUD_PATH, fileContent: fs.createReadStream(LOCAL_PATH) });
  }

  const uploaded = await request(CLOUD_PATH);
  if (uploaded.status !== 200 || sha1(uploaded.body) !== localSha1) {
    throw new Error(`uploaded v5 verification failed: ${uploaded.status}`);
  }
  const uploadedTrack = JSON.parse(uploaded.body.toString('utf8'));
  if (uploadedTrack.trackId !== TRACK_ID || uploadedTrack.lines.length !== 778) {
    throw new Error('uploaded v5 structure verification failed');
  }
  const oldAfter = await request(OLD_PATH);
  if (oldAfter.status !== 200 || sha1(oldAfter.body) !== oldSha1) {
    throw new Error('existing v4 track changed during upload');
  }
  const result = {
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    episode: EPISODE,
    cloudPath: CLOUD_PATH,
    uploaded: preflight.uploadRequired,
    bytes: uploaded.body.length,
    sha1: localSha1,
    oldV4Unchanged: true
  };
  fs.writeFileSync(UPLOAD_REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
