const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
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
  const reading2009 = reading.filter((item) => Number(item.year) === 2009);
  const writing2009 = writing.filter((item) => Number(item.year) === 2009);
  const listening2009 = listening.filter((item) => Number(item.year) === 2009);
  assert.equal(reading2009.length, 7);
  assert.equal(reading2009.reduce((sum, item) => sum + item.questions.length, 0), 44);
  assert.deepEqual(reading2009.map((item) => item.paperOrder), [20, 30, 39, 40, 41, 42, 50]);
  assert.deepEqual(reading2009[0].questions.map((item) => item.number), Array.from({ length: 9 }, (_, index) => index + 41));
  assert.deepEqual(reading2009[0].questions.map((item) => item.answer), Array.from('CEADBHJFI'));
  assert.equal(writing2009.length, 2);
  assert.deepEqual(writing2009.map((item) => item._id), ['sh-autumn-2009-translation', 'sh-autumn-2009-writing']);
  assert.equal(writing2009[0].contentType, 'translation');
  assert.equal(writing2009[0].questionCount, 6);
  assert.equal(writing2009[0].score, 20);
  assert.deepEqual(writing2009[0].questions.map((item) => item.requiredWord), ['popular', 'as…as', 'keep', 'memory', 'remember', 'despite']);
  assert.ok(writing2009[0].questions.every((item) => item.sourceText && item.referenceAnswers.length === 1));
  assert.match(writing2009[0].questions[2].referenceAnswers[0], /^Drinking only a cup of coffee/);
  assert.equal(grammar.length, 16);
  assert.equal(listening2009.length, 1);
  assert.deepEqual(listening2009[0].questions.map((item) => item.number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(listening2009[0]._id, 'sh-autumn-2009-listening-v5');
  assert.equal(listening2009[0].durationSec, 906.71);
  assert.ok(listening2009[0].questions.slice(16).every((item) => item.prompt.includes('_____') && !item.prompt.startsWith('Blank ')));
  assert.deepEqual(listening2009[0].questions.filter((item) => [1, 11, 17].includes(item.number)).map((item) => item.sectionTitle), [
    'Section A · Listen and choose the best answer.',
    'Section B · Listen and choose the best answer.',
    'Section C · Listen and complete the form.'
  ]);
  assert.deepEqual(listening2009[0].questions.find((item) => item.number === 17).givenRows, [
    { label: 'Name', value: 'Amy Toms' }
  ]);
  assert.deepEqual(listening2009[0].questions.find((item) => item.number === 19).givenRows, [
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
  assert.ok([].concat(reading2009, writing2009, grammar, listening2009).every((item) => Number(item.year || item.sourceYear) === 2009));
  const readingService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/reading.service.js'), 'utf8');
  const grammarService = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/grammar.service.js'), 'utf8');
  assert.match(readingService, /reading-senior-autumn\/years\/2009\/v2\/reading-passages\.json/);
  assert.match(grammarService, /grammar-senior-autumn\/years\/2009\/v2/);
});

test('2010 秋考只发布本地原卷完整部分并保持原卷顺序', () => {
  const reading = readJson('data/reading-senior-autumn/reading-passages.json').filter((item) => Number(item.year) === 2010);
  const writing = readJson('data/writing-senior-autumn/writing-prompts.json').filter((item) => Number(item.year) === 2010);
  const listening = readJson('data/listening-senior-autumn/listening-practice.json').filter((item) => Number(item.year) === 2010);
  const grammar = readJson('data/grammar-senior-autumn/years/2010/shanghai-senior-grammar-questions.json');
  const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers.find((item) => item.year === 2010);
  assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching', 'D']);
  assert.deepEqual(reading.map((item) => item.paperOrder), [20, 30, 40, 41, 42, 50, 60]);
  assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 44);
  assert.deepEqual(reading.at(-1).questions.map((item) => item.number), [81, 82, 83, 84]);
  assert.deepEqual(writing.map((item) => item._id), ['sh-autumn-2010-translation', 'sh-autumn-2010-writing']);
  assert.equal(writing[0].questionCount, 5);
  assert.deepEqual(writing[1].requirements, ['描述图片里学生上课的场景', '比较你同时期的上课情况', '简单谈谈你的感受']);
  assert.equal(writing[1].images.length, 1);
  assert.ok(fs.existsSync(path.join(root, writing[1].images[0].localPath)));
  assert.equal(grammar.length, 16);
  assert.ok(grammar.every((item) => item.classificationModel === 'gpt-5.6-sol' && item.prompt.includes('_____')));
  assert.equal(listening.length, 0);
  assert.equal(report.listening.accepted, false);
  assert.equal(report.listening.questions, 0);
});

test('2015 秋考按原卷结构完整收录可用内容', () => {
  const reading = readJson('data/reading-senior-autumn/reading-passages.json').filter((item) => Number(item.year) === 2015);
  const writing = readJson('data/writing-senior-autumn/writing-prompts.json').filter((item) => Number(item.year) === 2015);
  const listening = readJson('data/listening-senior-autumn/listening-practice.json').filter((item) => Number(item.year) === 2015);
  const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
    .find((item) => item.year === 2015 && item.session === 'autumn');

  assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C']);
  assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
  assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 57);
  assert.deepEqual(reading[0].questions.map((item) => item.number), Array.from({ length: 16 }, (_, index) => index + 25));
  assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 16);
  assert.deepEqual(reading[0].questions.find((item) => item.number === 39).acceptedAnswers, ['has been interrupted', 'is being interrupted', 'is interrupted']);
  assert.equal(reading.find((item) => item.section === 'BB').images.length, 1);
  assert.ok(fs.existsSync(path.join(root, reading.find((item) => item.section === 'BB').images[0].localPath)));

  assert.deepEqual(writing.map((item) => item.contentType), ['translation', 'guided-writing']);
  assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2]);
  assert.deepEqual(writing[0].questions.map((item) => item.number), [1, 2, 3, 4, 5]);
  assert.ok(writing[0].questions.every((item) => item.sourceText && item.requiredWord && item.referenceAnswers.length));
  assert.deepEqual(writing[1].requirements, ['简单描述你想推荐的那幅图片；', '阐述你用这幅图片宣传“读书节”的理由。']);
  assert.equal(writing[1].images.length, 1);
  assert.ok(fs.existsSync(path.join(root, writing[1].images[0].localPath)));

  assert.equal(listening.length, 1);
  assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.deepEqual(listening[0].questions.filter((item) => [1, 11, 17].includes(item.number)).map((item) => item.sectionKey), ['A', 'B', 'C']);
  assert.equal(listening[0].questions[16].formTitle, 'SRT Service Notes');
  assert.equal(listening[0].questions[16].groupInstruction, 'Write NO MORE THAN ONE WORD for each answer.');
  assert.equal(listening[0].questions[16].answer, 'XW94702');
  assert.equal(listening[0].questions[20].answer, 'disabled');
  assert.equal(listening[0].questions[23].answer, 'an online diary/a diary online');
  assert.equal(listening[0].hasTranscript, false);
  assert.equal(listening[0].durationSec, 1004.304);

  const probe = JSON.parse(childProcess.execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json',
    path.join(root, listening[0].audioLocalPath)
  ], { encoding: 'utf8' }));
  assert.equal(probe.streams[0].codec_name, 'mp3');
  assert.equal(probe.streams[0].channels, 1);
  assert.equal(probe.streams[0].sample_rate, '32000');
  assert.equal(probe.streams[0].bit_rate, '64000');
  assert.equal(report.grammarCloze.accepted, true);
  assert.equal(report.vocabularyCloze.accepted, true);
  assert.ok(report.reading.every((item) => item.accepted));
  assert.equal(report.translation.accepted, true);
  assert.equal(report.writing.accepted, true);
  assert.equal(report.listening.accepted, true);
  assert.equal(report.grammar.accepted, false);
});

