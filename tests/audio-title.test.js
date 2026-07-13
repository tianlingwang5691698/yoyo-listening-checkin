const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanAudioTitle, getTaskAudioDisplayTitle } = require('../utils/audio-title');

test('音频标题隐藏指纹并极简化 Unlock 编号', () => {
  const raw = 'b15af2e88b_UNL3_PP_IN_LS1_U01_l03_p024_X05_t03.mp3';
  assert.equal(cleanAudioTitle(raw), '1.3');
  assert.equal(getTaskAudioDisplayTitle({ audioCloudPath: `A1/unlock1 第三版/Audio/${raw}` }), '1.3');
});

test('音频标题优先使用已清洗展示名', () => {
  assert.equal(getTaskAudioDisplayTitle({
    displayTitle: 'Hide and Seek',
    audioTitle: '4f8c80d119_raw_audio_name.mp3'
  }), 'Hide and Seek');
  assert.equal(cleanAudioTitle('1.10'), '1.10');
});
