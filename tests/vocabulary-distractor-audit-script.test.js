const assert = require('node:assert/strict');
const test = require('node:test');
const { enumerateSources, makeBatches, normalizeAudit } = require('../scripts/audit_all_vocabulary_distractors_gpt');

test('全量审计覆盖 283 个正式词汇来源', () => {
  const sources = enumerateSources();
  assert.equal(sources.length, 283);
  assert.equal(new Set(sources.map((item) => item.sourceId)).size, 283);
  assert.equal(sources.filter((item) => item.sourceId.includes('junior-list-')).length, 32);
  assert.equal(sources.filter((item) => item.sourceId.includes('senior-list-')).length, 40);
  assert.equal(sources.filter((item) => item.sourceId.includes('cet4-list-')).length, 35);
  assert.equal(sources.filter((item) => item.sourceId.includes('ielts-list-')).length, 48);
  assert.equal(sources.filter((item) => /^dictionary-book-unlock-\d/.test(item.sourceId)).length, 64);
  assert.equal(sources.filter((item) => /^dictionary-book-unlock-v3-/.test(item.sourceId)).length, 64);
});

test('审计批次不拆分单个来源', () => {
  const sources = [
    { sourceId: 'a', wordCount: 100 },
    { sourceId: 'b', wordCount: 70 },
    { sourceId: 'c', wordCount: 30 }
  ];
  assert.deepEqual(makeBatches(sources).map((batch) => batch.map((item) => item.sourceId)), [['a', 'b'], ['c']]);
});

test('GPT 返回必须逐来源与逐词数完整', () => {
  const source = {
    sourceId: 'dictionary-book-junior-list-1',
    cloudPath: 'x.json',
    fingerprint: 'hash',
    wordCount: 2,
    words: [{ wordLower: 'one' }, { wordLower: 'two' }]
  };
  assert.throws(() => normalizeAudit([source], { sources: [] }), /audit-source-count/);
  assert.throws(() => normalizeAudit([source], { sources: [{ sourceId: source.sourceId, reviewedWordCount: 1 }] }), /audit-word-count/);
});
