const test = require('node:test');
const assert = require('node:assert/strict');

const levelEngine = require('../lib/level-engine');

test('resolveStandaloneCategoryTasks 优先使用已刷新的目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('unlock2', 'child-1', '2026-07-03', {
    getCatalog: (category) => category === 'unlock2' ? [{
      taskId: 'unlock2-1',
      category: 'unlock2',
      title: 'Unlock 2 Track 1'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taskId, 'unlock2-1');
  assert.equal(tasks[0].planRunType, 'level');
});

test('resolveStandaloneCategoryTasks 支持 Pre A1 Little Bear 静态目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('littlebear', 'child-1', '2026-07-14', {
    getCatalog: (category) => category === 'littlebear' ? [{
      taskId: 'little-bear-010',
      category: 'littlebear',
      title: 'Up All Night'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, 'littlebear');
  assert.equal(tasks[0].planRunType, 'level');
});

test('resolveStandaloneCategoryTasks 支持 Unlock4 练习册独立目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('unlock4workbook', 'child-1', '2026-07-09', {
    getCatalog: (category) => category === 'unlock4workbook' ? [{
      taskId: 'unlock4workbook-1',
      category: 'unlock4workbook',
      title: 'Unlock 4 Workbook Track 1'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, 'unlock4workbook');
  assert.equal(tasks[0].planRunType, 'level');
});

test('resolveStandaloneCategoryTasks 支持 Unlock1 第三版独立目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('unlock1thirdedition', 'child-1', '2026-07-10', {
    getCatalog: (category) => category === 'unlock1thirdedition' ? [{
      taskId: 'unlock1thirdedition-1',
      category: 'unlock1thirdedition',
      title: 'Unlock 1 Third Edition Track 1'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, 'unlock1thirdedition');
  assert.equal(tasks[0].planRunType, 'level');
});

test('resolveStandaloneCategoryTasks 支持 Unlock3 第三版静态目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('unlock3thirdedition', 'child-1', '2026-07-11', {
    getCatalog: (category) => category === 'unlock3thirdedition' ? [{
      taskId: 'unlock3thirdedition-1',
      category: 'unlock3thirdedition',
      title: 'Unlock 3 Third Edition Track 1'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, 'unlock3thirdedition');
  assert.equal(tasks[0].planRunType, 'level');
});

test('resolveStandaloneCategoryTasks 支持 Unlock4 第三版静态目录', async () => {
  const tasks = await levelEngine.resolveStandaloneCategoryTasks('unlock4thirdedition', 'child-1', '2026-07-11', {
    getCatalog: (category) => category === 'unlock4thirdedition' ? [{
      taskId: 'unlock4thirdedition-1',
      category: 'unlock4thirdedition',
      title: 'Unlock 4 Third Edition Track 1'
    }] : [],
    storageRootCandidates: {},
    storageRoots: {},
    listDirectoryFiles: async () => {
      throw new Error('should not scan storage');
    }
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, 'unlock4thirdedition');
  assert.equal(tasks[0].planRunType, 'level');
});