test('2016 秋考按原卷结构完整收录可用内容', () => {
  const reading = readJson('data/reading-senior-autumn/reading-passages.json').filter((item) => Number(item.year) === 2016);
  const writing = readJson('data/writing-senior-autumn/writing-prompts.json').filter((item) => Number(item.year) === 2016);
  const listening = readJson('data/listening-senior-autumn/listening-practice.json').filter((item) => Number(item.year) === 2016);
  const grammar = readJson('data/grammar-senior-autumn/shanghai-senior-grammar-questions.json')
    .filter((item) => Number(item.year) === 2016);
  const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
    .find((item) => item.year === 2016 && item.session === 'autumn');

  assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C']);
  assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
  assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 57);
  assert.deepEqual(reading[0].questions.map((item) => item.number), Array.from({ length: 16 }, (_, index) => index + 25));
  assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 16);
  assert.deepEqual(reading[4].questions.map((item) => item.number), [70, 71, 72]);
  assert.deepEqual(reading[4].questions.map((item) => item.answer), Array.from('DDB'));
  assert.equal(reading[4].images.length, 1);
  assert.ok(fs.existsSync(path.join(root, reading[4].images[0].localPath)));
  assert.deepEqual(reading[6].questions.map((item) => item.number), [78, 79, 80, 81]);
  assert.deepEqual(reading[6].questions.map((item) => item.answer), [
    "The capacity of escalators hasn't been made full use of",
    'Passengers can go quicker by standing still',
    '18.5 m',
    'standing only and a mix of walking and standing'
  ]);

  assert.deepEqual(writing.map((item) => item._id), ['sh-autumn-2016-translation', 'sh-autumn-2016-writing']);
  assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2]);
  assert.deepEqual(writing.map((item) => item.score), [15, 24]);
  assert.deepEqual(writing[0].questions.map((item) => item.number), [23, 24, 25, 26, 27]);
  assert.deepEqual(writing[1].requirements, ['描述调研数据；', '分析可能导致这一结果的原因']);
  assert.equal(writing[1].images.length, 1);
  assert.ok(fs.existsSync(path.join(root, writing[1].images[0].localPath)));

  assert.equal(grammar.length, 0);
  assert.equal(listening.length, 1);
  assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(listening[0].durationSec, 1093.669);
  assert.deepEqual(listening[0].questions.filter((item) => [1, 11, 17].includes(item.number)).map((item) => item.sectionTitle), [
    'Section A · Listen and choose the best answer.',
    'Section B · Listen and choose the best answer.',
    'Section C · Listen and complete the form.'
  ]);
  assert.ok(listening[0].questions.slice(16).every((item) => item.prompt.includes('_____')));
  assert.equal(listening[0].questions[16].formTitle, 'Class Diary (June 13-19)');
  assert.match(listening[0].questions[20].prompt, /Sue Walter/);
  assert.equal(listening[0].questions[20].answer, 'a famous judge/a judge');
  assert.equal(listening[0].questions[23].answer, 'Sharing with others/Sharing');

  const probe = JSON.parse(childProcess.execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json',
    path.join(root, listening[0].audioLocalPath)
  ], { encoding: 'utf8' }));
  assert.equal(probe.streams[0].codec_name, 'mp3');
  assert.equal(probe.streams[0].channels, 1);
  assert.equal(probe.streams[0].sample_rate, '32000');
  assert.equal(probe.streams[0].bit_rate, '64000');

  assert.equal(report.grammarCloze.accepted, true);
  assert.equal(report.vocabularyCloze.accepted, true);
  assert.ok(report.reading.every((item) => item.accepted));
  assert.equal(report.translation.accepted, true);
  assert.equal(report.writing.accepted, true);
  assert.equal(report.listening.accepted, true);
  assert.equal(report.summaryWriting.accepted, false);
  assert.equal(report.grammar.accepted, false);
});

