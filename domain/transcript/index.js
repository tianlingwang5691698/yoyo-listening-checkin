const { transcriptTracks } = require('../../data/catalog');

function formatMsLabel(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getTranscriptTrackMap() {
  const map = {};
  transcriptTracks.forEach((track) => {
    map[track.trackId] = track;
  });
  return map;
}

function splitWords(text) {
  return String(text || '').match(/\S+/g) || [];
}

function buildFallbackWords(line) {
  if (line.words && line.words.length) {
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
      wordId: `${line.lineId}-w${index + 1}`,
      text: word,
      startMs: cursor,
      endMs: Math.max(cursor + 1, nextEnd)
    };
    cursor = item.endMs;
    return item;
  });
}

function normalizeTranscriptTrack(track) {
  if (!track) {
    return null;
  }
  return Object.assign({}, track, {
    lines: track.lines.map((line) => Object.assign({}, line, {
      startLabel: formatMsLabel(line.startMs),
      words: buildFallbackWords(line)
    }))
  });
}

function getTranscriptBundle(task) {
  if (!task || !task.transcriptTrackId) {
    return {
      transcriptTrack: null,
      transcriptLines: []
    };
  }
  const transcriptTrack = normalizeTranscriptTrack(getTranscriptTrackMap()[task.transcriptTrackId]);
  return {
    transcriptTrack,
    transcriptLines: transcriptTrack ? transcriptTrack.lines : []
  };
}

module.exports = {
  getTranscriptTrackMap,
  normalizeTranscriptTrack,
  getTranscriptBundle
};
