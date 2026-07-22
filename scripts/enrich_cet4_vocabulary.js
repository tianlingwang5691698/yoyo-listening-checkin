#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data', 'dictionary-import', 'cet4-v1');
const CANDIDATE_ROOT = path.join(DATA_ROOT, 'candidates');
const FINAL_ROOT = path.join(DATA_ROOT, 'cet4');
const PROGRESS = path.join(DATA_ROOT, 'enrichment-progress.json');
const REPORT = path.join(DATA_ROOT, 'enrichment-report.json');
const BATCH_SIZE = Math.max(5, Math.min(25, Number(process.env.CET4_BATCH_SIZE || 15)));
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.CET4_CONCURRENCY || 8)));
const MANUAL_EXAMPLE_CORRECTIONS = {
  preliminary: {
    example: 'Preliminary results suggest that the new method is effective.',
    exampleMeaning: '初步结果表明这种新方法是有效的。'
  }
};

function clean(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
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
    request.setTimeout(180000, () => request.destroy(new Error('request-timeout')));
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

async function modelConfig() {
  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  const prefix = process.env.MODEL_CONFIG === 'reading' ? 'READING_STUDY' : 'GRAMMAR_EXPLAIN';
  return { endpoint: variables[`${prefix}_ENDPOINT`], apiKey: variables[`${prefix}_API_KEY`], model: process.env.CET4_MODEL || variables[`${prefix}_MODEL`] || 'gpt-5.6-sol' };
}

function validItem(item, expectedId) {
  const definitions = Array.isArray(item && item.definitions) ? item.definitions.map(clean).filter(Boolean) : [];
  const phonetic = clean(item && item.phonetic);
  const example = clean(item && item.example);
  const exampleMeaning = clean(item && item.exampleMeaning);
  return item && item.id === expectedId && definitions.length > 0
    && definitions.every((value) => /[\u3400-\u9fff]/.test(value) && value.length <= 180)
    && /^\/.{1,80}\/$/.test(phonetic) && !/[\u3400-\u9fff]/.test(phonetic)
    && example.split(/\s+/).length >= 5 && example.split(/\s+/).length <= 24
    && /[.!?]$/.test(example) && !/[\u3400-\u9fff]/.test(example)
    && /[\u3400-\u9fff]/.test(exampleMeaning);
}

async function callModel(config, batch, audit) {
  const task = audit
    ? 'Audit and correct every supplied final entry against its PDF OCR context and the headword-order reference. Keep accurate content and repair only errors.'
    : 'Create the publishable fields for every item by normalizing the PDF OCR and the short headword-order reference.';
  const prompt = [
    'You are a meticulous CET-4 vocabulary editor for Chinese learners.',
    task,
    'The PDF OCR is the primary source. The short referenceMeaning is a secondary clue and may be incomplete or wrong. Do not copy OCR noise, mnemonics, headers, questions, answer explanations, or nearby headwords.',
    'definitions must be a non-empty array. Preserve the source book senses and part-of-speech labels; use compact forms such as "n. 情绪；语气". Do not add unrelated senses.',
    'phonetic must be one clean British learner IPA wrapped in /.../. Correct obvious OCR corruption.',
    'Write one natural B1-B2 example of 7-18 words and a faithful Chinese translation. The exact headword or a natural inflected form must occur in the English sentence.',
    'For systematic(al), use systematic in the example. Avoid politics, violence, brands, personal data, quotations, and controversial content.',
    'Return every id exactly once as JSON only: {"items":[{"id":"","definitions":[""],"phonetic":"/.../","example":"","exampleMeaning":""}]}.',
    JSON.stringify(batch)
  ].join('\n');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await requestJson(config.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }
      }, { model: config.model, temperature: 0.1, messages: [{ role: 'user', content: prompt }] });
      const items = parseItems(responseText(response));
      if (items.length !== batch.length) throw new Error(`invalid-items:${items.length}/${batch.length}`);
      const index = new Map(items.map((item) => [item.id, item]));
      if (batch.some((expected) => !validItem(index.get(expected.id), expected.id))) throw new Error('invalid-item-fields');
      return batch.map((expected) => index.get(expected.id));
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  return [];
}

