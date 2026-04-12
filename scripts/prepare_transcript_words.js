#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function splitWords(text) {
  return String(text || '').match(/\S+/g) || [];
}

function buildWords(line) {
  if (Array.isArray(line.words) && line.words.length) {
    return line.words;
  }
  const words = splitWords(line.text);
  if (!words.length) {
    return [];
  }
  const startMs = Number(line.startMs || 0);
  const endMs = Math.max(startMs + words.length, Number(line.endMs || startMs));
  const totalWeight = words.reduce((sum, word) => sum + Math.max(word.replace(/[^\w']/g, '').length, 1), 0);
  let cursor = startMs;
  return words.map((word, index) => {
    const isLast = index === words.length - 1;
    const weight = Math.max(word.replace(/[^\w']/g, '').length, 1);
    const nextEnd = isLast ? endMs : Math.min(endMs, cursor + Math.round(((endMs - startMs) * weight) / totalWeight));
    const item = {
      wordId: `${line.lineId || `line-${index + 1}`}-w${index + 1}`,
      text: word,
      startMs: cursor,
      endMs: Math.max(cursor + 1, nextEnd)
    };
    cursor = item.endMs;
    return item;
  });
}

function validateTrack(track) {
  if (!track || !track.trackId || !Array.isArray(track.lines)) {
    throw new Error('Invalid transcript track: expected trackId and lines[]');
  }
  let previousStartMs = -1;
  track.lines.forEach((line, index) => {
    if (!line.lineId || !line.text) {
      throw new Error(`Invalid line at index ${index}: expected lineId and text`);
    }
    if (!Number.isFinite(Number(line.startMs)) || !Number.isFinite(Number(line.endMs))) {
      throw new Error(`Invalid line timing at ${line.lineId}: expected numeric startMs/endMs`);
    }
    if (Number(line.startMs) < previousStartMs) {
      throw new Error(`Non-monotonic line timing at ${line.lineId}`);
    }
    if (Number(line.endMs) <= Number(line.startMs)) {
      throw new Error(`Invalid duration at ${line.lineId}: endMs must be greater than startMs`);
    }
    previousStartMs = Number(line.startMs);
    (line.words || []).forEach((word, wordIndex) => {
      if (!word.text || !Number.isFinite(Number(word.startMs)) || !Number.isFinite(Number(word.endMs))) {
        throw new Error(`Invalid word timing at ${line.lineId} word ${wordIndex + 1}`);
      }
    });
  });
}

function prepareTrack(track) {
  const nextTrack = Object.assign({}, track, {
    syncGranularity: track.syncGranularity || 'word-fallback',
    lines: track.lines.map((line) => Object.assign({}, line, {
      words: buildWords(line)
    }))
  });
  validateTrack(nextTrack);
  return nextTrack;
}

function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : '';
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : '';
  if (!inputPath || !outputPath) {
    throw new Error('Usage: node scripts/prepare_transcript_words.js <input-track.json> <output-track.json>');
  }
  const track = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nextTrack = prepareTrack(track);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(nextTrack, null, 2)}\n`);
  console.log(`Prepared ${nextTrack.lines.length} lines with word timings -> ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  prepareTrack,
  validateTrack
};
