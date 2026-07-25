#!/usr/bin/env node

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE_ROOT = '/Users/wangtianlong/资料1/雅思/网课/jonie b joins/R1002《330L-560L》Junie B. Jones系列 28册（6-9岁）音频';
const AUDIO_DIR = path.join(SOURCE_ROOT, '音频');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'junie-b-jones', 'A1', 'junie-b-jones');
const FULL_ROOT = path.join(BUILD_ROOT, 'audio-64k');
const SEGMENT_ROOT = path.join(BUILD_ROOT, 'segments-v1');
const MANIFEST_PATH = path.join(BUILD_ROOT, 'manifest.json');
const REPORT_PATH = path.join(BUILD_ROOT, 'clean-report.json');
const STATIC_MANIFEST_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');
const FIRST_SEGMENT_SECONDS = 30;
const SEGMENT_SECONDS = 90;
const CATEGORY = 'juniebjones';
const SERIES = 'Junie B. Jones';
const LEVEL = 'A1';
const AUDIO_CLOUD_ROOT = 'A1/Junie B. Jones/Audio';
const SEGMENT_VERSION = 'junie-b-jones-30s-first-90s-next-64k-mono-v1';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

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

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitle(fileName) {
  return fileName
    .replace(/\.mp3$/i, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\bMEAN IT\b/g, 'Mean It')
    .replace(/\bat last\b/g, 'at Last')
    .replace(/\bAloha-Ha-Ha\b/g, 'Aloha-ha-ha')
    .trim();
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

function listSourceFiles() {
  return fs.readdirSync(AUDIO_DIR)
    .filter((name) => /\.mp3$/i.test(name))
    .map((name) => {
      const match = name.match(/^(\d{2})\s+(.+)\.mp3$/i);
      if (!match) throw new Error(`bad source filename: ${name}`);
      return {
        index: Number(match[1]),
        fileName: name,
        title: cleanTitle(name),
        sourcePath: path.join(AUDIO_DIR, name)
      };
    })
    .sort((a, b) => a.index - b.index);
}

function findExistingHashedFile(dir, prefix) {
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.mp3'))
    .map((name) => path.join(dir, name))[0] || '';
}

function transcodeFull(track, sourceDurationSec) {
  fs.mkdirSync(FULL_ROOT, { recursive: true });
  const prefix = `${String(track.index).padStart(3, '0')}-${slug(track.title)}-`;
  const existing = findExistingHashedFile(FULL_ROOT, prefix);
  if (existing) {
    const existingMedia = ffprobe(existing);
    if (Math.abs(existingMedia.durationSec - sourceDurationSec) <= 0.6) return existing;
    fs.unlinkSync(existing);
  }
  const temporaryPath = path.join(FULL_ROOT, `${prefix}tmp-${process.pid}.mp3`);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', track.sourcePath,
    '-t', String(sourceDurationSec),
    '-map', '0:a:0', '-map_metadata', '-1', '-vn',
    '-ac', '1', '-ar', '32000',
    '-c:a', 'libmp3lame', '-b:a', '64k',
    '-write_xing', '1', '-id3v2_version', '3',
    temporaryPath
  ], { stdio: 'inherit' });
  const sha1 = sha1File(temporaryPath);
  const finalPath = path.join(FULL_ROOT, `${prefix}${sha1.slice(0, 10)}-64k-mono.mp3`);
  fs.renameSync(temporaryPath, finalPath);
  return finalPath;
}