test('2017 春考与秋考按原卷 21-76 顺序完整收录', () => {
  ['spring', 'autumn'].forEach((session) => {
    const reading = readJson(`data/reading-senior-${session}/reading-passages.json`).filter((item) => Number(item.year) === 2017);
    const writing = readJson(`data/writing-senior-${session}/writing-prompts.json`).filter((item) => Number(item.year) === 2017);
    const listening = readJson(`data/listening-senior-${session}/listening-practice.json`).filter((item) => Number(item.year) === 2017);
    const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
      .find((item) => item.year === 2017 && item.session === session);

    assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching']);
    assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
    assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 50);
    assert.deepEqual(reading[0].questions.map((item) => item.number), Array.from({ length: 10 }, (_, index) => index + 21));
    assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 10);
    assert.deepEqual(reading.at(-1).questions.map((item) => item.number), [67, 68, 69, 70]);
    assert.deepEqual(writing.map((item) => item.contentType), ['summary-writing', 'translation', 'guided-writing']);
    assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2, 3]);
    assert.equal(writing[0].questionNumber, 71);
    assert.deepEqual(writing[1].questions.map((item) => item.number), [72, 73, 74, 75]);
    assert.equal(writing[2].questionNumber, 76);
    assert.equal(listening.length, 1);
    assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.ok(listening[0].durationSec > 870 && listening[0].hasTranscript);
    assert.equal(report.grammarCloze.accepted, true);
    assert.equal(report.vocabularyCloze.accepted, true);
    assert.ok(report.reading.every((item) => item.accepted));
    assert.equal(report.summaryWriting.accepted, true);
    assert.equal(report.translation.accepted, true);
    assert.equal(report.writing.accepted, true);
    assert.equal(report.listening.accepted, true);
    assert.equal(report.listening.decodedDurationSeconds.unchanged, true);
    assert.equal(report.grammar.accepted, false);
  });

  const springReading = readJson('data/reading-senior-spring/reading-passages.json').filter((item) => Number(item.year) === 2017);
  const imageQuestion = springReading.find((item) => item.section === 'BA').questions.find((item) => item.number === 57);
  assert.deepEqual(Object.keys(imageQuestion.optionImages), ['A', 'B', 'C', 'D']);
  assert.ok(Object.values(imageQuestion.optionImages).every((image) => fs.existsSync(path.join(root, image.localPath))));
  assert.equal(springReading.find((item) => item.section === 'BB').images.length, 1);

  const autumnWriting = readJson('data/writing-senior-autumn/writing-prompts.json').filter((item) => Number(item.year) === 2017);
  assert.deepEqual(autumnWriting[2].promptTable.rows.map((row) => row.label), ['主题', '时间', '路线']);
  assert.match(autumnWriting[1].questions[0].referenceAnswers[0], /punished/);
});