function loadRows() {
  const books = [];
  const items = [];
  for (let list = 1; list <= 35; list += 1) {
    const rows = JSON.parse(fs.readFileSync(path.join(CANDIDATE_ROOT, `list-${list}.json`), 'utf8'));
    books.push({ list, rows });
    rows.forEach((row, index) => items.push({
      id: `cet4-list-${list}-${index}`,
      list,
      index,
      word: row.word,
      referenceMeaning: row.referenceMeaning,
      ocrContext: row.ocrContext,
      ocrMatch: row.ocrMatch,
      sourcePage: row.sourcePage
    }));
  }
  return { books, items };
}

function writeProgress(stage, generated, results) {
  fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage, generated, results }, null, 2)}\n`);
}

async function runBatches(config, batches, audit, generated, completed = {}) {
  const results = { ...completed };
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const index = cursor++;
      const batch = batches[index];
      if (batch.every((item) => results[item.id])) continue;
      const payload = audit ? batch.map((item) => ({ ...item, ...generated[item.id] })) : batch;
      const values = await callModel(config, payload, audit);
      values.forEach((item) => {
        results[item.id] = {
          definitions: item.definitions.map(clean).filter(Boolean),
          phonetic: clean(item.phonetic),
          example: clean(item.example),
          exampleMeaning: clean(item.exampleMeaning)
        };
      });
      writeProgress(audit ? 'audit' : 'generate', generated, results);
      console.log(`${audit ? 'audited' : 'generated'} ${Object.keys(results).length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

async function main() {
  fs.mkdirSync(FINAL_ROOT, { recursive: true });
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  const { books, items } = loadRows();
  const batches = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) batches.push(items.slice(offset, offset + BATCH_SIZE));
  const prior = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
  const generated = prior.stage === 'audit' || prior.stage === 'complete'
    ? (prior.generated || {})
    : await runBatches(config, batches, false, {}, prior.stage === 'generate' ? (prior.results || {}) : {});
  const priorAudited = prior.stage === 'audit' ? (prior.results || {}) : {};
  const audited = process.env.SINGLE_PASS === '1'
    ? generated
    : process.env.ALLOW_PARTIAL_AUDIT === '1'
      ? Object.assign({}, generated, priorAudited)
      : await runBatches(config, batches, true, generated, priorAudited);
  let missing = 0;
  for (const book of books) {
    const finalRows = book.rows.map((row, index) => {
      const id = `cet4-list-${book.list}-${index}`;
      const value = Object.assign({}, audited[id] || {});
      const modelAudited = !!priorAudited[id];
      const manualExample = MANUAL_EXAMPLE_CORRECTIONS[row.wordLower];
      if (manualExample) Object.assign(value, manualExample);
      if (!value) missing += 1;
      return {
        word: row.word,
        wordLower: row.wordLower,
        level: 'cet4',
        list: book.list,
        ...(value || {}),
        source: row.source,
        sourceFiles: row.sourceFiles,
        sourcePage: row.sourcePage,
        definitionSource: modelAudited ? 'source-pdf-ocr-model-audited' : 'source-pdf-ocr-model-normalized',
        phoneticSource: `model:${config.model}:${modelAudited ? 'audited' : 'generated'}`,
        exampleSource: manualExample ? 'manual-reviewed' : `model:${config.model}:${modelAudited ? 'audited' : 'generated'}`,
        auditStatus: modelAudited ? 'model-audited' : 'deterministic-pending'
      };
    });
    fs.writeFileSync(path.join(FINAL_ROOT, `list-${book.list}.json`), `${JSON.stringify(finalRows, null, 2)}\n`);
  }
  const report = {
    model: config.model,
    total: items.length,
    lists: books.map((book) => ({ list: book.list, count: book.rows.length })),
    generated: Object.keys(generated).length,
    modelAudited: Object.keys(priorAudited).length,
    deterministicPending: items.length - Object.keys(priorAudited).length,
    missing,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  writeProgress('complete', generated, audited);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
