const {
  canUseDictionaryVoice,
  normalizeDictionaryVoiceText,
  buildDictionaryVoiceUrls,
  buildDictionaryVoiceSegments,
  buildDictionaryVoiceSegmentUrls
} = require('./dictionary-voice');

function createDictionaryVoicePlayer() {
  let audio = null;
  let requestId = 0;
  let timer = null;
  let request = null;

  function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function finish(success) {
    clearTimer();
    const current = request;
    request = null;
    if (!current) return;
    if (success) {
      if (current.onDone) current.onDone();
    } else if (current.onFailed) {
      current.onFailed();
    }
  }

  function startTimer(id) {
    clearTimer();
    if (!request || request.id !== id) return;
    const remainingMs = Math.max(0, request.deadlineAt - Date.now());
    const attemptsRemaining = Math.max(1, request.urls.length - request.urlIndex);
    timer = setTimeout(() => {
      timer = null;
      if (!request || request.id !== id) return;
      if (tryNextUrl(id)) return;
      if (startSegments(id)) return;
      if (playNextSegment(id)) return;
      finish(false);
    }, Math.max(250, Math.floor(remainingMs / attemptsRemaining)));
  }

  function playCurrentUrl(id) {
    if (!request || request.id !== id || !audio || !request.urls[request.urlIndex]) return false;
    audio.src = request.urls[request.urlIndex];
    startTimer(id);
    audio.play();
    return true;
  }

  function tryNextUrl(id) {
    if (!request || request.id !== id || Date.now() >= request.deadlineAt) return false;
    if (request.urlIndex + 1 >= request.urls.length) return false;
    request.urlIndex += 1;
    return playCurrentUrl(id);
  }

  function startSegments(id) {
    if (!request || request.id !== id || request.usingSegments || request.segments.length < 2 || Date.now() >= request.deadlineAt) return false;
    request.usingSegments = true;
    request.segmentIndex = -1;
    return playNextSegment(id, false);
  }

  function playNextSegment(id, resetDeadline = true) {
    if (!request || request.id !== id || !request.usingSegments) return false;
    const nextIndex = request.segmentIndex + 1;
    if (nextIndex >= request.segments.length) return false;
    request.segmentIndex = nextIndex;
    request.urls = buildDictionaryVoiceSegmentUrls(request.segments[nextIndex]);
    request.urlIndex = 0;
    if (resetDeadline) request.deadlineAt = Date.now() + 2000;
    return playCurrentUrl(id);
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = wx.createInnerAudioContext();
    audio.obeyMuteSwitch = false;
    audio.onPlay(() => {
      clearTimer();
      if (request) request.heardAudio = true;
    });
    audio.onEnded(() => {
      if (!request) return;
      const id = request.id;
      if (playNextSegment(id)) return;
      finish(true);
    });
    audio.onError(() => {
      if (!request) return;
      const id = request.id;
      clearTimer();
      if (tryNextUrl(id)) return;
      if (startSegments(id)) return;
      if (playNextSegment(id)) return;
      finish(false);
    });
    return audio;
  }

  function play(value, options = {}) {
    const text = normalizeDictionaryVoiceText(value);
    if (!canUseDictionaryVoice(text)) {
      if (options.onFailed) options.onFailed();
      return false;
    }
    requestId += 1;
    clearTimer();
    ensureAudio().stop();
    const preferredUrls = (options.preferredUrls || []).filter(Boolean);
    request = {
      id: requestId,
      text,
      urls: preferredUrls.concat(buildDictionaryVoiceUrls(text)),
      urlIndex: 0,
      segments: buildDictionaryVoiceSegments(text),
      usingSegments: false,
      segmentIndex: -1,
      deadlineAt: Date.now() + 5000,
      heardAudio: false,
      onDone: options.onDone,
      onFailed: options.onFailed
    };
    if (options.onStart) options.onStart(text);
    return playCurrentUrl(request.id);
  }

  function destroy() {
    requestId += 1;
    request = null;
    clearTimer();
    if (audio) audio.destroy();
    audio = null;
  }

  return { play, destroy };
}

module.exports = { createDictionaryVoicePlayer };
