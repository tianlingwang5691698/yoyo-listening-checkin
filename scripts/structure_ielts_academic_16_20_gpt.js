#!/usr/bin/env node

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const BOOKS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
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
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${text.slice(0, 800)}`));
        try { resolve(JSON.parse(text)); } catch (error) { reject(new Error(`invalid-response-json:${text.slice(0, 800)}`)); }
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

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function itemFileName(itemId) {
  return `${sha1(String(itemId || ''))}.json`;
}

function renderPageDataUrl(pdfPath, page, label) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ielts-model-page-'));
  try {
    const prefix = path.join(tempDir, 'page');
    childProcess.execFileSync('pdftoppm', [
      '-f', String(page), '-l', String(page), '-singlefile', '-r', '135',
      '-jpeg', '-jpegopt', 'quality=88', pdfPath, prefix
    ]);
    const body = fs.readFileSync(`${prefix}.jpg`);
    return {
      label,
      imageUrl: `data:image/jpeg;base64,${body.toString('base64')}`
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function extractionPrompt(source) {
  return [
    `Clean Cambridge IELTS ${source.bookNumber} Academic Test ${source.testNumber} into production JSON.`,
    'Use only the supplied original question text, official audioscript, official answer-key text and page images. Do not import sample writing answers or examiner comments.',
    'Reconstruct structured text, not page-image placeholders. Preserve original English wording and original order. Correct obvious OCR character errors only when the original wording is unambiguous.',
    'Listening: return Questions 1-40 exactly once. Preserve PART, question range, shared title, instruction, table/form fixed rows, option bank and answer choices. A blank prompt must include its row label and nearby fixed text. Multiple-choice options must contain exact A/B/C... text. Set visualRequired=true and sourcePage to the physical PDF page only when a map, plan or diagram is essential.',
    'Reading: return three complete passages in order, with exact passage text and Questions 1-40 exactly once across the passages. Preserve group titles, instructions, options, note headings and official answers. Do not include headers, page numbers, answer explanations or sample answers. Set visualRequired/sourcePage only for essential original visuals.',
    'Writing: return Task 1 and Task 2 exact prompts. Separate directions, scenario and requirements. For Task 1, describe the original visual in visualData and list every clearly visible title, label, year, category, legend and unit. Do not invent unreadable values.',
    'Speaking: preserve Part 1 questions, the complete Part 2 cue card and all Part 3 questions in original order. Do not include examiner instructions as student prompts.',
    'Transcript: clean the official audioscript for this test, preserve the original SECTION 1-4 or PART 1-4 labels and speaker labels, remove page headers, page numbers and printed Q-number annotations. Do not paraphrase or shorten.',
    'If an OFFICIAL AUDIO TRANSCRIPTION SUPPLEMENT is supplied, use it only to restore audioscript material missing from the scanned book. Correct obvious speech-recognition errors from the question paper, printed audioscript and answer key. Remove test narration and do not invent inaudible wording. If the official audio itself cuts off during an incomplete trailing phrase after all Question 40 evidence is complete, omit only that incomplete trailing fragment and do not mark the completed question content uncertain.',
    'Every official answer must be present. Put slash-separated or explicitly accepted alternatives in acceptedAnswers. The official answer key is authoritative; do not mark a question uncertain merely because the audioscript could be interpreted differently. If the printed key itself remains unreadable, record that in uncertain instead of guessing.',
    'Return JSON only with this shape:',
    JSON.stringify({
      listening: {
        questions: [{ number: 1, prompt: '', options: {}, sectionKey: 'PART 1', sectionTitle: 'PART 1 · Questions 1-10', groupKey: '', groupTitle: '', groupInstruction: '', formTitle: '', noteHeading: '', givenRows: [{ label: '', value: '' }], answer: '', acceptedAnswers: [''], visualRequired: false, sourcePage: 0 }],
        transcript: ''
      },
      reading: [{ passageNumber: 1, title: '', passage: '', questions: [{ number: 1, prompt: '', options: {}, groupKey: '', groupTitle: '', groupInstruction: '', noteHeading: '', answer: '', acceptedAnswers: [''], visualRequired: false, sourcePage: 0 }] }],
      writing: [{ taskNumber: 1, directions: '', prompt: '', scenario: '', requirements: [''], visualData: { type: '', title: '', labels: [''], units: '', notes: [''] } }],
      speaking: { exercises: [{ part: 1, prompt: '' }] },
      uncertain: [{ section: '', question: 0, issue: '' }]
    }),
    'QUESTION PAPER:',
    source.listeningText,
    source.readingText,
    source.writingText,
    source.speakingText,
    'OFFICIAL AUDIOSCRIPT:',
    source.transcriptText,
    'OFFICIAL AUDIO TRANSCRIPTION SUPPLEMENT:',
    source.audioTranscriptText || '',
    'OFFICIAL ANSWER KEY:',
    source.answerText
  ].join('\n\n');
}

function buildContent(source) {
  const content = [{ type: 'text', text: extractionPrompt(source) }];
  const pages = [
    ...source.layout.answers,
    source.layout.writing[0],
    ...(source.reviewPages || []),
    ...(source.visualPages || [])
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  pages.forEach((page) => {
    const image = renderPageDataUrl(source.sourcePdf, page, `Original PDF page ${page}`);
    content.push({ type: 'text', text: image.label });
    content.push({ type: 'image_url', image_url: { url: image.imageUrl } });
  });
  return content;
}

function modulePrompt(source, moduleName) {
  const common = [
    `Clean Cambridge IELTS ${source.bookNumber} Academic Test ${source.testNumber} ${moduleName} into production JSON.`,
    'Use only the supplied original question text, official audioscript and official answer key. Preserve exact English wording and order. Correct only unambiguous OCR errors. Return JSON only.',
    'Every official answer must be present. Put slash-separated or explicitly accepted alternatives in acceptedAnswers. The official answer key is authoritative; do not mark interpretive disagreement with it as uncertain. Record only genuinely unreadable source material in uncertain.'
  ];
  const questionShape = { number: 1, prompt: '', options: {}, groupKey: '', groupTitle: '', groupInstruction: '', noteHeading: '', answer: '', acceptedAnswers: [''], visualRequired: false, sourcePage: 0 };
  const modules = {
    listening: [
      'Return Questions 1-40 exactly once. Preserve SECTION/PART, question ranges, shared titles, instructions, fixed form/table rows, option banks and exact choices. A blank prompt must include its row label and nearby fixed text.',
      'Clean the complete official audioscript, preserving SECTION 1-4 or PART 1-4 and speaker labels. Remove page headers, page numbers and printed Q annotations; do not paraphrase or shorten.',
      JSON.stringify({ listening: { questions: [Object.assign({}, questionShape, { sectionKey: 'SECTION 1', sectionTitle: 'SECTION 1 · Questions 1-10', formTitle: '', givenRows: [{ label: '', value: '' }] })], transcript: '' }, uncertain: [] }),
      'LISTENING QUESTION PAPER:', source.listeningText,
      'OFFICIAL AUDIOSCRIPT:', source.transcriptText,
      'OFFICIAL AUDIO TRANSCRIPTION SUPPLEMENT:', source.audioTranscriptText || '',
      'OFFICIAL ANSWER KEY:', source.answerText
    ],
    reading: [
      'Return three complete passages in order, with exact passage text and Questions 1-40 exactly once. Preserve group titles, instructions, option banks, note headings and official answers. Remove headers, page numbers and explanations.',
      JSON.stringify({ reading: [{ passageNumber: 1, title: '', passage: '', questions: [questionShape] }], uncertain: [] }),
      'READING QUESTION PAPER:', source.readingText,
      'OFFICIAL ANSWER KEY:', source.answerText
    ],
    writing: [
      'Return Task 1 and Task 2 exact prompts. Separate directions, scenario and requirements. For Task 1, list every clearly visible title, label, year, category, legend and unit in visualData. Do not import sample answers or invent values.',
      JSON.stringify({ writing: [{ taskNumber: 1, directions: '', prompt: '', scenario: '', requirements: [''], visualData: { type: '', title: '', labels: [''], units: '', notes: [''] } }], uncertain: [] }),
      'WRITING QUESTION PAPER:', source.writingText
    ],
    speaking: [
      'Preserve Part 1 questions, the complete Part 2 cue card and all Part 3 questions in original order. Do not include examiner instructions as student prompts.',
      JSON.stringify({ speaking: { exercises: [{ part: 1, prompt: '' }] }, uncertain: [] }),
      'SPEAKING QUESTION PAPER:', source.speakingText
    ]
  };
  return common.concat(modules[moduleName]).join('\n\n');
}

function moduleContent(source, moduleName) {
  const content = [{ type: 'text', text: modulePrompt(source, moduleName) }];
  const pagesByModule = {
    listening: source.visualPages || [],
    reading: source.visualPages || [],
    writing: [source.layout.writing[0]],
    speaking: [source.layout.speaking]
  };
  (pagesByModule[moduleName] || []).filter((value, index, values) => value && values.indexOf(value) === index).forEach((page) => {
    const image = renderPageDataUrl(source.sourcePdf, page, `Original PDF page ${page}`);
    content.push({ type: 'text', text: image.label });
    content.push({ type: 'image_url', image_url: { url: image.imageUrl } });
  });
  return content;
}

async function requestParsed(config, source, label, content) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await requestJson(config.endpoint, {
        model: MODEL,
        temperature: 0,
        max_tokens: 32000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }]
      }, config.apiKey);
      return parseJson(responseText(response));
    } catch (error) {
      lastError = error;
      console.warn(`[ielts-structure] retry book=${source.bookNumber} test=${source.testNumber} module=${label} attempt=${attempt}: ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError || new Error('model-request-failed');
}

