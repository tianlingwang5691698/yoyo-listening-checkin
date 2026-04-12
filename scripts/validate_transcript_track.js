#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) {
  throw new Error(message);
}

function validateTrack(track) {
  if (!track || typeof track !== 'object') {
    fail('Track must be an object.');
  }
  if (!track.trackId || !track.contentId) {
    fail('Track must include trackId and contentId.');
  }
  if (!Array.isArray(track.lines) || !track.lines.length) {
    fail('Track must include non-empty lines.');
  }
  let previousLineEnd = -1;
  track.lines.forEach((line, index) => {
    if (typeof line.startMs !== 'number' || typeof line.endMs !== 'number') {
      fail(`Line ${index + 1} is missing startMs/endMs.`);
    }
    if (line.endMs <= line.startMs) {
      fail(`Line ${index + 1} has invalid time range.`);
    }
    if (line.startMs < previousLineEnd) {
      fail(`Line ${index + 1} starts before previous line ended.`);
    }
    previousLineEnd = line.endMs;
    if (!Array.isArray(line.words) || !line.words.length) {
      fail(`Line ${index + 1} has no words.`);
    }
    let previousWordEnd = line.startMs;
    line.words.forEach((word, wordIndex) => {
      if (typeof word.startMs !== 'number' || typeof word.endMs !== 'number') {
        fail(`Line ${index + 1} word ${wordIndex + 1} is missing startMs/endMs.`);
      }
      if (word.endMs <= word.startMs) {
        fail(`Line ${index + 1} word ${wordIndex + 1} has invalid time range.`);
      }
      if (word.startMs < previousWordEnd) {
        fail(`Line ${index + 1} word ${wordIndex + 1} overlaps the previous word.`);
      }
      if (word.startMs < line.startMs || word.endMs > line.endMs) {
        fail(`Line ${index + 1} word ${wordIndex + 1} falls outside its line range.`);
      }
      previousWordEnd = word.endMs;
    });
  });
}

function main() {
  const inputPath = process.argv[2];
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/validate_transcript_track.js <track.json>');
    process.exit(0);
  }
  if (!inputPath) {
    fail('Usage: node scripts/validate_transcript_track.js <track.json>');
  }
  const absolutePath = path.resolve(inputPath);
  const track = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  validateTrack(track);
  console.log(`Track OK: ${track.trackId} (${track.lines.length} lines)`);
}

main();
