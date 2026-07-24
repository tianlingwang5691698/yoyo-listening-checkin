const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildReadingReportPdf, FONT_PATH, LATIN_FONT_PATH } = require('../lib/reading-report-pdf');
const reading = require('../services/reading.service');

function buildFixture(imageKey) {
  return {
    passage: {
      _id: 'reading-report-test',
      title: '完整阅读学习报告',
      year: '2026',
      district: '上海',
      examType: '一模',
      directions: 'Read the passage and choose the best answer.',
      sectionHeading: 'Questions 1-2',
      articleTitle: 'A Better Way to Learn',
      articleSubtitle: 'Small habits create lasting progress.',
      passageParagraphs: [
        'Students learn more effectively when they review ideas at the right time.',
        'A clear plan also helps them notice useful words, phrases and sentence patterns.'
      ],
      images: [{ cloudPath: imageKey }],
      questions: [{
        number: 1,
        prompt: 'What helps students learn effectively?',
        options: { A: 'A clear review plan', B: 'Skipping practice' },
        answer: 'A'
      }, {
        number: 2,
        prompt: 'What can students notice?',
        options: { A: 'Only answers', B: 'Useful language patterns' },
        answer: 'B'
      }]
    },
    attempt: {
      date: '2026-07-24',
      answers: { 1: 'A', 2: 'A' },
      correctCount: 1,
      totalCount: 2,
      questionResults: [
        { number: 1, selected: 'A', answer: 'A', correct: true },
        { number: 2, selected: 'A', answer: 'B', correct: false }
      ]
    },
    studyPack: {
      source: 'model:test',
      questionAnalyses: [{
        number: 1,
        answer: 'A',
        analysis: '第一段说明适时复习能提高学习效果。',
        answerSentence: 'Students learn more effectively when they review ideas at the right time.',
        answerSentenceTranslation: '学生在合适时间复习时学习更有效。'
      }, {
        number: 2,
        answer: 'B',
        analysis: '第二段列出了可积累的语言内容。',
        answerSentence: 'A clear plan also helps them notice useful words, phrases and sentence patterns.',
        answerSentenceTranslation: '清晰的计划也帮助他们发现有用的单词、短语和句型。'
      }],
      vocabularyCards: [{
        word: 'effectively',
        phonetic: '/ɪˈfektɪvli/',
        meaning: '有效地',
        example: 'She studies effectively.',
        exampleMeaning: '她学习得很有效。'
      }],
      phraseCards: [{
        text: 'at the right time',
        meaning: '在合适的时间',
        example: 'Review the lesson at the right time.'
      }],
      sentencePatternCards: [{
        pattern: 'help somebody do something',
        meaning: '帮助某人做某事',
        example: 'The plan helps students notice patterns.',
        exampleMeaning: '这个计划帮助学生发现句型。'
      }]
    }
  };
}

test('生成含原题图片、学生答案、逐题解析和三类学习卡的阅读 PDF', async () => {
  const imagePath = path.resolve(
    __dirname,
    '../../../data/reading-senior-autumn/images/sh-autumn-2012-reading-1-489b40029d.png'
  );
  const imageKey = '_content/reading/report-test.png';
  const input = buildFixture(imageKey);
  input.imageBuffers = { [imageKey]: fs.readFileSync(imagePath) };

  const buffer = await buildReadingReportPdf(input);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 15000);
  assert.ok(fs.existsSync(FONT_PATH));
  assert.ok(fs.existsSync(LATIN_FONT_PATH));

  const output = path.join(os.tmpdir(), `reading-report-${Date.now()}.pdf`);
  fs.writeFileSync(output, buffer);
  assert.ok(fs.statSync(output).size > 15000);
  fs.unlinkSync(output);
});

test('阅读报告收集正文、题目和选项图片且去重', () => {
  const shared = { cloudPath: '_content/reading/shared.png' };
  const images = reading._test.collectReadingReportImages({
    images: [shared],
    questions: [{
      sourceImages: [shared, { cloudPath: '_content/reading/question.png' }],
      optionImages: { A: { cloudPath: '_content/reading/option.png' } }
    }]
  });
  assert.deepEqual(images.map((item) => item.cloudPath), [
    '_content/reading/shared.png',
    '_content/reading/question.png',
    '_content/reading/option.png'
  ]);
});

test('旧提交中的完整模型解析可恢复为报告学习包', () => {
  const passage = buildFixture('').passage;
  const pack = reading._test.buildAttemptReviewStudyPack({
    review: {
      studyPackSource: 'model:legacy',
      analysis: [{
        number: 1,
        answer: 'A',
        text: '旧记录解析',
        answerSentence: {
          text: 'Students learn more effectively.',
          translation: '学生学习更有效。'
        }
      }]
    }
  }, passage);
  assert.equal(pack.source, 'model:legacy');
  assert.equal(pack.questionAnalyses[0].analysis, '旧记录解析');
  assert.equal(pack.questionAnalyses[0].answerSentenceTranslation, '学生学习更有效。');
});

test('阅读 PDF 使用统一层级、英文正文字体和分区起页', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/reading-report-pdf.js'), 'utf8');
  assert.match(source, /function addQuestions[\s\S]*doc\.addPage\(\)/);
  assert.match(source, /function addStudyCards[\s\S]*doc\.addPage\(\)/);
  assert.match(source, /font:\s*LATIN_FONT_PATH[\s\S]*size:\s*11/);
  assert.match(source, /const resultLine = hasOptions[\s\S]*答题结果/);
  assert.doesNotMatch(source, /学生答案：.*正确答案：.*结果：.*\\n.*学生答案：/);
});
