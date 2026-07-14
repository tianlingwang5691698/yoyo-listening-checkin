const EFFECTIVE_LISTENING_RATIO = 0.9;

function addEffectiveListeningSeconds(totalSeconds, sample = {}) {
  const total = Math.max(0, Number(totalSeconds || 0));
  if (!sample.isPlaying || sample.isSeeking) return total;
  const previous = Number(sample.previousAudioSec);
  const current = Number(sample.currentAudioSec);
  const elapsedSec = Number(sample.elapsedMs || 0) / 1000;
  if (!Number.isFinite(previous) || !Number.isFinite(current) || elapsedSec <= 0 || elapsedSec > 5) {
    return total;
  }
  const audioDelta = current - previous;
  const maxNaturalDelta = Math.max(1.5, elapsedSec * 1.6 + 0.5);
  if (audioDelta <= 0 || audioDelta > maxNaturalDelta) return total;
  const durationSec = Math.max(0, Number(sample.durationSec || 0));
  const next = total + Math.min(audioDelta, elapsedSec + 0.5);
  return durationSec > 0 ? Math.min(durationSec, next) : next;
}

function getRequiredListeningSeconds(durationSec, ratio = EFFECTIVE_LISTENING_RATIO) {
  return Math.max(0, Number(durationSec || 0)) * Math.max(0, Math.min(1, Number(ratio || 0)));
}

function hasEffectiveListeningCompleted(effectiveSeconds, durationSec, ratio = EFFECTIVE_LISTENING_RATIO) {
  const required = getRequiredListeningSeconds(durationSec, ratio);
  return required > 0 && Number(effectiveSeconds || 0) >= required;
}

module.exports = {
  EFFECTIVE_LISTENING_RATIO,
  addEffectiveListeningSeconds,
  getRequiredListeningSeconds,
  hasEffectiveListeningCompleted
};
