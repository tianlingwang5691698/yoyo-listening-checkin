#!/usr/bin/env node

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const appConfig = require('../app-config');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');

const ROOT = path.join(__dirname, '..');
const SOURCE_MANIFEST_PATH = path.join(ROOT, 'data', 'transcript-build', 'unlock-series', 'B2', 'unlock4', 'manifest.json');
const ONLINE_MANIFEST_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'unlock-series-manifests.json');
const BUILD_ROOT = '/tmp/yoyo-unlock4-segments-v1';
const REPORT_ROOT = path.join(ROOT, 'data', 'transcript-build', 'audio-performance');
const PROGRESS_PATH = path.join(REPORT_ROOT, 'unlock4-segments-v1-progress.json');
const REPORT_PATH = path.join(REPORT_ROOT, 'unlock4-segments-v1-report.json');
const FIRST_SEGMENT_SECONDS = 30;
const SEGMENT_SECONDS = 90;

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
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
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const [secretId, secretKey] = lines[1].split(',').map((item) => item.trim());
  return { secretId, secretKey };
}

function fileId(cloudPath) {
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${cloudPath}`;
}

function ffprobe(filePath) {
  const parsed = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=channels,bit_rate',
    '-show_entries', 'format=duration,size', '-of', 'json', filePath
  ], { encoding: 'utf8' }));
  return {
    channels: Number(parsed.streams[0].channels || 0),
    bitrate: Number(parsed.streams[0].bit_rate || 0),
    durationSec: Number(parsed.format.duration || 0),
    size: Number(parsed.format.size || 0)
  };
}

async function remoteStates(app, segments) {
  const response = await app.getTempFileURL({ fileList: segments.map((segment) => fileId(segment.audioCloudPath)) });
  return (response.fileList || []).map((item) => !!(item.tempFileURL || item.download_url));
}

function loadTracks() {
  const source = readJson(SOURCE_MANIFEST_PATH, null);
  Object.values(progress.tracks).forEach((entry) => {
    entry.segments = entry.segments.map(({ localPath, ...segment }) => segment);
  });
  writeJson(PROGRESS_PATH, progress);
  const online = readJson(ONLINE_MANIFEST_PATH, null);
  const sourceById = Object.fromEntries((source.tracks || []).map((track) => [track.id, track]));
  return online.unlock4.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    durationSec: Number(track.durationSec || 0),
    sourcePath: sourceById[track.id].sourcePath
  }));
}

function buildSegments(track) {
  const trackRoot = path.join(BUILD_ROOT, track.id);
  fs.rmSync(trackRoot, { recursive: true, force: true });
  fs.mkdirSync(trackRoot, { recursive: true });
  const splitTimes = [];
  for (let splitAt = FIRST_SEGMENT_SECONDS; splitAt < track.durationSec; splitAt += SEGMENT_SECONDS) splitTimes.push(splitAt);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', track.sourcePath,
    '-map', '0:a:0', '-map_metadata', '-1', '-vn',
    '-ac', '1', '-ar', '32000', '-c:a', 'libmp3lame', '-b:a', '64k',
    '-write_xing', '1', '-id3v2_version', '3',
    '-f', 'segment', '-segment_times', splitTimes.join(','), '-reset_timestamps', '1',
    path.join(trackRoot, 'segment-%03d.mp3')
  ], { stdio: 'inherit' });
  return fs.readdirSync(trackRoot).filter((name) => /^segment-\d{3}\.mp3$/.test(name)).sort().map((name, index) => {
    const localPath = path.join(trackRoot, name);
    const media = ffprobe(localPath);
    const maxSize = index === 0 ? 280000 : 800000;
    if (media.channels !== 1 || media.bitrate > 66000 || media.size > maxSize) throw new Error(`${track.id}/${name} failed media limits`);
    const sha1 = sha1File(localPath);
    const plannedSeconds = index === 0 ? FIRST_SEGMENT_SECONDS : SEGMENT_SECONDS;
    return {
      index,
      startSec: index === 0 ? 0 : FIRST_SEGMENT_SECONDS + ((index - 1) * SEGMENT_SECONDS),
      durationSec: Math.round(media.durationSec * 1000) / 1000,
      size: media.size,
      audioCloudPath: `B2/Unlock4/Class Audio/optimized-v1/segments-v1/${slug(track.title)}/${String(index).padStart(3, '0')}-${sha1.slice(0, 10)}-${plannedSeconds}s-64k-mono.mp3`,
      localPath
    };
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tracks = loadTracks();
  const estimatedSegments = tracks.reduce((sum, track) => sum + 1 + Math.ceil(Math.max(0, track.durationSec - FIRST_SEGMENT_SECONDS) / SEGMENT_SECONDS), 0);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', trackCount: tracks.length, estimatedSegments, firstSegmentSeconds: 30, segmentSeconds: 90 }, null, 2));
    return;
  }
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  const progress = readJson(PROGRESS_PATH, { version: 1, tracks: {} });
  let uploaded = 0;
  let reused = 0;
  for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
    const track = tracks[trackIndex];
    const existing = progress.tracks[track.id];
    if (existing && existing.complete) {
      const states = await remoteStates(app, existing.segments);
      if (states.length === existing.segments.length && states.every(Boolean)) {
        reused += existing.segments.length;
        console.log(`${trackIndex + 1}/${tracks.length} ${track.id} reused`);
        continue;
      }
    }
    const segments = buildSegments(track);
    const states = await remoteStates(app, segments);
    for (let index = 0; index < segments.length; index += 1) {
      if (states[index]) {
        reused += 1;
        continue;
      }
      await app.uploadFile({ cloudPath: segments[index].audioCloudPath, fileContent: fs.createReadStream(segments[index].localPath) });
      uploaded += 1;
    }
    const verified = await remoteStates(app, segments);
    if (!verified.every(Boolean)) throw new Error(`remote verify failed: ${track.id}`);
    progress.tracks[track.id] = {
      complete: true,
      segments: segments.map(({ localPath, ...segment }) => segment)
    };
    writeJson(PROGRESS_PATH, progress);
    fs.rmSync(path.join(BUILD_ROOT, track.id), { recursive: true, force: true });
    console.log(`${trackIndex + 1}/${tracks.length} ${track.id} complete ${segments.length}`);
  }
  const online = readJson(ONLINE_MANIFEST_PATH, null);
  online.unlock4.tracks.forEach((track) => {
    const entry = progress.tracks[track.id];
    track.audioSegments = entry.segments.map(({ localPath, ...segment }) => segment);
    track.audioSegmentVersion = 'unlock4-30s-first-90s-next-64k-mono-v1';
  });
  writeJson(ONLINE_MANIFEST_PATH, online);
  const report = {
    mode: 'applied',
    trackCount: tracks.length,
    segmentCount: Object.values(progress.tracks).reduce((sum, entry) => sum + entry.segments.length, 0),
    uploaded,
    reused,
    firstSegmentSeconds: FIRST_SEGMENT_SECONDS,
    segmentSeconds: SEGMENT_SECONDS,
    originalsPreserved: true
  };
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
