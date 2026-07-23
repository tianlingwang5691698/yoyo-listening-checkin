const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const datasets = [
  { dir: 'data/grammar', minimumCount: 2221 },
  { dir: 'data/grammar-em1-upload', minimumCount: 1914 }
];
const sourceWatermark = /[\[【（(]\s*来源\s*[:：]?/iu;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assertCleanQuestion(question, location) {
  assert.doesNotMatch(String(question.prompt || ''), sourceWatermark, `${location} prompt`);
  for (const key of ['A', 'B', 'C', 'D']) {
    assert.doesNotMatch(String((question.options || {})[key] || ''), sourceWatermark, `${location} option ${key}`);
  }
}

test('初中语法主数据与分题文件没有来源水印且题量不下降', () => {
  datasets.forEach(({ dir, minimumCount }) => {
    const questions = readJson(`${dir}/shanghai-em2-grammar-questions.json`);
    assert.ok(questions.length >= minimumCount, `${dir} question count dropped`);
    assert.equal(new Set(questions.map((item) => item._id)).size, questions.length, `${dir} duplicate _id`);
    questions.forEach((question) => assertCleanQuestion(question, `${dir}/${question._id}`));

    const byTopic = readJson(`${dir}/shanghai-em2-grammar-by-topic.json`);
    const grouped = byTopic.flatMap((group) => group.questions || []);
    assert.equal(grouped.length, questions.length, `${dir} by-topic count mismatch`);
    assert.deepEqual(
      new Set(grouped.map((item) => item._id)),
      new Set(questions.map((item) => item._id)),
      `${dir} by-topic IDs mismatch`
    );
    grouped.forEach((question) => assertCleanQuestion(question, `${dir}/by-topic/${question._id}`));

    byTopic.forEach((group) => {
      const fileName = `${crypto.createHash('sha1').update(group.topicId).digest('hex')}.json`;
      const topic = readJson(`${dir}/topics/${fileName}`);
      assert.equal(topic.topicId, group.topicId);
      assert.deepEqual(topic.questions, group.questions);
      topic.questions.forEach((question) => assertCleanQuestion(question, `${dir}/topics/${question._id}`));
    });
  });
});
