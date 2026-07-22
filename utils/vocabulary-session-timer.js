function formatDuration(seconds, language) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (language === 'en') return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
  return minutes ? `${minutes}分${rest}秒` : `${rest}秒`;
}

function createVocabularySessionTimer(onTick) {
  let elapsedMs = 0;
  let activeStartedAt = 0;
  let interval = null;
  let active = false;

  const elapsedSeconds = () => Math.max(0, Math.floor((elapsedMs + (active ? Date.now() - activeStartedAt : 0)) / 1000));
  const emit = () => {
    if (typeof onTick === 'function') onTick(elapsedSeconds());
  };
  const clear = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  return {
    start() {
      clear();
      elapsedMs = 0;
      activeStartedAt = Date.now();
      active = true;
      emit();
      interval = setInterval(emit, 1000);
    },
    resume() {
      if (active || elapsedMs < 0) return;
      activeStartedAt = Date.now();
      active = true;
      emit();
      interval = setInterval(emit, 1000);
    },
    pause() {
      if (active) elapsedMs += Date.now() - activeStartedAt;
      active = false;
      activeStartedAt = 0;
      clear();
      emit();
    },
    stop() {
      this.pause();
      return Math.max(elapsedMs > 0 ? 1 : 0, Math.round(elapsedMs / 1000));
    },
    getElapsedSec() {
      return elapsedSeconds();
    },
    reset() {
      clear();
      elapsedMs = 0;
      activeStartedAt = 0;
      active = false;
      emit();
    }
  };
}

module.exports = { createVocabularySessionTimer, formatDuration };
