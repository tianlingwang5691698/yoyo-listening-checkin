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
const BUILD_ROOT = '/tmp/yoyo-magic-tree-house-segments-v4';
const REPORT_ROOT = path.join(ROOT, 'data', 'transcript-build', 'audio-performance');
const PROGRESS_PATH = path.join(REPORT_ROOT, 'magic-tree-house-segments-v4-progress.json');
const REPORT_PATH = path.join(REPORT_ROOT, 'magic-tree-house-segments-v4-report.json');
const STATIC_MANIFEST_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');
const FIRST_SEGMENT_SECONDS = 30;
const SEGMENT_SECONDS = 90;
const CONFIGS = [
  { level: 'A2', category: 'magictreehouse', start: 1 },
  { level: 'B1', category: 'magictreehouseb1', start: 29 }
];

function sha1File(filePath) {
  const hash = crypto.createHash('sha1');
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let size = 0;
    while ((size = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, size));
    }
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function readCredentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const [secretId, secretKey] = lines[1].split(',').map((item) => item.trim());
  if (!secretId || !secretKey) throw new Error('SecretKey.csv is missing SDK credentials');
  return { secretId, secretKey };
}

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

function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)).then(() => results);
}

async function withRetry(label, worker, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = attempt * 1000;
      console.warn(`${label} retry ${attempt}/${attempts - 1}: ${error.message || error}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function buildFileId(cloudPath) {
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${cloudPath}`;
}

async function getRemoteState(app, segments) {
  if (!segments.length) return [];
  const results = [];
  for (let offset = 0; offset < segments.length; offset += 50) {
    const batch = segments.slice(offset, offset + 50);
    const response = await withRetry('getTempFileURL', () => app.getTempFileURL({
      fileList: batch.map((segment) => buildFileId(segment.audioCloudPath))
    }));
    (response.fileList || []).forEach((item, index) => {
      results.push({
        audioCloudPath: batch[index].audioCloudPath,
        exists: !!(item.tempFileURL || item.download_url),
        code: item.code || ''
      });
    });
  }
  return results;
}

function loadTracks() {
  return CONFIGS.flatMap((config) => {
    const manifestPath = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', config.level, 'magic-tree-house', 'manifest.json');
    const manifest = readJson(manifestPath, null);
    if (!manifest || !Array.isArray(manifest.tracks)) throw new Error(`missing manifest: ${manifestPath}`);
    return manifest.tracks.map((track) => ({
      level: config.level,
      category: config.category,
      index: Number(track.index),
      taskId: `magic-tree-house-${String(track.index).padStart(3, '0')}`,
      title: track.title,
      sourcePath: track.sourcePath,
      durationSec: Number(track.durationSec || 0)
    }));
  });
}

function buildTrackSegments(track) {
  if (!track.sourcePath || !fs.existsSync(track.sourcePath)) throw new Error(`missing source: ${track.taskId}`);
  const trackRoot = path.join(BUILD_ROOT, track.taskId);
  fs.rmSync(trackRoot, { recursive: true, force: true });
  fs.mkdirSync(trackRoot, { recursive: true });
  const segmentTimes = [];
  for (let splitAt = FIRST_SEGMENT_SECONDS; splitAt < track.durationSec; splitAt += SEGMENT_SECONDS) {
    segmentTimes.push(splitAt);
  }
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', track.sourcePath,
    '-map', '0:a:0', '-map_metadata', '-1', '-vn',
    '-ac', '1', '-ar', '32000',
    '-c:a', 'libmp3lame', '-b:a', '64k',
    '-write_xing', '1', '-id3v2_version', '3',
    '-f', 'segment', '-segment_times', segmentTimes.join(','), '-reset_timestamps', '1',
    path.join(trackRoot, 'segment-%03d.mp3')
  ], { stdio: 'inherit' });
  const localFiles = fs.readdirSync(trackRoot).filter((name) => /^segment-\d{3}\.mp3$/.test(name)).sort();
  const expectedCount = 1 + Math.ceil(Math.max(0, track.durationSec - FIRST_SEGMENT_SECONDS) / SEGMENT_SECONDS);
  if (localFiles.length !== expectedCount) {
    throw new Error(`${track.taskId} expected ${expectedCount} segments, got ${localFiles.length}`);
  }
  const segments = localFiles.map((fileName, index) => {
    const localPath = path.join(trackRoot, fileName);
    const media = ffprobe(localPath);
    const maxSize = index === 0 ? 280000 : 800000;
    if (media.codec !== 'mp3' || media.channels !== 1 || media.bitrate > 66000 || media.size > maxSize) {
      throw new Error(`${track.taskId}/${fileName} failed media limits`);
    }
    const sha1 = sha1File(localPath);
    const plannedSeconds = index === 0 ? FIRST_SEGMENT_SECONDS : SEGMENT_SECONDS;
    const segmentName = `${String(index).padStart(3, '0')}-${sha1.slice(0, 10)}-${plannedSeconds}s-64k-mono.mp3`;
    return {
      index,
      startSec: index === 0 ? 0 : FIRST_SEGMENT_SECONDS + ((index - 1) * SEGMENT_SECONDS),
      durationSec: Math.round(media.durationSec * 1000) / 1000,
      size: media.size,
      sha1,
      audioCloudPath: `${track.level}/Magic Tree House/Audio/segments-v4/${String(track.index).padStart(3, '0')}/${segmentName}`,
      localPath
    };
  });
  const lastSegment = segments.at(-1);
  const outputEndSec = lastSegment.startSec + lastSegment.durationSec;
  if (Math.abs(outputEndSec - track.durationSec) > 0.6) {
    throw new Error(`${track.taskId} duration drift: ${outputEndSec} vs ${track.durationSec}`);
  }
  return segments;
}

