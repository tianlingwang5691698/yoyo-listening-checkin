const test = require('node:test');
const assert = require('node:assert/strict');

global.wx = {
  store: {},
  getStorageSync(key) {
    return this.store[key];
  },
  setStorageSync(key, value) {
    this.store[key] = value;
  }
};

const snapshot = require('../utils/snapshot');

test('snapshot read/write by id', () => {
  snapshot.write('snap-key', 'item-1', { title: 'A' }, { source: 'test' });
  assert.deepEqual(snapshot.read('snap-key', { id: 'item-1' }), { title: 'A' });
  assert.equal(snapshot.read('snap-key', { id: 'item-2' }), null);
});

test('snapshot expires by age', () => {
  wx.setStorageSync('old-key', {
    savedAt: Date.now() - 1000,
    id: 'old',
    data: { title: 'old' }
  });
  assert.equal(snapshot.read('old-key', { id: 'old', maxAgeMs: 10 }), null);
});

test('同一学生的最新课程覆盖上一次继续目标', () => {
  snapshot.write('activeListeningLessonV1:self', 'self', { taskId: 'lesson-a' }, { source: 'lesson-a' });
  snapshot.write('activeListeningLessonV1:self', 'self', { taskId: 'lesson-b' }, { source: 'lesson-b' });
  assert.deepEqual(
    snapshot.read('activeListeningLessonV1:self', { id: 'self' }),
    { taskId: 'lesson-b' }
  );
});