function segmentTrack(track, fullMedia) {
  const trackRoot = path.join(SEGMENT_ROOT, String(track.index).padStart(3, '0'));
  const donePath = path.join(trackRoot, 'segments.json');
  if (fs.existsSync(donePath)) {
    const existing = readJson(donePath);
    if (Array.isArray(existing) && existing.length && existing.every((item) => fs.existsSync(item.localPath))) return existing;
  }
  fs.rmSync(trackRoot, { recursive: true, force: true });
  fs.mkdirSync(trackRoot, { recursive: true });
  const segmentTimes = [];
  for (let splitAt = FIRST_SEGMENT_SECONDS; splitAt < fullMedia.durationSec; splitAt += SEGMENT_SECONDS) {
    segmentTimes.push(splitAt);
  }
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', track.optimizedPath || track.sourcePath,
    '-map', '0:a:0', '-map_metadata', '-1', '-vn',
    '-ac', '1', '-ar', '32000',
    '-c:a', 'libmp3lame', '-b:a', '64k',
    '-write_xing', '1', '-id3v2_version', '3',
    '-f', 'segment', '-segment_times', segmentTimes.join(','), '-reset_timestamps', '1',
    path.join(trackRoot, 'segment-%03d.mp3')
  ], { stdio: 'inherit' });
  const files = fs.readdirSync(trackRoot).filter((name) => /^segment-\d{3}\.mp3$/.test(name)).sort();
  const segments = files.map((fileName, index) => {
    const localPath = path.join(trackRoot, fileName);
    const media = ffprobe(localPath);
    const maxSize = index === 0 ? 280000 : 800000;
    if (media.codec !== 'mp3' || media.channels !== 1 || media.sampleRate !== 32000 || media.bitrate > 67000 || media.size > maxSize) {
      throw new Error(`${track.id}/${fileName} failed audio limits`);
    }
    const sha1 = sha1File(localPath);
    const planned = index === 0 ? FIRST_SEGMENT_SECONDS : SEGMENT_SECONDS;
    const segmentName = `${String(index).padStart(3, '0')}-${sha1.slice(0, 10)}-${planned}s-64k-mono.mp3`;
    return {
      index,
      startSec: index === 0 ? 0 : FIRST_SEGMENT_SECONDS + ((index - 1) * SEGMENT_SECONDS),
      durationSec: Math.round(media.durationSec * 1000) / 1000,
      size: media.size,
      sha1,
      localPath,
      audioCloudPath: `${AUDIO_CLOUD_ROOT}/segments-v1/${String(track.index).padStart(3, '0')}/${segmentName}`
    };
  });
  const last = segments[segments.length - 1];
  const endSec = last.startSec + last.durationSec;
  if (Math.abs(endSec - fullMedia.durationSec) > 0.8) {
    throw new Error(`${track.id} segment duration drift: ${endSec} vs ${fullMedia.durationSec}`);
  }
  writeJson(donePath, segments);
  return segments;
}

function updateStaticManifest(tracks) {
  const manifest = readJson(STATIC_MANIFEST_PATH);
  manifest.generatedAt = new Date().toISOString();
  manifest.categories = manifest.categories || {};
  const existingRows = Array.isArray(manifest.categories[CATEGORY]) ? manifest.categories[CATEGORY] : [];
  const existingById = new Map(existingRows.map((row) => [row.taskId, row]));
  manifest.categories[CATEGORY] = tracks.map((track) => {
    const existing = existingById.get(track.id) || {};
    const transcriptTrackPath = path.join(BUILD_ROOT, 'tracks-v1', `${track.trackId}.json`);
    const transcriptReady = fs.existsSync(transcriptTrackPath);
    return {
      ...existing,
      taskId: track.id,
      category: CATEGORY,
      title: track.title,
      subtitle: `${SERIES} · ${track.index}/28`,
      audioCloudPath: track.audioCloudPath,
      size: track.size,
      repeatTarget: 3,
      durationSec: track.durationSec,
      coverTone: track.index % 2 === 0 ? 'peach' : 'mint',
      transcriptTrackId: existing.transcriptTrackId || (transcriptReady ? track.trackId : null),
      transcriptStatus: transcriptReady && (!existing.transcriptStatus || existing.transcriptStatus === 'pending') ? 'ready' : (existing.transcriptStatus || 'pending'),
      syncGranularity: existing.syncGranularity || 'line',
      textSource: existing.textSource || (transcriptReady ? {
        sourceType: 'transcript-track',
        title: 'Junie B. Jones sentence transcript',
        filePath: `_transcripts/A1/junie-b-jones/tracks-v1/${track.trackId}.json`
      } : null),
      audioSegments: track.audioSegments.map(({ sha1, localPath, ...item }) => item),
      audioSegmentVersion: SEGMENT_VERSION
    };
  });
  writeJson(STATIC_MANIFEST_PATH, manifest);
}

