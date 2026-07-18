const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildMeaningOptions,
  buildRecognitionQuestions
} = require('../utils/vocabulary-recognition');

const cards = [
  { key: 'evidence', word: 'evidence', meaning: 'n. 证据；证明' },
  { key: 'freedom', word: 'freedom', meaning: 'n. 自由' },
  { key: 'relation', word: 'relation', meaning: 'n. 关系；联系' },
  { key: 'activity', word: 'activity', meaning: 'n. 活动' },
  { key: 'confirm', word: 'confirm', meaning: 'v. 证实；确认' }
];

test('词义选项只使用真实词条且不重复', () => {
  const options = buildMeaningOptions(cards, cards[0], () => 0.25);
  assert.equal(options.length, 4);
  assert.equal(options.filter((item) => item.correct).length, 1);
  assert.equal(new Set(options.map((item) => item.text)).size, 4);
  options.forEach((item) => assert.ok(cards.some((card) => card.meaning === item.text)));
});

test('识义练习为每题生成四个选项', () => {
  const questions = buildRecognitionQuestions(cards, 3, () => 0.4);
  assert.equal(questions.length, 3);
  questions.forEach((item) => assert.equal(item.options.length, 4));
});

test('近义表述不作为错误选项', () => {
  const rows = [
    { key: 'important', meaning: 'adj. 重要的' },
    { key: 'main', meaning: 'adj. 主要的' },
    { key: 'free', meaning: 'adj. 自由的' },
    { key: 'quiet', meaning: 'adj. 安静的' },
    { key: 'active', meaning: 'adj. 活跃的' }
  ];
  const options = buildMeaningOptions(rows, rows[0], () => 0.25);
  assert.equal(options.length, 4);
  assert.ok(!options.some((item) => item.key === 'main'));
});

test('同词性候选足够时不混入其他词性', () => {
  const rows = [
    { key: 'target', meaning: 'adj. 温暖的' },
    { key: 'quiet', meaning: 'adj. 安静的' },
    { key: 'active', meaning: 'adj. 活跃的' },
    { key: 'distant', meaning: 'adj. 遥远的' },
    { key: 'journey', meaning: 'n. 旅行' }
  ];
  const options = buildMeaningOptions(rows, rows[0], () => 0.2);
  assert.ok(options.filter((item) => !item.correct).every((item) => item.key !== 'journey'));
});

test('语义同组表述不互为干扰项', () => {
  const rows = [
    { key: 'on', meaning: 'prep. 在…地方；关于' },
    { key: 'spot', meaning: 'n. 场所，地点' },
    { key: 'free', meaning: 'adj. 自由的' },
    { key: 'quiet', meaning: 'adj. 安静的' },
    { key: 'active', meaning: 'adj. 活跃的' }
  ];
  const options = buildMeaningOptions(rows, rows[0], () => 0.2);
  assert.equal(options.length, 4);
  assert.ok(!options.some((item) => item.key === 'spot'));
});

test('GPT 审核确认的歧义词对不互为干扰项', () => {
  const rows = [
    { key: 'bit', word: 'bit', meaning: 'n. 一点，一些，少量' },
    { key: 'spot', word: 'spot', meaning: 'n. 斑点，污点；场所，地点' },
    { key: 'journey', word: 'journey', meaning: 'n. 旅行，路程' },
    { key: 'mind', word: 'mind', meaning: 'n. 思想' },
    { key: 'fact', word: 'fact', meaning: 'n. 事实，现实' }
  ];
  const options = buildMeaningOptions(rows, rows[0], () => 0.2);
  assert.equal(options.length, 4);
  assert.ok(!options.some((item) => item.key === 'spot'));
});

test('每题优先使用本轮未出现的错误词义', () => {
  const meanings = ['苹果', '桌子', '河流', '医生', '城市', '音乐', '花园', '火车', '电影', '书包', '海洋', '朋友'];
  const rows = meanings.map((meaning, index) => ({ key: `word-${index}`, meaning: `n. ${meaning}` }));
  const questions = buildRecognitionQuestions(rows, 3, () => 0.3);
  const groups = questions.map((item) => item.options.filter((option) => !option.correct).map((option) => option.key).sort());
  const used = groups.flat();
  assert.equal(questions.length, 3);
  assert.equal(new Set(used).size, 9);
  assert.equal(new Set(groups.map((group) => group.join('|'))).size, 3);
});

test('只有七个词时每题的三项干扰组合仍不重复', () => {
  const meanings = ['苹果', '桌子', '河流', '医生', '城市', '音乐', '花园'];
  const rows = meanings.map((meaning, index) => ({ key: `small-${index}`, meaning: `n. ${meaning}` }));
  const questions = buildRecognitionQuestions(rows, 7, () => 0.3);
  const signatures = questions.map((item) => item.options.filter((option) => !option.correct).map((option) => option.key).sort().join('|'));
  assert.equal(questions.length, 7);
  assert.equal(new Set(signatures).size, 7);
});

test('目标只取已学词，干扰项可使用当前正式词表的全量词', () => {
  const learned = Array.from({ length: 4 }, (_, index) => ({ key: `learned-${index}`, word: `learned-${index}`, meaning: `n. 已学${index}` }));
  const full = Array.from({ length: 40 }, (_, index) => ({ key: `source-${index}`, word: `source-${index}`, meaning: `n. 词义${index}` }));
  const questions = buildRecognitionQuestions(learned, 4, () => 0.3, { optionCards: full, sourceId: 'dictionary-book-junior-list-1' });
  const distractors = questions.flatMap((item) => item.options.filter((option) => !option.correct).map((option) => option.key));
  assert.equal(questions.length, 4);
  assert.equal(new Set(distractors).size, 12);
  assert.ok(distractors.every((key) => key.startsWith('source-')));
});

test('同词性未使用项不足时先换词性，不重复上一题干扰项', () => {
  const rows = [
    { key: 'target-a', word: 'target-a', meaning: 'adj. 目标甲' },
    { key: 'target-b', word: 'target-b', meaning: 'adj. 目标乙' },
    { key: 'adj-1', word: 'adj-1', meaning: 'adj. 形容甲' },
    { key: 'adj-2', word: 'adj-2', meaning: 'adj. 形容乙' },
    { key: 'adj-3', word: 'adj-3', meaning: 'adj. 形容丙' },
    { key: 'noun-1', word: 'noun-1', meaning: 'n. 名词甲' },
    { key: 'noun-2', word: 'noun-2', meaning: 'n. 名词乙' },
    { key: 'noun-3', word: 'noun-3', meaning: 'n. 名词丙' }
  ];
  const questions = buildRecognitionQuestions(rows.slice(0, 2), 2, () => 0.3, { optionCards: rows });
  const distractors = questions.flatMap((item) => item.options.filter((option) => !option.correct).map((option) => option.key));
  assert.equal(questions.length, 2);
  assert.equal(new Set(distractors).size, 6);
});