test('2018-2020 春考与秋考按原卷结构完整收录', () => {
  const sections = ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching'];
  const expectedRequirementCounts = {
    'spring-2018': 2,
    'spring-2019': 2,
    'spring-2020': 1,
    'autumn-2018': 2,
    'autumn-2019': 2,
    'autumn-2020': 2
  };
  for (const session of ['spring', 'autumn']) {
    const allReading = readJson(`data/reading-senior-${session}/reading-passages.json`);
    const allWriting = readJson(`data/writing-senior-${session}/writing-prompts.json`);
    const allListening = readJson(`data/listening-senior-${session}/listening-practice.json`);
    for (const year of [2018, 2019, 2020]) {
      const reading = allReading.filter((item) => Number(item.year) === year);
      const writing = allWriting.filter((item) => Number(item.year) === year);
      const listening = allListening.find((item) => Number(item.year) === year);
      const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
        .find((item) => item.year === year && item.session === session);

      assert.deepEqual(reading.map((item) => item.section), sections);
      assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
      assert.deepEqual(reading.flatMap((item) => item.questions.map((question) => question.number)), Array.from({ length: 50 }, (_, index) => index + 21));
      assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 10);
      assert.deepEqual(writing.map((item) => item.contentType), ['summary-writing', 'translation', 'guided-writing']);
      assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2, 3]);
      assert.equal(writing[0].questionNumber, 71);
      assert.deepEqual(writing[1].questions.map((item) => item.number), [72, 73, 74, 75]);
      assert.ok(writing[1].questions.every((item) => item.sourceText && item.requiredWord && item.referenceAnswers.length >= 1));
      assert.equal(writing[2].questionNumber, 76);
      assert.equal(writing[2].requirements.length, expectedRequirementCounts[`${session}-${year}`]);
      assert.deepEqual(listening.questions.map((item) => item.number), Array.from({ length: 20 }, (_, index) => index + 1));
      assert.deepEqual(listening.questions.filter((item) => [1, 11].includes(item.number)).map((item) => item.sectionKey), ['A', 'B']);
      assert.deepEqual(listening.questions.filter((item) => [11, 14, 17].includes(item.number)).map((item) => item.groupKey), ['B-11-13', 'B-14-16', 'B-17-20']);
      assert.ok(listening.durationSec > 950);
      assert.equal(listening.hasTranscript, !(session === 'autumn' && year === 2020));
      assert.equal(report.grammarCloze.accepted, true);
      assert.equal(report.vocabularyCloze.accepted, true);
      assert.ok(report.reading.every((item) => item.accepted));
      assert.equal(report.summaryWriting.accepted, true);
      assert.equal(report.translation.accepted, true);
      assert.equal(report.writing.accepted, true);
      assert.equal(report.listening.accepted, true);
      assert.equal(report.grammar.accepted, false);

      const probe = JSON.parse(childProcess.execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json',
        path.join(root, listening.audioLocalPath)
      ], { encoding: 'utf8' }));
      assert.equal(probe.streams[0].codec_name, 'mp3');
      assert.equal(probe.streams[0].channels, 1);
      assert.equal(probe.streams[0].sample_rate, '32000');
      assert.equal(probe.streams[0].bit_rate, '64000');
    }
  }
});

