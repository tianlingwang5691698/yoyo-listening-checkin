#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const appConfig = require('../app-config');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'online-assets-report.json');

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const [secretId, secretKey] = lines[1].split(',').map((item) => item.trim());
  return { secretId, secretKey };
}

function fileId(cloudPath) {
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${cloudPath}`;
}

function publicUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(cloudPath)}`;
}

function head(cloudPath) {
  return new Promise((resolve) => {
    const request = https.request(publicUrl(cloudPath), { method: 'HEAD' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.on('error', () => resolve(0));
    request.setTimeout(10000, () => {
      request.destroy();
      resolve(0);
    });
    request.end();
  });
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

async function tempStates(app, paths) {
  const output = [];
  for (let offset = 0; offset < paths.length; offset += 50) {
    const batch = paths.slice(offset, offset + 50);
    const response = await app.getTempFileURL({ fileList: batch.map(fileId) });
    output.push(...(response.fileList || []).map((item, index) => ({
      cloudPath: batch[index],
      ready: !!(item.tempFileURL || item.download_url),
      code: item.code || ''
    })));
  }
  return output;
}

function collectPaths() {
  const staticManifest = require('../cloudfunctions/yoyo/data/static-catalog-manifests.json').categories;
  const unlockManifest = require('../cloudfunctions/yoyo/data/unlock-series-manifests.json');
  const workbook = unlockManifest.unlock1workbookthirdedition.tracks.map((track) => track.cloudPath);
  const magicTasks = [...staticManifest.magictreehouse, ...staticManifest.magictreehouseb1];
  const magicSegments = magicTasks.flatMap((task) => (task.audioSegments || []).map((segment) => segment.audioCloudPath));
  const magicFallbacks = magicTasks.map((task) => task.audioCloudPath);
  const unlock4Tasks = unlockManifest.unlock4.tracks;
  const unlock4Optimized = unlock4Tasks.map((track) => track.cloudPath);
  const unlock4Segments = unlock4Tasks.flatMap((track) => (track.audioSegments || []).map((segment) => segment.audioCloudPath));
  const unlock4Fallbacks = unlock4Tasks.map((track) => track.legacyCloudPath).filter(Boolean);
  return {
    workbook,
    magicSegments,
    magicFallbacks,
    unlock4Optimized,
    unlock4Segments,
    unlock4Fallbacks,
    all: Array.from(new Set([
      ...workbook,
      ...magicSegments,
      ...magicFallbacks,
      ...unlock4Optimized,
      ...unlock4Segments,
      ...unlock4Fallbacks
    ]))
  };
}

async function main() {
  const paths = collectPaths();
  if (paths.magicSegments.length < 2000) throw new Error(`Magic Tree House segment count too low: ${paths.magicSegments.length}`);
  if (paths.unlock4Segments.length < 100) throw new Error(`Unlock 4 segment count too low: ${paths.unlock4Segments.length}`);
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  const temp = await tempStates(app, paths.all);
  const tempFailed = temp.filter((item) => !item.ready);
  const publicChecks = await mapLimit(paths.all, 24, async (cloudPath) => ({ cloudPath, status: await head(cloudPath) }));
  const publicFailed = publicChecks.filter((item) => item.status < 200 || item.status >= 400);
  const report = {
    passed: tempFailed.length === 0 && publicFailed.length === 0,
    counts: Object.fromEntries(Object.entries(paths).filter(([key]) => key !== 'all').map(([key, value]) => [key, value.length])),
    uniquePathCount: paths.all.length,
    tempReadyCount: temp.length - tempFailed.length,
    publicReadyCount: publicChecks.length - publicFailed.length,
    tempFailed,
    publicFailed
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
