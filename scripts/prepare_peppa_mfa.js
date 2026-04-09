const fs = require('fs');
const path = require('path');

const { transcriptTracks } = require('../data/mock');

const TRACK_ID = 'track-peppa-s101';
const AUDIO_SOURCE = path.join(
  __dirname,
  '..',
  'assets',
  'audio',
  'Peppa',
  '第1季',
  'S101 Muddy Puddles.mp3'
);

function stripSpeaker(text) {
  return text.replace(/^[A-Za-z ]+:\s*/, '').trim();
}

function tokenize(text) {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^A-Za-z0-9'\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return [];
  }
  return normalized.split(' ');
}

function main() {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error('Usage: node scripts/prepare_peppa_mfa.js <work-dir>');
    process.exit(1);
  }

  const track = transcriptTracks.find((item) => item.trackId === TRACK_ID);
  if (!track) {
    console.error(`Could not find ${TRACK_ID}`);
    process.exit(1);
  }

  const corpusDir = path.join(workDir, 'corpus');
  fs.mkdirSync(corpusDir, { recursive: true });

  const baseName = 'S101 Muddy Puddles';
  const transcriptText = [];
  const lineMap = [];

  for (const line of track.lines) {
    const cleaned = stripSpeaker(line.text);
    const tokens = tokenize(cleaned);
    transcriptText.push(cleaned);
    lineMap.push({
      lineId: line.lineId,
      originalText: line.text,
      cleanedText: cleaned,
      tokens
    });
  }

  const labPath = path.join(corpusDir, `${baseName}.lab`);
  fs.writeFileSync(labPath, transcriptText.join('\n'));

  const metaPath = path.join(workDir, 'line-map.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        trackId: track.trackId,
        contentId: track.contentId,
        mediaType: track.mediaType,
        baseName,
        audioSource: AUDIO_SOURCE,
        lines: lineMap
      },
      null,
      2
    )
  );

  console.log(`Prepared MFA corpus in ${corpusDir}`);
  console.log(`Wrote ${labPath}`);
  console.log(`Wrote ${metaPath}`);
}

main();