test('2023 春考只收录本地完整的翻译与作文并保持原卷顺序', () => {
  const writing = readJson('data/writing-senior-spring/writing-prompts.json').filter((item) => Number(item.year) === 2023);
  const listening = readJson('data/listening-senior-spring/listening-practice.json').filter((item) => Number(item.year) === 2023);
  const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
    .find((item) => item.year === 2023 && item.session === 'spring');
  assert.deepEqual(writing.map((item) => item._id), ['sh-spring-2023-translation', 'sh-spring-2023-writing']);
  assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2]);
  assert.deepEqual(writing[0].questions.map((item) => item.number), [72, 73, 74, 75]);
  assert.ok(writing[0].questions.every((item) => item.sourceText && item.requiredWord && item.referenceAnswers.length === 1));
  assert.deepEqual(writing[1].requirements, ['向 Tom 反映同学的想法', '向 tom 提出建议并说明理由']);
  assert.equal(writing[1].promptStarter, 'Dear Tom：');
  assert.deepEqual(writing[1].images, []);
  assert.equal(writing[1].minWords, 0);
  assert.equal(writing[1].score, 0);
  assert.equal(listening.length, 0);
  assert.equal(report.listening.accepted, false);
  assert.equal(report.listening.hasTranscript, true);
  assert.equal(report.listening.hasAudio, false);
  assert.equal(report.listening.questions, 0);
  assert.equal(report.reading.length, 0);
  assert.equal(report.grammar.accepted, false);
});

test('2022 春考与秋考按现代卷面结构完整收录可用部分', () => {
  ['spring', 'autumn'].forEach((session) => {
    const reading = readJson(`data/reading-senior-${session}/reading-passages.json`).filter((item) => Number(item.year) === 2022);
    const writing = readJson(`data/writing-senior-${session}/writing-prompts.json`).filter((item) => Number(item.year) === 2022);
    const listening = readJson(`data/listening-senior-${session}/listening-practice.json`).filter((item) => Number(item.year) === 2022);
    const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
      .find((item) => item.year === 2022 && item.session === session);
    assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching']);
    assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
    assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 50);
    assert.deepEqual(reading[0].questions.map((item) => item.number), Array.from({ length: 10 }, (_, index) => index + 21));
    assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 10);
    assert.equal(report.grammarCloze.accepted, true);
    assert.deepEqual(reading[1].questions.map((item) => item.number), Array.from({ length: 10 }, (_, index) => index + 31));
    assert.deepEqual(reading.at(-1).questions.map((item) => item.number), [67, 68, 69, 70]);
    assert.deepEqual(writing.map((item) => item.contentType), ['summary-writing', 'translation', 'guided-writing']);
    assert.deepEqual(writing.map((item) => item.paperOrder), [1, 2, 3]);
    assert.equal(writing[0].maxWords, 60);
    assert.deepEqual(writing[1].questions.map((item) => item.number), [72, 73, 74, 75]);
    assert.ok(writing[1].questions.every((item) => item.sourceText && item.requiredWord && item.referenceAnswers.length));
    assert.equal(writing[2].minWords, 120);
    assert.equal(writing[2].requirements.length, 2);
    assert.equal(listening.length, 1);
    assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.ok(listening[0].questions.every((item) => item.answer && item.sectionTitle));
    assert.ok(listening[0].durationSec > 900 && listening[0].hasTranscript);
    assert.equal(report.grammar.accepted, false);
  });
  const autumnWriting = readJson('data/writing-senior-autumn/writing-prompts.json').filter((item) => Number(item.year) === 2022);
  assert.equal(autumnWriting[1].questions.find((item) => item.number === 74).requiredWord, 'a difference');
});

