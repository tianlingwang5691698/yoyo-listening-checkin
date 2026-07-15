const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getActiveGrammarTaskKey,
  findGrammarContinueTask
} = require('../utils/grammar-resume');

const grammarTasks = [1, 2, 3].map((lessonNumber) => ({
  category: 'grammar',
  taskId: `grammar-noun-${lessonNumber}`,
  topic: 'noun',
  lessonNumber,
  completedToday: lessonNumber === 2
}));
const groups = [{ category: 'grammar', tasks: grammarTasks }];

test('语法计划续学优先恢复最后打开的今日任务', () => {
  assert.equal(findGrammarContinueTask(groups, { taskId: 'grammar-noun-2' }).taskId, 'grammar-noun-2');
  assert.equal(getActiveGrammarTaskKey({ targetChildId: 'child-yoyo' }), 'activeGrammarPlanTaskV1:child-yoyo');
});

test('最后任务已不在今日计划时进入下一条未完成任务', () => {
  assert.equal(findGrammarContinueTask(groups, { taskId: 'grammar-noun-old' }).taskId, 'grammar-noun-1');
  assert.equal(findGrammarContinueTask(groups, null), null);
});

test('计划课堂记录最近任务，首页普通语法入口仍进入语法首页', () => {
  const classroom = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '../pages/home/index.js'), 'utf8');
  const openGrammar = home.match(/  openGrammar\(\) \{[\s\S]*?\n  \},\n  openTest\(\)/);
  assert.match(classroom, /rememberActivePlannedTask\(\)/);
  assert.match(classroom, /wx\.setStorageSync\(getActiveGrammarTaskKey\(target\)/);
  assert.ok(openGrammar);
  assert.match(openGrammar[0], /url: '\/pages\/grammar\/index'/);
  assert.doesNotMatch(openGrammar[0], /grammar-package\/pages\/classroom\/index/);
});
