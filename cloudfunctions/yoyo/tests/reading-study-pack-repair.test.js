const test = require('node:test');
const assert = require('node:assert/strict');

const readingService = require('../services/reading.service');

test('repairs a missing question analysis and preserves the official answer', async () => {
  const passage = {
    title: 'Test passage',
    passage: 'Sentence one. Sentence two. Sentence three. Sentence four.',
    questions: [
      { number: 1, prompt: 'Q1', options: { A: 'A1', B: 'B1' }, answer: 'A' },
      { number: 2, prompt: 'Q2', options: { A: 'A2', B: 'B2' }, answer: 'B' },
      { number: 3, prompt: 'Q3', options: { A: 'A3', B: 'B3' }, answer: 'A' },
      { number: 4, prompt: 'Q4', options: { C: 'C4', D: 'D4' }, answer: 'D' }
    ]
  };
  const calls = [];
  const requestJson = async (model, prompt) => {
    calls.push({ model, prompt });
    if (calls.length === 1) {
      return {
        questionAnalyses: [1, 2, 3].map((number) => ({
          number,
          answer: number === 2 ? 'B' : 'A',
          answerSentence: `Sentence ${number}.`,
          answerSentenceTranslation: `句子 ${number}`,
          analysis: `第 ${number} 题解析`
        }))
      };
    }
    return {
      questionAnalyses: [{
        number: 4,
        answer: 'C',
        answerSentence: 'Sentence four.',
        answerSentenceTranslation: '句子四',
        analysis: '第 4 题解析'
      }]
    };
  };

  const result = await readingService._test.buildQuestionStudyPackWithRequester(
    passage,
    'gpt-5.6-terra',
    requestJson
  );

  assert.equal(calls.length, 2);
  assert.match(calls[1].prompt, /漏题补全请求/);
  assert.match(calls[1].prompt, /"number":4/);
  assert.doesNotMatch(calls[1].prompt, /"number":1/);
  assert.deepEqual(result.questionAnalyses.map((item) => item.number), [1, 2, 3, 4]);
  assert.equal(result.questionAnalyses[3].answer, 'D');
  assert.equal(result.questionAnalyses[3].analysis, '第 4 题解析');
});
