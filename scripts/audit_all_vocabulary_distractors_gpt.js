#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');
const { formatVocabularyDefinitions } = require('../utils/vocabulary-definitions');
const { buildRecognitionQuestions, isBlockedDistractorPair, isRecognitionTargetAllowed } = require('../utils/vocabulary-recognition');

const ROOT = path.join(__dirname, '..');
const MODEL = process.env.VOCABULARY_AUDIT_MODEL || 'gpt-5.4-mini';
const CHECKPOINT = path.join(ROOT, 'data/dictionary-import/distractor-audits/all-vocabulary-checkpoint.json');
const REPORT = path.join(ROOT, 'data/dictionary-import/distractor-audits/all-vocabulary.json');
const RUNTIME_DATA = path.join(ROOT, 'utils/vocabulary-distractor-audit-data.js');
const BATCH_WORD_LIMIT = Math.max(50, Number(process.env.VOCABULARY_AUDIT_BATCH_WORDS || 180));
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.VOCABULARY_AUDIT_CONCURRENCY || 3)));
const PREPARE_ONLY = process.argv.includes('--prepare-only');
const RESET = process.argv.includes('--reset');
const POS_VALUES = new Set(['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'art', 'modal', 'phr']);

function enumerateSources() {
  const sources = [];
  [['junior', 32, 'word-lists-examples-v2'], ['senior', 40, 'word-lists-examples-v2'], ['ielts', 48, 'word-lists-examples-v1']]
    .forEach(([stage, count, release]) => {
      for (let list = 1; list <= count; list += 1) {
        sources.push({
          sourceId: `dictionary-book-${stage}-list-${list}`,
          cloudPath: `dictionary_books/${release}/${stage}/list-${list}.json`
        });
      }
    });
  [2, 3].forEach((edition) => {
    for (let level = 1; level <= 4; level += 1) {
      for (let unit = 1; unit <= 8; unit += 1) {
        ['ls', 'rw'].forEach((section) => {
          const levelKey = edition === 3 ? `unlock-v3-${level}-u${unit}-${section}` : `unlock-${level}-u${unit}-${section}`;
          sources.push({
            sourceId: `dictionary-book-${levelKey}`,
            cloudPath: `dictionary_books/unlock-v${edition}/level-${level}/unit-${unit}/${section}.json`
          });
        });
      }
    }
  });
  return sources;
}

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function requestBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const requestOptions = Object.assign({}, options, {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`
    });
    delete requestOptions.body;
    delete requestOptions.timeoutMs;
    const request = https.request(requestOptions, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${body.toString('utf8', 0, 240)}`));
        resolve(body);
      });
    });
    request.setTimeout(Number(options.timeoutMs || 180000), () => request.destroy(new Error('request-timeout')));
    request.on('error', reject);
    if (options.body) request.end(options.body);
    else request.end();
  });
}

async function downloadSource(source) {
  const url = `${String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '')}/${source.cloudPath}`;
  const rows = JSON.parse((await requestBuffer(encodeURI(url))).toString('utf8'));
  if (!Array.isArray(rows)) throw new Error(`source-json-invalid:${source.sourceId}`);
  const seen = new Set();
  const words = rows.map((row) => {
    const word = String(row.word || '').trim();
    const wordLower = String(row.wordLower || word).trim().toLowerCase();
    const meaning = formatVocabularyDefinitions(row.definitions);
    return { word, wordLower, meaning };
  }).filter((item) => item.wordLower && item.meaning && !seen.has(item.wordLower) && seen.add(item.wordLower));
  if (words.length < 4) throw new Error(`source-words-insufficient:${source.sourceId}:${words.length}`);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(words)).digest('hex');
  return Object.assign({}, source, { words, wordCount: words.length, fingerprint });
}

async function loadSources() {
  const sources = enumerateSources();
  const loaded = new Array(sources.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, sources.length) }, async () => {
    while (next < sources.length) {
      const index = next;
      next += 1;
      loaded[index] = await downloadSource(sources[index]);
    }
  }));
  return loaded;
}

function makeBatches(sources) {
  const batches = [];
  let current = [];
  let wordCount = 0;
  sources.forEach((source) => {
    if (current.length && wordCount + source.wordCount > BATCH_WORD_LIMIT) {
      batches.push(current);
      current = [];
      wordCount = 0;
    }
    current.push(source);
    wordCount += source.wordCount;
  });
  if (current.length) batches.push(current);
  return batches;
}

