#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'performance-regression-v6-episode-001-online.json');
const PATHS = {
  v6: '_transcripts/A2/magic-tree-house/tracks-v6/track-magic-tree-house-001.json',
  v5: '_transcripts/A2/magic-tree-house/tracks-v5/track-magic-tree-house-001.json',
  v4: '_transcripts/A2/magic-tree-house/tracks-v4/track-magic-tree-house-001.json'
};

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
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks), wallMs: Date.now() - startedAt }));
    }).on('error', reject);
  });
}

async function main() {
  const [v6, v5, v4] = await Promise.all([request(PATHS.v6), request(PATHS.v5), request(PATHS.v4)]);
  if ([v6, v5, v4].some((item) => item.status !== 200)) throw new Error(`track status v6=${v6.status} v5=${v5.status} v4=${v4.status}`);
  const track = JSON.parse(v6.body.toString('utf8'));
  if (track.source !== 'whisperx-word-stream-sentence-resegmented-asr-primary'
    || !Array.isArray(track.lines) || track.lines.length !== 759 || v6.body.length >= 1024 * 1024) {
    throw new Error('remote v6 episode 001 is invalid');
  }
  const detail = await new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId }).functions.getFunctionDetail('yoyo');
  const report = {
    passed: detail.Status === 'Active' && v6.wallMs < 1200,
    functionStatus: detail.Status || '',
    functionModifiedAt: detail.ModTime || '',
    episode: 1,
    v6Bytes: v6.body.length,
    v6WallMs: v6.wallMs,
    v6LineCount: track.lines.length,
    v5StillAvailable: true,
    v4StillAvailable: true,
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
