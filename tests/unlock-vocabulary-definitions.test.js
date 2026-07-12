const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  formatVocabularyDefinitions,
  formatVocabularyMeaning
} = require('../utils/vocabulary-definitions');

test('同一词性只显示一次并保留不同释义', () => {
  assert.equal(
    formatVocabularyDefinitions(['noun 解决办法', 'noun 解决方案', 'n. 解决方案']),
    'n. 解决办法；解决方案'
  );
});

test('不同词性保持独立且复合词性不拆分', () => {
  assert.equal(
    formatVocabularyDefinitions(['noun 记录', 'verb 记录', 'noun/verb 用法']),
    'n. 记录；v. 记录；n./v. 用法'
  );
});

test('缓存中的已拼接释义同样可以归一化', () => {
  assert.equal(
    formatVocabularyMeaning('adj. 色彩鲜艳的；adj 多彩的；adj. 多彩的'),
    'adj. 色彩鲜艳的；多彩的'
  );
});

test('Unlock 页面与构建脚本都使用词性归一化', () => {
  const root = path.resolve(__dirname, '..');
  const flashcards = fs.readFileSync(path.join(root, 'pages/reading/flashcards/index.js'), 'utf8');
  const builder = fs.readFileSync(path.join(root, 'scripts/build_unlock_vocabulary_books.py'), 'utf8');
  assert.match(flashcards, /formatVocabularyDefinitions\(entry\.definitions\)/);
  assert.match(flashcards, /formatVocabularyMeaning\(item\.meaning\)/);
  assert.match(builder, /def merge_definitions\(definitions\)/);
  assert.match(builder, /current\["definitions"\] = merge_definitions/);
});
