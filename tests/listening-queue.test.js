const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildListeningQueue,
  mergeListeningQueue,
  getNextQueueTask,
  getInitialQueuePass
} = require('../utils/listening-queue');

const tasks = [1, 2, 3].map((index) => ({
  category: 'unlock1thirdedition',
  taskId: `task-${index}`,
  repeatTarget: 3,
  playCount: 0
}));

test('从任意条目开始后按顺序并在末尾回环', () => {
  const queue = buildListeningQueue(tasks, tasks[1]);
  assert.equal(getNextQueueTask(queue, tasks[1]).taskId, 'task-3');
  assert.equal(getNextQueueTask(queue, tasks[2]).taskId, 'task-1');
});

test('未完成条目从已听遍数继续，完成条目新一轮从第一遍开始', () => {
  assert.equal(getInitialQueuePass({ repeatTarget: 3, playCount: 2 }), 2);
  assert.equal(getInitialQueuePass({ repeatTarget: 3, playCount: 3, completedToday: true }), 0);
});

test('进度回写只更新当前条目，不改变当天队列顺序', () => {
  const updated = Object.assign({}, tasks[1], { playCount: 1 });
  const queue = mergeListeningQueue(tasks, [updated], updated);
  assert.deepEqual(queue.map((item) => item.taskId), ['task-1', 'task-2', 'task-3']);
  assert.equal(queue[1].playCount, 1);
});

test('打卡完成后等待音效特效及 3 秒，再播当前条目的下一条', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  assert.match(source, /await this\.showLessonCompletionEffect\(\);[\s\S]*setTimeout\(resolve, 3000\)[\s\S]*getNextQueueTask\(this\.dailyListeningQueue, taskBeforeSave\)/);
});
