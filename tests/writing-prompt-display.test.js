const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPromptDisplay } = require('../utils/writing-prompt-display');
const fs = require('node:fs');
const path = require('node:path');
const em1Prompts = require('../data/writing-em1/writing-prompts.json');
const em2Prompts = require('../data/writing-em2/writing-prompts.json');
const prompts = em2Prompts;

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

test('340 道初中写作全部通过结构化与污染清理门禁', () => {
  const forbidden = /Use the following|following points? (?:as|for) (?:a )?reference|Suggested (?:questions|points)|Some words for reference|以下(?:问题|内容).*仅供参考|提示供参考|注意\s*[:：，,]|英语学科试卷|学业质量|质量调研|\bKEY\s*:|\d+\s*[-–]\s*\d+\s+[A-F]{4,}|【分析】|eq\s+\\o\\ac/i;
  const heading = /^\s*(?:VII|Ⅶ)\.?\s*Writing|^\s*\(?共?\d+分\)?\s*\d{1,3}[.．]|^\s*\d{1,3}[.．]\s*Write/i;

  assert.equal(em1Prompts.length + em2Prompts.length, 340);
  for (const prompt of [...em1Prompts, ...em2Prompts]) {
    const display = buildPromptDisplay(prompt);
    const visibleText = [display.scenario, ...display.requirements].join(' ');
    assert.ok(display.scenario || display.requirements.length, prompt._id);
    assert.doesNotMatch(visibleText, forbidden, prompt._id);
    assert.doesNotMatch(display.scenario, heading, prompt._id);
  }
});

test('高中写作与翻译全部保持独立结构', () => {
  const items = [
    ...require('../data/writing-senior-spring/writing-prompts.json'),
    ...require('../data/writing-senior-autumn/writing-prompts.json')
  ];

  assert.equal(items.length, 71);
  for (const item of items) {
    if (item.contentType === 'translation') {
      assert.ok(Array.isArray(item.questions) && item.questions.length, item._id);
    } else {
      const display = buildPromptDisplay(item);
      assert.ok(display.scenario, item._id);
      assert.doesNotMatch(display.scenario, /内容(?:必须)?包括\s*[:：]/, item._id);
    }
  }
});

test('高中 Summary Writing 标题、正文段落和污染全部清洗', () => {
  const items = [
    ...require('../data/writing-senior-spring/writing-prompts.json'),
    ...require('../data/writing-senior-autumn/writing-prompts.json')
  ].filter((item) => item.contentType === 'summary-writing');

  assert.equal(items.length, 18);
  assert.equal(items.filter((item) => item.articleTitle).length, 14);
  assert.equal(items.filter((item) => !item.articleTitle).length, 4);
  assert.equal(items.reduce((sum, item) => sum + item.articleParagraphs.length, 0), 77);
  for (const item of items) {
    assert.equal(item.contentRevision, 2, item._id);
    assert.ok(item.articleParagraphs.length >= 3, item._id);
    assert.equal(item.scenario, item.articleParagraphs.join('\n\n'), item._id);
    assert.doesNotMatch(item.scenario, /https?:\/\/|_{3,}|第\s*\d+\s*页/, item._id);
    if (item.articleTitle) assert.ok(!item.scenario.startsWith(item.articleTitle), item._id);

    const legacy = {
      ...item,
      articleTitle: undefined,
      articleParagraphs: undefined,
      scenario: `${item.articleTitle ? `${item.articleTitle} ` : ''}${item.articleParagraphs.join(' ')} 71.________`
    };
    const display = buildPromptDisplay(legacy);
    assert.equal(display.articleTitle, item.articleTitle, item._id);
    assert.deepEqual(display.articleParagraphs, item.articleParagraphs, item._id);
  }
});

test('IELTS 96 道写作全部为 v3 结构化数据', () => {
  const items = [];
  for (let book = 10; book <= 21; book += 1) {
    const directory = path.join(__dirname, '..', 'data', 'ielts-academic', `cambridge-${book}`, 'writing', 'items-v3');
    for (const name of fs.readdirSync(directory).filter((file) => file.endsWith('.json'))) {
      items.push(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
    }
  }

  assert.equal(items.length, 96);
  assert.ok(items.every((item) => item.dataFormat === 'structured-text-v3' && item.scenario && item.requirements.length));
  assert.equal(items.filter((item) => item.contentType === 'ielts-writing-task-1' && item.images.length === 1).length, 48);
  assert.equal(items.filter((item) => item.contentType === 'ielts-writing-task-2' && item.images.length === 0).length, 48);
});
