#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'data', 'transcript-build', 'unlock1-second-edition-v2', 'A1', 'unlock1');
const BACKUP = path.join(BUILD, 'cloud-backup', 'bundle-v1-before-v2-20260722.json');
const OUTPUT = path.join(BUILD, 'bundle-wordaligned-v2.json');
const REPORT = path.join(BUILD, 'clean-report.json');
const SECOND_EDITION_ROOT = '/Users/wangtianlong/\u5de5\u4f5c/01_\u6559\u5b66\u4e0e\u5907\u8003/unlock \u7b2c\u4e8c\u7248/Unlock1/LS';
const OFFICIAL_PDF = path.join(SECOND_EDITION_ROOT, 'Unlock 2e Listening and Speaking 1 Scripts.pdf');
const AUDIO_DIR = path.join(SECOND_EDITION_ROOT, 'Unlock1 \u542c\u53e3\u97f3\u9891Class Audio');

const REPAIRS = [
  ['track-unlock1-1-2', 'Unlock2e_A1_1.2'],
  ['track-unlock1-1-5', 'Unlock2e_A1_1.5'],
  ['track-unlock1-2-2', 'Unlock2e_A1_2.2'],
  ['track-unlock1-2-5', 'Unlock2e_A1_2.5'],
  ['track-unlock1-3-3', 'Unlock2e_A1_3.3']
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function durationSec(audioPath) {
  return Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    audioPath
  ], { encoding: 'utf8' }).trim());
}

function validateTrack(track, durationMs) {
  if (!track || !Array.isArray(track.lines) || !track.lines.length) {
    throw new Error(`missing lines: ${track && track.trackId}`);
  }
  let previousEnd = 0;
  track.lines.forEach((line, lineIndex) => {
    if (!String(line.text || '').trim()) throw new Error(`${track.trackId} line ${lineIndex + 1} is empty`);
    if (line.startMs < previousEnd || line.endMs <= line.startMs) {
      throw new Error(`${track.trackId} line ${lineIndex + 1} has invalid timing`);
    }
    let previousWordEnd = line.startMs;
    (line.words || []).forEach((word, wordIndex) => {
      if (word.startMs < previousWordEnd || word.endMs <= word.startMs) {
        throw new Error(`${track.trackId} line ${lineIndex + 1} word ${wordIndex + 1} has invalid timing`);
      }
      previousWordEnd = word.endMs;
    });
    previousEnd = line.endMs;
  });
  if (track.lines[track.lines.length - 1].endMs !== durationMs) {
    throw new Error(`${track.trackId} does not end at audio duration`);
  }
}

function main() {
  const oldBundle = readJson(BACKUP);
  const nextBundle = JSON.parse(JSON.stringify(oldBundle));
  const repairs = [];

  for (const [trackId, fileName] of REPAIRS) {
    const importedPath = path.join(BUILD, 'imported', `${trackId}.json`);
    const audioPath = path.join(AUDIO_DIR, `${fileName}.mp3`);
    const imported = readJson(importedPath);
    const seconds = durationSec(audioPath);
    const durationMs = Math.round(seconds * 1000);
    const oldTrack = oldBundle[trackId];
    if (!oldTrack || imported.trackId !== trackId) throw new Error(`track mismatch: ${trackId}`);

    const lines = imported.lines.map((line) => Object.assign({}, line, {
      words: Array.isArray(line.words) ? line.words.map((word) => Object.assign({}, word)) : []
    }));
    lines[lines.length - 1].endMs = durationMs;
    nextBundle[trackId] = Object.assign({}, oldTrack, imported, {
      source: 'official-pdf-plus-whisper-medium-global-word-alignment-v2',
      sourceType: 'unlock-second-edition-official-audio-scripts-pdf',
      officialSource: OFFICIAL_PDF,
      timingSource: 'whisper-medium-word-timestamps',
      transcriptStatus: 'official-text-word-aligned-v2',
      durationSec: seconds,
      scriptPatches: [{
        reason: 'v1 source text stopped before the audio ended',
        oldLineCount: oldTrack.lines.length,
        newLineCount: lines.length
      }],
      lines
    });
    validateTrack(nextBundle[trackId], durationMs);
    repairs.push({
      trackId,
      fileName,
      durationSec: Number(seconds.toFixed(3)),
      oldLineCount: oldTrack.lines.length,
      newLineCount: lines.length,
      oldLastEndMs: oldTrack.lines[oldTrack.lines.length - 1].endMs,
      newLastEndMs: durationMs
    });
  }

  if (Object.keys(nextBundle).length !== Object.keys(oldBundle).length) {
    throw new Error('track count changed');
  }
  const repairedIds = new Set(REPAIRS.map(([trackId]) => trackId));
  for (const trackId of Object.keys(oldBundle)) {
    if (!repairedIds.has(trackId)
      && JSON.stringify(oldBundle[trackId]) !== JSON.stringify(nextBundle[trackId])) {
      throw new Error(`unchanged track was modified: ${trackId}`);
    }
  }

  fs.writeFileSync(OUTPUT, `${JSON.stringify(nextBundle, null, 2)}\n`);
  fs.writeFileSync(REPORT, `${JSON.stringify({
    readyForUpload: true,
    sourceBundle: path.relative(ROOT, BACKUP),
    outputBundle: path.relative(ROOT, OUTPUT),
    trackCountBefore: Object.keys(oldBundle).length,
    trackCountAfter: Object.keys(nextBundle).length,
    repairedTrackCount: repairs.length,
    unchangedTrackCount: Object.keys(nextBundle).length - repairs.length,
    repairs
  }, null, 2)}\n`);
  console.log(`Built ${Object.keys(nextBundle).length} tracks with ${repairs.length} repairs -> ${OUTPUT}`);
}

main();
