const COMPLETE_SFX_SRC = '/assets/audio/sfx/flashcard-complete-chime.mp3';
const VOICE_SRC_MAP = {
  flashcardComplete: '/assets/audio/voice/flashcard-complete-great-work.mp3',
  listeningComplete: '/assets/audio/voice/listening-complete-great-listening.mp3',
  readingComplete: '/assets/audio/voice/reading-complete-nice-reading.mp3',
  writingComplete: '/assets/audio/voice/writing-complete-nice-writing.mp3',
  streakMilestone: '/assets/audio/voice/streak-milestone-you-did-it.mp3'
};

let completeAudioContext = null;
let voiceAudioContext = null;
let voiceTimer = null;

function canUseAudio() {
  return typeof wx !== 'undefined' && wx.createInnerAudioContext;
}

function getCompleteAudioContext() {
  if (!canUseAudio()) return null;
  if (!completeAudioContext) {
    completeAudioContext = wx.createInnerAudioContext();
    completeAudioContext.obeyMuteSwitch = true;
  }
  return completeAudioContext;
}

function getVoiceAudioContext() {
  if (!canUseAudio()) return null;
  if (!voiceAudioContext) {
    voiceAudioContext = wx.createInnerAudioContext();
    voiceAudioContext.obeyMuteSwitch = true;
  }
  return voiceAudioContext;
}

function playComplete(options) {
  const audio = getCompleteAudioContext();
  if (!audio) return;
  try {
    audio.stop();
    audio.src = COMPLETE_SFX_SRC;
    audio.play();
  } catch (error) {}
  if (options && options.voiceKey) {
    playVoice(options.voiceKey, { delayMs: options.voiceDelayMs || 450 });
  }
}

function playVoice(voiceKey, options) {
  const src = VOICE_SRC_MAP[voiceKey];
  if (!src) return;
  if (voiceTimer) {
    clearTimeout(voiceTimer);
    voiceTimer = null;
  }
  const delayMs = Math.max(0, Number((options && options.delayMs) || 0));
  voiceTimer = setTimeout(() => {
    voiceTimer = null;
    const audio = getVoiceAudioContext();
    if (!audio) return;
    try {
      audio.stop();
      audio.src = src;
      audio.play();
    } catch (error) {}
  }, delayMs);
}

function destroy() {
  if (voiceTimer) {
    clearTimeout(voiceTimer);
    voiceTimer = null;
  }
  if (completeAudioContext) {
    try {
      completeAudioContext.destroy();
    } catch (error) {}
    completeAudioContext = null;
  }
  if (voiceAudioContext) {
    try {
      voiceAudioContext.destroy();
    } catch (error) {}
    voiceAudioContext = null;
  }
}

module.exports = {
  playComplete,
  playVoice,
  destroy
};
