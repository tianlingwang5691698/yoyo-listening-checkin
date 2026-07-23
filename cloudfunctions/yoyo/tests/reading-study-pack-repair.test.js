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

test('accepts IELTS response aliases and falls back to one-question repair', async () => {
  const passage = {
    title: 'Cambridge IELTS reading',
    passage: 'The passage does not state the proposed date.',
    questions: [
      { number: 14, prompt: 'The plan has a fixed date.', answer: 'NOT GIVEN' },
      { number: 15, prompt: 'The plan is optional.', answer: 'FALSE' }
    ]
  };
  const calls = [];
  const requestJson = async (model, prompt) => {
    calls.push(prompt);
    if (calls.length === 1) {
      return [{
        question_number: 'Question 14',
        correct_answer: 'TRUE',
        evidence_sentence: 'The passage does not state the proposed date.',
        evidence_translation: '文章没有说明拟定日期。',
        explanation: '原文未提供固定日期，因此为 NOT GIVEN。'
      }];
    }
    if (calls.length === 2) {
      return { questions: [] };
    }
    return {
      answer: 'TRUE',
      evidence: { quote: 'The plan is optional.' },
      translation: '该计划是可选的。',
      rationale: '原文直接说明可选，因此题干说法错误。'
    };
  };

  const result = await readingService._test.buildQuestionStudyPackWithRequester(
    passage,
    'gpt-5.6-terra',
    requestJson
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(result.questionAnalyses.map((item) => item.number), [14, 15]);
  assert.equal(result.questionAnalyses[0].answer, 'NOT GIVEN');
  assert.equal(result.questionAnalyses[1].answer, 'FALSE');
  assert.equal(result.questionAnalyses[1].answerSentence, 'The plan is optional.');
});

test('parses fenced top-level JSON arrays', () => {
  const parsed = readingService._test.parseJsonText('结果如下：```json\n[{"number":1}]\n```');
  assert.deepEqual(parsed, [{ number: 1 }]);
});
