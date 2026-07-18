const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

test('2009 秋考四模块数据完整且只使用增量年份路径', () => {
  const reading = readJson('data/reading-senior-autumn/reading-passages.json');
  const writing = readJson('data/writing-senior-autumn/writing-prompts.json');
  const grammar = readJson('data/grammar-senior-autumn/shanghai-senior-grammar-questions.json');
  const listening = readJson('data/listening-senior-autumn/listening-practice.json');
  assert.equal(reading.length, 7);
  assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 44);
  assert.deepEqual(reading.map((item) => item.paperOrder), [20, 30, 39, 40, 41, 42, 50]);
  assert.deepEqual(reading[0].questions.map((item) => item.number), Array.from({ length: 9 }, (_, index) => index + 41));
  assert.deepEqual(reading[0].questions.map((item) => item.answer), Array.from('CEADBHJFI'));
  assert.equal(writing.length, 2);
  assert.deepEqual(writing.map((item) => item._id), ['sh-autumn-2009-translation', 'sh-autumn-2009-writing']);
  assert.equal(writing[0].contentType, 'translation');
  assert.equal(writing[0].questionCount, 6);
  assert.equal(writing[0].score, 20);
  assert.deepEqual(writing[0].questions.map((item) => item.requiredWord), ['popular', 'as…as', 'keep', 'memory', 'remember', 'despite']);
  assert.ok(writing[0].questions.every((item) => item.sourceText && item.referenceAnswers.length === 1));
  assert.match(writing[0].questions[2].referenceAnswers[0], /^Drinking only a cup of coffee/);
  assert.equal(grammar.length, 16);
  assert.equal(listening.length, 1);
  assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(listening[0]._id, 'sh-autumn-2009-listening-v5');
  assert.equal(listening[0].durationSec, 906.71);
  assert.ok(listening[0].questions.slice(16).every((item) => item.prompt.includes('_____') && !item.prompt.startsWith('Blank ')));
  assert.deepEqual(listening[0].questions.filter((item) => [1, 11, 17].includes(item.number)).map((item) => item.sectionTitle), [
    'Section A · Listen and choose the best answer.',
    'Section B · Listen and choose the best answer.',
    'Section C · Listen and complete the form.'
  ]);
  assert.deepEqual(listening[0].questions.find((item) => item.number === 17).givenRows, [
    { label: 'Name', value: 'Amy Toms' }
  ]);
  assert.deepEqual(listening[0].questions.find((item) => item.number === 19).givenRows, [
    { label: 'License', value: 'AN International Driver’s License' }
  ]);
  const grammarByNumber = Object.fromEntries(grammar.map((item) => [item.number, item]));
  assert.equal(grammarByNumber[29].subtopicId, 'verb:tense-voice');
  assert.equal(grammarByNumber[30].subtopicId, 'sentence:tag-question');
  assert.equal(grammarByNumber[36].subtopicId, 'verb:tense-voice');
  assert.equal(grammarByNumber[37].subtopicId, 'clause:noun');
  assert.equal(grammarByNumber[38].subtopicId, 'sentence:inversion');
  assert.equal(grammarByNumber[40].subtopicId, 'clause:noun');
  assert.ok(grammar.every((item) => item.classificationModel === 'gpt-5.6-sol' && item.classificationRevision === 2));
  assert.ok([].concat(reading, writing, grammar, listening).every((item) => Number(item.year || item.sourceYear) === 2009));
  const readingService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/reading.service.js'), 'utf8');
  const grammarService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/grammar.service.js'), 'utf8');
  assert.match(readingService, /reading-senior-autumn\/years\/2009\/v2\/reading-passages\.json/);
  assert.match(grammarService, /grammar-senior-autumn\/years\/2009\/v2/);
});

test('2009 听力音频与阅读标题匹配符合运行时规格', () => {
  const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json');
  const listening = report.papers[0].listening;
  const stream = listening.audioProbe.streams[0];
  assert.equal(stream.codec_name, 'mp3');
  assert.equal(stream.channels, 1);
  assert.equal(stream.sample_rate, '32000');
  assert.equal(stream.bit_rate, '64000');
  assert.equal(listening.decodedDurationSeconds.unchanged, true);
  const matching = readJson('data/reading-senior-autumn/reading-passages.json').find((item) => item.section === 'C-Matching');
  assert.deepEqual(matching.questions.map((item) => item.answer), Array.from('FDCBE'));
  assert.ok(matching.questions.every((item) => Object.keys(item.options).join('') === 'ABCDEF'));
});

test('2009 写作原卷三个要点独立分行展示', () => {
  const source = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxss'), 'utf8');
  assert.match(source, /'sh-autumn-2009-writing'[\s\S]*?你感兴趣的课程[\s\S]*?你期望从这门课程中学到什么[\s\S]*?为什么想学这些内容/);
  assert.match(template, /wx:for="\{\{promptDisplay\.requirements\}\}"/);
  assert.match(template, /class="requirement-dot"/);
  assert.match(template, /class="library-requirement-dot"/);
  assert.match(styles, /\.requirements-list[\s\S]*?gap:\s*16rpx/);
  assert.match(styles, /\.library-requirements-list[\s\S]*?gap:\s*16rpx/);
});

test('2009 翻译与作文按原卷顺序独立展示', () => {
  const source = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'pages/material/index.js'), 'utf8');
  assert.match(source, /isTranslationTask[\s\S]*?translationQuestions[\s\S]*?submitTranslation/);
  assert.match(template, /library-translation-item[\s\S]*?library-translation-input[\s\S]*?translationSubmitted/);
  assert.match(template, /class="translation-item"[\s\S]*?class="translation-input"[\s\S]*?translationSubmitted/);
  assert.match(catalog, /翻译 \$\{group\.translationQuestionCount\} 题 · 作文 \$\{group\.writingTaskCount/);
  assert.match(catalog, /isSeniorWritingItem \? `\$\{item\.year\}年`/);
});
