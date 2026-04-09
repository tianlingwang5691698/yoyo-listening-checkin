const fs = require('fs');
const path = require('path');
const { peppaTranscriptTracks } = require('../data/transcripts/peppa');

function extractIntervals(payload) {
  if (payload.words && Array.isArray(payload.words)) {
    return payload.words;
  }
  if (payload.tiers && payload.tiers.words && Array.isArray(payload.tiers.words.entries)) {
    return payload.tiers.words.entries;
  }
  if (payload.item && Array.isArray(payload.item.words)) {
    return payload.item.words;
  }
  throw new Error('Unsupported MFA JSON format');
}

function normalizeInterval(interval) {
  if (Array.isArray(interval)) {
    return {
      word: String(interval[2] || '').trim().toLowerCase(),
      begin: Number(interval[0] || 0),
      end: Number(interval[1] || interval[0] || 0)
    };
  }
  return {
    word: String(interval.word || interval.label || interval.text || '').trim().toLowerCase(),
    begin: Number(interval.begin ?? interval.start ?? interval.xmin ?? 0),
    end: Number(interval.end ?? interval.stop ?? interval.xmax ?? interval.begin ?? 0)
  };
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

function toMs(seconds, offsetMs) {
  return Math.max(0, Math.round(seconds * 1000) + offsetMs);
}

function findSegmentJson(outputDir, segmentId) {
  const direct = path.join(outputDir, `${segmentId}.json`);
  if (fs.existsSync(direct)) {
    return direct;
  }
  const nested = path.join(outputDir, 'output', `${segmentId}.json`);
  if (fs.existsSync(nested)) {
    return nested;
  }
  throw new Error(`Missing MFA output for ${segmentId}`);
}

function parseTextGridWords(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const intervals = [];
  let inWordsTier = false;
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('name = "')) {
      inWordsTier = line === 'name = "words"';
      continue;
    }
    if (!inWordsTier) {
      continue;
    }
    if (line.startsWith('intervals [')) {
      if (current) {
        intervals.push(current);
      }
      current = { begin: 0, end: 0, word: '' };
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith('xmin = ')) {
      current.begin = Number(line.replace('xmin = ', '').trim());
      continue;
    }
    if (line.startsWith('xmax = ')) {
      current.end = Number(line.replace('xmax = ', '').trim());
      continue;
    }
    if (line.startsWith('text = ')) {
      current.word = line
        .replace(/^text = /, '')
        .trim()
        .replace(/^"/, '')
        .replace(/"$/, '')
        .toLowerCase();
    }
  }

  if (current) {
    intervals.push(current);
  }
  return intervals;
}

function mapSegmentLines(segment, outputDir) {
  let intervals;
  try {
    const payload = JSON.parse(fs.readFileSync(findSegmentJson(outputDir, segment.segmentId), 'utf8'));
    intervals = extractIntervals(payload)
      .map(normalizeInterval)
      .filter((item) => item.word && item.word !== 'sp' && item.word !== 'sil' && item.word !== '<eps>');
  } catch (error) {
    const textGridPath = path.join(outputDir, `${segment.segmentId}.TextGrid`);
    if (fs.existsSync(textGridPath)) {
      intervals = parseTextGridWords(textGridPath)
        .map(normalizeInterval)
        .filter((item) => item.word && item.word !== 'sp' && item.word !== 'sil' && item.word !== '<eps>');
    } else {
      return [];
    }
  }

  let cursor = 0;
  const mappedLines = [];

  for (const line of segment.textLines) {
    const targetTokens = tokenize(line.cleanedText);
    const matched = [];

    for (const token of targetTokens) {
      while (cursor < intervals.length && intervals[cursor].word === '<eps>') {
        cursor += 1;
      }
      if (cursor >= intervals.length) {
        throw new Error(`Ran out of aligned words while mapping ${line.lineId} in ${segment.segmentId}`);
      }
      matched.push(intervals[cursor]);
      cursor += 1;
    }

    if (!matched.length) {
      continue;
    }

    mappedLines.push({
      lineId: line.lineId,
      text: line.originalText,
      startMs: toMs(matched[0].begin, segment.startMs),
      endMs: toMs(matched[matched.length - 1].end, segment.startMs)
    });
  }

  return mappedLines;
}

function main() {
  const workDir = process.argv[2];
  const outputPath = process.argv[3];

  if (!workDir || !outputPath) {
    console.error('Usage: node scripts/merge_peppa_segmented_mfa.js <work-dir> <output-json>');
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(workDir, 'segments.json'), 'utf8'));
  const outputDir = path.join(workDir, 'output');
  const existingTrack = peppaTranscriptTracks.find((item) => item.trackId === meta.trackId);
  const existingLineMap = new Map(
    existingTrack ? existingTrack.lines.map((line) => [line.lineId, line]) : []
  );
  const lines = [];

  for (const segment of meta.segments) {
    const mapped = mapSegmentLines(segment, outputDir);
    if (mapped.length) {
      lines.push(...mapped);
      continue;
    }
    for (const line of segment.textLines) {
      const fallback = existingLineMap.get(line.lineId);
      if (fallback) {
        lines.push({
          lineId: fallback.lineId,
          text: fallback.text,
          startMs: fallback.startMs,
          endMs: fallback.endMs
        });
      }
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        trackId: meta.trackId,
        contentId: meta.contentId,
        mediaType: meta.mediaType,
        lines
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outputPath}`);
}

main();
