const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../pages/reading/flashcards/index.js'), 'utf8');

test('flashcard completion reward is scoped by the current plan limits', () => {
  assert.match(source, /new-\$\{newLimit\}:review-\$\{reviewLimit\}/);
  assert.match(source, /onceKey: buildCompletionRewardKey\(this\.data\)/);
});
