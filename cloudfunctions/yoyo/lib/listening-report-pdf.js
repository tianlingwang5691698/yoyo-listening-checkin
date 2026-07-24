const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_PATH = path.resolve(__dirname, '../assets/fonts/NotoSansCJKsc-Regular.otf');
const LATIN_FONT_PATH = path.resolve(__dirname, '../assets/fonts/NotoSans-Regular.ttf');
const COLORS = {
  ink: '#203A5F',
  muted: '#68778D',
  line: '#D8DEE7',
  coral: '#DF6B4A',
  green: '#2F7D62',
  blue: '#3E6F91',
  paper: '#FFFDF7',
  pale: '#F4F7F8'
};

function cleanText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function cleanList(value) {
  return (Array.isArray(value) ? value : []).filter(Boolean);
}

function writeText(doc, value, options = {}) {
  const text = cleanText(value);
  if (!text) return;
  doc
    .font(options.font || FONT_PATH)
    .fontSize(options.size || 10.8)
    .fillColor(options.color || COLORS.ink)
    .text(text, {
      width: options.width,
      lineGap: options.lineGap === undefined ? 4 : options.lineGap,
      paragraphGap: options.paragraphGap === undefined ? 6 : options.paragraphGap,
      align: options.align || 'left'
    });
}

function measureText(doc, value, options = {}) {
  const text = cleanText(value);
  if (!text) return 0;
  return doc
    .font(options.font || FONT_PATH)
    .fontSize(options.size || 10.8)
    .heightOfString(text, {
      width: options.width || doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: options.lineGap === undefined ? 4 : options.lineGap
    });
}

function remainingHeight(doc) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function ensureSpace(doc, height) {
  if (remainingHeight(doc) < height) doc.addPage();
}

function startSectionPage(doc) {
  doc.addPage();
}

function addSectionTitle(doc, title, tone = COLORS.blue, subtitle = '') {
  ensureSpace(doc, 86);
  const y = doc.y;
  doc.rect(doc.page.margins.left, y + 2, 5, 24).fill(tone);
  doc.x = doc.page.margins.left + 15;
  writeText(doc, title, { size: 17, lineGap: 1, paragraphGap: subtitle ? 2 : 7 });
  if (subtitle) {
    writeText(doc, subtitle, {
      font: LATIN_FONT_PATH,
      size: 9.5,
      color: COLORS.muted,
      lineGap: 2,
      paragraphGap: 7
    });
  }
  doc.x = doc.page.margins.left;
  doc.strokeColor(COLORS.line).lineWidth(0.7)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.45);
}

function addLabel(doc, label, value, options = {}) {
  const text = cleanText(value);
  if (!text) return;
  const bodyHeight = measureText(doc, text, {
    font: options.font,
    size: options.size || 10.6,
    lineGap: options.lineGap === undefined ? 4 : options.lineGap
  });
  ensureSpace(doc, 28 + Math.min(bodyHeight, 150));
  writeText(doc, label, {
    size: 9.3,
    color: options.color || COLORS.green,
    lineGap: 1,
    paragraphGap: 3
  });
  writeText(doc, text, {
    font: options.font,
    size: options.size || 10.6,
    color: options.textColor || COLORS.ink,
    lineGap: options.lineGap === undefined ? 4 : options.lineGap,
    paragraphGap: options.paragraphGap === undefined ? 8 : options.paragraphGap
  });
}

function imageKey(image) {
  return String(image && (image.cloudPath || image.fileId || image.fileID || image.src || image.url) || '');
}

function addSourceImage(doc, image, imageBuffers, label) {
  const buffer = imageBuffers && imageBuffers[imageKey(image)];
  if (!buffer || !buffer.length) return;
  ensureSpace(doc, 330);
  writeText(doc, label || '原题图片', { size: 9.3, color: COLORS.muted, lineGap: 1, paragraphGap: 5 });
  doc.image(buffer, {
    fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 285],
    align: 'center'
  });
  doc.moveDown(0.8);
}

function addOriginalPaper(doc, item) {
  addSectionTitle(doc, '听力套题原题', COLORS.blue, 'ORIGINAL PAPER');
  addLabel(doc, '作答说明', item.directions, { font: LATIN_FONT_PATH, size: 10.8 });
  addLabel(doc, '试卷说明', item.instructions || item.sectionHeading, {
    font: LATIN_FONT_PATH,
    size: 10.8
  });
}