async function extractByModules(config, source, moduleNames = ['listening', 'reading', 'writing', 'speaking']) {
  const result = { listening: null, reading: null, writing: null, speaking: null, uncertain: [] };
  for (const moduleName of moduleNames) {
    console.log(`[ielts-structure] book=${source.bookNumber} test=${source.testNumber} module=${moduleName}`);
    const parsed = await requestParsed(config, source, moduleName, moduleContent(source, moduleName));
    result[moduleName] = parsed[moduleName];
    result.uncertain.push(...(Array.isArray(parsed.uncertain) ? parsed.uncertain : []));
  }
  return result;
}

async function extractOrLoad(config, source, target) {
  const refreshTestsFlag = process.argv.find((value) => value.startsWith('--refresh-tests='));
  const refreshTests = new Set(String(refreshTestsFlag || '').split('=')[1]?.split(',').map(Number).filter(Boolean) || []);
  const refreshModulesFlag = process.argv.find((value) => value.startsWith('--refresh-modules='));
  const refreshModules = String(refreshModulesFlag || '').split('=')[1]?.split(',').map((value) => value.trim()).filter((value) => ['listening', 'reading', 'writing', 'speaking'].includes(value)) || [];
  const refreshThisModules = refreshModules.length && (!refreshTests.size || refreshTests.has(source.testNumber));
  const shouldRefresh = process.argv.includes('--refresh') || refreshTests.has(source.testNumber) || refreshThisModules;
  if (fs.existsSync(target) && !shouldRefresh) {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  }
  console.log(`[ielts-structure] book=${source.bookNumber} test=${source.testNumber}`);
  if (fs.existsSync(target) && refreshThisModules) {
    const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
    const refreshed = await extractByModules(config, source, refreshModules);
    refreshModules.forEach((moduleName) => { existing[moduleName] = refreshed[moduleName]; });
    existing.uncertain = refreshed.uncertain;
    writeJson(target, existing);
    return existing;
  }
  const parsed = source.bookNumber === 11 || process.argv.includes('--split')
    ? await extractByModules(config, source)
    : await requestParsed(config, source, 'all', buildContent(source));
  writeJson(target, parsed);
  return parsed;
}

function normalizedOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
  return Object.fromEntries(Object.entries(options)
    .map(([key, value]) => [String(key || '').trim().toUpperCase(), String(value || '').replace(/\s+/g, ' ').trim()])
    .filter(([key, value]) => key && value));
}

function normalizeQuestion(question, context) {
  const answer = String(question.answer || '').replace(/\s+/g, ' ').trim();
  const rawAcceptedAnswers = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
    ? question.acceptedAnswers
    : [answer];
  const acceptedAnswers = rawAcceptedAnswers
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const prompt = String(question.prompt || '').replace(/\s+/g, ' ').trim();
  if (!prompt || /original paper|page above|refer to (?:the )?(?:page|image|map|plan|diagram)/i.test(prompt)) {
    throw new Error(`${context}-invalid-prompt:${question.number}`);
  }
  if (!answer || !acceptedAnswers.length) throw new Error(`${context}-missing-answer:${question.number}`);
  const options = normalizedOptions(question.options);
  return {
    number: Number(question.number),
    prompt,
    options,
    questionType: Object.keys(options).length ? 'choice' : 'blank',
    sectionKey: String(question.sectionKey || '').trim(),
    sectionTitle: String(question.sectionTitle || '').replace(/\s+/g, ' ').trim(),
    groupKey: String(question.groupKey || '').trim(),
    groupTitle: String(question.groupTitle || '').replace(/\s+/g, ' ').trim(),
    groupInstruction: String(question.groupInstruction || '').replace(/\s+/g, ' ').trim(),
    formTitle: String(question.formTitle || '').replace(/\s+/g, ' ').trim(),
    noteHeading: String(question.noteHeading || '').replace(/\s+/g, ' ').trim(),
    givenRows: (Array.isArray(question.givenRows) ? question.givenRows : []).map((row) => ({
      label: String(row.label || '').replace(/\s+/g, ' ').trim(),
      value: String(row.value || '').replace(/\s+/g, ' ').trim()
    })).filter((row) => row.label || row.value),
    answer,
    acceptedAnswers,
    visualRequired: !!question.visualRequired,
    sourcePage: Number(question.sourcePage || 0)
  };
}

