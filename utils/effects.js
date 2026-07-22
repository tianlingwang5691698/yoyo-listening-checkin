const COMPLETE_SFX_VARIANTS = [
  {
    src: '/assets/audio/sfx/flashcard-complete-chime.mp3',
    includesVoice: false
  },
  {
    src: '/assets/audio/sfx/completion-warm-bloom-you-did-it.mp3',
    includesVoice: true
  },
  {
    src: '/assets/audio/sfx/completion-solo-chord-you-nailed-it.mp3',
    includesVoice: true
  }
];
const DEVICE_STUDY_ROLE_KEY = 'yoyoDeviceStudyRoleV1';
const SELECTED_STUDENT_KEY = 'yoyoSelectedStudentTargetV1';
const COMPLETION_PLAYED_PREFIX = 'yoyoCompletionEffectPlayedV1:';
const COMPLETE_SFX_VOLUME = 0.55;
const COMPLETE_VOICE_VOLUME = 0.9;
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

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isStudentDevice() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return false;
  try {
    return String(wx.getStorageSync(DEVICE_STUDY_ROLE_KEY) || wx.getStorageSync('lastStudyRole') || '') === 'student';
  } catch (error) {
    return false;
  }
}

function getStudentScope() {
  try {
    const target = wx.getStorageSync(SELECTED_STUDENT_KEY) || {};
    return String(target.targetChildId || target.childId || 'self');
  } catch (error) {
    return 'self';
  }
}

function claimOnce(onceKey) {
  const normalizedKey = String(onceKey || '').trim();
  if (!normalizedKey) return true;
  const storageKey = `${COMPLETION_PLAYED_PREFIX}${getStudentScope()}:${normalizedKey}`;
  try {
    if (wx.getStorageSync(storageKey)) return false;
    wx.setStorageSync(storageKey, true);
  } catch (error) {}
  return true;
}

function canPlayReward(options) {
  const settings = options || {};
  if (settings.studentOnly !== false && !isStudentDevice()) return false;
  return claimOnce(settings.onceKey);
}

function pickCompleteVariant(options) {
  if (options && options.voiceKey) {
    return COMPLETE_SFX_VARIANTS.find((item) => !item.includesVoice) || COMPLETE_SFX_VARIANTS[0];
  }
  const index = Math.floor(Math.random() * COMPLETE_SFX_VARIANTS.length);
  return COMPLETE_SFX_VARIANTS[index] || COMPLETE_SFX_VARIANTS[0];
}

function clearVoiceTimer() {
  if (!voiceTimer) return;
  clearTimeout(voiceTimer);
  voiceTimer = null;
}

function getCompleteAudioContext() {
  if (!canUseAudio()) return null;
  if (!completeAudioContext) {
    completeAudioContext = wx.createInnerAudioContext();
    completeAudioContext.obeyMuteSwitch = true;
    completeAudioContext.volume = COMPLETE_SFX_VOLUME;
  }
  return completeAudioContext;
}

function getVoiceAudioContext() {
  if (!canUseAudio()) return null;
  if (!voiceAudioContext) {
    voiceAudioContext = wx.createInnerAudioContext();
    voiceAudioContext.obeyMuteSwitch = true;
    voiceAudioContext.volume = COMPLETE_VOICE_VOLUME;
  }
  return voiceAudioContext;
}

function playComplete(options) {
  if (!canPlayReward(options)) return false;
  const audio = getCompleteAudioContext();
  if (!audio) return false;
  const variant = pickCompleteVariant(options);
  try {
    audio.stop();
    audio.src = variant.src;
    audio.play();
  } catch (error) {}
  if (variant.includesVoice) {
    clearVoiceTimer();
  } else if (options && options.voiceKey) {
    playVoice(options.voiceKey, {
      delayMs: options.voiceDelayMs || 1000,
      studentOnly: options.studentOnly
    });
  }
  return true;
}

function playAudioAndWait(audio, src, fallbackMs) {
  if (!audio || !src) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (played) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (audio.offEnded) audio.offEnded(onEnded);
      if (audio.offError) audio.offError(onError);
      resolve(played);
    };
    const onEnded = () => finish(true);
    const onError = () => finish(false);
    if (audio.onEnded) audio.onEnded(onEnded);
    if (audio.onError) audio.onError(onError);
    timer = setTimeout(() => finish(false), Math.max(1000, Number(fallbackMs || 8000)));
    try {
      audio.stop();
      audio.src = src;
      audio.play();
    } catch (error) {
      finish(false);
    }
  });
}

async function playCompleteAndWait(options) {
  if (!canPlayReward(options)) return false;
  const audio = getCompleteAudioContext();
  if (!audio) return false;
  const variant = pickCompleteVariant(options);
  clearVoiceTimer();
  const waits = [playAudioAndWait(audio, variant.src, 8000)];
  if (!variant.includesVoice && options && options.voiceKey) {
    const voiceSrc = VOICE_SRC_MAP[options.voiceKey];
    if (voiceSrc) {
      const delayMs = Math.max(0, Number(options.voiceDelayMs || 1000));
      waits.push(new Promise((resolve) => {
        voiceTimer = setTimeout(async () => {
          voiceTimer = null;
          resolve(await playAudioAndWait(getVoiceAudioContext(), voiceSrc, 8000));
        }, delayMs);
      }));
    }
  }
  await Promise.all(waits);
  return true;
}

function playVoice(voiceKey, options) {
  const src = VOICE_SRC_MAP[voiceKey];
  if (!src || !canPlayReward(options)) return false;
  clearVoiceTimer();
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
  return true;
}

function destroy() {
  clearVoiceTimer();
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
  playCompleteAndWait,
  playVoice,
  todayKey,
  destroy
};
