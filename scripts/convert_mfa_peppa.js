const fs = require('fs');
const path = require('path');

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
  const word = interval.word || interval.label || interval.text || '';
  const begin = interval.begin ?? interval.start ?? interval.xmin ?? 0;
  const end = interval.end ?? interval.stop ?? interval.xmax ?? begin;
  return {
    word: String(word).trim().toLowerCase(),
    begin: Number(begin),
    end: Number(end)
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

function toMs(seconds) {
  return Math.max(0, Math.round(seconds * 1000));
}

function main() {
  const workDir = process.argv[2];
  const outputPath = process.argv[3];

  if (!workDir || !outputPath) {
    console.error('Usage: node scripts/convert_mfa_peppa.js <work-dir> <output-json>');
    process.exit(1);
  }

  const lineMap = JSON.parse(fs.readFileSync(path.join(workDir, 'line-map.json'), 'utf8'));
  const alignmentPath = path.join(workDir, 'output', `${lineMap.baseName}.json`);
  const alignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'));
  const rawIntervals = extractIntervals(alignment).map(normalizeInterval).filter((i) => i.word && i.word !== 'sp' && i.word !== 'sil');

  let cursor = 0;
  const lines = [];

  for (const line of lineMap.lines) {
    const targetTokens = tokenize(line.cleanedText);
    const matched = [];

    for (const token of targetTokens) {
      while (cursor < rawIntervals.length && rawIntervals[cursor].word === '<eps>') {
        cursor += 1;
      }
      if (cursor >= rawIntervals.length) {
        throw new Error(`Ran out of aligned words while mapping ${line.lineId}`);
      }
      matched.push(rawIntervals[cursor]);
      cursor += 1;
    }

    if (!matched.length) {
      continue;
    }

    lines.push({
      lineId: line.lineId,
      text: line.originalText,
      startMs: toMs(matched[0].begin),
      endMs: toMs(matched[matched.length - 1].end)
    });
  }

  const track = {
    trackId: lineMap.trackId,
    contentId: lineMap.contentId,
    mediaType: lineMap.mediaType,
    lines
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(track, null, 2));
  console.log(`Wrote ${outputPath}`);
}

main();
