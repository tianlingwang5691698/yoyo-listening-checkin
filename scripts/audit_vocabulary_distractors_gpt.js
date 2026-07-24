#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');
const { formatVocabularyDefinitions } = require('../utils/vocabulary-definitions');
const { buildRecognitionQuestions } = require('../pages/reading/shared/vocabulary-recognition');

const ROOT = path.join(__dirname, '..');
const MODEL = 'gpt-5.6-sol';
const INPUT = process.env.VOCABULARY_DISTRACTOR_INPUT
  || path.join(ROOT, 'data/dictionary-import/school-examples-v1/senior/list-4.json');
const OUTPUT = process.env.VOCABULARY_DISTRACTOR_OUTPUT
  || path.join(ROOT, 'data/dictionary-import/distractor-audits/senior-list-4.json');

function credential() {
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
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${text.slice(0, 300)}`));
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
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

function parseAudit(value) {
  try { return JSON.parse(value); } catch (error) {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

async function modelConfig() {
  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  return { endpoint: variables.GRAMMAR_EXPLAIN_ENDPOINT, apiKey: variables.GRAMMAR_EXPLAIN_API_KEY };
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const cards = rows.map((row, index) => ({
    key: String(row.word || index),
    word: String(row.word || ''),
    meaning: formatVocabularyDefinitions(row.definitions)
  })).filter((item) => item.word && item.meaning);
  const questions = buildRecognitionQuestions(cards, cards.length, () => 0.37).map((item) => ({
    targetWord: item.word,
    targetMeaning: item.meaning,
    distractors: item.options.filter((option) => !option.correct).map((option) => ({ word: option.key, meaning: option.text }))
  }));
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  const prompt = [
    'You are auditing Chinese definitions used as distractors in an English vocabulary exercise.',
    'For every target and each distractor, decide whether it is suitable.',
    'Suitable means: the definition is clean and accurate; preferably the same part of speech; clearly not a synonym, near-synonym, alternate sense, or translation overlap of the target; plausible enough to test recognition; no OCR residue.',
    'Mark unsuitable when ambiguity could make more than one option defensible.',
    'Return JSON only: {"questions":[{"targetWord":"","targetPos":"","allSuitable":true,"distractors":[{"word":"","pos":"","suitable":true,"reason":""}]}]}.',
    JSON.stringify(questions)
  ].join('\n');
  const response = await requestJson(config.endpoint, { model: MODEL, temperature: 0, messages: [{ role: 'user', content: prompt }] }, config.apiKey);
  const audit = parseAudit(responseText(response));
  const auditedQuestions = Array.isArray(audit.questions) ? audit.questions : [];
  const unsuitable = auditedQuestions.flatMap((item) => (item.distractors || []).filter((row) => row.suitable === false).map((row) => ({ targetWord: item.targetWord, ...row })));
  const report = { generatedAt: new Date().toISOString(), model: MODEL, input: path.relative(ROOT, INPUT), questionCount: questions.length, unsuitableCount: unsuitable.length, unsuitable, questions, audit };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ model: MODEL, questionCount: questions.length, unsuitableCount: unsuitable.length, output: path.relative(ROOT, OUTPUT) }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
