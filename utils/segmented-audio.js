function normalizeAudioSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => ({
      index: Number.isFinite(Number(segment.index)) ? Number(segment.index) : index,
      startSec: Math.max(0, Number(segment.startSec || 0)),
      durationSec: Math.max(0, Number(segment.durationSec || 0)),
      audioUrl: String(segment.audioUrl || ''),
      audioCloudPath: String(segment.audioCloudPath || ''),
      audioFileId: String(segment.audioFileId || '')
    }))
    .filter((segment) => segment.durationSec > 0
      && (segment.audioUrl || segment.audioCloudPath || segment.audioFileId))
    .sort((left, right) => left.startSec - right.startSec || left.index - right.index)
    .map((segment, index) => Object.assign({}, segment, { index }));
}

function getSegmentIndexAtTime(segments, positionSec) {
  const rows = normalizeAudioSegments(segments);
  if (!rows.length) return -1;
  const target = Math.max(0, Number(positionSec || 0));
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (target >= rows[index].startSec) return index;
  }
  return 0;
}

function getSegmentGlobalTime(segments, segmentIndex, localPositionSec) {
  const rows = normalizeAudioSegments(segments);
  const segment = rows[Math.max(0, Math.min(rows.length - 1, Number(segmentIndex || 0)))];
  return segment ? segment.startSec + Math.max(0, Number(localPositionSec || 0)) : Math.max(0, Number(localPositionSec || 0));
}

function getSegmentLocalTime(segments, segmentIndex, globalPositionSec) {
  const rows = normalizeAudioSegments(segments);
  const segment = rows[Math.max(0, Math.min(rows.length - 1, Number(segmentIndex || 0)))];
  return segment ? Math.max(0, Number(globalPositionSec || 0) - segment.startSec) : Math.max(0, Number(globalPositionSec || 0));
}

module.exports = {
  normalizeAudioSegments,
  getSegmentIndexAtTime,
  getSegmentGlobalTime,
  getSegmentLocalTime
};