function addTranscript(doc, item) {
  startSectionPage(doc);
  addSectionTitle(doc, '完整听力原文', COLORS.green, 'FULL TRANSCRIPT');
  cleanText(item.transcript).split('\n').forEach((line) => {
    const text = cleanText(line);
    if (!text) {
      doc.moveDown(0.5);
      return;
    }
    ensureSpace(doc, measureText(doc, text, {
      font: LATIN_FONT_PATH,
      size: 11.2,
      lineGap: 5
    }) + 18);
    writeText(doc, text, {
      font: LATIN_FONT_PATH,
      size: 11.2,
      lineGap: 5,
      paragraphGap: 9
    });
  });
}

function addScoreSummary(doc, attempt) {
  const correct = Number(attempt.correctCount || 0);
  const total = Number(attempt.totalCount || 0);
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, 152, 70, 4).fill(COLORS.pale);
  doc.font(LATIN_FONT_PATH).fontSize(28).fillColor(COLORS.coral)
    .text(`${correct} / ${total}`, doc.page.margins.left + 14, y + 9, { width: 124, lineBreak: false });
  doc.font(FONT_PATH).fontSize(9.5).fillColor(COLORS.muted)
    .text('答题结果', doc.page.margins.left + 16, y + 47, { width: 120, lineBreak: false });
  doc.y = y + 84;
  doc.x = doc.page.margins.left;
}

function addOptions(doc, question, selected, answer) {
  const options = question.options && typeof question.options === 'object' ? question.options : {};
  Object.keys(options).sort().forEach((key) => {
    const tags = [];
    if (String(key) === String(answer)) tags.push('正确答案');
    if (String(key) === String(selected)) tags.push('学生选择');
    const optionText = `${key}. ${cleanText(options[key])}`;
    const tagText = tags.length ? `  [${tags.join(' / ')}]` : '';
    ensureSpace(doc, measureText(doc, `${optionText}${tagText}`, {
      font: LATIN_FONT_PATH,
      size: 10.3,
      lineGap: 3
    }) + 8);
    const color = String(key) === String(answer)
      ? COLORS.green
      : (String(key) === String(selected) ? COLORS.coral : COLORS.ink);
    doc.font(LATIN_FONT_PATH).fontSize(10.3).fillColor(color).text(optionText, {
      continued: !!tagText,
      lineGap: 3,
      paragraphGap: tagText ? 0 : 5
    });
    if (tagText) {
      doc.font(FONT_PATH).fontSize(9.8).fillColor(color).text(tagText, {
        lineGap: 3,
        paragraphGap: 5
      });
    }
  });
}

function addOptionImages(doc, question, imageBuffers) {
  const optionImages = question.optionImages && typeof question.optionImages === 'object'
    ? question.optionImages
    : {};
  Object.keys(optionImages).sort().forEach((key) => {
    addSourceImage(doc, optionImages[key], imageBuffers, `选项 ${key} 原图`);
  });
}

function estimateQuestionHeight(doc, question, analysis) {
  let height = 88;
  height += measureText(doc, question.prompt, { font: LATIN_FONT_PATH, size: 11, lineGap: 4 });
  Object.keys(question.options || {}).forEach((key) => {
    height += measureText(doc, `${key}. ${question.options[key]}`, {
      font: LATIN_FONT_PATH,
      size: 10.3,
      lineGap: 3
    }) + 5;
  });
  [
    ['解析', analysis.analysis, FONT_PATH, 10.6],
    ['听力依据', analysis.evidence, LATIN_FONT_PATH, 10.7],
    ['依据翻译', analysis.evidenceTranslation, FONT_PATH, 10.3]
  ].forEach(([, value, font, size]) => {
    if (!cleanText(value)) return;
    height += 26 + measureText(doc, value, { font, size, lineGap: 4 });
  });
  return height;
}

function addGivenRows(doc, question) {
  const rows = cleanList(question.givenRows);
  if (!rows.length) return;
  ensureSpace(doc, 80);
  writeText(doc, question.formTitle, {
    font: LATIN_FONT_PATH,
    size: 11,
    color: COLORS.blue,
    lineGap: 3,
    paragraphGap: 4
  });
  rows.forEach((row) => {
    writeText(doc, `${cleanText(row.label)}${row.label ? ': ' : ''}${cleanText(row.value)}`, {
      font: LATIN_FONT_PATH,
      size: 10,
      color: COLORS.muted,
      lineGap: 3,
      paragraphGap: 3
    });
  });
}

