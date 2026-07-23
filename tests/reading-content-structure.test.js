const test = require('node:test');
const assert = require('node:assert/strict');

const { structureLegacyReadingContent } = require('../utils/reading-content-structure');

test('separates senior section heading, title and page watermark from passage', () => {
  const result = structureLegacyReadingContent({
    _id: 'sh-spring-2026-reading-a',
    passage: 'II. Reading Comprehension （15 分） Passive vs.Active Solar Energy Solar energy has two types. Passive solar energy 41 smart 第2页（共11页） building design.'
  });

  assert.equal(result.sectionHeading, 'II. Reading Comprehension （15 分）');
  assert.equal(result.articleTitle, 'Passive vs. Active Solar Energy');
  assert.equal(result.passage, 'Solar energy has two types. Passive solar energy 41 building design.');
});

test('separates junior question directions from the real passage', () => {
  const result = structureLegacyReadingContent({
    _id: 'sh-em1-2014-宝山-reading-a',
    passage: 'answer（根据短文内容，选择最恰当的答案） ( 12分) A mother saved her baby.'
  });

  assert.equal(result.directions, '根据短文内容，选择最恰当的答案');
  assert.equal(result.passage, 'A mother saved her baby.');
});

test('leaves unaffected natural-paragraph content unchanged', () => {
  const passage = {
    _id: 'sh-em2-clean-reading-a',
    passage: 'First paragraph.\n\nSecond paragraph.'
  };
  assert.equal(structureLegacyReadingContent(passage), passage);
});
