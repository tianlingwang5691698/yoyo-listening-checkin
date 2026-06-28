const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_DIR = '/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/二模（12年无音频）/2019年上海市中考英语二模试卷（16区，15区含听力）';
const SOURCES = [
  { section: 'A', fileName: '2019英语二模阅读理解A分类汇编.docx', questionStart: 69, questionEnd: 74 },
  { section: 'B', fileName: '2019英语二模阅读理解B分类汇编.docx', questionStart: 75, questionEnd: 80 }
];

const DISTRICT_SLUGS = {
  长宁: 'changning',
  宝山: 'baoshan',
  崇明: 'chongming',
  奉贤: 'fengxian',
  虹口: 'hongkou',
  黄浦: 'huangpu',
  嘉定: 'jiading',
  静安: 'jingan',
  闵行: 'minhang',
  浦东: 'pudong',
  普陀: 'putuo',
  青浦: 'qingpu',
  松江: 'songjiang',
  徐汇: 'xuhui',
  杨浦: 'yangpu',
  闸北: 'zhabei'
};

const SAMPLE_KEYS = {
  'A:长宁': ['A', 'B', 'C', 'D', 'C', 'D'],
  'B:长宁': ['C', 'A', 'B', 'A', 'D', 'B']
};

function toText(filePath) {
  const result = spawnSync('textutil', ['-convert', 'txt', '-stdout', filePath], {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `textutil failed: ${filePath}`);
  }
  return result.stdout.replace(/\r/g, '\n');
}

function clean(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitDistrictEntries(text, section) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(\\d+)[，、.]\\s*([^\\n\\s]{2,8})\\s*${section}\\.`, 'g');
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      number: Number(match[1]),
      district: match[2].replace(/区$/, '')
    });
  }
  return matches.map((item, index) => ({
    district: item.district,
    body: text.slice(item.index, matches[index + 1] ? matches[index + 1].index : text.length)
  }));
}

function parseQuestionBlock(lines, qn) {
  const start = lines.findIndex((line) => line.startsWith(`${qn}.`));
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^\d{2}\./.test(line));
  const block = lines.slice(start, end < 0 ? lines.length : end).join(' ');
  const prompt = clean(block.replace(/^[0-9]+\.\s*/, '').split(/\s+[A-D]\./)[0]);
  const options = {};
  ['A', 'B', 'C', 'D'].forEach((letter, index, letters) => {
    const next = letters[index + 1];
    const optionPattern = next
      ? new RegExp(`${letter}\\.\\s*([\\s\\S]*?)(?=\\s+${next}\\.)`)
      : new RegExp(`${letter}\\.\\s*([\\s\\S]*)$`);
    const match = block.match(optionPattern);
    options[letter] = clean(match ? match[1] : '');
  });
  return { prompt, options };
}

function extractSupportSentences(passage, limit) {
  const sentences = clean(passage)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => clean(line))
    .filter((line) => line.length > 24 && /[a-zA-Z]/.test(line));
  return sentences.slice(0, limit).map((text, index) => ({
    label: `答案句 ${index + 1}`,
    text
  }));
}

function extractWords(passage, limit) {
  const common = new Set('the a an and or to of in on for with is are was were be been it this that these those you your i we they he she his her their as at from by about into out up down not no yes do does did can could would should may might will shall have has had'.split(' '));
  const words = clean(passage).toLowerCase().match(/[a-z][a-z'-]{4,}/g) || [];
  const unique = [];
  words.forEach((word) => {
    const key = word.replace(/'s$/, '');
    if (!common.has(key) && !unique.includes(key)) {
      unique.push(key);
    }
  });
  return unique.slice(0, limit).map((word) => ({
    word,
    meaning: '结合原文理解'
  }));
}

function extractPhrases(passage, limit) {
  const candidates = clean(passage).match(/\b(?:[a-zA-Z]+ ){1,3}(?:for|with|from|about|through|during|before|after|without|because of)\b(?: [a-zA-Z]+){0,3}/g) || [];
  const unique = [];
  candidates.forEach((phrase) => {
    const text = clean(phrase.toLowerCase());
    if (text.length > 8 && !unique.includes(text)) {
      unique.push(text);
    }
  });
  return unique.slice(0, limit).map((phrase) => ({
    phrase,
    meaning: '阅读高频表达'
  }));
}

function parseEntries(source) {
  const text = toText(path.join(SOURCE_DIR, source.fileName));
  return splitDistrictEntries(text, source.section).map((entry, index) => {
    const lines = clean(entry.body).split('\n').map((line) => clean(line)).filter(Boolean);
    const firstQuestion = lines.findIndex((line) => line.startsWith(`${source.questionStart}.`));
    const passage = clean(lines.slice(1, firstQuestion < 0 ? lines.length : firstQuestion).join('\n'));
    const key = SAMPLE_KEYS[`${source.section}:${entry.district}`] || [];
    const questions = [];
    for (let qn = source.questionStart; qn <= source.questionEnd; qn += 1) {
      const parsed = parseQuestionBlock(lines, qn);
      if (parsed) {
        questions.push(Object.assign({}, parsed, {
          number: qn,
          answer: key[qn - source.questionStart] || '',
          analysis: key[qn - source.questionStart]
            ? `本题答案为 ${key[qn - source.questionStart]}，依据原文关键信息判断。`
            : '样本题待人工补充标准答案，先用于验证阅读流程。'
        }));
      }
    }
    const title = `2019 上海${entry.district}二模阅读 ${source.section}`;
    return {
      _id: `sh-em2-2019-${source.section.toLowerCase()}-${String(index + 1).padStart(2, '0')}-${DISTRICT_SLUGS[entry.district] || `d${index + 1}`}`,
      title,
      year: 2019,
      city: '上海',
      district: entry.district,
      examType: '二模',
      section: source.section,
      sourceType: 'shanghai-mock',
      sourceFile: source.fileName,
      passage,
      questions,
      answerSentences: extractSupportSentences(passage, 4),
      phrases: extractPhrases(passage, 6),
      vocabulary: extractWords(passage, 8),
      status: key.length ? 'sample-keyed' : 'sample-needs-key-review',
      createdAt: new Date().toISOString()
    };
  });
}

const passages = SOURCES.flatMap(parseEntries).slice(0, 20);
const output = `${JSON.stringify(passages, null, 2)}\n`;
[
  path.join(process.cwd(), 'data/reading-passages.sample.json'),
  path.join(process.cwd(), 'cloudfunctions/yoyo/data/reading-passages.sample.json')
].forEach((target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
});

console.log(`generated ${passages.length} reading samples`);
