#!/usr/bin/env node

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const SOURCE_MANIFEST_PATH = path.join(ROOT, 'data', 'transcript-build', 'unlock-series', 'B2', 'unlock4', 'manifest.json');
const ONLINE_MANIFEST_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'unlock-series-manifests.json');
const BUILD_ROOT = '/tmp/yoyo-unlock4-optimized-v1';
const REPORT_ROOT = path.join(ROOT, 'data', 'transcript-build', 'audio-performance');
const PROGRESS_PATH = path.join(REPORT_ROOT, 'unlock4-optimized-v1-progress.json');
const REPORT_PATH = path.join(REPORT_ROOT, 'unlock4-optimized-v1-report.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function sha1File(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readCredentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const [secretId, secretKey] = lines[1].split(',').map((item) => item.trim());
  if (!secretId || !secretKey) throw new Error('SecretKey.csv is missing SDK credentials');
  return { secretId, secretKey };
}

function ffprobe(filePath) {
  const result = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate',
    '-show_entries', 'format=duration,size,bit_rate',
    '-of', 'json',
    filePath
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(result);
  return {
    codec: parsed.streams[0].codec_name,
    channels: Number(parsed.streams[0].channels || 0),
    sampleRate: Number(parsed.streams[0].sample_rate || 0),
    bitrate: Number(parsed.streams[0].bit_rate || parsed.format.bit_rate || 0),
    durationSec: Number(parsed.format.duration || 0),
    size: Number(parsed.format.size || 0)
  };
}

function buildFileId(cloudPath) {
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${cloudPath}`;
}

async function remoteExists(app, cloudPath) {
  const result = await app.getTempFileURL({ fileList: [buildFileId(cloudPath)] });
  const item = (result.fileList || [])[0] || {};
  return !!(item.tempFileURL || item.download_url);
}

function loadTracks() {
  const source = readJson(SOURCE_MANIFEST_PATH, null);
  const target = readJson(ONLINE_MANIFEST_PATH, null);
  const sourceById = Object.fromEntries((source.tracks || []).map((track) => [track.id, track]));
  const onlineTracks = target && target.unlock4 && target.unlock4.tracks;
  if (!Array.isArray(onlineTracks) || onlineTracks.length !== 27) throw new Error('Unlock 4 online manifest must contain 27 eligible tracks');
  return onlineTracks.map((track) => {
    const sourceTrack = sourceById[track.id];
    if (!sourceTrack || !sourceTrack.sourcePath || !fs.existsSync(sourceTrack.sourcePath)) {
      throw new Error(`missing Unlock 4 source: ${track.id}`);
    }
    return {
      id: track.id,
      title: track.title,
      sourcePath: sourceTrack.sourcePath,
      oldCloudPath: track.legacyCloudPath || track.cloudPath,
      durationSec: Number(track.durationSec || sourceTrack.durationSec || 0)
    };
  });
}

function buildOptimizedTrack(track) {
  fs.mkdirSync(BUILD_ROOT, { recursive: true });
  const temporaryPath = path.join(BUILD_ROOT, `${slug(track.title)}.mp3`);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', track.sourcePath,
    '-map', '0:a:0', '-map_metadata', '-1', '-vn',
    '-ac', '1', '-ar', '32000',
    '-c:a', 'libmp3lame', '-b:a', '64k',
    '-write_xing', '1', '-id3v2_version', '3',
    temporaryPath
  ], { stdio: 'inherit' });
  const media = ffprobe(temporaryPath);
  const sourceMedia = ffprobe(track.sourcePath);
  if (media.codec !== 'mp3' || media.channels !== 1 || media.bitrate > 66000
    || Math.abs(media.durationSec - track.durationSec) > 0.8
    || media.size >= sourceMedia.size * 0.4) {
    throw new Error(`${track.id} failed optimized media validation`);
  }
  const sha1 = sha1File(temporaryPath);
  return {
    id: track.id,
    title: track.title,
    localPath: temporaryPath,
    cloudPath: `B2/Unlock4/Class Audio/optimized-v1/${slug(track.title)}-${sha1.slice(0, 10)}-64k-mono.mp3`,
    legacyCloudPath: track.oldCloudPath,
    sha1,
    durationSec: track.durationSec,
    encodedDurationSec: Math.round(media.durationSec * 1000) / 1000,
    size: media.size,
    originalSize: sourceMedia.size,
    bitrate: media.bitrate,
    channels: media.channels,
    sampleRate: media.sampleRate
  };
}

function applyOptimizedManifest(progress) {
  const target = readJson(ONLINE_MANIFEST_PATH, null);
  const tracks = target && target.unlock4 && target.unlock4.tracks;
  tracks.forEach((track) => {
    const optimized = progress.tracks[track.id];
    if (!optimized || !optimized.complete) throw new Error(`missing optimized track: ${track.id}`);
    if (track.legacyCloudPath && track.legacyCloudPath !== optimized.legacyCloudPath) {
      throw new Error(`refuse changing legacy path: ${track.id}`);
    }
    track.legacyCloudPath = optimized.legacyCloudPath;
    track.cloudPath = optimized.cloudPath;
    track.sha1 = optimized.sha1;
    track.durationSec = optimized.durationSec;
    track.audioOptimization = {
      version: 'unlock4-64k-mono-v1',
      bitrate: optimized.bitrate,
      channels: optimized.channels,
      sampleRate: optimized.sampleRate,
      size: optimized.size
    };
  });
  writeJson(ONLINE_MANIFEST_PATH, target);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tracks = loadTracks();
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      trackCount: tracks.length,
      format: 'mp3 64kbps mono 32kHz',
      immutablePath: 'B2/Unlock4/Class Audio/optimized-v1',
      preservesOriginalAudio: true
    }, null, 2));
    return;
  }

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...readCredentials() });
  const progress = readJson(PROGRESS_PATH, { version: 1, tracks: {} });
  let uploaded = 0;
  let reused = 0;
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    let optimized = progress.tracks[track.id];
    if (optimized && optimized.complete && await remoteExists(app, optimized.cloudPath)) {
      reused += 1;
      console.log(`${index + 1}/${tracks.length} ${track.id} reused`);
      continue;
    }
    optimized = buildOptimizedTrack(track);
    if (!await remoteExists(app, optimized.cloudPath)) {
      await app.uploadFile({
        cloudPath: optimized.cloudPath,
        fileContent: fs.createReadStream(optimized.localPath)
      });
      uploaded += 1;
    } else {
      reused += 1;
    }
    if (!await remoteExists(app, optimized.cloudPath)) throw new Error(`remote verify failed: ${optimized.cloudPath}`);
    const { localPath, ...savedOptimized } = optimized;
    progress.tracks[track.id] = Object.assign({}, savedOptimized, { complete: true });
    writeJson(PROGRESS_PATH, progress);
    fs.rmSync(optimized.localPath, { force: true });
    console.log(`${index + 1}/${tracks.length} ${track.id} complete`);
  }
  Object.values(progress.tracks).forEach((entry) => {
    delete entry.localPath;
  });
  writeJson(PROGRESS_PATH, progress);
  applyOptimizedManifest(progress);
  const entries = Object.values(progress.tracks);
  const report = {
    mode: 'applied',
    trackCount: tracks.length,
    uploaded,
    reused,
    originalBytes: entries.reduce((sum, item) => sum + Number(item.originalSize || 0), 0),
    optimizedBytes: entries.reduce((sum, item) => sum + Number(item.size || 0), 0),
    format: 'mp3 64kbps mono 32kHz',
    originalsPreserved: true,
    onlineManifestUpdated: true
  };
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