async function uploadTrack(app, track, segments) {
  const before = await getRemoteState(app, segments);
  const pending = segments.filter((segment, index) => !before[index].exists);
  let uploaded = 0;
  await mapLimit(pending, 4, async (segment) => {
    await withRetry(`uploadFile ${segment.audioCloudPath}`, () => app.uploadFile({
      cloudPath: segment.audioCloudPath,
      fileContent: fs.createReadStream(segment.localPath)
    }));
    uploaded += 1;
    console.log(`${track.taskId} ${uploaded}/${pending.length} ${segment.audioCloudPath}`);
  });
  const after = await getRemoteState(app, segments);
  const failed = after.filter((item) => !item.exists);
  if (failed.length) throw new Error(`${track.taskId} remote verify failed: ${failed.map((item) => item.audioCloudPath).join(' | ')}`);
  return { uploaded: pending.length, reused: segments.length - pending.length };
}

function applySegmentsToManifest(progress) {
  const target = readJson(STATIC_MANIFEST_PATH, null);
  const categories = target && target.categories;
  if (!categories) throw new Error('static catalog manifest is invalid');
  for (const config of CONFIGS) {
    const rows = categories[config.category];
    if (!Array.isArray(rows)) throw new Error(`missing static category: ${config.category}`);
    rows.forEach((item) => {
      const entry = progress.tracks[item.taskId];
      if (!entry || !entry.complete) throw new Error(`missing completed segments: ${item.taskId}`);
      const segments = entry.segments.map(({ localPath, sha1, ...segment }) => segment);
      if (Array.isArray(item.audioSegments) && item.audioSegments.length
        && JSON.stringify(item.audioSegments) !== JSON.stringify(segments)) {
        throw new Error(`refuse replacing different segment manifest: ${item.taskId}`);
      }
      item.audioSegments = segments;
      item.audioSegmentVersion = 'mth-30s-first-90s-next-64k-mono-v4';
    });
  }
  writeJson(STATIC_MANIFEST_PATH, target);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tracks = loadTracks();
  const estimatedSegments = tracks.reduce((sum, track) => (
    sum + 1 + Math.ceil(Math.max(0, track.durationSec - FIRST_SEGMENT_SECONDS) / SEGMENT_SECONDS)
  ), 0);
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      trackCount: tracks.length,
      estimatedSegments,
      firstSegmentSeconds: FIRST_SEGMENT_SECONDS,
      segmentSeconds: SEGMENT_SECONDS,
      format: 'mp3 64kbps mono 32kHz',
      preservesOriginalAudio: true
    }, null, 2));
    return;
  }

  fs.mkdirSync(BUILD_ROOT, { recursive: true });
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...readCredentials() });
  const progress = readJson(PROGRESS_PATH, {
    version: 1,
    firstSegmentSeconds: FIRST_SEGMENT_SECONDS,
    segmentSeconds: SEGMENT_SECONDS,
    tracks: {}
  });
  let uploadedTotal = 0;
  let reusedTotal = 0;

  for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
    const track = tracks[trackIndex];
    const existing = progress.tracks[track.taskId];
    if (existing && existing.complete && Array.isArray(existing.segments)) {
      const remote = await getRemoteState(app, existing.segments);
      if (remote.length === existing.segments.length && remote.every((item) => item.exists)) {
        reusedTotal += existing.segments.length;
        console.log(`${trackIndex + 1}/${tracks.length} ${track.taskId} reused ${existing.segments.length}`);
        continue;
      }
    }
    const segments = buildTrackSegments(track);
    const result = await uploadTrack(app, track, segments);
    uploadedTotal += result.uploaded;
    reusedTotal += result.reused;
    progress.tracks[track.taskId] = {
      level: track.level,
      category: track.category,
      title: track.title,
      durationSec: track.durationSec,
      complete: true,
      segments: segments.map(({ localPath, ...segment }) => segment)
    };
    writeJson(PROGRESS_PATH, progress);
    fs.rmSync(path.join(BUILD_ROOT, track.taskId), { recursive: true, force: true });
    console.log(`${trackIndex + 1}/${tracks.length} ${track.taskId} complete ${segments.length}`);
  }

  Object.values(progress.tracks).forEach((entry) => {
    entry.segments = entry.segments.map(({ localPath, ...segment }) => segment);
  });
  writeJson(PROGRESS_PATH, progress);
  applySegmentsToManifest(progress);
  const segmentCount = Object.values(progress.tracks).reduce((sum, entry) => sum + entry.segments.length, 0);
  const totalBytes = Object.values(progress.tracks).reduce((sum, entry) => (
    sum + entry.segments.reduce((trackSum, segment) => trackSum + Number(segment.size || 0), 0)
  ), 0);
  const report = {
    mode: 'applied',
    trackCount: tracks.length,
    segmentCount,
    uploadedTotal,
    reusedTotal,
    totalBytes,
    firstSegmentSeconds: FIRST_SEGMENT_SECONDS,
    segmentSeconds: SEGMENT_SECONDS,
    format: 'mp3 64kbps mono 32kHz',
    originalsPreserved: true,
    staticManifestUpdated: true
  };
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
