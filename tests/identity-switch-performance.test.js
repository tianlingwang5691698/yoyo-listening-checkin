const assert = require('node:assert/strict');
const test = require('node:test');

const storage = new Map();

global.wx = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  }
};

const store = require('../utils/store');

test.beforeEach(() => {
  storage.clear();
});

test('切回家长时立即恢复上次学生目标，失败可回滚', () => {
  storage.set('yoyoDeviceStudyRoleV1', 'student');
  storage.set('yoyoLastParentStudentTargetV1', {
    targetFamilyId: 'family-parent',
    targetChildId: 'child-parent'
  });

  const prepared = store.prepareStudyRoleSwitch('parent');

  assert.equal(store.getDeviceStudyRole(), 'parent');
  assert.deepEqual(store.getSelectedStudentTarget(), {
    targetFamilyId: 'family-parent',
    targetChildId: 'child-parent'
  });

  store.restoreStudyRoleSwitch(prepared);
  assert.equal(store.getDeviceStudyRole(), 'student');
  assert.deepEqual(store.getSelectedStudentTarget(), {
    targetFamilyId: '',
    targetChildId: ''
  });
});

test('切到学生时立即清空家长目标，失败可恢复', () => {
  storage.set('yoyoDeviceStudyRoleV1', 'parent');
  storage.set('yoyoSelectedStudentTargetV1', {
    targetFamilyId: 'family-parent',
    targetChildId: 'child-parent'
  });

  const prepared = store.prepareStudyRoleSwitch('student');

  assert.equal(store.getDeviceStudyRole(), 'student');
  assert.deepEqual(store.getSelectedStudentTarget(), {
    targetFamilyId: '',
    targetChildId: ''
  });

  store.restoreStudyRoleSwitch(prepared);
  assert.equal(store.getDeviceStudyRole(), 'parent');
  assert.deepEqual(store.getSelectedStudentTarget(), {
    targetFamilyId: 'family-parent',
    targetChildId: 'child-parent'
  });
});
