const test = require('node:test');
const assert = require('node:assert/strict');
const segmentedAudio = require('../utils/segmented-audio');

const segments = [
  { index: 0, startSec: 0, durationSec: 90, audioCloudPath: '0.mp3' },
  { index: 1, startSec: 90, durationSec: 90, audioCloudPath: '1.mp3' },
  { index: 2, startSec: 180, durationSec: 45, audioCloudPath: '2.mp3' }
];

test('分片音频按整集时间定位片段', () => {
  assert.equal(segmentedAudio.getSegmentIndexAtTime(segments, 0), 0);
  assert.equal(segmentedAudio.getSegmentIndexAtTime(segments, 89.9), 0);
  assert.equal(segmentedAudio.getSegmentIndexAtTime(segments, 90), 1);
  assert.equal(segmentedAudio.getSegmentIndexAtTime(segments, 224), 2);
});

test('分片本地时间与整集时间双向换算', () => {
  assert.equal(segmentedAudio.getSegmentGlobalTime(segments, 1, 12.5), 102.5);
  assert.equal(segmentedAudio.getSegmentLocalTime(segments, 1, 102.5), 12.5);
});