async function modelConfig() {
  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  return {
    endpoint: variables.VOCABULARY_AUDIT_ENDPOINT || variables.GRAMMAR_EXPLAIN_ENDPOINT,
    apiKey: variables.VOCABULARY_AUDIT_API_KEY || variables.GRAMMAR_EXPLAIN_API_KEY
  };
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

function auditPrompt(batch) {
  return [
    'You audit Chinese meanings for English vocabulary multiple-choice exercises.',
    'Review EVERY word in EVERY source. Compare words only within the same source.',
    'Report excludedWords only when a meaning is corrupt, unusable, or clearly inaccurate.',
    'Report blockedPairs when two displayed meanings overlap enough that either could defensibly answer the other word, including synonyms, alternate senses, or translation overlap. Do not block merely related topics.',
    'Report posOverrides only when the displayed leading part of speech is missing or wrong. Allowed values: n,v,adj,adv,prep,conj,pron,det,num,art,modal,phr.',
    'Return every source exactly once and JSON only:',
    '{"sources":[{"sourceId":"","reviewedWordCount":0,"excludedWords":[{"word":"","reason":""}],"blockedPairs":[{"words":["a","b"],"reason":""}],"posOverrides":[{"word":"","pos":"","reason":""}]}]}',
    JSON.stringify(batch.map((source) => ({ sourceId: source.sourceId, expectedWordCount: source.wordCount, words: source.words })))
  ].join('\n');
}

async function requestModel(config, batch, batchIndex) {
  const body = JSON.stringify({ model: MODEL, temperature: 0, messages: [{ role: 'user', content: auditPrompt(batch) }] });
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = JSON.parse((await requestBuffer(config.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        body,
        timeoutMs: 300000
      })).toString('utf8'));
      return normalizeAudit(batch, parseJson(responseText(response)));
    } catch (error) {
      lastError = error;
      console.error(`batch ${batchIndex + 1} attempt ${attempt} failed: ${error.message}`);
    }
  }
  throw lastError;
}

function normalizeAudit(batch, response) {
  const returned = Array.isArray(response && response.sources) ? response.sources : [];
  if (returned.length !== batch.length) throw new Error(`audit-source-count:${returned.length}/${batch.length}`);
  const resultMap = new Map(returned.map((item) => [String(item.sourceId || ''), item]));
  return batch.map((source) => {
    const item = resultMap.get(source.sourceId);
    if (!item) throw new Error(`audit-source-missing:${source.sourceId}`);
    if (Number(item.reviewedWordCount) !== source.wordCount) throw new Error(`audit-word-count:${source.sourceId}:${item.reviewedWordCount}/${source.wordCount}`);
    const validWords = new Set(source.words.map((word) => word.wordLower));
    const excludedWords = (item.excludedWords || []).map((row) => String(row.word || '').toLowerCase()).filter((word) => validWords.has(word));
    const blockedPairs = (item.blockedPairs || []).map((row) => (row.words || []).map((word) => String(word || '').toLowerCase()).sort())
      .filter((words) => words.length === 2 && words[0] !== words[1] && words.every((word) => validWords.has(word)))
      .map((words) => words.join('|'));
    const posOverrides = {};
    (item.posOverrides || []).forEach((row) => {
      const word = String(row.word || '').toLowerCase();
      const pos = String(row.pos || '').toLowerCase();
      if (validWords.has(word) && POS_VALUES.has(pos)) posOverrides[word] = pos;
    });
    return {
      sourceId: source.sourceId,
      cloudPath: source.cloudPath,
      fingerprint: source.fingerprint,
      wordCount: source.wordCount,
      model: MODEL,
      excludedWords: Array.from(new Set(excludedWords)).sort(),
      blockedPairs: Array.from(new Set(blockedPairs)).sort(),
      posOverrides
    };
  });
}

