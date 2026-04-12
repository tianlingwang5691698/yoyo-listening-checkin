#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function printHelp() {
  console.log(`Usage: node scripts/build_series_transcript_bundle.js <input-dir> <output-file>

Bundle per-track transcript JSON files into a single series-level JSON object.`);
}

const inputDir = process.argv[2];
const outputPath = process.argv[3];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (!inputDir || !outputPath) {
  throw new Error('Usage: node scripts/build_series_transcript_bundle.js <input-dir> <output-file>');
}

const resolvedInputDir = path.resolve(inputDir);
const resolvedOutputPath = path.resolve(outputPath);
const combined = {};

for (const name of fs.readdirSync(resolvedInputDir).filter((file) => file.endsWith('.json')).sort()) {
  const track = JSON.parse(fs.readFileSync(path.join(resolvedInputDir, name), 'utf8'));
  if (!track.trackId) {
    throw new Error(`Missing trackId in ${name}`);
  }
  combined[track.trackId] = track;
}

fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
fs.writeFileSync(resolvedOutputPath, JSON.stringify(combined, null, 2));
console.log(`Bundled ${Object.keys(combined).length} tracks -> ${resolvedOutputPath}`);
