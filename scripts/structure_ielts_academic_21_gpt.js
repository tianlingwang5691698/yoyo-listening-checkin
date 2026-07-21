#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data', 'ielts-academic', 'cambridge-21');
const PDF_PATH = '/Users/wangtianlong/工作/01_教学与备考/备考/雅思总类/核心资料库/雅思真题/雅思A类全套4-21/剑桥雅思21（A类）.pdf';
const MODEL = 'gpt-5.6-sol';
const CHECKPOINT_DIR = path.join(DATA_ROOT, 'model-extraction');
const REPORT_PATH = path.join(DATA_ROOT, 'structured-v3-report.json');

const TESTS = {
  1: { listening: [11, 16], writing: [30, 31] },
  2: { listening: [33, 38], writing: [52, 53] },
  3: { listening: [55, 60], writing: [73, 74] },
  4: { listening: [76, 81], writing: [95, 96] }
};

const READING = {
  1: [[17, 20, 1, 13], [21, 25, 14, 26], [26, 29, 27, 40]],
  2: [[39, 42, 1, 13], [43, 46, 14, 26], [47, 51, 27, 40]],
  3: [[61, 64, 1, 13], [65, 68, 14, 26], [69, 72, 27, 40]],
  4: [[82, 85, 1, 13], [86, 89, 14, 26], [90, 94, 27, 40]]
};

const WRITING_VISUALS = {
  1: 'test-1-task-1-line-graph-d7c052a003.jpg',
  2: 'test-2-task-1-cafe-plans-9acd9eef19.jpg',
  3: 'test-3-task-1-rain-shadow-ff5a718126.jpg',
  4: 'test-4-task-1-library-survey-49f3caa173.jpg'
};

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
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${text.slice(0, 400)}`));
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(240000, () => request.destroy(new Error('model-request-timeout')));
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
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

function extractPages(first, last) {
  return childProcess.execFileSync('pdftotext', ['-f', String(first), '-l', String(last), '-layout', PDF_PATH, '-'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  }).replace(/\u000c/g, '\n\n=== PAGE BREAK ===\n\n');
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function extractOrLoad(config, name, prompt) {
  const target = path.join(CHECKPOINT_DIR, `${name}.json`);
  if (fs.existsSync(target) && !process.argv.includes('--refresh')) {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  }
  console.log(`[structure] ${name}`);
  let response = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await requestJson(config.endpoint, {
        model: MODEL,
        temperature: 0,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      }, config.apiKey);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`[structure] retry ${name} ${attempt}/3: ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (!response) throw lastError || new Error(`model-request-failed:${name}`);
  const parsed = parseJson(responseText(response));
  writeJson(target, parsed);
  return parsed;
}

function normalizedOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
  return Object.fromEntries(Object.entries(options)
    .map(([key, value]) => [String(key || '').trim().toUpperCase(), String(value || '').replace(/\s+/g, ' ').trim()])
    .filter(([key, value]) => key && value));
}

function validateQuestions(rawQuestions, first, last, context) {
  const questions = (Array.isArray(rawQuestions) ? rawQuestions : []).map((question) => ({
    number: Number(question.number),
    prompt: String(question.prompt || '').replace(/\s+/g, ' ').trim(),
    options: normalizedOptions(question.options),
    questionType: Object.keys(normalizedOptions(question.options)).length ? 'choice' : 'blank',
    sectionKey: String(question.sectionKey || '').trim(),
    sectionTitle: String(question.sectionTitle || '').replace(/\s+/g, ' ').trim(),
    groupKey: String(question.groupKey || '').trim(),
    groupTitle: String(question.groupTitle || '').replace(/\s+/g, ' ').trim(),
    groupInstruction: String(question.groupInstruction || '').replace(/\s+/g, ' ').trim(),
    formTitle: String(question.formTitle || '').replace(/\s+/g, ' ').trim(),
    givenRows: Array.isArray(question.givenRows) ? question.givenRows.map((row) => ({
      label: String(row.label || '').replace(/\s+/g, ' ').trim(),
      value: String(row.value || '').replace(/\s+/g, ' ').trim()
    })).filter((row) => row.label || row.value) : []
  })).sort((a, b) => a.number - b.number);
  const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  if (questions.map((item) => item.number).join(',') !== expected.join(',')) {
    throw new Error(`${context}-question-numbers:${questions.map((item) => item.number).join(',')}`);
  }
  questions.forEach((question) => {
    if (!question.prompt || /original paper|page above|refer to/i.test(question.prompt)) {
      throw new Error(`${context}-invalid-prompt:${question.number}`);
    }
  });
  return questions;
}

