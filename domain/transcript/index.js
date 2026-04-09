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

function normalizeTranscriptTrack(track) {
  if (!track) {
    return null;
  }
  return Object.assign({}, track, {
    lines: track.lines.map((line) => Object.assign({}, line, {
      startLabel: formatMsLabel(line.startMs)
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
