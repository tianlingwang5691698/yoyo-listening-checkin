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
const {
  getActiveListeningLessonKey,
  findListeningContinueTask
} = require('../utils/listening-resume');

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

test('继续学习优先返回上次退出的未完成课程', () => {
  const groups = [{ category: 'peppa', tasks: [
    { category: 'peppa', taskId: 'peppa-1', completedToday: false },
    { category: 'peppa', taskId: 'peppa-2', completedToday: false }
  ] }];
  assert.equal(findListeningContinueTask(groups, {
    category: 'peppa',
    taskId: 'peppa-2'
  }).taskId, 'peppa-2');
  assert.equal(getActiveListeningLessonKey({ targetChildId: 'child-1' }), 'activeListeningLessonV1:child-1');
});

test('最新退出课程即使已完成也优先继续，播放器就绪后恢复 5 秒断点', () => {
  const groups = [{ category: 'peppa', tasks: [
    { category: 'peppa', taskId: 'peppa-1', completedToday: true },
    { category: 'peppa', taskId: 'peppa-2', completedToday: false }
  ] }];
  assert.equal(findListeningContinueTask(groups, {
    category: 'peppa',
    taskId: 'peppa-1'
  }).taskId, 'peppa-1');
  const source = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  assert.match(source, /const preservePreparedPlayer = !!\(/);
  assert.match(source, /if \(this\.data\.audioReady && this\.innerAudioContext && this\.innerAudioContext\.src\) \{\s*await new Promise\(\(resolve\) => wx\.nextTick\(resolve\)\);\s*this\.restoreListeningResumeCheckpoint\(\{ force: true \}\)/);
  assert.match(source, /resumePositionSec = Math\.max\(0, positionSec - LISTENING_RESUME_REWIND_SEC\)/);
});

test('最新退出课程不在今日任务时才回到下一条未完成课程', () => {
  const groups = [{ category: 'peppa', tasks: [
    { category: 'peppa', taskId: 'peppa-1', completedToday: true },
    { category: 'peppa', taskId: 'peppa-2', completedToday: false }
  ] }];
  assert.equal(findListeningContinueTask(groups, {
    category: 'unlock1',
    taskId: 'missing-task'
  }).taskId, 'peppa-2');
});

test('继续学习保留今日任务表为课程页上一层', () => {
  const homeSource = fs.readFileSync(path.join(__dirname, '../pages/home/index.js'), 'utf8');
  const stageSource = fs.readFileSync(path.join(__dirname, '../pages/level-stage/index.js'), 'utf8');
  assert.match(homeSource, /pages\/level-stage\/index[\s\S]*buildListeningResumeQuery\(continueTask, activeLesson\)/);
  assert.match(stageSource, /tryOpenResumeTask\(\)[\s\S]*wx\.nextTick\(\(\) => \{[\s\S]*this\.openTaskByIndex/);
  assert.doesNotMatch(homeSource, /url: buildListeningContinueUrl/);
});

test('继续学习和任务表选课进入课程后都等待手动播放', () => {
  const lessonSource = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  const stageSource = fs.readFileSync(path.join(__dirname, '../pages/level-stage/index.js'), 'utf8');
  assert.doesNotMatch(stageSource, /autoPlay=1|autoPlay: true/);
  assert.match(lessonSource, /this\.pendingAutoPlay = false/);
  assert.doesNotMatch(lessonSource, /query\.autoPlay/);
});

test('手动进入其他课程后立即更新最新继续目标', () => {
  const lessonSource = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  assert.match(lessonSource, /applyTaskSnapshot\(task\)[\s\S]*this\.writeActiveListeningLessonSnapshot\(normalizedTask\);[\s\S]*this\.prefetchTaskAudio/);
  assert.match(lessonSource, /if \(normalizedTask\) \{\s*this\.writeActiveListeningLessonSnapshot\(normalizedTask\);\s*this\.prefetchTaskAudio/);
});

test('任务表手动选择 B 会取消待执行的自动恢复 A', () => {
  const stageSource = fs.readFileSync(path.join(__dirname, '../pages/level-stage/index.js'), 'utf8');
  assert.match(stageSource, /const resumeOpenToken = \+\+this\.resumeOpenToken/);
  assert.match(stageSource, /if \(resumeOpenToken !== this\.resumeOpenToken\) return/);
  assert.match(stageSource, /openTask\(event\)[\s\S]*this\.resumeOpenToken \+= 1;[\s\S]*this\.resumeTaskRequest = null;[\s\S]*this\.openTaskByIndex\(groupIndex, taskIndex\)/);
});

test('音频就绪后等待页面渲染完成再恢复断点', () => {
  const lessonSource = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  assert.match(lessonSource, /this\.setData\(\{[\s\S]*audioReady: true[\s\S]*\}, \(\) => \{\s*setTimeout\(\(\) => \{[\s\S]*this\.restoreListeningResumeCheckpoint\(\)/);
  assert.match(lessonSource, /await new Promise\(\(resolve\) => wx\.nextTick\(resolve\)\);\s*this\.restoreListeningResumeCheckpoint\(\{ force: true \}\)/);
});
