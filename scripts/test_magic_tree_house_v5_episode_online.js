#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'performance-regression-v5-episode-001-online.json');
const V5_PATH = '_transcripts/A2/magic-tree-house/tracks-v5/track-magic-tree-house-001.json';
const V4_PATH = '_transcripts/A2/magic-tree-house/tracks-v4/track-magic-tree-house-001.json';

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function request(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    https.get(`${base}/${encodeURI(cloudPath)}?test=${Date.now()}-${Math.random()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: Buffer.concat(chunks),
        wallMs: Date.now() - startedAt
      }));
    }).on('error', reject);
  });
}

async function main() {
  const [v5, v4] = await Promise.all([request(V5_PATH), request(V4_PATH)]);
  if (v5.status !== 200 || v4.status !== 200) throw new Error(`track status v5=${v5.status} v4=${v4.status}`);
  const track = JSON.parse(v5.body.toString('utf8'));
  if (track.trackId !== 'track-magic-tree-house-001'
    || track.source !== 'whisperx-direct-segment-word-alignment-asr-primary'
    || !Array.isArray(track.lines) || track.lines.length !== 778
    || v5.body.length >= 1024 * 1024) {
    throw new Error('remote v5 episode 001 is invalid');
  }
  const manager = new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const report = {
    passed: detail.Status === 'Active' && v5.wallMs < 1200,
    functionStatus: detail.Status || '',
    functionModifiedAt: detail.ModTime || '',
    episode: 1,
    v5Path: V5_PATH,
    v5Bytes: v5.body.length,
    v5WallMs: v5.wallMs,
    v5Sha1: crypto.createHash('sha1').update(v5.body).digest('hex'),
    v4StillAvailable: true,
    v4Bytes: v4.body.length,
    coldThresholdMs: 1200
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
