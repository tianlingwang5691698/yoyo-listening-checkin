#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const TARGET = process.env.VOCABULARY_TARGET === 'ielts' ? 'ielts' : 'school';
const OUTPUT = path.join(ROOT, 'data', 'dictionary-import', TARGET === 'ielts' ? 'ielts-examples-v1' : 'school-examples-v1');
const PROGRESS = path.join(OUTPUT, 'progress.json');
const REPORT = path.join(OUTPUT, 'clean-report.json');
const REMOTE_BASE = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const BOOKS = TARGET === 'ielts' ? [['ielts', 48]] : [['junior', 32], ['senior', 40]];
const BATCH_SIZE = TARGET === 'ielts' ? 40 : 20;
const CONCURRENCY = TARGET === 'ielts' ? 10 : 4;

async function loadSchoolPhonetics() {
  const index = new Map();
  for (const stage of ['junior', 'senior']) {
    const rows = await requestJson(`${REMOTE_BASE}/dictionary_books/word-dictionary-${stage}.json?phonetics=20260718`);
    rows.forEach((row) => {
      const word = clean(row.word || row.wordLower).toLowerCase();
      const phonetic = clean(row.phonetic);
      if (word && phonetic && !index.has(word)) index.set(word, phonetic);
    });
  }
  return index;
}

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function requestJson(url, options = {}, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = https.request({ hostname: parsed.hostname, port: parsed.port || 443, path: `${parsed.pathname}${parsed.search}`, ...options }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${text.slice(0, 240)}`));
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(120000, () => request.destroy(new Error('request-timeout')));
    request.on('error', reject);
    request.end(payload ? JSON.stringify(payload) : undefined);
  });
}

function responseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const content = (((response.choices || [])[0] || {}).message || {}).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => item.text || item.content || '').join('\n');
  return '';
}

function parseItems(text) {
  try { return JSON.parse(text).items || []; } catch (_) {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('model-json-missing');
    return JSON.parse(match[0]).items || [];
  }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validItem(item) {
  const example = clean(item && item.example);
  const exampleMeaning = clean(item && item.exampleMeaning);
  const wordCount = example.split(/\s+/).filter(Boolean).length;
  return !!(item && item.id && wordCount >= 4 && wordCount <= 22 && /[.!?]$/.test(example)
    && !/[\u3400-\u9fff]/.test(example) && /[\u3400-\u9fff]/.test(exampleMeaning));
}

async function modelConfig() {
  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  const prefix = process.env.MODEL_CONFIG === 'speaking' ? 'SPEAKING_SCORE' : (process.env.MODEL_CONFIG === 'reading' ? 'READING_STUDY' : 'GRAMMAR_EXPLAIN');
  return { endpoint: variables[`${prefix}_ENDPOINT`], apiKey: variables[`${prefix}_API_KEY`], model: variables[`${prefix}_MODEL`] || 'gpt-5.6-sol' };
}

async function callModel(config, batch, audit) {
  const prompt = [
    TARGET === 'ielts' ? 'You are an IELTS vocabulary editor for Chinese learners.' : 'You are an English vocabulary editor for Chinese secondary-school learners.',
    audit ? 'Audit every supplied example and translation. Keep good pairs; rewrite weak, unnatural, ambiguous, semantically wrong, or level-inappropriate pairs.' : 'Write one example sentence and one faithful Chinese translation for every item.',
    'The exact target word or a natural inflected form must appear in the English sentence and demonstrate the listed meaning.',
    'junior: A1-B1, preferably 6-12 words, familiar daily or school contexts, simple grammar.',
    'senior: B1-B2, preferably 8-18 words, natural senior-high exam, academic, social, or daily contexts; avoid rare vocabulary and overly complex clauses.',
    'ielts: B2-C1, preferably 8-20 words, natural IELTS academic, social, workplace, environmental, or daily contexts; keep grammar clear and avoid obscure words unrelated to the target.',
    'No quotations, labels, explanations, politics, violence, brands, personal data, or controversial content.',
    'Return every id exactly once as JSON only: {"items":[{"id":"","example":"","exampleMeaning":""}]}.',
    JSON.stringify(batch)
  ].join('\n');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await requestJson(config.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }
      }, { model: config.model, temperature: 0.2, messages: [{ role: 'user', content: prompt }] });
      const items = parseItems(responseText(response));
      if (items.length !== batch.length || items.some((item) => !validItem(item))) throw new Error(`invalid-items:${items.length}/${batch.length}`);
      return items;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  return [];
}

async function loadBooks() {
  const books = [];
  const items = [];
  const schoolPhonetics = TARGET === 'school' ? await loadSchoolPhonetics() : new Map();
  for (const [stage, count] of BOOKS) {
    for (let list = 1; list <= count; list += 1) {
      const rows = TARGET === 'ielts'
        ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dictionary-import', 'ielts-vocabulary-v1', `list-${list}.json`), 'utf8'))
        : await requestJson(`${REMOTE_BASE}/dictionary_books/word-lists-v1/${stage}/list-${list}.json?examples=20260718`);
      rows.forEach((row) => {
        if (!clean(row.phonetic)) row.phonetic = schoolPhonetics.get(clean(row.word || row.wordLower).toLowerCase()) || '';
      });
      books.push({ stage, list, rows });
      rows.forEach((row, index) => items.push({
        id: `${stage}-list-${list}-${index}`,
        stage,
        list,
        index,
        word: row.word,
        definitions: row.definitions || []
      }));
    }
  }
  return { books, items };
}

async function runBatches(config, batches, audit, completed = {}) {
  const results = { ...completed };
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const index = cursor++;
      const batch = batches[index];
      if (batch.every((item) => results[item.id])) continue;
      const payload = audit ? batch.map((item) => ({ ...item, ...results[item.id] })) : batch;
      const generated = await callModel(config, payload, audit);
      generated.forEach((item) => { results[item.id] = { example: clean(item.example), exampleMeaning: clean(item.exampleMeaning) }; });
      fs.mkdirSync(OUTPUT, { recursive: true });
      const checkpoint = { stage: audit ? 'audit' : 'generate', completed: Object.keys(results).length, results };
      if (audit && runBatches.generated) checkpoint.generated = runBatches.generated;
      fs.writeFileSync(PROGRESS, `${JSON.stringify(checkpoint, null, 2)}\n`);
      console.log(`${audit ? 'audited' : 'generated'} ${Object.keys(results).length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  const { books, items } = await loadBooks();
  const batches = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) batches.push(items.slice(offset, offset + BATCH_SIZE));
  const prior = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
  const generated = prior.stage === 'audit'
    ? (prior.generated || {})
    : await runBatches(config, batches, false, prior.stage === 'generate' ? (prior.results || {}) : {});
  const priorAudited = prior.stage === 'audit' ? (prior.results || {}) : {};
  if (prior.stage !== 'audit') fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage: 'audit', completed: 0, generated, results: {} }, null, 2)}\n`);
  const auditCompleted = Object.keys(priorAudited).length;
  runBatches.generated = generated;
  const audited = process.env.SINGLE_PASS === '1'
    ? generated
    : process.env.ALLOW_PARTIAL_AUDIT === '1'
    ? Object.assign({}, generated, priorAudited)
    : await runBatches(config, batches.map((batch) => batch.map((item) => ({ ...item, ...generated[item.id] }))), true, priorAudited);
  for (const book of books) {
    for (let index = 0; index < book.rows.length; index += 1) {
      const id = `${book.stage}-list-${book.list}-${index}`;
      Object.assign(book.rows[index], audited[id], { exampleSource: `model:${config.model}:${TARGET}-level-${process.env.SINGLE_PASS !== '1' && priorAudited[id] ? 'audited' : 'generated'}` });
    }
    const dir = path.join(OUTPUT, book.stage);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `list-${book.list}.json`), `${JSON.stringify(book.rows, null, 2)}\n`);
  }
  const report = { model: config.model, target: TARGET, total: items.length, auditCompleted: process.env.SINGLE_PASS === '1' ? 0 : (process.env.ALLOW_PARTIAL_AUDIT === '1' ? auditCompleted : items.length), junior: items.filter((item) => item.stage === 'junior').length, senior: items.filter((item) => item.stage === 'senior').length, ielts: items.filter((item) => item.stage === 'ielts').length, missingExample: items.filter((item) => !audited[item.id]).length, generatedAt: new Date().toISOString() };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage: 'complete', report }, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
