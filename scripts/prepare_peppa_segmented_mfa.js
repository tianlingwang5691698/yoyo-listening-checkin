const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { peppaTranscriptTracks } = require('../data/transcripts/peppa');
const { peppaSegmentBuild } = require('../data/transcript-build/peppa-segments');

const AUDIO_SOURCE_BY_TRACK = {
  'track-peppa-s101': path.join(
    __dirname,
    '..',
    'assets',
    'audio',
    'Peppa',
    '第1季',
    'S101 Muddy Puddles.mp3'
  ),
  'track-peppa-s102': path.join(
    __dirname,
    '..',
    'assets',
    'audio',
    'Peppa',
    '第1季',
    'S102 Mr Dinosaur Is Lost.mp3'
  )
};

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

function clamp(number, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, number));
}

function runFfprobe(filePath) {
  const output = execFileSync(
    '/opt/homebrew/bin/ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath
    ],
    { encoding: 'utf8' }
  );
  return Number(output.trim());
}

function millisecondsToSeconds(ms) {
  return (ms / 1000).toFixed(3);
}

function buildSegment(track, config, totalDurationMs) {
  const firstLine = track.lines[config.lineStart];
  const lastLine = track.lines[config.lineEnd];
  if (!firstLine || !lastLine) {
    throw new Error(`Invalid line range ${config.lineStart}-${config.lineEnd} for ${track.trackId}`);
  }
  const startMs = clamp(firstLine.startMs - (config.paddingBeforeMs || 0), 0, totalDurationMs);
  const endMs = clamp(lastLine.endMs + (config.paddingAfterMs || 0), startMs + 200, totalDurationMs);
  const textLines = track.lines.slice(config.lineStart, config.lineEnd + 1);
  return {
    segmentId: config.segmentId,
    startMs,
    endMs,
    textLines: textLines.map((line) => ({
      lineId: line.lineId,
      originalText: line.text,
      cleanedText: stripSpeaker(line.text)
    }))
  };
}

function buildPerLineSegments(track, config, totalDurationMs) {
  return track.lines.map((line, index) => {
    const startMs = clamp(line.startMs - (config.paddingBeforeMs || 0), 0, totalDurationMs);
    const endMs = clamp(line.endMs + (config.paddingAfterMs || 0), startMs + 200, totalDurationMs);
    return {
      segmentId: `${config.prefix}-${String(index + 1).padStart(2, '0')}`,
      startMs,
      endMs,
      textLines: [
        {
          lineId: line.lineId,
          originalText: line.text,
          cleanedText: stripSpeaker(line.text)
        }
      ]
    };
  });
}

function buildGroupedPerLineSegments(track, config, totalDurationMs) {
  const segments = [];
  for (const group of config.groups) {
    const groupLines = track.lines.slice(group.lineStart, group.lineEnd + 1);
    if (!groupLines.length) {
      continue;
    }
    const firstLine = groupLines[0];
    const lastLine = groupLines[groupLines.length - 1];
    const groupStartMs = clamp(firstLine.startMs - (group.groupPaddingBeforeMs || 0), 0, totalDurationMs);
    const groupEndMs = clamp(lastLine.endMs + (group.groupPaddingAfterMs || 0), groupStartMs + 500, totalDurationMs);
    const totalWindowMs = groupEndMs - groupStartMs;
    const weights = groupLines.map((line) => Math.max(1, tokenize(stripSpeaker(line.text)).length));
    const weightSum = weights.reduce((sum, item) => sum + item, 0);
    let cursorMs = groupStartMs;

    groupLines.forEach((line, index) => {
      const shareMs = Math.max(1200, Math.round((totalWindowMs * weights[index]) / weightSum));
      const estimatedStartMs = cursorMs;
      const estimatedEndMs = index === groupLines.length - 1 ? groupEndMs : Math.min(groupEndMs, cursorMs + shareMs);
      cursorMs = estimatedEndMs;
      const startMs = clamp(estimatedStartMs - (config.paddingBeforeMs || 0), 0, totalDurationMs);
      const endMs = clamp(estimatedEndMs + (config.paddingAfterMs || 0), startMs + 300, totalDurationMs);
      segments.push({
        segmentId: `${config.prefix}-${String(group.lineStart + index + 1).padStart(2, '0')}`,
        startMs,
        endMs,
        textLines: [
          {
            lineId: line.lineId,
            originalText: line.text,
            cleanedText: stripSpeaker(line.text)
          }
        ]
      });
    });
  }
  return segments;
}

function main() {
  const trackId = process.argv[2];
  const workDir = process.argv[3];

  if (!trackId || !workDir) {
    console.error('Usage: node scripts/prepare_peppa_segmented_mfa.js <track-id> <work-dir>');
    process.exit(1);
  }

  const track = peppaTranscriptTracks.find((item) => item.trackId === trackId);
  if (!track) {
    throw new Error(`Missing track ${trackId}`);
  }

  const sourceAudio = AUDIO_SOURCE_BY_TRACK[trackId];
  if (!sourceAudio || !fs.existsSync(sourceAudio)) {
    throw new Error(`Missing source audio for ${trackId}`);
  }

  const segmentDefs = peppaSegmentBuild[trackId];
  if (!segmentDefs) {
    throw new Error(`Missing segment build config for ${trackId}`);
  }

  fs.mkdirSync(workDir, { recursive: true });
  const corpusDir = path.join(workDir, 'corpus');
  fs.mkdirSync(corpusDir, { recursive: true });

  const totalDurationMs = Math.round(runFfprobe(sourceAudio) * 1000);
  const segments = Array.isArray(segmentDefs)
    ? segmentDefs.map((config) => buildSegment(track, config, totalDurationMs))
    : segmentDefs.mode === 'grouped-per-line'
      ? buildGroupedPerLineSegments(track, segmentDefs, totalDurationMs)
      : buildPerLineSegments(track, segmentDefs, totalDurationMs);

  for (const segment of segments) {
    const baseName = segment.segmentId;
    const wavPath = path.join(corpusDir, `${baseName}.wav`);
    const labPath = path.join(corpusDir, `${baseName}.lab`);
    execFileSync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-i',
        sourceAudio,
        '-ss',
        millisecondsToSeconds(segment.startMs),
        '-to',
        millisecondsToSeconds(segment.endMs),
        '-ac',
        '1',
        '-ar',
        '16000',
        wavPath
      ],
      { stdio: 'ignore' }
    );
    fs.writeFileSync(
      labPath,
      segment.textLines
        .map((line) => line.cleanedText)
        .join('\n')
    );
  }

  fs.writeFileSync(
    path.join(workDir, 'segments.json'),
    JSON.stringify(
      {
        trackId: track.trackId,
        contentId: track.contentId,
        mediaType: track.mediaType,
        sourceAudio,
        totalDurationMs,
        segments
      },
      null,
      2
    )
  );

  console.log(`Prepared ${segments.length} segments for ${trackId} in ${workDir}`);
}

main();
