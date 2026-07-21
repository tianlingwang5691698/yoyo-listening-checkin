#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const MODEL = 'gpt-5.6-sol';
const yearArg = process.argv.find((value) => value.startsWith('--year='));
const sessionArg = process.argv.find((value) => value.startsWith('--session='));
const year = Number(yearArg ? yearArg.slice('--year='.length) : 2012);
const session = sessionArg ? sessionArg.slice('--session='.length) : 'autumn';
const moduleDir = path.join(ROOT, 'data', `grammar-senior-${session}`, 'years', String(year));
const inputPath = path.join(moduleDir, 'shanghai-senior-grammar-questions.json');
const outputPath = path.join(moduleDir, `grammar-classification-review-${year}-${session}.json`);

const TOPICS = [
  ['verb', '动词类', 'verb:modal', '情态动词'],
  ['verb', '动词类', 'verb:nonfinite', '非谓语'],
  ['verb', '动词类', 'verb:tense-voice', '时态语态'],
  ['lexical', '词法类', 'lexical:article', '冠词'],
  ['lexical', '词法类', 'lexical:preposition', '介词'],
  ['lexical', '词法类', 'lexical:pronoun', '代词'],
  ['lexical', '词法类', 'lexical:usage', '词义与用法'],
  ['clause', '从句类', 'clause:adverbial', '状语从句'],
  ['clause', '从句类', 'clause:noun', '名词性从句'],
  ['clause', '从句类', 'clause:relative', '定语从句'],
  ['sentence', '句型结构类', 'sentence:emphasis', '强调句'],
  ['sentence', '句型结构类', 'sentence:inversion', '倒装句'],
  ['sentence', '句型结构类', 'sentence:tag-question', '反意疑问句'],
  ['logic', '连词逻辑类', 'logic:clause-link', '从属连词'],
  ['communicative', '情景交际类', 'communicative:daily', '日常口语表达'],
].map(([categoryId, category, subtopicId, subtopic]) => ({ categoryId, category, subtopicId, subtopic }));

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function requestJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(180000, () => request.destroy(new Error('request-timeout')));
    request.on('error', reject);
    request.end(JSON.stringify(payload));
  });
}

function responseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const content = (((response.choices || [])[0] || {}).message || {}).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => item.text || item.content || '').join('\n');
  return '';
}

function parseJson(value) {
  try { return JSON.parse(value); } catch (error) {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

async function modelConfig() {
  const manager = CloudBase.init({ ...credentials(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  return { endpoint: variables.GRAMMAR_EXPLAIN_ENDPOINT, apiKey: variables.GRAMMAR_EXPLAIN_API_KEY };
}

async function main() {
  const questions = JSON.parse(fs.readFileSync(inputPath, 'utf8')).map(({ number, prompt, options, answer }) => ({ number, prompt, options, answer }));
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  const prompt = [
    '你是上海高中英语真题语法分类审核员。逐题依据正确答案和唯一核心考点分类，干扰项中的关键词不得影响分类。',
    '只能从给定 topic 列表中选择。rationale 用一句简洁中文说明为什么正确答案体现该主考点。',
    '只返回 JSON：{"questions":[{"number":25,"categoryId":"","category":"","subtopicId":"","subtopic":"","rationale":""}]}。题目不得遗漏、重复或改号。',
    `topics=${JSON.stringify(TOPICS)}`,
    `questions=${JSON.stringify(questions)}`,
  ].join('\n');
  const response = await requestJson(config.endpoint, { model: MODEL, temperature: 0, messages: [{ role: 'user', content: prompt }] }, config.apiKey);
  const reviewed = parseJson(responseText(response)).questions || [];
  const topicMap = new Map(TOPICS.map((item) => [item.subtopicId, item]));
  if (reviewed.length !== questions.length || new Set(reviewed.map((item) => Number(item.number))).size !== questions.length) throw new Error('review-question-set-invalid');
  const rows = reviewed.sort((a, b) => Number(a.number) - Number(b.number)).map((row) => {
    const topic = topicMap.get(row.subtopicId);
    if (!topic) throw new Error(`review-topic-invalid:${row.number}:${row.subtopicId}`);
    return { number: Number(row.number), ...topic, rationale: String(row.rationale || '').trim() };
  });
  const report = {
    examId: session,
    year,
    model: MODEL,
    reviewedAt: new Date().toISOString().slice(0, 10),
    classificationRevision: 2,
    rule: 'Classify by the correct answer and the single primary tested grammar point; distractor keywords must not determine the topic.',
    questions: rows,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ model: MODEL, year, session, questionCount: rows.length, output: path.relative(ROOT, outputPath) }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
