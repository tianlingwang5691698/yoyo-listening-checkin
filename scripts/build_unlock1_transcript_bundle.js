#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const inputDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('data/transcript-build/unlock1-word-align/output/imported');
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve('cloudfunctions/yoyo/transcripts/unlock1-word-tracks.json');

const combined = {};
for (const name of fs.readdirSync(inputDir).filter((file) => file.endsWith('.json')).sort()) {
  const track = JSON.parse(fs.readFileSync(path.join(inputDir, name), 'utf8'));
  if (!track.trackId) {
    throw new Error(`Missing trackId in ${name}`);
  }
  combined[track.trackId] = track;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const jsonText = JSON.stringify(combined, null, 2);
fs.writeFileSync(outputPath, jsonText);
console.log(`Bundled ${Object.keys(combined).length} tracks -> ${outputPath}`);
