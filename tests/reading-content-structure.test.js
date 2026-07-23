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

test('separates truncated junior cloze directions without inventing missing English', () => {
  const result = structureLegacyReadingContent({
    _id: 'sh-em1-2020-长宁-reading-b',
    passage: 'answer and complete the passage （选择最恰当的选项完成短文） A Simple Act of Gratitude tells a story.'
  });

  assert.equal(result.directions, '选择最恰当的选项完成短文');
  assert.equal(result.articleTitle, '');
  assert.equal(result.passage, 'A Simple Act of Gratitude tells a story.');
  assert.deepEqual(result.passageParagraphs, ['A Simple Act of Gratitude tells a story.']);
});

test('drops previous-section residue before junior section D', () => {
  const result = structureLegacyReadingContent({
    _id: 'sh-em1-2022-长宁-reading-d',
    section: 'D',
    passage: 'read faster and more accurately. s_____77_____ toward helping dyslexics. D. Answer the questions. Sometimes school knowledge becomes useful.'
  });

  assert.equal(result.sectionHeading, 'D');
  assert.equal(result.directions, 'Answer the questions.');
  assert.equal(result.passage, 'Sometimes school knowledge becomes useful.');
});

test('drops next-section residue after junior section C', () => {
  const result = structureLegacyReadingContent({
    _id: 'sh-em1-2022-虹口-reading-c',
    section: 'C',
    passage: ') (14分) Bruce Lee became a new l___76___ of popularity. D. Answer the questions. Real Superheroes begins here.'
  });

  assert.equal(result.passage, 'Bruce Lee became a new l___76___ of popularity.');
  assert.ok(!result.passage.includes('Real Superheroes'));
});

test('separates IELTS title, subtitle and body paragraphs', () => {
  const result = structureLegacyReadingContent({
    _id: 'ielts-academic-10-test-3-reading-passage-2',
    title: 'Autumn leaves',
    passage: 'Canadian writer Jay Ingram investigates the mystery of why leaves turn red in the fall\n\nA One body paragraph.\n\nB Another body paragraph.'
  });

  assert.equal(result.articleTitle, 'Autumn leaves');
  assert.equal(result.articleSubtitle, 'Canadian writer Jay Ingram investigates the mystery of why leaves turn red in the fall');
  assert.deepEqual(result.passageParagraphs, ['A One body paragraph.', 'B Another body paragraph.']);
  assert.equal(result.passage, 'A One body paragraph.\n\nB Another body paragraph.');
});

test('splits IELTS title fields that contain an embedded subtitle', () => {
  const result = structureLegacyReadingContent({
    _id: 'ielts-academic-13-test-2-reading-passage-2',
    title: 'Oxytocin\nThe positive and negative effects of the chemical known as the love hormone',
    passage: 'A First body paragraph.\n\nB Second body paragraph.'
  });

  assert.equal(result.articleTitle, 'Oxytocin');
  assert.equal(result.articleSubtitle, 'The positive and negative effects of the chemical known as the love hormone');
});

test('leaves unaffected natural-paragraph content unchanged', () => {
  const passage = {
    _id: 'sh-em2-clean-reading-a',
    passage: 'First paragraph.\n\nSecond paragraph.'
  };
  assert.equal(structureLegacyReadingContent(passage), passage);
});
