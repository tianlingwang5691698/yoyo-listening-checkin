#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'examples-candidate');
const MISSING = path.join(OUTPUT, 'missing-items.json');
const PROGRESS = path.join(OUTPUT, 'model-progress.json');
const BATCH_SIZE = 24;

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function postJson(url, apiKey, payload) {
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
        if ((response.statusCode || 500) >= 400) return reject(new Error(`model-http-${response.statusCode}:${text.slice(0, 300)}`));
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(120000, () => request.destroy(new Error('model-timeout')));
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

function parseJson(text) {
  try { return JSON.parse(text); } catch (_) {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('model-json-missing');
    return JSON.parse(match[0]);
  }
}

function validSentence(value) {
  const sentence = String(value || '').replace(/\s+/g, ' ').trim();
  const words = sentence.split(/\s+/).filter(Boolean);
  return sentence && words.length >= 4 && words.length <= 24 && /[.!?]$/.test(sentence) && !/[\u3400-\u9fff]/.test(sentence);
}

async function requestBatch(endpoint, apiKey, model, batch, audit = false) {
  const task = audit
    ? 'Audit every example. Keep good sentences unchanged; rewrite any sentence that is unnatural, semantically wrong, too difficult for its level, or unlike an Unlock textbook example.'
    : 'Write one natural example sentence for every item.';
  const prompt = [
    'You are a Cambridge Unlock vocabulary editor.',
    task,
    'Use the exact vocabulary item naturally and demonstrate its listed meaning.',
    'Difficulty: Unlock 1=A1, Unlock 2=A2, Unlock 3=B1. Use clear academic or everyday textbook contexts.',
    'Use 5-18 words where possible. No quotations, labels, explanations, translations, politics, violence, or brand promotion.',
    'Return every id exactly once as JSON only: {"items":[{"id":"","example":""}]}.',
    JSON.stringify(batch)
  ].join('\n');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await postJson(endpoint, apiKey, { model, temperature: 0.2, messages: [{ role: 'user', content: prompt }] });
      const items = parseJson(responseText(response)).items || [];
      if (items.length !== batch.length || items.some((item) => !validSentence(item.example))) throw new Error(`model-invalid-items:${items.length}/${batch.length}`);
      return items;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  return [];
}

async function modelConfig() {
  const keys = credential();
  const manager = CloudBase.init({ ...keys, envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  return {
    endpoint: variables.GRAMMAR_EXPLAIN_ENDPOINT || variables.READING_STUDY_ENDPOINT,
    apiKey: variables.GRAMMAR_EXPLAIN_API_KEY || variables.READING_STUDY_API_KEY,
    model: variables.GRAMMAR_EXPLAIN_MODEL || variables.READING_STUDY_MODEL || 'gpt-5.5'
  };
}

function applyExamples(items, source) {
  const byId = new Map(items.map((item) => [item.id, String(item.example || '').replace(/\s+/g, ' ').trim()]));
  const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8'));
  for (const item of missing) {
    const example = byId.get(item.id);
    if (!example) throw new Error(`missing-generated-example:${item.id}`);
    const file = path.join(OUTPUT, `level-${item.level}`, `unit-${item.unit}`, `${item.section.toLowerCase()}.json`);
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    rows[item.index].example = example;
    rows[item.index].exampleSource = source;
    fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
  }
}

async function auditUnlock1(config) {
  const items = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const file = path.join(OUTPUT, 'level-1', `unit-${unit}`, `${section}.json`);
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.forEach((row, index) => items.push({
        id: `audit-unlock-1-u${unit}-${section}-${index}`,
        level: 1,
        unit,
        section: section.toUpperCase(),
        index,
        word: row.word,
        definitions: row.definitions || [],
        example: row.example
      }));
    }
  }
  const audited = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    audited.push(...await requestBatch(config.endpoint, config.apiKey, config.model, batch, true));
    fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage: 'audit-unlock1', completed: audited.length, total: items.length, items: audited }, null, 2)}\n`);
    console.log(`audited unlock1 ${audited.length}/${items.length}`);
  }
  const byId = new Map(audited.map((item) => [item.id, item.example]));
  for (const item of items) {
    const file = path.join(OUTPUT, 'level-1', `unit-${item.unit}`, `${item.section.toLowerCase()}.json`);
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    rows[item.index].example = byId.get(item.id);
    rows[item.index].exampleSource = `model:${config.model}:unlock1-full-audit`;
    fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(OUTPUT, 'unlock1-full-audit.json'), `${JSON.stringify(audited, null, 2)}\n`);
  return audited.length;
}

async function main() {
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  if (process.argv.includes('--audit-unlock1-only')) {
    const unlock1Audited = await auditUnlock1(config);
    console.log(JSON.stringify({ model: config.model, unlock1Audited }, null, 2));
    return;
  }
  const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8'));
  let generated = [];
  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    const batch = missing.slice(offset, offset + BATCH_SIZE);
    generated.push(...await requestBatch(config.endpoint, config.apiKey, config.model, batch));
    fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage: 'generate', completed: generated.length, total: missing.length, items: generated }, null, 2)}\n`);
    console.log(`generated ${generated.length}/${missing.length}`);
  }
  const generatedById = new Map(generated.map((item) => [item.id, item.example]));
  let audited = [];
  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    const batch = missing.slice(offset, offset + BATCH_SIZE).map((item) => ({ ...item, example: generatedById.get(item.id) }));
    audited.push(...await requestBatch(config.endpoint, config.apiKey, config.model, batch, true));
    fs.writeFileSync(PROGRESS, `${JSON.stringify({ stage: 'audit', completed: audited.length, total: missing.length, items: audited }, null, 2)}\n`);
    console.log(`audited ${audited.length}/${missing.length}`);
  }
  applyExamples(audited, `model:${config.model}:audited`);
  fs.writeFileSync(path.join(OUTPUT, 'model-audit.json'), `${JSON.stringify(audited, null, 2)}\n`);
  const unlock1Audited = await auditUnlock1(config);
  console.log(JSON.stringify({ model: config.model, generated: generated.length, audited: audited.length, unlock1Audited }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