test('2021 春考与秋考只收录原卷完整部分', () => {
  ['spring', 'autumn'].forEach((session) => {
    const reading = readJson(`data/reading-senior-${session}/reading-passages.json`).filter((item) => Number(item.year) === 2021);
    const writing = readJson(`data/writing-senior-${session}/writing-prompts.json`).filter((item) => Number(item.year) === 2021);
    const listening = readJson(`data/listening-senior-${session}/listening-practice.json`).filter((item) => Number(item.year) === 2021);
    const report = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
      .find((item) => item.year === 2021 && item.session === session);
    assert.deepEqual(reading.map((item) => item.section), ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching']);
    assert.deepEqual(reading.map((item) => item.paperOrder), [10, 20, 30, 40, 41, 42, 50]);
    assert.equal(reading.reduce((sum, item) => sum + item.questions.length, 0), 50);
    assert.deepEqual(reading[0].questions.map((item) => item.number), session === 'spring'
      ? Array.from({ length: 10 }, (_, index) => index + 1)
      : Array.from({ length: 10 }, (_, index) => index + 21));
    assert.equal((reading[0].passage.match(/_{5}\d+_{5}/g) || []).length, 10);
    assert.equal(report.grammarCloze.accepted, true);
    assert.equal(listening.length, 1);
    assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.ok(listening[0].durationSec > 900);
    assert.equal(report.grammar.accepted, false);
    if (session === 'spring') {
      assert.deepEqual(writing.map((item) => item.contentType), ['summary-writing', 'translation', 'guided-writing']);
      assert.equal(writing[0].maxWords, 60);
      assert.equal(listening[0].hasTranscript, true);
    } else {
      assert.deepEqual(writing.map((item) => item.contentType), ['translation', 'guided-writing']);
      assert.equal(report.summaryWriting.accepted, false);
      assert.equal(listening[0].hasTranscript, false);
      assert.deepEqual(writing[1].promptTable.headers, ['课程名称', '汉语听说', '汉语读写']);
      assert.deepEqual(writing[1].requirements, ['推荐其中一门课程；', '通过比较两门课程的信息，说明你推荐该课程的理由。']);
    }
  });
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  assert.match(template, /promptDisplay\.promptTable\.headers/);
  assert.match(template, /promptDisplay\.promptTable\.rows/);
});

test('高中 Section A 在文章原位显示横线输入并接受并列答案', () => {
  const detailSource = fs.readFileSync(path.join(root, 'pages/reading/detail/index.js'), 'utf8');
  const detailTemplate = fs.readFileSync(path.join(root, 'pages/reading/detail/index.wxml'), 'utf8');
  const spring2021 = readJson('data/reading-senior-spring/reading-passages.json')
    .find((item) => item._id === 'sh-spring-2021-grammar-vocabulary-a');
  const spring2022 = readJson('data/reading-senior-spring/reading-passages.json')
    .find((item) => item._id === 'sh-spring-2022-grammar-vocabulary-a');
  assert.deepEqual(spring2021.questions.find((item) => item.number === 5).acceptedAnswers, ['which', 'that']);
  assert.deepEqual(spring2022.questions.find((item) => item.number === 27).acceptedAnswers, ['when', 'as']);
  assert.match(detailSource, /acceptedAnswers\.some/);
  assert.match(detailTemplate, /cloze-inline-input/);
});

test('2009 听力音频与阅读标题匹配符合运行时规格', () => {
  const listening = readJson('data/listening-senior-autumn/listening-practice.json').find((item) => item.year === 2009);
  const probe = JSON.parse(childProcess.execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json',
    path.join(root, listening.audioLocalPath)
  ], { encoding: 'utf8' }));
  const stream = probe.streams[0];
  assert.equal(stream.codec_name, 'mp3');
  assert.equal(stream.channels, 1);
  assert.equal(stream.sample_rate, '32000');
  assert.equal(stream.bit_rate, '64000');
  const matching = readJson('data/reading-senior-autumn/reading-passages.json').find((item) => item.year === 2009 && item.section === 'C-Matching');
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
  assert.match(source, /resolvePromptImages[\s\S]*?store\.getTempFileURL/);
  assert.match(template, /class="library-prompt-image"/);
  assert.match(template, /class="prompt-image"/);
});

