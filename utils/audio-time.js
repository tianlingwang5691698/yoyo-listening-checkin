function formatSeconds(seconds, rounding) {
  const numeric = Math.max(0, Number(seconds) || 0);
  const value = rounding === 'round' ? Math.round(numeric) : Math.floor(numeric);
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes < 10 ? '0' : ''}${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

function formatAudioTime(seconds) {
  return formatSeconds(seconds, 'floor');
}

function formatAudioDuration(seconds) {
  return formatSeconds(seconds, 'round');
}

module.exports = {
  formatAudioTime,
  formatAudioDuration
};
