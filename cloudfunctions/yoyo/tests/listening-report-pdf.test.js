const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildListeningReportPdf, FONT_PATH, LATIN_FONT_PATH } = require('../lib/listening-report-pdf');
const listening = require('../services/listening.service');

function buildFixture(imageKey) {
  return {
    item: {
      _id: 'listening-report-test',
      title: '2026 上海英语听力套题',
      year: '2026',
      district: '上海',
      examType: '一模',
      directions: 'Listen and choose the best answer.',
      instructions: 'Questions 1-2',
      transcript: [
        'M: When does the school library open?',
        'W: It opens at half past eight every morning.',
        'M: Why do students visit it?',
        'W: They can read quietly and prepare for class.'
      ].join('\n'),
      images: [{ cloudPath: imageKey }],
      questions: [{
        number: 1,
        sectionKey: 'B',
        sectionTitle: 'B. Listen and choose the best answer.',
        prompt: 'When does the library open?',
        options: { A: 'At 8:00', B: 'At 8:30', C: 'At 9:00' },
        answer: 'B'
      }, {
        number: 2,
        sectionKey: 'B',
        sectionTitle: 'B. Listen and choose the best answer.',
        prompt: 'Why do students visit the library?',
        options: { A: 'To play games', B: 'To have lunch', C: 'To prepare for class' },
        answer: 'C'
      }]
    },
    attempt: {
      date: '2026-07-24',
      correctCount: 1,
      totalCount: 2,
      questions: [
        { number: 1, selectedAnswer: 'B', answer: 'B', isCorrect: true },
        { number: 2, selectedAnswer: 'A', answer: 'C', isCorrect: false }
      ]
    },
    studyPack: {
      source: 'model:test',
      questionAnalyses: [{
        number: 1,
        answer: 'B',
        evidence: 'It opens at half past eight every morning.',
        evidenceTranslation: '它每天早上八点半开放。',
        analysis: 'half past eight 对应 8:30。'
      }, {
        number: 2,
        answer: 'C',
        evidence: 'They can read quietly and prepare for class.',
        evidenceTranslation: '他们可以安静阅读并为上课做准备。',
        analysis: '原文直接说明学生会为上课做准备。'
      }],
      vocabularyCards: [{
        word: 'prepare',
        phonetic: '/prɪˈpeə/',
        meaning: '准备',
        example: 'They prepare for class.',
        exampleMeaning: '他们为上课做准备。'
      }],
      phraseCards: [{
        text: 'prepare for',
        meaning: '为……做准备',
        example: 'Students prepare for class.'
      }],
      sentencePatternCards: [{
        pattern: 'When does ... open?',
        meaning: '询问开放时间',
        example: 'When does the library open?',
        exampleMeaning: '图书馆什么时候开放？'
      }]
    }
  };
}

test('生成含结构化原题、完整原文、学生答案、逐题解析和学习卡的听力 PDF', async () => {
  const imagePath = path.resolve(
    __dirname,
    '../../../data/reading-senior-autumn/images/sh-autumn-2012-reading-1-489b40029d.png'
  );
  const imageKey = '_content/listening/report-test.png';
  const input = buildFixture(imageKey);
  input.imageBuffers = { [imageKey]: fs.readFileSync(imagePath) };
  const buffer = await buildListeningReportPdf(input);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 15000);
  assert.ok(fs.existsSync(FONT_PATH));
  assert.ok(fs.existsSync(LATIN_FONT_PATH));
  const output = path.join(os.tmpdir(), `listening-report-${Date.now()}.pdf`);
  fs.writeFileSync(output, buffer);
  assert.ok(fs.statSync(output).size > 15000);
  fs.unlinkSync(output);
});

test('听力报告收集套题、题目和选项图片且去重', () => {
  const shared = { cloudPath: '_content/listening/shared.png' };
  const images = listening._test.collectListeningReportImages({
    images: [{ cloudPath: '_content/listening/full-page-scan.png' }, shared],
    questions: [{
      sourceImages: [shared, { cloudPath: '_content/listening/question.png' }],
      optionImages: { A: { cloudPath: '_content/listening/option.png' } }
    }]
  });
  assert.deepEqual(images.map((item) => item.cloudPath), [
    '_content/listening/shared.png',
    '_content/listening/question.png',
    '_content/listening/option.png'
  ]);
});

test('旧缓存可保留学习卡并补充完整逐题解析', () => {
  const fixture = buildFixture('');
  const pack = listening._test.normalizeStudyPack({
    source: 'model:legacy',
    vocabularyCards: fixture.studyPack.vocabularyCards,
    phraseCards: fixture.studyPack.phraseCards,
    sentencePatternCards: fixture.studyPack.sentencePatternCards,
    questionAnalyses: fixture.studyPack.questionAnalyses
  });
  assert.equal(pack.vocabularyCards[0].word, 'prepare');
  assert.equal(pack.questionAnalyses[0].evidenceTranslation, '它每天早上八点半开放。');
  assert.equal(listening._test.hasCompleteQuestionAnalyses(pack, fixture.item), true);
  assert.equal(listening._test.hasCompleteQuestionAnalyses(
    Object.assign({}, pack, { questionAnalyses: pack.questionAnalyses.slice(0, 1) }),
    fixture.item
  ), false);
});