test('2009 翻译与作文按原卷顺序独立展示', () => {
  const source = fs.readFileSync(path.join(root, 'pages/writing/detail/index.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/writing/detail/index.wxml'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'pages/material/index.js'), 'utf8');
  assert.match(source, /isTranslationTask[\s\S]*?translationQuestions[\s\S]*?submitTranslation/);
  assert.match(template, /library-translation-item[\s\S]*?library-translation-input[\s\S]*?translationSubmitted/);
  assert.match(template, /class="translation-item"[\s\S]*?class="translation-input"[\s\S]*?translationSubmitted/);
  assert.match(catalog, /summaryParts\.push\(`翻译 \$\{group\.translationQuestionCount\} 题`\)/);
  assert.match(catalog, /summaryParts\.push\(`作文 \$\{group\.writingTaskCount\} 题`\)/);
  assert.match(catalog, /isSeniorWritingItem \? `\$\{item\.year\}年`/);
});

test('2024-2026 春秋考按原卷结构增量收录完整可用部分', () => {
  const expectedSections = ['Grammar-Vocabulary-A', 'Grammar-Vocabulary-B', 'A', 'BA', 'BB', 'BC', 'C-Matching'];
  const publishedPapers = [
    [2024, 'spring', true],
    [2024, 'autumn', true],
    [2025, 'spring', true],
    [2025, 'autumn', false],
    [2026, 'spring', false]
  ];
  for (const [year, session, hasListening] of publishedPapers) {
    const reading = readJson(`data/reading-senior-${session}/reading-passages.json`).filter((item) => Number(item.year) === year);
    const writing = readJson(`data/writing-senior-${session}/writing-prompts.json`).filter((item) => Number(item.year) === year);
    const listening = readJson(`data/listening-senior-${session}/listening-practice.json`).filter((item) => Number(item.year) === year);
    assert.deepEqual(reading.map((item) => item.section), expectedSections);
    assert.deepEqual(reading.flatMap((item) => item.questions.map((question) => question.number)), Array.from({ length: 50 }, (_, index) => index + 21));
    assert.deepEqual(writing.map((item) => item.contentType), ['summary-writing', 'translation', 'guided-writing']);
    assert.deepEqual(writing[1].questions.map((item) => item.number), [72, 73, 74, 75]);
    assert.equal(writing[2].questionNumber, 76);
    assert.ok(writing[1].questions.every((item) => item.sourceText && item.requiredWord && item.referenceAnswers.length));
    assert.equal(listening.length, hasListening ? 1 : 0);
    if (hasListening) {
      assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: 20 }, (_, index) => index + 1));
      assert.ok(fs.existsSync(path.join(root, listening[0].audioLocalPath)));
    }
    assert.doesNotMatch(JSON.stringify([...reading, ...writing, ...listening]), /【(?:解析|答案|解答|点评)|故选|考查/);
  }
  assert.equal(readJson('data/reading-senior-autumn/reading-passages.json').filter((item) => Number(item.year) === 2026).length, 0);
  const missing = readJson('data/imports/shanghai-senior-1990-2023/formal/clean-report.json').papers
    .find((item) => item.year === 2026 && item.session === 'autumn');
  assert.equal(missing.reason, 'source-paper-missing');
});

test('2024-2025 新增听力音频符合运行时规格', () => {
  for (const [year, session] of [[2024, 'spring'], [2024, 'autumn'], [2025, 'spring']]) {
    const listening = readJson(`data/listening-senior-${session}/listening-practice.json`).find((item) => Number(item.year) === year);
    const probe = JSON.parse(childProcess.execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json',
      path.join(root, listening.audioLocalPath)
    ], { encoding: 'utf8' }));
    const stream = probe.streams[0];
    assert.equal(stream.codec_name, 'mp3');
    assert.equal(stream.channels, 1);
    assert.equal(stream.sample_rate, '32000');
    assert.equal(stream.bit_rate, '64000');
  }
});
