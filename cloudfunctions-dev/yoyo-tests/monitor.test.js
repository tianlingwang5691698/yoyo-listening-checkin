const test = require('node:test');
const assert = require('node:assert/strict');

const monitor = require('../lib/monitor');

test('monitor 能正确分类常见错误类型', () => {
  assert.equal(monitor.classifyError(new Error('timeout')), 'timeout');
  assert.equal(monitor.classifyError(new Error('SSL alert access denied')), 'ssl');
  assert.equal(monitor.classifyError(new Error('permission denied')), 'permission');
  assert.equal(monitor.classifyError(new Error('cloud.callFunction:fail functions execute fail')), 'cloud');
  assert.equal(monitor.classifyError(new Error('random unknown issue')), 'unknown');
});

test('monitor 对空错误安全返回 unknown', () => {
  assert.equal(monitor.classifyError(null), 'unknown');
  assert.equal(monitor.classifyError(undefined), 'unknown');
  assert.equal(monitor.classifyError(''), 'unknown');
});
