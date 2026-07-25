const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { findClozeBlanks, normalizeClozeBlankMarkers } = require('../utils/reading-cloze-display');
const { splitReadingSentenceRanges } = require('../utils/reading-sentence-ranges');
const { structureLegacyReadingContent } = require('../utils/reading-content-structure');

const root = path.resolve(__dirname, '..');

test('旧高中填空把重复错位题号恢复到括号提示词位置', () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({
    number: index + 21,
    questionType: 'blank'
  }));
  const source = 'Researchers found _____26_____.\n\n24% of shoes carry bacteria.E.coli.These are not things 26 （bring） inside. Kids run for 30 seconds.Plus: 30 （few） things are sadder.';
  const normalized = normalizeClozeBlankMarkers(source, questions);
  assert.match(normalized, /found 24%/);
  assert.match(normalized, /things _____26_____ （bring）/);
  assert.match(normalized, /30 seconds/);
  assert.match(normalized, /Plus: _____30_____ （few）/);
  assert.deepEqual(findClozeBlanks(normalized, questions).map((item) => item.number), [26, 30]);

  const structured = structureLegacyReadingContent({
    _id: 'sh-spring-2026-grammar-vocabulary-a',
    passage: source,
    questions
  });
  assert.match(structured.passage, /things _____26_____ （bring）/);
  assert.match(structured.passage, /30 seconds/);
});

test('初中首字母填空按权威题目顺序恢复重复题号', () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'data/reading-em1/reading-passages.json'), 'utf8'));
  const item = items.find((entry) => entry._id === 'sh-em1-2020-杨浦-reading-c');
  const normalized = normalizeClozeBlankMarkers(item.passage, item.questions);
  const blanks = findClozeBlanks(normalized, item.questions);
  assert.deepEqual(blanks.map((blank) => blank.number), [81, 82, 83, 84, 85, 86, 87]);
  assert.match(normalized, /s_____81_____/);
  assert.match(normalized, /m_____82_____/);
  assert.equal(blanks.filter((blank) => blank.number === 82).length, 1);
});

test('首字母空位数量与题目数量不一致时不猜测重排', () => {
  const questions = [81, 82, 83].map((number) => ({ number, questionType: 'blank' }));
  const source = 'One a____81____ and two b____81____.';
  assert.equal(normalizeClozeBlankMarkers(source, questions), source);
});

test('无空格英文句号仍按当前句切分，缩写内部句号不切分', () => {
  const source = 'The sample contained E.coli.These findings matter.Sure，the next sentence starts here.';
  const sentences = splitReadingSentenceRanges(source).map((range) => source.slice(range.start, range.end).trim());
  assert.deepEqual(sentences, [
    'The sample contained E.coli.',
    'These findings matter.',
    'Sure，the next sentence starts here.'
  ]);
});

test('2026 春考第 26 与 30 空位可直接作答', () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'data/reading-senior-spring/reading-passages.json'), 'utf8'));
  const item = items.find((entry) => entry._id === 'sh-spring-2026-grammar-vocabulary-a');
  assert.equal(item.contentRevision, 4);
  assert.match(item.passage, /things _____26_____ （bring）/);
  assert.match(item.passage, /dignity： _____30_____ （few）/);
  assert.doesNotMatch(item.passage, /found _____26_____/);
  assert.equal(item.passageParagraphs.join('\n\n'), item.passage);
});

test('龙珠初中高中 IELTS 共用实体标记色，不继承雾蓝短语色', () => {
  const styles = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxss'), 'utf8');
  assert.match(styles, /\.theme-dragon \.reading-mark-word\s*\{[^}]*background:\s*#ffe36f/);
  assert.match(styles, /\.theme-dragon \.reading-mark-phrase\s*\{[^}]*background:\s*#ffbd73/);
  assert.match(styles, /\.theme-dragon \.reading-mark-sentence-token\s*\{[^}]*background:\s*#d9edc5/);
});

test('高中生成器、清洗规则与回归门禁同步', () => {
  const builder = fs.readFileSync(path.join(root, 'scripts/build_shanghai_senior_gaokao_content.py'), 'utf8');
  const cleaner = fs.readFileSync(path.join(root, 'scripts/reading_content_structure.py'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'docs/SHANGHAI_SENIOR_STRUCTURING_RULES.md'), 'utf8');
  assert.match(builder, /normalize_numbered_blank_markers\(passage/);
  assert.match(cleaner, /inline-blank-position/);
  assert.match(rules, /每个真实题号必须恰好对应一个文内输入框/);
  assert.match(rules, /文内空位错位=0/);
});

test('初中首字母错号恢复规则与清洗器同步', () => {
  const cleaner = fs.readFileSync(path.join(root, 'scripts/reading_content_structure.py'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'docs/SHANGHAI_EM2_STRUCTURING_RULES.md'), 'utf8');
  assert.match(cleaner, /normalize_initial_cloze_marker_sequence/);
  assert.match(rules, /正文空位数量与题目数量一致/);
  assert.match(rules, /每个题号恰好生成一个输入框/);
});
