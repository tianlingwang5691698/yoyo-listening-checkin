#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');
const SONG_ROOT = 'A1/Super simple songs';
const SONG_BUNDLE = '_transcripts/A1/songs/bundle.json';

function credentials() {
  const envId = process.env.TENCENTCLOUD_SECRETID || process.env.SECRETID;
  const envKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRETKEY;
  if (envId && envKey) return { secretId: envId, secretKey: envKey };
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function normalizePath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function baseName(value) {
  return normalizePath(value).split('/').pop().replace(/\.[^.]+$/i, '');
}

function downloadJson(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    https.get(`${base}/${encodeURI(cloudPath)}?manifest=${Date.now()}`, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`http-${response.statusCode}:${cloudPath}`));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

function trackDurationSec(track) {
  const directMs = Number(track && (track.durationMs || track.duration || track.audioDurationMs));
  if (directMs > 0) return Math.max(1, Math.round(directMs / 1000));
  const directSec = Number(track && (track.durationSec || track.audioDurationSec));
  if (directSec > 0) return Math.max(1, Math.round(directSec));
  const maxEndMs = (track && Array.isArray(track.lines) ? track.lines : []).reduce((max, line) => Math.max(max, Number(line && line.endMs || 0)), 0);
  return maxEndMs > 0 ? Math.max(1, Math.ceil(maxEndMs / 1000)) : 0;
}

function songMeta(cloudPath, size, trackMap) {
  const name = baseName(cloudPath);
  const match = name.replace(/^0+/, '').match(/^(\d+)(?:[.\s_-]+)(.+)$/);
  if (!match) return null;
  const number = Number(match[1]);
  const padded = String(number).padStart(3, '0');
  const trackId = `track-sss-${padded}`;
  return {
    taskId: `super-simple-songs-${number}`,
    category: 'song',
    title: `${padded} ${match[2].trim()}`,
    subtitle: 'Super Simple Songs',
    audioCloudPath: normalizePath(cloudPath),
    size: Number(size || 0),
    repeatTarget: 3,
    durationSec: trackDurationSec(trackMap[trackId]) || 180,
    coverTone: 'mint',
    transcriptTrackId: trackId,
    transcriptStatus: trackMap[trackId] ? 'ready' : 'pending',
    transcriptBatch: Math.floor((number - 1) / 100) + 1,
    syncGranularity: trackMap[trackId] && trackMap[trackId].syncGranularity || 'line',
    textSource: { sourceType: 'transcript-bundle', title: 'Super Simple Songs Lyrics', filePath: SONG_BUNDLE }
  };
}

async function main() {
  const keys = credentials();
  const manager = new CloudBaseManager({ ...keys, envId: appConfig.cloudEnvId });
  const [listed, trackMap] = await Promise.all([
    manager.storage.listDirectoryFiles(SONG_ROOT),
    downloadJson(SONG_BUNDLE)
  ]);
  const rawFiles = Array.isArray(listed) ? listed : ((((listed || {}).data || {}).files || []));
  const songs = rawFiles
    .map((item) => ({ cloudPath: item.cloud_path || item.cloudPath || item.Key || '', size: item.size || item.Size || 0 }))
    .filter((item) => /\.(mp3|m4a|aac|wav)$/i.test(item.cloudPath))
    .map((item) => songMeta(item.cloudPath, item.size, trackMap || {}))
    .filter(Boolean)
    .sort((left, right) => left.audioCloudPath.localeCompare(right.audioCloudPath, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
  if (!songs.length) throw new Error('song-manifest-empty');
  const output = {
    generatedAt: new Date().toISOString(),
    categories: { song: songs }
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), songCount: songs.length, transcriptReady: songs.filter((item) => item.transcriptStatus === 'ready').length }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
