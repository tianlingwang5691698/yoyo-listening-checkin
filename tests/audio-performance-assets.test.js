const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const unlockManifest = require('../cloudfunctions/yoyo/data/unlock-series-manifests.json');
const staticManifest = require('../cloudfunctions/yoyo/data/static-catalog-manifests.json');

test('Unlock 4 使用不可变优化音频并保留原路径', () => {
  const tracks = unlockManifest.unlock4.tracks;
  assert.equal(tracks.length, 27);
  tracks.forEach((track) => {
    assert.match(track.cloudPath, /^B2\/Unlock4\/Class Audio\/optimized-v1\/.+-[a-f0-9]{10}-64k-mono\.mp3$/);
    assert.match(track.legacyCloudPath, /^B2\/Unlock4\/Class Audio\/Unlock2e_B2_.+\.mp3$/);
    assert.equal(track.audioOptimization.bitrate, 64000);
    assert.equal(track.audioOptimization.channels, 1);
  });
});

test('Unlock 4 首片满足 500ms 目标所需大小门槛', () => {
  unlockManifest.unlock4.tracks.forEach((track) => {
    assert.ok(track.audioSegments.length >= 2);
    assert.equal(track.audioSegments[0].startSec, 0);
    assert.ok(track.audioSegments[0].durationSec <= 31);
    assert.ok(track.audioSegments[0].size <= 280000);
    track.audioSegments.slice(1).forEach((segment) => assert.ok(segment.size <= 800000));
    const lastSegment = track.audioSegments.at(-1);
    assert.ok(Math.abs((lastSegment.startSec + lastSegment.durationSec) - track.durationSec) <= 0.6);
  });
});

test('Magic Tree House 全部 52 条分片满足 500ms 大小门槛', () => {
  const tracks = [
    ...staticManifest.categories.magictreehouse,
    ...staticManifest.categories.magictreehouseb1
  ];
  assert.equal(tracks.length, 52);
  tracks.forEach((track) => {
    assert.ok(track.audioSegments.length >= 2);
    assert.equal(track.audioSegments[0].startSec, 0);
    assert.ok(track.audioSegments[0].durationSec <= 31);
    assert.ok(track.audioSegments[0].size <= 280000);
    track.audioSegments.slice(1).forEach((segment) => assert.ok(segment.size <= 800000));
    const lastSegment = track.audioSegments.at(-1);
    assert.ok(Math.abs((lastSegment.startSec + lastSegment.durationSec) - track.durationSec) <= 0.6);
  });
});

test('课程播放器支持整集时间、下一片预下载和整集回退', () => {
  const source = fs.readFileSync(path.join(ROOT, 'pages', 'lesson', 'index.js'), 'utf8');
  assert.match(source, /getCurrentAudioPositionSeconds\(\)/);
  assert.match(source, /prepareNextAudioSegment\(\)/);
  assert.match(source, /fallbackSegmentedAudio\('segment-playback-error'/);
  assert.match(source, /audioSegmentVersion/);
  assert.match(source, /Number\(pendingLocalSeek\) > 0\.01/);
  assert.match(source, /innerAudioContext\.onCanplay\(\(\) => \{\s*this\.clearAudioErrorTimer\(\)/);
});
