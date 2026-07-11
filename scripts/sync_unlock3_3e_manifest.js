#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'unlock3-3e-textbook', 'B1', 'unlock3');
const sourcePath = path.join(BUILD_ROOT, 'manifest.json');
const targetPath = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'unlock-series-manifests.json');
const reportPath = path.join(BUILD_ROOT, 'manifest-sync-report.json');
const CATEGORY = 'unlock3thirdedition';

function stableHash(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  if (!Array.isArray(source.tracks) || source.tracks.length !== 68) {
    throw new Error(`expected 68 source tracks, got ${(source.tracks || []).length}`);
  }
  if (target[CATEGORY]) {
    throw new Error(`${CATEGORY} already exists; refusing implicit replacement`);
  }

  const beforeKeys = Object.keys(target);
  const beforeHashes = Object.fromEntries(beforeKeys.map((key) => [key, stableHash(target[key])]));
  target[CATEGORY] = {
    meta: {
      level: 'B1',
      series: CATEGORY,
      edition: 'third',
      book: 'Unlock 3 Listening, Speaking & Critical Thinking Third Edition',
      module: 'textbook',
      displayTitle: 'Unlock3 听口 第三版',
      cloudAudioRoot: source.meta.cloudAudioRoot,
      transcriptCloudPath: source.meta.transcriptCloudPath,
      audioCount: source.tracks.length,
      eligibleCount: source.tracks.length,
      fullImportNoDurationFilter: true,
      duplicateCount: source.meta.duplicateCount,
      asrModel: source.meta.asrModel
    },
    tracks: source.tracks.map((track) => ({
      id: track.id,
      level: 'B1',
      series: CATEGORY,
      book: 'Unlock 3 Third Edition',
      title: track.title,
      fileName: track.fileName,
      normalizedFileName: track.normalizedFileName,
      sourcePath: track.sourcePath,
      cloudPath: track.cloudPath,
      durationSec: track.durationSec,
      unit: track.unit,
      sourceUnit: track.sourceUnit,
      track: track.track,
      sha1: track.sha1,
      status: track.status,
      duplicateOf: track.duplicateOf,
      kind: track.kind,
      transcriptTrackId: track.transcriptTrackId
    }))
  };

  const changedOldKeys = beforeKeys.filter((key) => stableHash(target[key]) !== beforeHashes[key]);
  if (changedOldKeys.length) {
    throw new Error(`existing manifest entries changed: ${changedOldKeys.join(', ')}`);
  }
  fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`);
  const report = {
    category: CATEGORY,
    addedTrackCount: target[CATEGORY].tracks.length,
    existingCategoryCount: beforeKeys.length,
    changedOldKeys,
    manifestBytes: fs.statSync(targetPath).size
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
