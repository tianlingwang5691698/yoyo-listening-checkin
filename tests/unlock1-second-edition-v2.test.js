const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'data', 'transcript-build', 'unlock1-second-edition-v2', 'A1', 'unlock1');
const before = JSON.parse(fs.readFileSync(path.join(build, 'cloud-backup', 'bundle-v1-before-v2-20260722.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(build, 'bundle-wordaligned-v2.json'), 'utf8'));
const repairedIds = [
  'track-unlock1-1-2',
  'track-unlock1-1-5',
  'track-unlock1-2-2',
  'track-unlock1-2-5',
  'track-unlock1-3-3'
];

test('Unlock 1 second edition v2 keeps all tracks and only repairs incomplete transcripts', () => {
  assert.equal(Object.keys(before).length, 24);
  assert.equal(Object.keys(after).length, 24);
  repairedIds.forEach((trackId) => {
    assert.equal(after[trackId].lines.length > before[trackId].lines.length, true);
    assert.equal(after[trackId].lines.at(-1).endMs, Math.round(after[trackId].durationSec * 1000));
  });
  Object.keys(before).filter((trackId) => !repairedIds.includes(trackId)).forEach((trackId) => {
    assert.deepEqual(after[trackId], before[trackId]);
  });
});

test('Unlock2e_A1_1.2 contains the complete three-student dialogue', () => {
  const track = after['track-unlock1-1-2'];
  assert.equal(track.lines.length, 30);
  assert.equal(track.lines[0].text, 'Carlos: Hi, hello.');
  assert.equal(track.lines.at(-1).text, 'Kerry: Thank you, Nehir.');
  assert.equal(track.lines.at(-1).endMs, 85461);
});
