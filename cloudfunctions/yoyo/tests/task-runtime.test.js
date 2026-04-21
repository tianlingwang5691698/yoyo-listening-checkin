const test = require('node:test');
const assert = require('node:assert/strict');

const taskRuntime = require('../lib/task-runtime');

test('老进度记录缺少 completedToday 时，按 playCount 补齐完成态', () => {
  const progress = taskRuntime.getTaskProgressForDate([
    {
      childId: 'child-1',
      category: 'peppa',
      date: '2026-04-20',
      taskId: 'peppa-1',
      playCount: 3,
      repeatTarget: 3
    }
  ], 'child-1', 'peppa', '2026-04-20', 'peppa-1');

  assert.equal(progress.completedToday, true);
  assert.equal(progress.textUnlocked, true);
  assert.equal(progress.playCount, 3);
});