function main() {
  const updateStatic = process.argv.includes('--update-static');
  const sources = listSourceFiles();
  if (sources.length !== 28) throw new Error(`expected 28 MP3 files, got ${sources.length}`);
  const tracks = [];
  const rejected = [];
  for (const source of sources) {
    const id = `junie-b-jones-${String(source.index).padStart(3, '0')}`;
    try {
      const sourceMedia = ffprobe(source.sourcePath);
      if (sourceMedia.durationSec < 60) throw new Error('duration shorter than 60s');
      const fullPath = transcodeFull(Object.assign({}, source, { id }), sourceMedia.durationSec);
      const fullMedia = ffprobe(fullPath);
      if (fullMedia.codec !== 'mp3' || fullMedia.channels !== 1 || fullMedia.sampleRate !== 32000 || fullMedia.bitrate > 67000) {
        throw new Error('full audio does not meet 64k mono 32kHz spec');
      }
      if (Math.abs(fullMedia.durationSec - sourceMedia.durationSec) > 0.6) {
        throw new Error(`full duration drift: ${fullMedia.durationSec} vs ${sourceMedia.durationSec}`);
      }
      const fullSha1 = sha1File(fullPath);
      const audioCloudPath = `${AUDIO_CLOUD_ROOT}/${String(source.index).padStart(3, '0')}-${slug(source.title)}-${fullSha1.slice(0, 10)}-64k-mono.mp3`;
      const segments = segmentTrack(Object.assign({}, source, { id, optimizedPath: fullPath }), fullMedia);
      tracks.push({
        index: source.index,
        level: LEVEL,
        category: CATEGORY,
        id,
        trackId: `track-${id}`,
        title: source.title,
        sourcePath: source.sourcePath,
        optimizedPath: fullPath,
        audioCloudPath,
        durationSec: Math.round(fullMedia.durationSec * 1000) / 1000,
        size: fullMedia.size,
        sha1: fullSha1,
        sourceSize: sourceMedia.size,
        sourceDurationSec: Math.round(sourceMedia.durationSec * 1000) / 1000,
        audioSegments: segments,
        validationStatus: 'audio-only-transcoded-segmented',
        validationErrors: []
      });
      console.log(`${source.index}/28 ${source.title}`);
    } catch (error) {
      rejected.push({ index: source.index, title: source.title, reason: error.message || String(error) });
    }
  }
  const manifest = {
    meta: {
      level: LEVEL,
      category: CATEGORY,
      series: SERIES,
      audioSourceDir: AUDIO_DIR,
      audioCloudRoot: AUDIO_CLOUD_ROOT,
      expectedTrackCount: 28,
      audioFormat: 'mp3 64kbps mono 32kHz',
      segmentVersion: SEGMENT_VERSION,
      firstSegmentSeconds: FIRST_SEGMENT_SECONDS,
      segmentSeconds: SEGMENT_SECONDS,
      transcriptStatus: 'pending'
    },
    tracks
  };
  const report = {
    generatedAt: new Date().toISOString(),
    sourceRoot: SOURCE_ROOT,
    sourceAudioCount: sources.length,
    readyTrackCount: tracks.length,
    rejectedCount: rejected.length,
    rejected,
    validationErrorCount: rejected.length,
    totalDurationSec: Math.round(tracks.reduce((sum, track) => sum + track.durationSec, 0)),
    totalOptimizedBytes: tracks.reduce((sum, track) => sum + track.size, 0),
    totalSegmentCount: tracks.reduce((sum, track) => sum + track.audioSegments.length, 0),
    totalSegmentBytes: tracks.reduce((sum, track) => sum + track.audioSegments.reduce((partSum, item) => partSum + item.size, 0), 0),
    uploadMode: 'incremental-content-fingerprint-paths',
    notes: [
      'Audio only: no transcript text was generated or uploaded.',
      'Original files are not uploaded directly; optimized 64k mono files and immutable segments are used.'
    ]
  };
  writeJson(MANIFEST_PATH, manifest);
  writeJson(REPORT_PATH, report);
  if (report.validationErrorCount) throw new Error(`cleaning produced rejected tracks: ${report.validationErrorCount}`);
  if (updateStatic) updateStaticManifest(tracks);
  console.log(JSON.stringify({
    manifest: MANIFEST_PATH,
    report: REPORT_PATH,
    readyTrackCount: tracks.length,
    totalSegmentCount: report.totalSegmentCount,
    staticManifestUpdated: updateStatic
  }, null, 2));
}

main();
