#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function yearItems(moduleName, fileName, year) {
  return readJson(`data/${moduleName}/${fileName}`).filter((item) => Number(item.year || item.sourceYear) === year);
}

function assertPaper(session, year, expected) {
  const reading = yearItems(`reading-senior-${session}`, 'reading-passages.json', year);
  const writing = yearItems(`writing-senior-${session}`, 'writing-prompts.json', year);
  const listening = yearItems(`listening-senior-${session}`, 'listening-practice.json', year);
  assert.equal(reading.length, expected.reading, `${session}-${year}-reading-count`);
  assert.deepEqual(writing.map((item) => item.contentType), expected.writing, `${session}-${year}-writing-order`);
  assert.equal(listening.length, expected.listening ? 1 : 0, `${session}-${year}-listening-count`);
  if (expected.listening) {
    assert.deepEqual(listening[0].questions.map((item) => item.number), Array.from({ length: expected.listening }, (_, index) => index + 1));
    assert.ok(Number(listening[0].durationSec) > 900, `${session}-${year}-duration`);
  }
}

assertPaper('autumn', 2011, { reading: 7, writing: ['translation'], listening: 24 });
assertPaper('autumn', 2012, { reading: 7, writing: ['translation', 'guided-writing'], listening: 24 });
assertPaper('autumn', 2013, { reading: 0, writing: ['translation', 'guided-writing'], listening: 24 });
assertPaper('autumn', 2014, { reading: 7, writing: ['translation', 'guided-writing'], listening: 24 });
assertPaper('spring', 2023, { reading: 6, writing: ['summary-writing', 'translation', 'guided-writing'], listening: 20 });
assertPaper('autumn', 2023, { reading: 7, writing: ['summary-writing', 'translation', 'guided-writing'], listening: 20 });

const writing2011 = yearItems('writing-senior-autumn', 'writing-prompts.json', 2011)[0];
assert.equal(writing2011.questions.length, 5);
assert.match(writing2011.questions[0].referenceAnswers[0], /^Why not\/ Why don’t you book tickets online/);
const listening2011 = yearItems('listening-senior-autumn', 'listening-practice.json', 2011)[0];
assert.equal(listening2011.questions.find((item) => item.number === 24).answer, 'is permanent');

for (const year of [2011, 2012]) {
  const base = `data/grammar-senior-autumn/years/${year}`;
  const questions = readJson(`${base}/shanghai-senior-grammar-questions.json`);
  const review = readJson(`${base}/grammar-classification-review-${year}-autumn.json`);
  assert.equal(questions.length, 16, `autumn-${year}-grammar-count`);
  assert.equal(review.model, 'gpt-5.6-sol', `autumn-${year}-review-model`);
  assert.equal(review.questions.length, 16, `autumn-${year}-review-count`);
  assert.ok(questions.every((item) => item.classificationModel === 'gpt-5.6-sol'));
}

console.log(JSON.stringify({ passed: true, papers: 6, grammarYears: [2011, 2012] }, null, 2));
