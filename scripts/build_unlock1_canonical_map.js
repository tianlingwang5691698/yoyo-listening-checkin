#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { unlockTranscriptTracks, unlockTranscriptBuildStatus } = require('../data/transcripts/unlock1');

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('data/transcript-build/unlock1-word-align/work/unlock1-canonical-map.json');

const statusByTrackId = new Map(
  unlockTranscriptBuildStatus.map((item) => [item.trackId, item])
);

const tracksByFileName = {};
for (const track of unlockTranscriptTracks) {
  const status = statusByTrackId.get(track.trackId);
  if (!status) {
    continue;
  }
  tracksByFileName[status.fileName] = {
    trackId: track.trackId,
    contentId: track.contentId,
    taskId: status.taskId,
    fileName: status.fileName,
    batch: status.batch,
    canonicalSegments: (track.lines || []).map((line) => line.text)
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  tracksByFileName
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${Object.keys(tracksByFileName).length} canonical entries -> ${outputPath}`);
