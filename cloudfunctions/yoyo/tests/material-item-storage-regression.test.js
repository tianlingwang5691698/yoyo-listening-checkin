const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.join(__dirname, '..', 'services', 'catalog.service.js');
const source = fs.readFileSync(servicePath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const directory = require('../data/material-directory.json');

test('听力与写作目录使用轻量摘要且详情优先按 id 读取单条文件', () => {
  assert.match(source, /loadBundledMaterialIndex\(\)/);
  assert.match(source, /loadMaterialItem\(moduleId, itemId\)/);
  assert.match(source, /downloadMaterialItemJson/);
  assert.match(source, /items-v1/);
  assert.doesNotMatch(source.split('\n').slice(0, 5).join('\n'), /shared\.service|storage\.adapter/);
  assert.match(indexSource, /'getMaterialIndex'/);
  assert.equal(directory.listeningEm1.length, 67);
  assert.equal(directory.listeningEm2.length, 76);
  assert.equal(directory.writingEm1.length, 159);
  assert.equal(directory.writingEm2.length, 181);
  assert.equal(Object.hasOwn(directory.listeningEm2[0], 'questions'), false);
  assert.equal(Object.hasOwn(directory.writingEm2[0], 'prompt'), false);
});
