#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'performance-regression-v4-online.json');
const STATIC_MANIFEST = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');

function readCredential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function request(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = `${base}/${encodeURI(String(cloudPath).replace(/^\/+/, ''))}?v4=${Date.now()}-${Math.random()}`;
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
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
  const manifest = JSON.parse(fs.readFileSync(STATIC_MANIFEST, 'utf8'));
  const routes = [
    ...(manifest.categories.magictreehouse || []),
    ...(manifest.categories.magictreehouseb1 || [])
  ].map((item) => item.textSource && item.textSource.filePath).filter(Boolean);
  if (routes.length !== 52 || routes.some((item) => !item.includes('/tracks-v4/'))) {
    throw new Error('local deployed manifest does not contain 52 v4 routes');
  }

  const samplePaths = [routes[0], routes[13], routes[27], routes[28], routes[39], routes[51]];
  const samples = [];
  for (const cloudPath of samplePaths) {
    const remote = await request(cloudPath);
    if (remote.status !== 200 || remote.body.length >= 1024 * 1024) {
      throw new Error(`invalid remote track: ${cloudPath}:${remote.status}:${remote.body.length}`);
    }
    const track = JSON.parse(remote.body.toString('utf8'));
    if (track.source !== 'whisperx-wav2vec2-forced-alignment-asr-primary'
      || !Array.isArray(track.lines) || track.lines.length < 300) {
      throw new Error(`invalid v4 content: ${cloudPath}`);
    }
    samples.push({ cloudPath, bytes: remote.body.length, wallMs: remote.wallMs, sha1: sha1(remote.body), lineCount: track.lines.length });
  }

  const manager = new CloudBaseManager({ ...readCredential(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const maxWallMs = Math.max(...samples.map((item) => item.wallMs));
  const report = {
    passed: detail.Status === 'Active' && maxWallMs < 1200,
    functionName: 'yoyo',
    functionStatus: detail.Status || '',
    functionModifiedAt: detail.ModTime || '',
    routeCount: routes.length,
    sampleCount: samples.length,
    maxTrackBytes: Math.max(...samples.map((item) => item.bytes)),
    maxWallMs,
    coldThresholdMs: 1200,
    samples
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
