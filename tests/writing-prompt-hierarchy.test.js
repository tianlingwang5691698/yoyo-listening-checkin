const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildPromptDisplay,
  buildPromptSections
} = require('../utils/writing-prompt-display');

const root = path.resolve(__dirname, '..');
const labels = {
  directionsTitle: '作答说明',
  taskTitle: '写作任务',
  requirementsTitle: '写作要点',
  noticeTitle: '注意事项',
  starterTitle: '开头提示'
};

function sectionsFor(prompt) {
  return buildPromptSections(buildPromptDisplay(prompt, labels), labels);
}

test('初中、高中和 IELTS 作文使用统一语义层级', () => {
  const junior = require('../data/writing-em2/writing-prompts.json')
    .find((item) => item._id === 'sh-em2-2012-宝山-writing');
  const senior = require('../data/writing-senior-spring/writing-prompts.json')
    .find((item) => item._id === 'sh-spring-2022-writing');
  const summary = require('../data/writing-senior-spring/writing-prompts.json')
    .find((item) => item.contentType === 'summary-writing' && item.articleTitle);
  const ielts = require('../data/ielts-academic/cambridge-21/writing/items-v3/6b99daff9ba420ce7a2a1e6eb905ba033dbee57d.json');

  assert.deepEqual(sectionsFor(junior).map((item) => item.type), ['task', 'requirements', 'notice']);
  assert.deepEqual(sectionsFor(senior).map((item) => item.type), ['directions', 'task', 'requirements']);
  assert.deepEqual(sectionsFor(ielts).map((item) => item.type), ['directions', 'task', 'requirements']);

  const summarySections = sectionsFor(summary);
  assert.deepEqual(summarySections.map((item) => item.type), ['directions', 'task']);
  assert.equal(summarySections[1].articleTitle, summary.articleTitle);
  assert.equal(summarySections[1].items.length, summary.articleParagraphs.length);
});

test('全量作文题纸区块顺序稳定且要点独立编号', () => {
  const junior = [
    ...require('../data/writing-em1/writing-prompts.json'),
    ...require('../data/writing-em2/writing-prompts.json')
  ];
  const senior = [
    ...require('../data/writing-senior-spring/writing-prompts.json'),
    ...require('../data/writing-senior-autumn/writing-prompts.json')
  ].filter((item) => item.contentType !== 'translation');
  const ielts = [];

  for (let book = 10; book <= 21; book += 1) {
    const directory = path.join(root, 'data', 'ielts-academic', `cambridge-${book}`, 'writing', 'items-v3');
    for (const name of fs.readdirSync(directory).filter((file) => file.endsWith('.json'))) {
      ielts.push(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
    }
  }

  assert.equal(junior.length, 340);
  assert.equal(senior.length, 44);
  assert.equal(ielts.length, 96);
  for (const prompt of [...junior, ...senior, ...ielts]) {
    const sections = sectionsFor(prompt);
    const types = sections.map((item) => item.type);
    assert.ok(types.includes('task'), prompt._id);
    assert.deepEqual(types, ['directions', 'task', 'requirements', 'notice', 'starter'].filter((type) => types.includes(type)), prompt._id);
    const requirements = sections.find((item) => item.type === 'requirements');
    if (requirements) {
      assert.ok(requirements.items.every((item, index) => item.marker === String(index + 1)), prompt._id);
    }
  }
});

test('两套页面分支和四主题均接入作文题纸层级样式', () => {
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxss'), 'utf8');

  assert.equal((template.match(/class="writing-prompt-structure"/g) || []).length, 2);
  assert.equal((template.match(/section\.type === 'task'/g) || []).length, 2);
  assert.match(styles, /\.writing-prompt-section\.type-directions/);
  assert.match(styles, /\.writing-library-page \.writing-prompt-section/);
  assert.match(styles, /\.theme-voyage \.writing-prompt-section/);
  assert.match(styles, /\.theme-dragon \.writing-prompt-section/);
});
