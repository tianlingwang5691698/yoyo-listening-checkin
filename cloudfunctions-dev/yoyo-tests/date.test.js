const test = require('node:test');
const assert = require('node:assert/strict');

const dateLib = require('../lib/date');

test('中国零点按北京时间切换日期', () => {
  assert.equal(dateLib.formatChinaDateFromDate('2026-04-20T15:59:00.000Z'), '2026-04-20');
  assert.equal(dateLib.formatChinaDateFromDate('2026-04-20T16:00:00.000Z'), '2026-04-21');
});

test('日期加减按自然日稳定推进', () => {
  assert.equal(dateLib.addDays('2026-04-30', 1), '2026-05-01');
  assert.equal(dateLib.addDays('2026-05-01', -1), '2026-04-30');
  assert.equal(dateLib.diffDays('2026-05-01', '2026-04-30'), 1);
});
