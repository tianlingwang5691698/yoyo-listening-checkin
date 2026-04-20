const { TRANSCRIPT_BUNDLE_PATHS, TRANSCRIPT_BUNDLE_TTL_MS } = require('../lib/constants');
const { downloadCloudJson, getBaseName } = require('./storage.adapter');

const runtimeTranscriptTrackMaps = {};
const runtimeTranscriptTrackMapExpiresAt = {};

function slugifyTrackIdPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/i, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getTrackSlugVariants(value) {
  const text = String(value || '');
  return Array.from(new Set([
    slugifyTrackIdPart(text),
    slugifyTrackIdPart(text.replace(/&/g, ' ')),
    slugifyTrackIdPart(text.replace(/&/g, '-')),
    slugifyTrackIdPart(text.replace(/&/g, ' and '))
  ].filter(Boolean)));
}

function formatTranscriptMsLabel(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function normalizeTranscriptWord(word, lineId, index) {
  const startMs = Number(word && word.startMs);
  const endMs = Number(word && word.endMs);
  return {
    wordId: String((word && word.wordId) || `${lineId}-w${index + 1}`),
    text: String((word && word.text) || '').trim(),
    startMs: Number.isFinite(startMs) ? startMs : 0,
    endMs: Number.isFinite(endMs) ? Math.max(endMs, startMs + 1) : 1
  };
}

function normalizeTranscriptLine(line) {
  const lineId = String((line && line.lineId) || '');
  const startMs = Number((line && line.startMs) || 0);
  const endMs = Math.max(Number((line && line.endMs) || startMs), startMs + 1);
  const words = Array.isArray(line && line.words)
    ? line.words.map((word, index) => normalizeTranscriptWord(word, lineId, index))
    : [];
  return Object.assign({}, line, {
    lineId,
    text: String((line && line.text) || '').trim(),
    startMs,
    endMs,
    words
  });
}

function normalizeTranscriptTrack(track, options = {}) {
  const syncGranularity = String(options.syncGranularity || (track && track.syncGranularity) || 'word').trim() || 'word';
  return Object.assign({}, track, {
    syncGranularity,
    lines: Array.isArray(track && track.lines)
      ? track.lines.map((line) => {
        const normalizedLine = normalizeTranscriptLine(line);
        return Object.assign({}, normalizedLine, {
          words: syncGranularity === 'line' ? [] : normalizedLine.words,
          startLabel: formatTranscriptMsLabel(normalizedLine.startMs)
        });
      })
      : []
  });
}

function shouldLazyTranscriptCategory(category) {
  return ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'].includes(category);
}

async function getTranscriptTrackMap(category) {
  const key = String(category || '').trim();
  if (!key) {
    return {};
  }
  const now = Date.now();
  if (runtimeTranscriptTrackMaps[key] && runtimeTranscriptTrackMapExpiresAt[key] > now) {
    return runtimeTranscriptTrackMaps[key];
  }
  const cloudPaths = Array.isArray(TRANSCRIPT_BUNDLE_PATHS[key]) ? TRANSCRIPT_BUNDLE_PATHS[key] : [TRANSCRIPT_BUNDLE_PATHS[key]];
  let trackMap = {};
  for (const cloudPath of (cloudPaths || []).filter(Boolean)) {
    try {
      trackMap = await downloadCloudJson(cloudPath);
      break;
    } catch (error) {
      // try next
    }
  }
  runtimeTranscriptTrackMaps[key] = trackMap || {};
  runtimeTranscriptTrackMapExpiresAt[key] = now + TRANSCRIPT_BUNDLE_TTL_MS;
  return runtimeTranscriptTrackMaps[key];
}

function findTranscriptTrack(transcriptTrackMap, task) {
  const candidates = [
    task && task.transcriptTrackId,
    task && task.contentId,
    task && task.title,
    task && task.audioTitle,
    task && task.displayTitle,
    task && getBaseName(task.audioCloudPath),
    task && getBaseName(task.audioUrl)
  ].concat((task && task.transcriptTrackCandidates) || []).filter(Boolean);
  for (const trackId of candidates) {
    if (transcriptTrackMap[trackId]) {
      return transcriptTrackMap[trackId];
    }
  }
  const normalizedCandidates = new Set(candidates.flatMap(getTrackSlugVariants));
  const matchedKey = Object.keys(transcriptTrackMap || {}).find((trackId) => {
    const track = transcriptTrackMap[trackId] || {};
    const trackCandidates = [
      trackId,
      track.trackId,
      track.contentId,
      track.title,
      track.audioTitle,
      track.fileName,
      track.audioFileName
    ].filter(Boolean).flatMap(getTrackSlugVariants);
    return trackCandidates.some((item) => normalizedCandidates.has(item));
  });
  return matchedKey ? transcriptTrackMap[matchedKey] : null;
}

async function getTranscriptBundle(task) {
  if (shouldLazyTranscriptCategory(task && task.category) && (!task || !task.transcriptTrackId) && !(task && task.transcriptTrackCandidates && task.transcriptTrackCandidates.length)) {
    return {
      transcriptTrack: null,
      transcriptLines: []
    };
  }
  const trackMap = await getTranscriptTrackMap(task && task.category);
  const transcriptTrack = findTranscriptTrack(trackMap, task);
  if (!task || !transcriptTrack) {
    return {
      transcriptTrack: null,
      transcriptLines: []
    };
  }
  const normalizedTrack = normalizeTranscriptTrack(transcriptTrack, {
    syncGranularity: task && task.category === 'song' ? 'line' : undefined
  });
  return {
    transcriptTrack: normalizedTrack,
    transcriptLines: normalizedTrack.lines
  };
}

module.exports = {
  getTranscriptTrackMap,
  getTranscriptBundle,
  normalizeTranscriptTrack,
  findTranscriptTrack,
  formatTranscriptMsLabel
};
