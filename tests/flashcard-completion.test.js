const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../pages/reading/flashcards/index.js'), 'utf8');

test('flashcard completion reward is scoped by the current plan limits', () => {
  assert.match(source, /new-\$\{newLimit\}:review-\$\{reviewLimit\}/);
  assert.match(source, /onceKey: buildCompletionRewardKey\(this\.data\)/);
});

test('flashcard completion shows new and review counts in both themes', () => {
  const wxml = fs.readFileSync(path.resolve(__dirname, '../pages/reading/flashcards/index.wxml'), 'utf8');
  assert.equal((wxml.match(/texts\.completeNew/g) || []).length, 2);
  assert.equal((wxml.match(/texts\.completeReview/g) || []).length, 2);
  assert.ok((wxml.match(/\{\{newDueCount\}\}/g) || []).length >= 2);
  assert.ok((wxml.match(/\{\{reviewDueCount\}\}/g) || []).length >= 2);
});
