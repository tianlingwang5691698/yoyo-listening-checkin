#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appConfig = require('../app-config');
const unlockSeriesManifests = require('../cloudfunctions/yoyo/data/unlock-series-manifests.json');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const SOURCE_MANIFEST_ROOT = path.join(ROOT, 'data', 'transcript-build', 'unlock-series');
const SERIES = ['unlock2', 'unlock3', 'unlock4'];

function readSourceManifest(series) {
  const meta = unlockSeriesManifests[series] && unlockSeriesManifests[series].meta;
  if (!meta) {
    throw new Error(`missing manifest meta: ${series}`);
  }
  const manifestPath = path.join(SOURCE_MANIFEST_ROOT, meta.level, series, 'manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function buildUploadItems(series) {
  const sourceManifest = readSourceManifest(series);
  return sourceManifest.tracks
    .filter((item) => item.status === 'eligible')
    .map((item) => ({
      series,
      title: item.title,
      durationSec: item.durationSec,
      localPath: item.sourcePath,
      cloudPath: item.cloudPath
    }));
}

function buildTranscriptItems(series) {
  const meta = unlockSeriesManifests[series] && unlockSeriesManifests[series].meta;
  if (!meta) {
    throw new Error(`missing manifest meta: ${series}`);
  }
  return [{
    series,
    title: `${series} transcript bundle`,
    localPath: path.join(SOURCE_MANIFEST_ROOT, meta.level, series, 'bundle-draft.json'),
    cloudPath: meta.transcriptCloudPath,
    type: 'transcript'
  }];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadItem(app, item, maxAttempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await app.uploadFile({
        cloudPath: item.cloudPath,
        fileContent: fs.createReadStream(item.localPath)
      });
      return Object.assign({}, item, {
        fileID: result.fileID || result.fileId || '',
        attempts: attempt
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
      await wait(1000 * attempt);
    }
  }
  throw lastError;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyArg = process.argv.find((arg) => arg.startsWith('--series='));
  const startAtArg = process.argv.find((arg) => arg.startsWith('--start-at='));
  const startAt = Math.max(1, Number(startAtArg ? startAtArg.split('=')[1] : 1) || 1);
  const audioOnly = process.argv.includes('--audio-only');
  const transcriptOnly = process.argv.includes('--transcript-only');
  const selectedSeries = onlyArg ? onlyArg.split('=')[1].split(',').filter(Boolean) : SERIES;
  const audioItems = transcriptOnly ? [] : selectedSeries.flatMap(buildUploadItems).map((item) => Object.assign({}, item, { type: 'audio' }));
  const transcriptItems = audioOnly ? [] : selectedSeries.flatMap(buildTranscriptItems);
  const allItems = audioItems.concat(transcriptItems);
  const items = allItems.slice(startAt - 1);
  const missing = items.filter((item) => !fs.existsSync(item.localPath));
  if (missing.length) {
    throw new Error(`missing local files: ${missing.map((item) => item.localPath).join(' | ')}`);
  }
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      envId: appConfig.cloudEnvId,
      count: items.length,
      startAt,
      originalCount: allItems.length,
      audioCount: audioItems.length,
      transcriptCount: transcriptItems.length,
      bySeries: Object.fromEntries(SERIES.map((series) => [series, items.filter((item) => item.series === series).length])),
      sample: items.slice(0, 5)
    }, null, 2));
    return;
  }
  const app = cloudbase.init({ env: appConfig.cloudEnvId });
  const uploaded = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    uploaded.push(await uploadItem(app, item));
    console.log(`${startAt + index}/${allItems.length} ${item.cloudPath}`);
  }
  console.log(JSON.stringify({
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    count: uploaded.length,
    bySeries: Object.fromEntries(SERIES.map((series) => [series, uploaded.filter((item) => item.series === series).length]))
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
