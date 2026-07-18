const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const runtime = require('../utils/ielts-phonetics-v2');
const { resolveVocabularyEntry } = require('../utils/vocabulary-phonetics');

const root = path.resolve(__dirname, '..');
const unusualIpa = /[ɹɚɝ().]|[ɾʔʍɫɨʉɐɘ]|[\u0300-\u036f]/u;

test('雅思 48 个 List 全部使用重建 IPA', () => {
  let total = 0;
  for (let list = 1; list <= 48; list += 1) {
    const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/dictionary-import/ielts-phonetics-v2/ielts', `list-${list}.json`), 'utf8'));
    rows.forEach((row) => {
      total += 1;
      assert.match(row.phonetic, /^\/.+\/$/);
      assert.doesNotMatch(row.phonetic, /[［］\[\]]/);
      assert.doesNotMatch(row.phonetic, unusualIpa);
      assert.ok(row.phoneticSource && row.phoneticSource !== 'missing');
    });
  }
  assert.equal(total, 3554);
  assert.equal(Object.keys(runtime.phonetics).length, 3551);
  Object.values(runtime.phonetics).forEach((phonetic) => assert.doesNotMatch(phonetic, unusualIpa));
  assert.equal(runtime.phonetics.barely, '/ˈbeəli/');
  assert.equal(runtime.phonetics.hierarchy, '/ˈhaɪərɑːki/');
});

test('旧缓存的雅思 OCR 音标和错词头在展示层被替换', () => {
  assert.deepEqual(resolveVocabularyEntry('dictionary-book-ielts-list-1', 'exact', "［rg'zakt］"), { word: 'exact', phonetic: '/ɪɡˈzækt/' });
  const corrected = resolveVocabularyEntry('dictionary-book-ielts-list-48', 'agiie', "［'adsanl］");
  assert.equal(corrected.word, 'agile');
  assert.match(corrected.phonetic, /^\/.+\/$/);
});

test('非雅思词表不受重建索引影响', () => {
  assert.deepEqual(resolveVocabularyEntry('dictionary-book-senior-list-1', 'exact', '/old/'), { word: 'exact', phonetic: '/old/' });
});
