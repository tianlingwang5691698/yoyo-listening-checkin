#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data', 'ielts-academic');
const BOOKS = Array.from({ length: 12 }, (_, index) => index + 10);
const MODEL = 'gpt-5.6-sol';

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = rows[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function modelConfig() {
  const manager = CloudBase.init({ ...credentials(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const variables = Object.fromEntries((((detail.Environment || {}).Variables) || []).map((item) => [item.Key, item.Value]));
  return {
    endpoint: variables.GRAMMAR_EXPLAIN_ENDPOINT || variables.WRITING_SCORE_ENDPOINT || '',
    apiKey: variables.GRAMMAR_EXPLAIN_API_KEY || variables.WRITING_SCORE_API_KEY || ''
  };
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
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${body.slice(0, 800)}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`invalid-response-json:${body.slice(0, 800)}`)); }
      });
    });
    request.setTimeout(600000, () => request.destroy(new Error('model-request-timeout')));
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
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch (error) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw error;
    return JSON.parse(text.slice(start, end + 1));
  }
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function itemFileName(itemId) {
  return `${sha1(itemId)}.json`;
}

function readBookItems(book) {
  const directory = path.join(DATA_ROOT, `cambridge-${book}`, 'speaking', 'items-v1');
  return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(directory, name)))
    .sort((left, right) => Number(left.testNumber || 0) - Number(right.testNumber || 0));
}

function imageDataUrl(image) {
  const localPath = path.join(ROOT, String(image && image.localPath || ''));
  if (!fs.existsSync(localPath)) throw new Error(`speaking-image-missing:${localPath}`);
  const extension = path.extname(localPath).toLowerCase();
  const mime = extension === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(localPath).toString('base64')}`;
}

function sourceText(book, item) {
  const test = Number(item.testNumber || 0);
  const target = path.join(DATA_ROOT, `cambridge-${book}`, 'source-extraction', `test-${test}.json`);
  if (!fs.existsSync(target)) return '';
  return String(readJson(target).speakingText || '').trim();
}

function promptForBook(book, items) {
  const tests = items.map((item) => ({
    itemId: item._id,
    testNumber: item.testNumber,
    sourceText: sourceText(book, item),
    exercises: item.exercises.map((exercise) => ({
      id: exercise.id,
      part: exercise.part,
      prompt: exercise.prompt
    }))
  }));
  return [
    'You are structuring official Cambridge IELTS Academic Speaking test pages.',
    'Use the supplied original page images as the authority. Existing exercise ids and prompt wording are frozen.',
    'Return JSON only. Do not add sample answers, examiner instructions, timing notes, scores, or invented content.',
    'For each test return exactly this schema:',
    '{"tests":[{"itemId":"...","part1":{"topic":"...","questions":[{"exerciseId":"...","prompt":"..."}]},"part2":{"exerciseId":"...","task":"...","cuePoints":["..."],"closingPrompt":"..."},"part3":{"topics":[{"title":"...","questions":[{"exerciseId":"...","prompt":"..."}]}]}}],"uncertain":[]}',
    'Rules:',
    '- Preserve the official topic titles and original question order shown on the page.',
    '- Return every individual official question shown on the page. If one frozen exercise contains several questions, split them and repeat its exerciseId for each question.',
    '- Every supplied exercise id must appear at least once in the matching Part.',
    '- Question prompt wording must reproduce the original page without adding the topic title.',
    '- Part 2 task, cuePoints, and closingPrompt must reproduce the wording of the frozen prompt without paraphrasing.',
    '- Part 2 cuePoints excludes the opening task and the final "and explain..." clause.',
    '- Part 3 must retain every official discussion topic and map its question ids.',
    '- If an image or OCR is unclear, add a precise entry to uncertain instead of guessing.',
    `BOOK ${book} INPUT:`,
    JSON.stringify(tests)
  ].join('\n\n');
}

function contentForBook(book, items) {
  const content = [{ type: 'text', text: promptForBook(book, items) }];
  items.forEach((item) => {
    content.push({ type: 'text', text: `${item._id} original speaking page:` });
    content.push({ type: 'image_url', image_url: { url: imageDataUrl((item.images || [])[0]) } });
  });
  return content;
}

async function requestBook(config, book, items) {
  const cachePath = path.join(DATA_ROOT, `cambridge-${book}`, 'speaking', 'model-structure-v2.json');
  if (fs.existsSync(cachePath) && !process.argv.includes('--refresh')) return readJson(cachePath);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`[ielts-speaking-v2] book=${book} attempt=${attempt}`);
      const response = await requestJson(config.endpoint, {
        model: MODEL,
        temperature: 0,
        max_tokens: 16000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: contentForBook(book, items) }]
      }, config.apiKey);
      const parsed = parseJson(responseText(response));
      writeJson(cachePath, parsed);
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(`[ielts-speaking-v2] retry book=${book}: ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError || new Error(`book-${book}-model-failed`);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ').trim();
}

function validatePart2Prompt(exercise, part2) {
  const expected = normalizeText(String(exercise.prompt || '').replace(
    /you will have to talk about the topic for (?:one|1) to (?:two|2) minutes?\.?\s*(?:you have (?:one|1) minute to think about what you are going to say\.?\s*)?(?:you can make some notes to help you if you wish\.?\s*)?/gi,
    ' '
  ));
  const actual = normalizeText([part2.task, 'You should say', ...(part2.cuePoints || []), part2.closingPrompt].join(' '));
  const expectedWords = expected.split(' ').filter(Boolean);
  const actualWords = new Set(actual.split(' ').filter(Boolean));
  const missing = expectedWords.filter((word) => !actualWords.has(word));
  if (missing.length > Math.max(2, Math.floor(expectedWords.length * 0.03))) {
    throw new Error(`part2-wording-mismatch:${exercise.id}:${missing.slice(0, 8).join(',')}`);
  }
}

