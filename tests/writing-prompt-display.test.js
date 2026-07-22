const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPromptDisplay } = require('../utils/writing-prompt-display');
const prompts = require('../data/writing-em2/writing-prompts.json');

test('初中写作题干、参考问题和注意事项分区展示', () => {
  const display = buildPromptDisplay(prompts.find((item) => item._id === 'sh-em2-2012-宝山-writing'));

  assert.equal(display.requirements.length, 2);
  assert.equal(display.requirements[0], 'Why is fast food so popular in China?');
  assert.equal(display.requirements[1], 'What do you think of fast food?');
  assert.equal(display.notices.length, 1);
  assert.doesNotMatch(display.scenario, /注意|英语学科试卷/);
});

test('未编号的初中参考问题按问号拆分', () => {
  const display = buildPromptDisplay(prompts.find((item) => item._id === 'sh-em2-2012-普陀-writing'));

  assert.equal(display.requirements.length, 3);
  assert.ok(display.requirements.every((item) => /\?$/.test(item)));
});
