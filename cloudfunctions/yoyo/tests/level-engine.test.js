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