function readCheckpoint() {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { model: MODEL, sources: {} };
  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  if (!checkpoint || !checkpoint.sources) return { model: MODEL, sources: {} };
  Object.values(checkpoint.sources).forEach((audit) => {
    if (!audit.model) audit.model = checkpoint.model || 'gpt-5.6-sol';
  });
  checkpoint.model = MODEL;
  return checkpoint;
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeRuntimeData(audits) {
  const runtime = {};
  audits.forEach((audit) => {
    if (!audit.excludedWords.length && !audit.blockedPairs.length && !Object.keys(audit.posOverrides).length) return;
    runtime[audit.sourceId] = {
      excludedWords: audit.excludedWords,
      blockedPairs: audit.blockedPairs,
      posOverrides: audit.posOverrides
    };
  });
  fs.writeFileSync(RUNTIME_DATA, `// Generated by scripts/audit_all_vocabulary_distractors_gpt.js.\nmodule.exports = ${JSON.stringify(runtime, null, 2)};\n`);
  return runtime;
}

function validatePracticeSources(sources) {
  const failures = [];
  let zeroRepeatSessions = 0;
  sources.forEach((source) => {
    const cards = source.words.map((item) => ({
      key: item.wordLower,
      word: item.word,
      meaning: item.meaning,
      sourceId: source.sourceId
    }));
    const targetCards = cards.filter((item) => isRecognitionTargetAllowed(item, source.sourceId));
    const expected = Math.min(20, targetCards.length);
    const questions = buildRecognitionQuestions(targetCards, expected, () => 0.37, { optionCards: cards, sourceId: source.sourceId });
    const signatures = questions.map((question) => question.options.filter((option) => !option.correct).map((option) => option.key).sort().join('|'));
    const distractors = questions.flatMap((question) => question.options.filter((option) => !option.correct).map((option) => option.key));
    const invalidQuestion = questions.find((question) => question.options.length !== 4 || new Set(question.options.map((option) => option.text)).size !== 4);
    const unsafeQuestion = questions.find((question) => question.options.some((option) => !option.correct && (
      !isRecognitionTargetAllowed({ word: option.key }, source.sourceId)
      || isBlockedDistractorPair(question, { word: option.key }, source.sourceId)
    )));
    if (questions.length !== expected || invalidQuestion || unsafeQuestion || new Set(signatures).size !== signatures.length) {
      failures.push({ sourceId: source.sourceId, wordCount: cards.length, eligibleWordCount: targetCards.length, expected, actual: questions.length });
    }
    if (new Set(distractors).size === distractors.length) zeroRepeatSessions += 1;
  });
  return { failures, zeroRepeatSessions };
}

async function main() {
  const sources = await loadSources();
  const wordCount = sources.reduce((sum, source) => sum + source.wordCount, 0);
  if (PREPARE_ONLY) {
    const validation = validatePracticeSources(sources);
    console.log(JSON.stringify({
      sourceCount: sources.length,
      wordCount,
      batchCount: makeBatches(sources).length,
      model: MODEL,
      practiceValidationFailures: validation.failures,
      zeroRepeatSessions: validation.zeroRepeatSessions
    }, null, 2));
    if (validation.failures.length) process.exitCode = 1;
    return;
  }
  const checkpoint = readCheckpoint();
  const pending = sources.filter((source) => !checkpoint.sources[source.sourceId] || checkpoint.sources[source.sourceId].fingerprint !== source.fingerprint);
  const batches = makeBatches(pending);
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('model-config-missing');
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length || 1) }, async () => {
    while (next < batches.length) {
      const index = next;
      next += 1;
      const audits = await requestModel(config, batches[index], index);
      audits.forEach((audit) => { checkpoint.sources[audit.sourceId] = audit; });
      checkpoint.updatedAt = new Date().toISOString();
      writeJson(CHECKPOINT, checkpoint);
      console.log(`audited ${Object.keys(checkpoint.sources).length}/${sources.length}`);
    }
  }));
  const audits = sources.map((source) => checkpoint.sources[source.sourceId]);
  if (audits.some((audit) => !audit)) throw new Error('audit-incomplete');
  const runtime = writeRuntimeData(audits);
  const report = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    sourceCount: sources.length,
    wordCount,
    excludedWordCount: audits.reduce((sum, audit) => sum + audit.excludedWords.length, 0),
    blockedPairCount: audits.reduce((sum, audit) => sum + audit.blockedPairs.length, 0),
    posOverrideCount: audits.reduce((sum, audit) => sum + Object.keys(audit.posOverrides).length, 0),
    runtimeSourceCount: Object.keys(runtime).length,
    modelSourceCounts: audits.reduce((counts, audit) => {
      counts[audit.model || 'unknown'] = Number(counts[audit.model || 'unknown'] || 0) + 1;
      return counts;
    }, {}),
    sources: audits
  };
  writeJson(REPORT, report);
  console.log(JSON.stringify({ sourceCount: report.sourceCount, wordCount: report.wordCount, excludedWordCount: report.excludedWordCount, blockedPairCount: report.blockedPairCount, posOverrideCount: report.posOverrideCount }, null, 2));
}

if (require.main === module) main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

module.exports = { enumerateSources, makeBatches, normalizeAudit, validatePracticeSources };