function validateQuestionRange(questions, first, last, context) {
  const normalized = (Array.isArray(questions) ? questions : []).map((question) => normalizeQuestion(question, context)).sort((a, b) => a.number - b.number);
  const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  if (normalized.map((item) => item.number).join(',') !== expected.join(',')) {
    throw new Error(`${context}-numbers:${normalized.map((item) => item.number).join(',')}`);
  }
  return normalized;
}

function attachVisuals(questions, visualAssets, context) {
  const used = new Set();
  return questions.map((question) => {
    const output = Object.assign({}, question);
    const visualContext = `${question.prompt || ''} ${question.groupTitle || ''} ${question.groupInstruction || ''}`;
    const needsVisual = question.visualRequired && /\b(?:map|plan|diagram|layout)\b/i.test(visualContext);
    if (!needsVisual) {
      delete output.visualRequired;
      delete output.sourcePage;
      return output;
    }
    const asset = visualAssets[String(question.sourcePage || '')];
    if (!asset) throw new Error(`${context}-missing-visual-page:${question.number}:${question.sourcePage}`);
    const key = `${question.groupKey || question.groupTitle || question.sourcePage}:${question.sourcePage}`;
    output.sourceImages = used.has(key) ? [] : [asset];
    used.add(key);
    delete output.visualRequired;
    delete output.sourcePage;
    return output;
  });
}

