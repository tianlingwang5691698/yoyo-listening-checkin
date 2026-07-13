const assert = require('node:assert/strict');
const test = require('node:test');

function makeAudio(played, wholePlayable) {
  const handlers = {};
  return {
    src: '',
    obeyMuteSwitch: true,
    onPlay(fn) { handlers.play = fn; },
    onEnded(fn) { handlers.ended = fn; },
    onError(fn) { handlers.error = fn; },
    play() {
      const url = this.src;
      played.push(url);
      queueMicrotask(() => {
        const isWhole = decodeURIComponent(url).includes('lives in a remote Chinese village');
        if (isWhole && !wholePlayable) {
          handlers.error();
          return;
        }
        handlers.play();
        handlers.ended();
      });
    },
    stop() {},
    destroy() {}
  };
}

test('统一播放器整条可用时不进入逐词补救', async () => {
  const played = [];
  global.wx = { createInnerAudioContext: () => makeAudio(played, true) };
  const { createDictionaryVoicePlayer } = require('../utils/dictionary-voice-player');
  await new Promise((resolve, reject) => {
    createDictionaryVoicePlayer().play('lives in a remote Chinese village', { onDone: resolve, onFailed: reject });
  });
  assert.equal(played.length, 1);
  assert.match(decodeURIComponent(played[0]), /lives in a remote Chinese village/);
});

test('统一播放器整条全部失败后才按顺序逐词', async () => {
  const played = [];
  global.wx = { createInnerAudioContext: () => makeAudio(played, false) };
  const { createDictionaryVoicePlayer } = require('../utils/dictionary-voice-player');
  await new Promise((resolve, reject) => {
    createDictionaryVoicePlayer().play('lives in a remote Chinese village', { onDone: resolve, onFailed: reject });
  });
  const spokenWords = played.slice(3).map((url) => new URL(url).searchParams.get('audio'));
  assert.deepEqual(spokenWords, ['lives', 'in', 'a', 'remote', 'Chinese', 'village']);
});
