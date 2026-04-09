function formatTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remain = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${minutes}:${remain}`;
}

function getInitialPlayerState(durationSec) {
  return {
    currentTimeMs: 0,
    currentTimeLabel: '00:00',
    durationLabel: formatTime(Number(durationSec) || 0),
    progressPercent: 0,
    isPlaying: false,
    playbackRate: 1,
    canRewind: false
  };
}

function getProgressPercent(currentSeconds, durationSeconds) {
  if (!durationSeconds) {
    return 0;
  }
  return Math.min(100, Math.max(0, (currentSeconds / durationSeconds) * 100));
}

module.exports = {
  formatTime,
  getInitialPlayerState,
  getProgressPercent
};