function buildParts(item, structure) {
  const exercises = item.exercises || [];
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const used = [];
  const mapQuestions = (questions, ids, expectedPart) => {
    const rows = Array.isArray(questions) && questions.length
      ? questions
      : (ids || []).map((id) => ({ exerciseId: id, prompt: (byId.get(id) || {}).prompt }));
    return rows.map((row, index) => {
    const id = String(row && row.exerciseId || '');
    const exercise = byId.get(id);
    if (!exercise || Number(exercise.part) !== expectedPart) throw new Error(`invalid-question-id:${item._id}:${id}`);
    used.push(id);
    const prompt = String(row.prompt || '').trim();
    if (!prompt) throw new Error(`empty-question-prompt:${item._id}:${id}`);
    return { exerciseId: id, number: index + 1, prompt };
  });
  };
  const part2Exercise = byId.get(structure.part2 && structure.part2.exerciseId);
  if (!part2Exercise || Number(part2Exercise.part) !== 2) throw new Error(`invalid-part2-id:${item._id}`);
  if (!Array.isArray(structure.part2.cuePoints) || structure.part2.cuePoints.length < 3) throw new Error(`part2-cue-points:${item._id}`);
  validatePart2Prompt(part2Exercise, structure.part2);
  used.push(part2Exercise.id);
  const parts = [
    {
      part: 1,
      label: 'PART 1',
      topics: [{
        title: String(structure.part1 && structure.part1.topic || '').trim(),
        questions: mapQuestions(structure.part1 && structure.part1.questions, structure.part1 && structure.part1.questionIds, 1)
      }]
    },
    {
      part: 2,
      label: 'PART 2',
      tasks: [{
        exerciseId: part2Exercise.id,
        task: String(structure.part2.task || '').trim(),
        cuePoints: structure.part2.cuePoints.map((value) => String(value || '').trim()).filter(Boolean),
        closingPrompt: String(structure.part2.closingPrompt || '').trim()
      }]
    },
    {
      part: 3,
      label: 'PART 3',
      topics: (structure.part3 && structure.part3.topics || []).map((topic) => ({
        title: String(topic.title || '').trim(),
        questions: mapQuestions(topic.questions, topic.questionIds, 3)
      }))
    }
  ];
  const expectedIds = exercises.map((exercise) => exercise.id).sort();
  const actualIds = Array.from(new Set(used)).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`exercise-coverage:${item._id}:${actualIds.length}/${expectedIds.length}`);
  }
  if (!parts[0].topics[0].title || !parts[2].topics.length || parts[2].topics.some((topic) => !topic.title || !topic.questions.length)) {
    throw new Error(`topic-structure:${item._id}`);
  }
  return parts;
}

function buildBook(book, items, parsed) {
  const uncertain = Array.isArray(parsed.uncertain) ? parsed.uncertain : [];
  if (uncertain.length) throw new Error(`book-${book}-uncertain:${uncertain.length}`);
  const structures = new Map((parsed.tests || []).map((item) => [item.itemId, item]));
  if (structures.size !== items.length) throw new Error(`book-${book}-test-count:${structures.size}`);
  const outputDir = path.join(DATA_ROOT, `cambridge-${book}`, 'speaking', 'items-v2');
  fs.mkdirSync(outputDir, { recursive: true });
  for (const name of fs.readdirSync(outputDir).filter((value) => value.endsWith('.json'))) fs.unlinkSync(path.join(outputDir, name));
  return items.map((item) => {
    const structure = structures.get(item._id);
    if (!structure) throw new Error(`missing-test-structure:${item._id}`);
    const output = Object.assign({}, item, {
      contentRevision: 2,
      dataFormat: 'structured-speaking-v2',
      parts: buildParts(item, structure)
    });
    writeJson(path.join(outputDir, itemFileName(item._id)), output);
    return output;
  });
}

async function main() {
  const selected = process.argv.filter((value) => /^\d+$/.test(value)).map(Number);
  const books = selected.length ? selected : BOOKS;
  if (books.some((book) => !BOOKS.includes(book))) throw new Error(`unsupported-books:${books.join(',')}`);
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('gpt-5.6-sol-config-missing');
  const reports = [];
  for (const book of books) {
    const items = readBookItems(book);
    if (items.length !== 4) throw new Error(`book-${book}-items:${items.length}`);
    const parsed = await requestBook(config, book, items);
    const output = buildBook(book, items, parsed);
    reports.push({ book, tests: output.length, exercises: output.reduce((sum, item) => sum + item.exercises.length, 0) });
  }
  const report = {
    model: MODEL,
    generatedAt: new Date().toISOString(),
    books,
    tests: reports.reduce((sum, item) => sum + item.tests, 0),
    exercises: reports.reduce((sum, item) => sum + item.exercises, 0),
    uncertainCount: 0,
    reports
  };
  writeJson(path.join(DATA_ROOT, 'speaking-v2-clean-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
  if (books.length === BOOKS.length && (report.tests !== 48 || report.exercises !== 533)) throw new Error(`global-count:${report.tests}/${report.exercises}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