function addQuestions(doc, item, attempt, studyPack, imageBuffers) {
  startSectionPage(doc);
  addSectionTitle(doc, '答题结果与逐题解析', COLORS.coral, 'ANSWERS AND EXPLANATIONS');
  addScoreSummary(doc, attempt);
  const results = Array.isArray(attempt.questions) ? attempt.questions : [];
  const analyses = Array.isArray(studyPack.questionAnalyses) ? studyPack.questionAnalyses : [];
  let lastSectionKey = '';
  let lastGroupKey = '';
  cleanList(item.questions).forEach((question, index) => {
    const number = question.number === undefined || question.number === null ? index + 1 : question.number;
    const result = results.find((entry) => String(entry.number) === String(number)) || {};
    const analysis = analyses.find((entry) => String(entry.number) === String(number)) || {};
    const selected = cleanText(result.selectedAnswer);
    const answer = cleanText(question.answer || result.answer);
    const sectionKey = cleanText(question.sectionKey || question.sectionTitle);
    const groupKey = cleanText(question.groupKey || question.groupTitle);
    const showSection = !!sectionKey && sectionKey !== lastSectionKey;
    const showGroup = !!groupKey && groupKey !== lastGroupKey;
    const headingHeight = (showSection ? 52 : 0) + (showGroup ? 70 : 0);
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 20;
    ensureSpace(doc, Math.min(usableHeight, headingHeight + estimateQuestionHeight(doc, question, analysis)));
    if (showSection) {
      writeText(doc, question.sectionTitle || sectionKey, {
        font: LATIN_FONT_PATH,
        size: 12.3,
        color: COLORS.blue,
        lineGap: 3,
        paragraphGap: 7
      });
      lastSectionKey = sectionKey;
    }
    if (showGroup) {
      writeText(doc, question.groupTitle || groupKey, {
        font: LATIN_FONT_PATH,
        size: 11.5,
        lineGap: 3,
        paragraphGap: 4
      });
      writeText(doc, question.groupInstruction, {
        font: LATIN_FONT_PATH,
        size: 10,
        color: COLORS.muted,
        lineGap: 3,
        paragraphGap: 7
      });
      lastGroupKey = groupKey;
    }
    addGivenRows(doc, question);
    cleanList(question.sourceImages).forEach((image, imageIndex) => {
      addSourceImage(doc, image, imageBuffers, question.sourceImages.length > 1 ? `题目图片 ${imageIndex + 1}` : '题目图片');
    });
    writeText(doc, `第 ${number} 题`, { size: 13.5, lineGap: 1, paragraphGap: 4 });
    writeText(doc, question.prompt, {
      font: LATIN_FONT_PATH,
      size: 11,
      lineGap: 4,
      paragraphGap: 7
    });
    addOptionImages(doc, question, imageBuffers);
    addOptions(doc, question, selected, answer);
    const correct = result.isCorrect === true
      || (selected && answer && selected.toLowerCase() === answer.toLowerCase());
    writeText(doc, `本题结果：${correct ? '正确' : '需订正'}`, {
      size: 10.3,
      color: correct ? COLORS.green : COLORS.coral,
      lineGap: 2,
      paragraphGap: 8
    });
    addLabel(doc, '解析', analysis.analysis, { size: 10.6, color: COLORS.blue });
    addLabel(doc, '听力依据', analysis.evidence, {
      font: LATIN_FONT_PATH,
      size: 10.7,
      color: COLORS.coral
    });
    addLabel(doc, '依据翻译', analysis.evidenceTranslation, {
      size: 10.3,
      color: COLORS.muted
    });
    doc.moveDown(0.4);
  });
}

function estimateCardHeight(doc, item, type) {
  const rows = type === 'vocabulary'
    ? [[item.word, LATIN_FONT_PATH, 13.5], [item.phonetic, LATIN_FONT_PATH, 11.3], [item.meaning, FONT_PATH, 10.4], [item.example, LATIN_FONT_PATH, 10.5], [item.exampleMeaning, FONT_PATH, 10.1]]
    : (type === 'phrase'
      ? [[item.text, LATIN_FONT_PATH, 13], [item.meaning, FONT_PATH, 10.4], [item.example, LATIN_FONT_PATH, 10.5]]
      : [[item.pattern, LATIN_FONT_PATH, 13], [item.meaning, FONT_PATH, 10.4], [item.example, LATIN_FONT_PATH, 10.5], [item.exampleMeaning, FONT_PATH, 10.1]]);
  return 34 + rows.reduce((sum, [value, font, size]) => (
    sum + (cleanText(value) ? measureText(doc, value, { font, size, lineGap: 4 }) + 6 : 0)
  ), 0);
}

