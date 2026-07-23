const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('学习模块的页内层级返回使用统一大号热区', () => {
  const appStyles = read('app.wxss');
  assert.match(appStyles, /\.hierarchy-back\.hierarchy-back\s*\{[\s\S]*?min-height:\s*68rpx/);
  assert.match(appStyles, /\.hierarchy-back\.hierarchy-back\s*\{[\s\S]*?padding:\s*0 22rpx/);
  assert.match(appStyles, /\.hierarchy-back\.hierarchy-back\s*\{[\s\S]*?font-size:\s*28rpx/);

  const templates = {
    grammar: read('pages/grammar/index.wxml'),
    reading: read('pages/reading/index.wxml'),
    writing: read('pages/material/index.wxml'),
    speaking: read('pages/speaking/index.wxml'),
    vocabulary: read('pages/reading/flashcards/index.wxml')
  };

  assert.equal((templates.grammar.match(/hierarchy-back/g) || []).length, 16);
  assert.equal((templates.reading.match(/hierarchy-back/g) || []).length, 2);
  assert.equal((templates.writing.match(/hierarchy-back/g) || []).length, 9);
  assert.equal((templates.speaking.match(/hierarchy-back/g) || []).length, 8);
  assert.equal((templates.vocabulary.match(/hierarchy-back/g) || []).length, 2);
});

test('顶部系统导航返回不被页内层级样式改写', () => {
  const practice = read('pages/reading/flashcards/practice/index.wxml');
  const recognition = read('pages/reading/flashcards/recognition/index.wxml');
  const dictation = read('pages/reading/flashcards/dictation/index.wxml');

  assert.doesNotMatch(practice, /word-practice-back hierarchy-back/);
  assert.doesNotMatch(recognition, /recognition-back hierarchy-back/);
  assert.doesNotMatch(dictation, /dictation-back hierarchy-back/);
});
