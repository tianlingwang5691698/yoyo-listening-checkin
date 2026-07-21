const test = require('node:test');
const assert = require('node:assert/strict');

const { formatAudioTime, formatAudioDuration } = require('../utils/audio-time');

test('current playback time floors partial seconds', () => {
  assert.equal(formatAudioTime(923.742), '15:23');
});

test('total duration rounds partial seconds', () => {
  assert.equal(formatAudioDuration(923.742), '15:24');
  assert.equal(formatAudioDuration(941.375), '15:41');
});