function listeningPrompt(test, text, answers) {
  return [
    'You are cleaning a Cambridge IELTS Academic listening test into production JSON.',
    'The OCR text below contains the complete question paper for one test. Reconstruct all 40 questions as structured data, not page images.',
    'Preserve the original English wording, PART order, group titles, instructions, table/form labels, matching banks and answer choices. Do not paraphrase.',
    'For a table/note/form blank, make prompt self-contained by including its row/field label and nearby fixed text. For matching questions, copy the shared option bank into options for every affected question.',
    'For ordinary multiple choice, options must contain the exact A/B/C... texts. For a blank, options must be {}.',
    'Each question number 1-40 must appear exactly once. Never write placeholders such as "use the original paper".',
    'Return JSON only: {"questions":[{"number":1,"prompt":"","options":{},"sectionKey":"PART 1","sectionTitle":"PART 1 · Questions 1-10","groupKey":"part-1-questions-1-6","groupTitle":"Questions 1-6","groupInstruction":"","formTitle":"","givenRows":[]}],"uncertain":[]}.',
    `Official answer sequence is supplied only to help identify blank versus choice question types; do not put answers in prompts: ${JSON.stringify(answers.map((item) => item.answer))}`,
    `TEST=${test}`,
    text
  ].join('\n\n');
}

function readingPrompt(test, passage, first, last, text, answers) {
  return [
    'You are cleaning one Cambridge IELTS Academic reading passage into production JSON.',
    'The OCR text below includes the full passage and all questions for this passage. Reconstruct data as text fields, not page images.',
    'Preserve the full passage wording, paragraph order, heading, question instructions, statements, sentence endings, matching banks and answer options. Do not paraphrase or add explanations.',
    'For matching/heading questions, copy the shared option bank into options for every affected question. For TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN questions, options must contain those exact choices.',
    'For completion questions, make each prompt self-contained with the surrounding sentence/note/table field. Each requested question number must appear exactly once.',
    'Never write placeholders such as "use the original paper". Mark unreadable source in uncertain instead of guessing.',
    `Return JSON only: {"title":"","passage":"full passage text","questions":[{"number":${first},"prompt":"","options":{},"groupKey":"","groupTitle":"","groupInstruction":""}],"uncertain":[]}.`,
    `Official answers are supplied only to help identify question types: ${JSON.stringify(answers.map((item) => item.answer))}`,
    `TEST=${test}; PASSAGE=${passage}; QUESTION_RANGE=${first}-${last}`,
    text
  ].join('\n\n');
}

function itemFileName(id) {
  return require('crypto').createHash('sha1').update(String(id)).digest('hex') + '.json';
}

async function buildListening(config) {
  const source = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'listening', 'index.json'), 'utf8'));
  const output = [];
  for (const item of source) {
    const test = Number(item.testNumber);
    const pages = TESTS[test].listening;
    const parsed = await extractOrLoad(config, `listening-test-${test}`, listeningPrompt(test, extractPages(pages[0], pages[1]), item.questions));
    const structured = validateQuestions(parsed.questions, 1, 40, `listening-test-${test}`);
    const answerByNumber = new Map(item.questions.map((question) => [Number(question.number), question]));
    const questions = structured.map((question) => Object.assign(question, {
      answer: answerByNumber.get(question.number).answer,
      acceptedAnswers: answerByNumber.get(question.number).acceptedAnswers
    }));
    output.push(Object.assign({}, item, {
      contentRevision: 2,
      dataFormat: 'structured-text-v2',
      questions,
      images: []
    }));
  }
  const targetDir = path.join(DATA_ROOT, 'listening', 'items-v2');
  output.forEach((item) => writeJson(path.join(targetDir, itemFileName(item._id)), item));
  return output;
}