function addStudyCards(doc, title, subtitle, items, type, render) {
  startSectionPage(doc);
  addSectionTitle(doc, title, COLORS.blue, subtitle);
  cleanList(items).forEach((item, index) => {
    ensureSpace(doc, Math.min(300, estimateCardHeight(doc, item, type)));
    const startY = doc.y;
    doc.rect(doc.page.margins.left, startY + 2, 4, 20).fill(index % 2 ? COLORS.blue : COLORS.green);
    doc.x = doc.page.margins.left + 14;
    render(item);
    doc.x = doc.page.margins.left;
    doc.moveDown(0.5);
  });
}

function addLearningPack(doc, studyPack) {
  addStudyCards(doc, '生词学习卡', 'VOCABULARY', studyPack.vocabularyCards, 'vocabulary', (item) => {
    writeText(doc, item.word, { font: LATIN_FONT_PATH, size: 13.5, lineGap: 2, paragraphGap: 2 });
    writeText(doc, item.phonetic, { font: LATIN_FONT_PATH, size: 11.3, color: COLORS.muted, lineGap: 2, paragraphGap: 4 });
    writeText(doc, item.meaning, { size: 10.4, color: COLORS.green, lineGap: 3, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.5, lineGap: 4, paragraphGap: 3 });
    writeText(doc, item.exampleMeaning, { size: 10.1, color: COLORS.muted, lineGap: 4, paragraphGap: 8 });
  });
  addStudyCards(doc, '短语学习卡', 'PHRASES', studyPack.phraseCards, 'phrase', (item) => {
    writeText(doc, item.text, { font: LATIN_FONT_PATH, size: 13, lineGap: 2, paragraphGap: 3 });
    writeText(doc, item.meaning, { size: 10.4, color: COLORS.green, lineGap: 3, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.5, lineGap: 4, paragraphGap: 8 });
  });
  addStudyCards(doc, '句型学习卡', 'SENTENCE PATTERNS', studyPack.sentencePatternCards, 'pattern', (item) => {
    writeText(doc, item.pattern, { font: LATIN_FONT_PATH, size: 13, lineGap: 2, paragraphGap: 3 });
    writeText(doc, item.meaning, { size: 10.4, color: COLORS.green, lineGap: 3, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.5, lineGap: 4, paragraphGap: 3 });
    writeText(doc, item.exampleMeaning, { size: 10.1, color: COLORS.muted, lineGap: 4, paragraphGap: 8 });
  });
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(FONT_PATH).fontSize(8).fillColor(COLORS.muted)
      .text(
        `听力学习报告 · ${index + 1} / ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 30,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center',
          lineBreak: false
        }
      );
    doc.page.margins.bottom = bottomMargin;
  }
}

function buildListeningReportPdf(input) {
  const item = input && input.item || {};
  const attempt = input && input.attempt || {};
  const studyPack = input && input.studyPack || {};
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, right: 50, bottom: 48, left: 50 },
      bufferPages: true,
      info: {
        Title: `${cleanText(item.title || '听力套题')} - 学习报告`,
        Subject: '听力原题、完整原文、学生答案、逐题解析与学习卡'
      }
    });
    const paintPage = () => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
      doc.fillColor(COLORS.ink);
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    };
    doc.on('pageAdded', paintPage);
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    paintPage();
    writeText(doc, '听力套题学习报告', {
      size: 10.5,
      color: COLORS.coral,
      lineGap: 1,
      paragraphGap: 6
    });
    writeText(doc, item.title || '听力套题', { size: 22, lineGap: 3, paragraphGap: 8 });
    const meta = [
      attempt.date,
      [item.year, item.district, item.examType].filter(Boolean).join(' · ')
    ].filter(Boolean).join('  ·  ');
    writeText(doc, meta, { size: 10, color: COLORS.muted, lineGap: 2, paragraphGap: 14 });

    addOriginalPaper(doc, item);
    addTranscript(doc, item);
    addQuestions(doc, item, attempt, studyPack, input && input.imageBuffers);
    addLearningPack(doc, studyPack);
    addPageNumbers(doc);
    doc.end();
  });
}

module.exports = {
  buildListeningReportPdf,
  FONT_PATH,
  LATIN_FONT_PATH,
  _test: {
    cleanText,
    imageKey,
    estimateQuestionHeight,
    estimateCardHeight
  }
};
