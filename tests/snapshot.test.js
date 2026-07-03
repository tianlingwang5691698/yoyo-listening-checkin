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
