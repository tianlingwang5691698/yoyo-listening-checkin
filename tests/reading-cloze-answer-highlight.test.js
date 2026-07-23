const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
const {
  isAnswerSentenceHighlightExcluded,
  canHighlightReadingAnswers,
  resolveReadingHighlightMode
} = require('../utils/reading-highlight-mode');

test('填空阅读禁止答案句模式，选择题保持原行为', () => {
  const cloze = { isClozePassage: true };
  const choice = { isClozePassage: false };

  assert.equal(resolveReadingHighlightMode(cloze, 'answer'), 'none');
  assert.equal(resolveReadingHighlightMode(cloze, 'all'), 'all');
  assert.equal(resolveReadingHighlightMode(choice, 'answer'), 'answer');
  assert.equal(canHighlightReadingAnswers(cloze), false);
  assert.equal(canHighlightReadingAnswers(choice), true);
});

test('高中语篇选词和阅读完形同样禁止答案句高亮', () => {
  const wordBank = {
    section: 'Grammar-Vocabulary-B',
    sectionLabel: 'Grammar and Vocabulary Section B',
    passage: 'Businesses relied on (31) ________ surveys.',
    questions: [{ number: 31, prompt: 'Blank 31', questionType: 'choice' }]
  };
  const seniorCloze = {
    section: 'A',
    sectionLabel: 'Reading Section A',
    passage: 'Solar energy 41 building design and materials.',
    questions: [
      { number: 41, prompt: 'Blank 41', questionType: 'choice' },
      { number: 42, prompt: 'Blank 42', questionType: 'choice' }
    ]
  };
  const sentenceMatching = {
    section: 'C-Matching',
    sectionLabel: 'Reading Section C',
    passage: 'She later studied in China. (67) ________',
    questions: [{ number: 67, prompt: 'Blank 67', questionType: 'choice' }]
  };
  const normalChoice = {
    section: 'BA',
    sectionLabel: 'Reading Section B (A)',
    passage: 'A complete article without numbered blanks.',
    questions: [{ number: 56, prompt: 'What is the main idea?', questionType: 'choice' }]
  };

  assert.equal(isAnswerSentenceHighlightExcluded(wordBank), true);
  assert.equal(isAnswerSentenceHighlightExcluded(seniorCloze), true);
  assert.equal(isAnswerSentenceHighlightExcluded(sentenceMatching), true);
  assert.equal(canHighlightReadingAnswers(wordBank), false);
  assert.equal(resolveReadingHighlightMode(wordBank, 'answer'), 'none');
  assert.equal(canHighlightReadingAnswers(normalChoice), true);
});

test('填空阅读的原文构建和四主题入口都共用结构门禁', () => {
  assert.match(source, /includeAnswerHighlight !== false && review/);
  assert.match(source, /resolveReadingHighlightMode\(submittedPassage, 'answer'\)/);
  assert.match(source, /canHighlightAnswers,\n\s+questions/);
  assert.equal((template.match(/passage\.canHighlightAnswers \|\| item\.key !== 'answer'/g) || []).length, 2);
  assert.equal((template.match(/class="cloze-evidence"/g) || []).length, 2);
});
