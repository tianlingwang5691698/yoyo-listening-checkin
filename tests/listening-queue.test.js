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
  resolveListeningCheckpointSeconds,
  findListeningContinueTask
} = require('../utils/listening-resume');
const {
  addEffectiveListeningSeconds,
  getRequiredListeningSeconds,
  hasEffectiveListeningCompleted
} = require('../utils/effective-listening');

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

test('最新退出课程即使已完成也优先继续，播放器就绪后精确恢复断点', () => {
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
  assert.match(source, /LISTENING_RESUME_REWIND_SEC = 0/);
  assert.doesNotMatch(source, /currentSeconds >= durationSeconds - 2/);
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

test('真机销毁播放器后 currentTime 归零仍使用最后有效断点', () => {
  const lastKnown = { key: 'lesson-a', positionSec: 83.4 };
  assert.equal(resolveListeningCheckpointSeconds(0, 'lesson-a', lastKnown), 83.4);
  assert.equal(resolveListeningCheckpointSeconds(0, 'lesson-b', lastKnown), 0);
  assert.equal(resolveListeningCheckpointSeconds(91.2, 'lesson-a', lastKnown), 91.2);
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

test('所有带进度条的长音频播放器均支持拖拽定位', () => {
  const lessonWxml = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.wxml'), 'utf8');
  const lessonSource = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  const materialWxml = fs.readFileSync(path.join(__dirname, '../pages/material/detail/index.wxml'), 'utf8');
  const grammarWxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.equal((lessonWxml.match(/bindchanging="changingAudioProgress"/g) || []).length, 2);
  assert.equal((lessonWxml.match(/bindchange="changeAudioProgress"/g) || []).length, 2);
  assert.match(lessonSource, /changingAudioProgress\(event\)[\s\S]*changeAudioProgress\(event\)/);
  assert.match(lessonSource, /saveListeningResumeCheckpoint\(\{ force: true, positionSec: currentSeconds \}\)/);
  assert.match(materialWxml, /bindchanging="changingAudioProgress"[\s\S]*bindchange="changeAudioProgress"/);
  assert.match(grammarWxml, /bindchanging="previewNarrationSeek" bindchange="seekNarration"/);
});

test('拖拽不计有效听力，实际播放达到九成才完成一遍', () => {
  const afterSeek = addEffectiveListeningSeconds(0, {
    previousAudioSec: 10,
    currentAudioSec: 290,
    elapsedMs: 300,
    durationSec: 300,
    isPlaying: true
  });
  const afterNaturalPlay = addEffectiveListeningSeconds(afterSeek, {
    previousAudioSec: 10,
    currentAudioSec: 11,
    elapsedMs: 1000,
    durationSec: 300,
    isPlaying: true
  });
  assert.equal(afterSeek, 0);
  assert.equal(afterNaturalPlay, 1);
  assert.equal(getRequiredListeningSeconds(300), 270);
  assert.equal(hasEffectiveListeningCompleted(269.9, 300), false);
  assert.equal(hasEffectiveListeningCompleted(270, 300), true);
  const lessonSource = fs.readFileSync(path.join(__dirname, '../pages/lesson/index.js'), 'utf8');
  assert.match(lessonSource, /effectiveListeningSec:[\s\S]*effectiveListeningPassKey:/);
  assert.match(lessonSource, /if \(!hasEffectiveListeningCompleted\(this\.effectiveListeningSeconds, durationSeconds\)\)/);
});
