#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');
const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
const { TRANSCRIPT_BUNDLE_PATHS } = require('../cloudfunctions/yoyo/lib/constants');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');
const SONG_ROOT = 'A1/Super simple songs';
const SONG_BUNDLE = '_transcripts/A1/songs/bundle.json';
const NEW_CONCEPT_CATEGORIES = ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'];
const EXPECTED_COUNTS = { newconcept1: 72, newconcept2: 98, newconcept3: 60, newconcept4: 48 };
const NON_AUDIO_FILE_PATTERN = /\.(lrc|srt|vtt|txt|json|pdf|jpg|jpeg|png|webp)$/i;

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

function getDuration(trackMap, meta) {
  const keys = [meta.transcriptTrackId].concat(meta.transcriptTrackCandidates || []).filter(Boolean);
  for (const key of keys) {
    const durationSec = trackDurationSec(trackMap && trackMap[key]);
    if (durationSec > 0) return durationSec;
  }
  return 180;
}

function normalizeListedFiles(listed) {
  const rawFiles = Array.isArray(listed) ? listed : ((((listed || {}).data || {}).files || []));
  return rawFiles.map((item) => ({
    cloudPath: normalizePath(item.cloud_path || item.cloudPath || item.Key || ''),
    size: Number(item.size || item.Size || 0)
  })).filter((item) => item.cloudPath);
}

async function loadTrackMap(category) {
  const paths = Array.isArray(TRANSCRIPT_BUNDLE_PATHS[category])
    ? TRANSCRIPT_BUNDLE_PATHS[category]
    : [TRANSCRIPT_BUNDLE_PATHS[category]];
  for (const cloudPath of paths.filter(Boolean)) {
    try {
      return await downloadJson(cloudPath);
    } catch (error) {
      // try next compatible bundle
    }
  }
  return {};
}

async function buildNewConceptManifest(manager, category) {
  const trackMap = await loadTrackMap(category);
  const candidates = catalogEngine.STORAGE_ROOT_CANDIDATES[category] || [];
  for (const root of candidates) {
    try {
      const files = normalizeListedFiles(await manager.storage.listDirectoryFiles(root));
      const audioFiles = files.filter((item) => (
        catalogEngine.AUDIO_FILE_PATTERN.test(item.cloudPath)
        || (!NON_AUDIO_FILE_PATTERN.test(item.cloudPath) && item.size >= 100 * 1024)
      )).sort((left, right) => catalogEngine.sortFilesByPath(left, right, category));
      if (audioFiles.length !== EXPECTED_COUNTS[category]) continue;
      return audioFiles.map((file, index) => {
        const meta = catalogEngine.inferNewConceptTaskMeta(category, baseName(file.cloudPath), index);
        return {
          taskId: meta.taskId,
          category,
          title: meta.title,
          subtitle: meta.subtitle,
          audioCloudPath: file.cloudPath,
          size: file.size,
          repeatTarget: 3,
          durationSec: getDuration(trackMap, meta),
          coverTone: meta.coverTone,
          transcriptTrackId: meta.transcriptTrackId,
          transcriptTrackCandidates: meta.transcriptTrackCandidates,
          transcriptStatus: meta.transcriptTrackId ? 'ready' : 'none',
          transcriptBatch: meta.transcriptBatch,
          syncGranularity: meta.syncGranularity,
          textSource: meta.textSource
        };
      });
    } catch (error) {
      // try next compatible root
    }
  }
  throw new Error(`${category}-manifest-count-mismatch`);
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
  const apply = process.argv.includes('--apply');
  const keys = credentials();
  const manager = new CloudBaseManager({ ...keys, envId: appConfig.cloudEnvId });
  const [listed, trackMap, ...newConceptEntries] = await Promise.all([
    manager.storage.listDirectoryFiles(SONG_ROOT),
    downloadJson(SONG_BUNDLE),
    ...NEW_CONCEPT_CATEGORIES.map(async (category) => [category, await buildNewConceptManifest(manager, category)])
  ]);
  const songs = normalizeListedFiles(listed)
    .filter((item) => /\.(mp3|m4a|aac|wav)$/i.test(item.cloudPath))
    .map((item) => songMeta(item.cloudPath, item.size, trackMap || {}))
    .filter(Boolean)
    .sort((left, right) => left.audioCloudPath.localeCompare(right.audioCloudPath, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
  if (!songs.length) throw new Error('song-manifest-empty');
  const current = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const output = {
    generatedAt: new Date().toISOString(),
    categories: Object.assign({}, current.categories || {}, {
      song: songs
    }, Object.fromEntries(newConceptEntries))
  };
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    output: path.relative(ROOT, OUTPUT),
    counts: Object.fromEntries(NEW_CONCEPT_CATEGORIES.map((category) => [category, output.categories[category].length])),
    songCount: songs.length,
    preservedCategories: Object.keys(current.categories || {}).filter((category) => category !== 'song')
  };
  if (apply) fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