function buildListening(source, parsed) {
  const questions = attachVisuals(
    validateQuestionRange(parsed.listening && parsed.listening.questions, 1, 40, `book-${source.bookNumber}-test-${source.testNumber}-listening`),
    source.visualAssets || {},
    `book-${source.bookNumber}-test-${source.testNumber}-listening`
  );
  const transcript = String(parsed.listening && parsed.listening.transcript || '').trim();
  if (transcript.length < 8000 || !/(?:PART|SECTION)\s*1/i.test(transcript) || !/(?:PART|SECTION)\s*4/i.test(transcript)) {
    throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-transcript:${transcript.length}`);
  }
  const id = `ielts-academic-${source.bookNumber}-test-${source.testNumber}-listening`;
  return {
    _id: id,
    id,
    title: `Cambridge IELTS ${source.bookNumber} Test ${source.testNumber} Listening`,
    year: source.year,
    sourceYear: source.year,
    city: 'Cambridge',
    district: `Test ${source.testNumber}`,
    examType: 'IELTS Academic',
    stage: '雅思',
    sourceType: 'cambridge-ielts-academic',
    sourceFile: source.sourceFile,
    book: `Cambridge IELTS ${source.bookNumber} Academic`,
    bookNumber: source.bookNumber,
    testNumber: source.testNumber,
    audioCloudPath: source.audio.cloudPath,
    audioLocalPath: source.audio.localPath,
    durationSec: source.audio.durationSec,
    hasAudio: true,
    hasTranscript: true,
    transcript,
    questions,
    questionCount: 40,
    contentRevision: 2,
    dataFormat: 'structured-text-v2',
    status: 'published-candidate'
  };
}

function buildReading(source, parsed) {
  const rows = Array.isArray(parsed.reading) ? parsed.reading
    .filter((row) => row && (String(row.title || '').trim() || String(row.passage || '').trim() || (Array.isArray(row.questions) && row.questions.length)))
    .sort((a, b) => Number(a.passageNumber) - Number(b.passageNumber)) : [];
  if (rows.length !== 3) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-reading-passages:${rows.length}`);
  const ranges = [[1, 13], [14, 26], [27, 40]];
  return rows.map((row, index) => {
    const passageNumber = index + 1;
    const passage = String(row.passage || '').trim();
    if (passage.length < 1000) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-reading-${passageNumber}-short:${passage.length}`);
    const questions = attachVisuals(
      validateQuestionRange(row.questions, ranges[index][0], ranges[index][1], `book-${source.bookNumber}-test-${source.testNumber}-reading-${passageNumber}`),
      source.visualAssets || {},
      `book-${source.bookNumber}-test-${source.testNumber}-reading-${passageNumber}`
    );
    const id = `ielts-academic-${source.bookNumber}-test-${source.testNumber}-reading-passage-${passageNumber}`;
    return {
      _id: id,
      id,
      title: String(row.title || `Reading Passage ${passageNumber}`).trim(),
      year: source.year,
      district: `Test ${source.testNumber}`,
      examType: `Cambridge IELTS ${source.bookNumber}`,
      stage: '雅思',
      section: `Passage ${passageNumber}`,
      sectionLabel: `READING PASSAGE ${passageNumber}`,
      paperId: `ielts-academic-${source.bookNumber}-test-${source.testNumber}`,
      paperTitle: `Cambridge IELTS ${source.bookNumber} Test ${source.testNumber}`,
      paperOrder: passageNumber,
      sourceType: 'cambridge-ielts-academic',
      sourceFile: source.sourceFile,
      book: `Cambridge IELTS ${source.bookNumber} Academic`,
      bookNumber: source.bookNumber,
      testNumber: source.testNumber,
      passage,
      images: [],
      questions,
      questionCount: questions.length,
      contentRevision: 2,
      dataFormat: 'structured-text-v2',
      status: 'published-candidate'
    };
  });
}

function buildWriting(source, parsed) {
  const rows = Array.isArray(parsed.writing) ? parsed.writing.slice().sort((a, b) => Number(a.taskNumber) - Number(b.taskNumber)) : [];
  if (rows.length !== 2) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-writing:${rows.length}`);
  return rows.map((row, index) => {
    const task = index + 1;
    const prompt = String(row.prompt || '').trim();
    const scenario = String(row.scenario || '').trim();
    const requirements = (Array.isArray(row.requirements) ? row.requirements : []).map((value) => String(value || '').trim()).filter(Boolean);
    if (`${prompt} ${scenario} ${requirements.join(' ')}`.trim().length < 80) {
      throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-writing-${task}-short`);
    }
    const id = `ielts-academic-${source.bookNumber}-test-${source.testNumber}-writing-task-${task}`;
    return {
      _id: id,
      id,
      title: `Cambridge IELTS ${source.bookNumber} Test ${source.testNumber} Writing Task ${task}`,
      year: source.year,
      city: 'Cambridge',
      district: `Test ${source.testNumber}`,
      examType: 'IELTS Academic',
      stage: '雅思',
      section: `Writing Task ${task}`,
      category: 'IELTS Academic Writing',
      contentType: `ielts-writing-task-${task}`,
      contentRevision: 3,
      dataFormat: 'structured-text-v3',
      paperId: `ielts-academic-${source.bookNumber}-test-${source.testNumber}`,
      paperOrder: task,
      sourceType: 'cambridge-ielts-academic',
      sourceFile: source.sourceFile,
      book: `Cambridge IELTS ${source.bookNumber} Academic`,
      bookNumber: source.bookNumber,
      testNumber: source.testNumber,
      directions: String(row.directions || `WRITING TASK ${task}`).trim(),
      prompt,
      scenario: scenario || prompt,
      requirements,
      visualData: row.visualData || null,
      images: task === 1 ? [source.writingVisual] : [],
      minWords: task === 1 ? 150 : 250,
      score: 9,
      status: 'published-candidate'
    };
  });
}

function splitSpeakingRows(rows) {
  return rows.flatMap((row) => {
    const part = Number(row && row.part);
    const prompt = String(row && row.prompt || '').trim();
    if (part === 2 || !prompt.includes('\n')) return [{ part, prompt }];
    const lines = prompt.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const questions = [];
    let heading = [];
    lines.forEach((line) => {
      if (!line.includes('?')) {
        heading = [line];
        return;
      }
      questions.push({ part, prompt: heading.length ? `${heading.join('\n')}\n${line}` : line });
    });
    return questions.length > 1 ? questions : [{ part, prompt }];
  });
}

function buildSpeaking(source, parsed) {
  const raw = splitSpeakingRows(parsed.speaking && Array.isArray(parsed.speaking.exercises) ? parsed.speaking.exercises : []);
  const counts = { 1: 0, 2: 0, 3: 0 };
  const exercises = raw.map((row) => {
    const part = Number(row.part);
    if (![1, 2, 3].includes(part)) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-speaking-part:${part}`);
    const prompt = String(row.prompt || '').replace(/\s+/g, ' ').trim();
    if (!prompt) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-speaking-empty`);
    counts[part] += 1;
    const duration = part === 1 ? 45 : (part === 2 ? 120 : 60);
    return {
      id: `ielts-academic-${source.bookNumber}-test-${source.testNumber}-speaking-part-${part}-${counts[part]}`,
      part,
      title: `Part ${part} · ${counts[part]}`,
      meta: `${duration} 秒`,
      prompt,
      maxDurationSec: duration
    };
  });
  if (Object.values(counts).some((count) => !count)) throw new Error(`book-${source.bookNumber}-test-${source.testNumber}-speaking-missing-part`);
  const id = `ielts-academic-${source.bookNumber}-test-${source.testNumber}-speaking`;
  return {
    _id: id,
    id,
    title: `Cambridge IELTS ${source.bookNumber} Test ${source.testNumber} Speaking`,
    year: source.year,
    city: 'Cambridge',
    district: `Test ${source.testNumber}`,
    examType: 'IELTS Academic',
    stage: '雅思',
    sourceType: 'cambridge-ielts-academic',
    sourceFile: source.sourceFile,
    book: `Cambridge IELTS ${source.bookNumber} Academic`,
    bookNumber: source.bookNumber,
    testNumber: source.testNumber,
    images: [source.speakingPage],
    exercises,
    questionCount: exercises.length,
    contentRevision: 1,
    status: 'published-candidate'
  };
}

function slimListening(item) {
  return Object.fromEntries(['_id', 'id', 'title', 'year', 'sourceYear', 'district', 'examType', 'stage', 'book', 'bookNumber', 'testNumber', 'audioCloudPath', 'durationSec', 'hasAudio', 'hasTranscript'].map((key) => [key, item[key]]));
}

function slimWriting(item) {
  return Object.fromEntries(['_id', 'id', 'title', 'year', 'district', 'examType', 'stage', 'category', 'contentType', 'contentRevision', 'paperId', 'paperOrder', 'book', 'bookNumber', 'testNumber', 'minWords', 'score'].map((key) => [key, item[key]]));
}

function slimSpeaking(item) {
  return Object.fromEntries(['_id', 'id', 'title', 'year', 'district', 'examType', 'stage', 'book', 'bookNumber', 'testNumber', 'questionCount'].map((key) => [key, item[key]]));
}

async function buildBook(config, book) {
  const root = path.join(ROOT, 'data', 'ielts-academic', `cambridge-${book}`);
  const modelDir = path.join(root, 'model-extraction');
  fs.mkdirSync(modelDir, { recursive: true });
  const listening = [];
  const reading = [];
  const writing = [];
  const speaking = [];
  const uncertain = [];
  const sourceFiles = fs.readdirSync(path.join(root, 'source-extraction'))
    .filter((name) => /^test-\d+\.json$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  if (sourceFiles.length !== 4) throw new Error(`book-${book}-source-tests:${sourceFiles.length}`);
  for (const sourceFile of sourceFiles) {
    const source = JSON.parse(fs.readFileSync(path.join(root, 'source-extraction', sourceFile), 'utf8'));
    const test = Number(source.testNumber);
    const parsed = await extractOrLoad(config, source, path.join(modelDir, sourceFile));
    listening.push(buildListening(source, parsed));
    reading.push(...buildReading(source, parsed));
    writing.push(...buildWriting(source, parsed));
    speaking.push(buildSpeaking(source, parsed));
    (Array.isArray(parsed.uncertain) ? parsed.uncertain : []).forEach((row) => uncertain.push({ test, ...row }));
  }
  writeJson(path.join(root, 'listening', 'index.json'), listening.map(slimListening));
  listening.forEach((item) => writeJson(path.join(root, 'listening', 'items-v2', itemFileName(item._id)), item));
  writeJson(path.join(root, 'reading', 'v2', 'reading-passages.json'), reading);
  writeJson(path.join(root, 'writing', 'index.json'), writing.map(slimWriting));
  writing.forEach((item) => writeJson(path.join(root, 'writing', 'items-v3', itemFileName(item._id)), item));
  writeJson(path.join(root, 'speaking', 'index.json'), speaking.map(slimSpeaking));
  speaking.forEach((item) => writeJson(path.join(root, 'speaking', 'items-v1', itemFileName(item._id)), item));
  const report = {
    model: MODEL,
    generatedAt: new Date().toISOString(),
    bookNumber: book,
    listeningTests: listening.length,
    listeningQuestions: listening.reduce((sum, item) => sum + item.questions.length, 0),
    readingPassages: reading.length,
    readingQuestions: reading.reduce((sum, item) => sum + item.questions.length, 0),
    writingTasks: writing.length,
    speakingTests: speaking.length,
    speakingExercises: speaking.reduce((sum, item) => sum + item.exercises.length, 0),
    uncertainCount: uncertain.length,
    uncertain,
    sampleAnswersImported: false,
    errors: []
  };
  writeJson(path.join(root, 'clean-report.json'), report);
  return report;
}

async function main() {
  const selected = process.argv.filter((value) => /^\d+$/.test(value)).map(Number);
  const books = selected.length ? selected : BOOKS;
  if (books.some((book) => !BOOKS.includes(book))) throw new Error(`unsupported-books:${books.join(',')}`);
  const config = await modelConfig();
  if (!config.endpoint || !config.apiKey) throw new Error('gpt-5.6-sol-config-missing');
  const reports = [];
  for (const book of books) reports.push(await buildBook(config, book));
  const uncertainCount = reports.reduce((sum, report) => sum + report.uncertainCount, 0);
  console.log(JSON.stringify({ books, reports, uncertainCount }, null, 2));
  if (uncertainCount) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
