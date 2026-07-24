const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  buildIeltsSpeakingReportPdf,
  FONT_PATH,
  LATIN_FONT_PATH,
  _test
} = require('../lib/ielts-speaking-report-pdf');

test('IELTS speaking report maps latest real attempts and keeps unanswered questions', async () => {
  const item = {
    title: 'Cambridge IELTS 21 Test 1 Speaking',
    book: 'Cambridge IELTS 21 Academic',
    testNumber: 1,
    exercises: [
      { id: 'q1', part: 1, prompt: 'Where do you go to get a haircut?' },
      { id: 'q2', part: 2, prompt: 'Describe a useful source of tourist information.' },
      { id: 'q3', part: 3, prompt: 'Why do people travel abroad?' }
    ]
  };
  const attempts = [
    {
      questionViewKey: 'q1',
      promptText: item.exercises[0].prompt,
      status: 'scored',
      studentTranscript: 'I usually go to a barber near my home.',
      ieltsOverallBand: 6,
      ieltsFluencyCoherenceBand: 6,
      ieltsLexicalResourceBand: 6,
      ieltsGrammaticalRangeAccuracyBand: 6,
      ieltsPronunciationBand: 6,
      feedback: 'Add one supporting detail.',
      updatedAt: '2026-07-24T09:00:00.000Z'
    },
    {
      questionViewKey: 'q1',
      promptText: item.exercises[0].prompt,
      status: 'scored',
      studentTranscript: 'I visit a local barber because it is convenient.',
      ieltsOverallBand: 6.5,
      ieltsFluencyCoherenceBand: 7,
      ieltsLexicalResourceBand: 6,
      ieltsGrammaticalRangeAccuracyBand: 6,
      ieltsPronunciationBand: 7,
      feedback: 'Keep the same clear pace.',
      updatedAt: '2026-07-24T10:00:00.000Z'
    }
  ];
  const map = _test.latestByQuestion(attempts);
  assert.equal(_test.findAttempt(item.exercises[0], map, attempts).ieltsOverallBand, 6.5);
  assert.equal(_test.findAttempt(item.exercises[1], map, attempts), null);
  assert.equal(_test.average(attempts, 'ieltsOverallBand'), 6.5);
  assert.equal(fs.existsSync(FONT_PATH), true);
  assert.equal(fs.existsSync(LATIN_FONT_PATH), true);
  const pdf = await buildIeltsSpeakingReportPdf({ item, attempts });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 5000);
});

test('IELTS speaking report source has no model generation dependency', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/ielts-speaking-report-pdf.js'), 'utf8');
  assert.doesNotMatch(source, /openai|terra|chat\.completions|responses\.create/i);
  assert.doesNotMatch(source, /原题原图|imageBuffer|doc\.image/);
  assert.equal(_test.studentVisibleText('模型评分已完成。请增加一个具体例子。'), '请增加一个具体例子。');
});
