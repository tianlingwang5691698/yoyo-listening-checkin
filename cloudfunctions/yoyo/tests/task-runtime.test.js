const test = require('node:test');
const assert = require('node:assert/strict');

const taskRuntime = require('../lib/task-runtime');
const shared = require('../services/shared.service');

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

test('当天已打卡但已有 Peppa 复听记录时继续展示复听任务', () => {
  const options = shared.getPeppaReviewPlanOptions([
    {
      childId: 'child-1',
      category: 'peppa',
      date: '2026-05-06',
      taskId: 'peppa-1__review_20_1',
      playCount: 1,
      repeatTarget: 1,
      completedToday: true
    }
  ], [
    { childId: 'child-1', date: '2026-05-06', planDayIndex: 20 }
  ], 'child-1', '2026-05-06');

  assert.equal(options.includePeppaReview, true);
});