async function buildReading(config) {
  const source = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'reading', 'reading-passages.json'), 'utf8'));
  const sourceById = new Map(source.map((item) => [item._id, item]));
  const output = [];
  for (let test = 1; test <= 4; test += 1) {
    for (let passage = 1; passage <= 3; passage += 1) {
      const [firstPage, lastPage, first, last] = READING[test][passage - 1];
      const id = `ielts-academic-21-test-${test}-reading-passage-${passage}`;
      const original = sourceById.get(id);
      const parsed = await extractOrLoad(config, `reading-test-${test}-passage-${passage}`, readingPrompt(test, passage, first, last, extractPages(firstPage, lastPage), original.questions));
      const structured = validateQuestions(parsed.questions, first, last, `reading-test-${test}-passage-${passage}`);
      const answerByNumber = new Map(original.questions.map((question) => [Number(question.number), question]));
      const questions = structured.map((question) => Object.assign(question, {
        answer: answerByNumber.get(question.number).answer,
        acceptedAnswers: answerByNumber.get(question.number).acceptedAnswers
      }));
      const passageText = String(parsed.passage || '').trim();
      if (passageText.length < 1000) throw new Error(`reading-passage-too-short:${id}:${passageText.length}`);
      output.push(Object.assign({}, original, {
        title: String(parsed.title || original.title).trim(),
        passage: passageText,
        images: [],
        questions,
        contentRevision: 2,
        dataFormat: 'structured-text-v2'
      }));
    }
  }
  writeJson(path.join(DATA_ROOT, 'reading', 'v2', 'reading-passages.json'), output);
  return output;
}

function writingPrompt(test, task, text) {
  return [
    'Clean this Cambridge IELTS Academic writing task into structured JSON.',
    'Extract exact task wording. Do not include sample answers, examiner comments, page headers or page numbers.',
    'For Task 1, describe the visual type and list every visible axis label, category, year, unit and legend label in visualData. Do not invent numeric values that are not unambiguously readable.',
    'Return JSON only: {"directions":"","prompt":"","scenario":"","requirements":[],"visualData":{"type":"","title":"","labels":[],"units":"","notes":[]},"uncertain":[]}.',
    `TEST=${test}; TASK=${task}`,
    text
  ].join('\n\n');
}

async function buildWriting(config) {
  const source = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'writing', 'index.json'), 'utf8'));
  const output = [];
  for (const item of source) {
    const test = Number(item.testNumber);
    const task = Number(String(item.contentType).match(/(\d+)$/)?.[1] || item.paperOrder);
    const page = TESTS[test].writing[task - 1];
    const parsed = await extractOrLoad(config, `writing-test-${test}-task-${task}`, writingPrompt(test, task, extractPages(page, page)));
    const prompt = String(parsed.prompt || '').trim();
    const scenario = String(parsed.scenario || '').trim();
    const requirements = Array.isArray(parsed.requirements) ? parsed.requirements.map((value) => String(value).trim()).filter(Boolean) : [];
    if (`${scenario} ${prompt} ${requirements.join(' ')}`.trim().length < 80) throw new Error(`writing-prompt-too-short:test-${test}-task-${task}`);
    output.push(Object.assign({}, item, {
      contentRevision: 3,
      dataFormat: 'structured-text-v3',
      directions: String(parsed.directions || `WRITING TASK ${task}`).trim(),
      prompt,
      scenario: scenario || prompt,
      requirements,
      visualData: parsed.visualData || null,
      images: task === 1 ? [{
        cloudPath: `_content/ielts-academic/cambridge-21/writing/visuals-v3/${WRITING_VISUALS[test]}`,
        localPath: `data/ielts-academic/cambridge-21/writing/visuals-v3/${WRITING_VISUALS[test]}`,
        alt: `Cambridge IELTS 21 Test ${test} Writing Task 1 visual`
      }] : []
    }));
  }
  const targetDir = path.join(DATA_ROOT, 'writing', 'items-v3');
  output.forEach((item) => writeJson(path.join(targetDir, itemFileName(item._id)), item));
  return output;
}

async function main() {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('gpt-5.6-sol-config-missing');
  const listening = await buildListening(config);
  const reading = await buildReading(config);
  const writing = await buildWriting(config);
  const uncertain = fs.readdirSync(CHECKPOINT_DIR).filter((name) => name.endsWith('.json')).flatMap((name) => {
    const row = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, name), 'utf8'));
    return (row.uncertain || []).map((value) => ({ source: name, value }));
  });
  const report = {
    model: MODEL,
    generatedAt: new Date().toISOString(),
    listeningTests: listening.length,
    listeningQuestions: listening.reduce((sum, item) => sum + item.questions.length, 0),
    readingPassages: reading.length,
    readingQuestions: reading.reduce((sum, item) => sum + item.questions.length, 0),
    writingTasks: writing.length,
    uncertainCount: uncertain.length,
    uncertain
  };
  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
  if (uncertain.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
