#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { stripRepeatedQuestionTitles } = require('../utils/listening-question-display');

const ROOT = path.join(__dirname, '..');
const DEFAULT_BOOKS = [16, 17, 18, 19, 20];
const selectedBooks = process.argv.filter((value) => /^\d+$/.test(value)).map(Number);
const BOOKS = selectedBooks.length ? selectedBooks : DEFAULT_BOOKS;
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', `audit-${Math.min(...BOOKS)}-${Math.max(...BOOKS)}.json`);

function readJson(localPath) {
  return JSON.parse(fs.readFileSync(localPath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function itemFileName(id) {
  return require('crypto').createHash('sha1').update(id).digest('hex') + '.json';
}

function fileExists(relativePath) {
  return !!relativePath && fs.existsSync(path.join(ROOT, relativePath));
}

function probeAudio(relativePath) {
  return JSON.parse(childProcess.execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,sample_rate,channels,bit_rate',
    '-of', 'json', path.join(ROOT, relativePath)
  ], { encoding: 'utf8' }));
}

function auditQuestions(questions, first, last, context) {
  assert(Array.isArray(questions), `${context}:questions`);
  const numbers = questions.map((item) => Number(item.number));
  const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  assert(numbers.join(',') === expected.join(','), `${context}:numbers:${numbers.join(',')}`);
  questions.forEach((item) => {
    assert(String(item.prompt || '').trim(), `${context}:prompt:${item.number}`);
    assert(String(item.answer || '').trim(), `${context}:answer:${item.number}`);
    assert(Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length, `${context}:accepted:${item.number}`);
    assert(!/original paper|page above|refer to (?:the )?(?:page|image|map|plan|diagram)/i.test(item.prompt), `${context}:placeholder:${item.number}`);
    const displayPrompt = stripRepeatedQuestionTitles(item.prompt, item.formTitle, item.groupTitle).trim().toLowerCase();
    ['groupTitle', 'formTitle', 'noteHeading'].forEach((key) => {
      const heading = String(item[key] || '').trim().toLowerCase();
      if (heading) assert(displayPrompt !== heading, `${context}:repeated-${key}:${item.number}`);
    });
    (item.sourceImages || []).forEach((asset) => assert(fileExists(asset.localPath), `${context}:asset:${item.number}`));
  });
}

function auditBook(book) {
  const root = path.join(ROOT, 'data', 'ielts-academic', `cambridge-${book}`);
  const report = readJson(path.join(root, 'clean-report.json'));
  assert(report.model === 'gpt-5.6-sol', `book-${book}:model`);
  assert(report.uncertainCount === 0 && report.errors.length === 0, `book-${book}:uncertain`);
  assert(report.listeningQuestions === 160 && report.readingQuestions === 160 && report.writingTasks === 8 && report.speakingTests === 4, `book-${book}:counts`);

  const listeningIndex = readJson(path.join(root, 'listening', 'index.json'));
  const writingIndex = readJson(path.join(root, 'writing', 'index.json'));
  const speakingIndex = readJson(path.join(root, 'speaking', 'index.json'));
  const reading = readJson(path.join(root, 'reading', 'v2', 'reading-passages.json'));
  assert(listeningIndex.length === 4 && writingIndex.length === 8 && speakingIndex.length === 4 && reading.length === 12, `book-${book}:index-counts`);

  const audio = [];
  listeningIndex.forEach((summary, index) => {
    const item = readJson(path.join(root, 'listening', 'items-v2', itemFileName(summary._id)));
    auditQuestions(item.questions, 1, 40, `book-${book}:listening-${index + 1}`);
    assert([1, 2, 3, 4].every((part) => item.questions.some((question) => String(question.sectionKey).replace(/\D/g, '') === String(part))), `book-${book}:listening-parts-${index + 1}`);
    assert(item.transcript.length >= 8000 && /(?:PART|SECTION)\s*1/i.test(item.transcript) && /(?:PART|SECTION)\s*4/i.test(item.transcript), `book-${book}:transcript-${index + 1}`);
    assert(fileExists(item.audioLocalPath), `book-${book}:audio-file-${index + 1}`);
    const probe = probeAudio(item.audioLocalPath);
    const stream = probe.streams[0] || {};
    assert(stream.codec_name === 'mp3' && Number(stream.sample_rate) === 32000 && Number(stream.channels) === 1 && Number(stream.bit_rate) === 64000, `book-${book}:audio-format-${index + 1}`);
    audio.push({ test: Number(summary.testNumber || index + 1), durationSec: item.durationSec, size: Number(probe.format.size), cloudPath: item.audioCloudPath });
  });

  reading.forEach((item, index) => {
    const passage = index % 3;
    const ranges = [[1, 13], [14, 26], [27, 40]][passage];
    assert(String(item.title || '').trim(), `book-${book}:reading-title-${index + 1}`);
    assert(item.passage.length >= 1000, `book-${book}:reading-text-${index + 1}`);
    auditQuestions(item.questions, ranges[0], ranges[1], `book-${book}:reading-${index + 1}`);
  });

  writingIndex.forEach((summary) => {
    const item = readJson(path.join(root, 'writing', 'items-v3', itemFileName(summary._id)));
    assert(item.prompt && item.scenario && item.requirements.length, `book-${book}:writing:${item._id}`);
    if (item.paperOrder === 1) {
      assert(item.images.length === 1 && fileExists(item.images[0].localPath), `book-${book}:writing-image:${item._id}`);
    } else {
      assert(item.images.length === 0, `book-${book}:writing-task2-image:${item._id}`);
    }
  });

  speakingIndex.forEach((summary) => {
    const item = readJson(path.join(root, 'speaking', 'items-v1', itemFileName(summary._id)));
    assert(item.images.length === 1 && fileExists(item.images[0].localPath), `book-${book}:speaking-image:${item._id}`);
    assert([1, 2, 3].every((part) => item.exercises.some((exercise) => exercise.part === part)), `book-${book}:speaking-parts:${item._id}`);
    assert(item.exercises.every((exercise) => exercise.id && exercise.prompt), `book-${book}:speaking-prompts:${item._id}`);
    assert(item.exercises.every((exercise) => exercise.part === 2 || (exercise.prompt.match(/\?/g) || []).length <= 3), `book-${book}:speaking-question-split:${item._id}`);
  });

  return { book, listeningTests: 4, readingPassages: 12, writingTasks: 8, speakingTests: 4, audio };
}

function main() {
  const rows = BOOKS.map(auditBook);
  const report = { passed: true, checkedAt: new Date().toISOString(), books: rows, totals: { listeningTests: BOOKS.length * 4, listeningQuestions: BOOKS.length * 160, readingPassages: BOOKS.length * 12, readingQuestions: BOOKS.length * 160, writingTasks: BOOKS.length * 8, speakingTests: BOOKS.length * 4 } };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.totals, null, 2));
}

try {
  main();
} catch (error) {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), error: error.message }, null, 2)}\n`);
  console.error(error.stack || error);
  process.exit(1);
}
