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
  soft: '#F4F8FA',
  evidence: '#FFF8E4'
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
    .font(FONT_PATH)
    .fontSize(options.size || 10.2)
    .fillColor(options.color || COLORS.ink)
    .text(text, {
      lineGap: options.lineGap === undefined ? 3 : options.lineGap,
      paragraphGap: options.paragraphGap === undefined ? 5 : options.paragraphGap,
      align: options.align || 'left'
    });
}

function ensureSpace(doc, height) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - height) doc.addPage();
}

function measureText(doc, value, options = {}) {
  const text = cleanText(value);
  if (!text) return 0;
  return doc
    .font(options.font || FONT_PATH)
    .fontSize(options.size || 10.2)
    .heightOfString(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: options.lineGap === undefined ? 3 : options.lineGap
    });
}

function addSectionTitle(doc, title, tone = COLORS.blue) {
  ensureSpace(doc, 80);
  doc.moveDown(0.7);
  const y = doc.y;
  doc.rect(doc.page.margins.left, y + 2, 4, 20).fill(tone);
  doc.x = doc.page.margins.left + 12;
  writeText(doc, title, { size: 15, color: COLORS.ink, lineGap: 1, paragraphGap: 5 });
  doc.x = doc.page.margins.left;
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.7)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.35);
}

function addLabel(doc, label, value, options = {}) {
  const text = cleanText(value);
  if (!text) return;
  ensureSpace(doc, 70);
  writeText(doc, label, { size: 9, color: options.color || COLORS.green, lineGap: 1, paragraphGap: 2 });
  writeText(doc, text, { size: options.size || 10, color: options.textColor || COLORS.ink, lineGap: 3, paragraphGap: 6 });
}

function imageKey(image) {
  return String(image && (image.cloudPath || image.fileId || image.fileID || image.src || image.url) || '');
}

function addSourceImage(doc, image, imageBuffers, label) {
  const buffer = imageBuffers && imageBuffers[imageKey(image)];
  if (!buffer || !buffer.length) return;
  ensureSpace(doc, 320);
  writeText(doc, label || '原题图片', { size: 9, color: COLORS.muted, lineGap: 1, paragraphGap: 4 });
  doc.image(buffer, {
    fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 270],
    align: 'center'
  });
  doc.moveDown(0.7);
}

function addPassage(doc, passage, imageBuffers) {
  addSectionTitle(doc, '阅读原题');
  addLabel(doc, '作答说明', passage.directions);
  addLabel(doc, '题组说明', passage.sectionHeading);
  if (cleanText(passage.articleTitle)) {
    ensureSpace(doc, 70);
    writeText(doc, passage.articleTitle, { size: 17, color: COLORS.ink, align: 'center', lineGap: 2, paragraphGap: 4 });
  }
  if (cleanText(passage.articleSubtitle)) {
    writeText(doc, passage.articleSubtitle, { size: 10, color: COLORS.muted, align: 'center', lineGap: 2, paragraphGap: 7 });
  }
  cleanList(passage.images).forEach((image, index) => {
    addSourceImage(doc, image, imageBuffers, passage.images.length > 1 ? `原文图片 ${index + 1}` : '原文图片');
  });
  const paragraphs = cleanList(passage.passageParagraphs).map(cleanText).filter(Boolean);
  if (paragraphs.length) {
    paragraphs.forEach((paragraph) => {
      ensureSpace(doc, 90);
      writeText(doc, paragraph, { size: 10.2, lineGap: 4, paragraphGap: 9 });
    });
  } else {
    writeText(doc, passage.passage, { size: 10.2, lineGap: 4, paragraphGap: 9 });
  }
}

function addOptions(doc, question, selected, answer, imageBuffers) {
  const options = question.options && typeof question.options === 'object' ? question.options : {};
  const optionImages = question.optionImages && typeof question.optionImages === 'object' ? question.optionImages : {};
  Array.from(new Set(Object.keys(options).concat(Object.keys(optionImages)))).sort().forEach((key) => {
    ensureSpace(doc, 45);
    const tags = [];
    if (String(key) === String(answer)) tags.push('正确答案');
    if (String(key) === String(selected)) tags.push('学生选择');
    const suffix = tags.length ? `  [${tags.join(' / ')}]` : '';
    writeText(doc, `${key}. ${cleanText(options[key])}${suffix}`, {
      size: 9.6,
      color: String(key) === String(answer) ? COLORS.green : (String(key) === String(selected) ? COLORS.coral : COLORS.ink),
      lineGap: 2,
      paragraphGap: 3
    });
    if (optionImages[key]) addSourceImage(doc, optionImages[key], imageBuffers, `选项 ${key} 图片`);
  });
}

function estimateQuestionHeight(doc, question, selected, answer, analysis) {
  let height = 48;
  height += measureText(doc, question.noteHeading, { size: 9.2, lineGap: 1 });
  height += measureText(doc, question.prompt, { size: 10, lineGap: 3 });
  const options = question.options && typeof question.options === 'object' ? question.options : {};
  const optionImages = question.optionImages && typeof question.optionImages === 'object' ? question.optionImages : {};
  Array.from(new Set(Object.keys(options).concat(Object.keys(optionImages)))).forEach((key) => {
    const tags = [];
    if (String(key) === String(answer)) tags.push('正确答案');
    if (String(key) === String(selected)) tags.push('学生选择');
    height += measureText(doc, `${key}. ${cleanText(options[key])}${tags.length ? `  [${tags.join(' / ')}]` : ''}`, {
      size: 9.6,
      lineGap: 2
    }) + 3;
  });
  height += measureText(doc, `学生答案：${selected || '未作答'}    正确答案：${answer || '暂无'}    结果：需订正`, {
    size: 9.5,
    lineGap: 2
  }) + 8;
  [
    ['解析', analysis.analysis || analysis.text],
    ['答案句', analysis.answerSentence],
    ['答案句翻译', analysis.answerSentenceTranslation]
  ].forEach(([label, value]) => {
    if (!cleanText(value)) return;
    height += measureText(doc, label, { size: 9, lineGap: 1 });
    height += measureText(doc, value, { size: 9.6, lineGap: 3 }) + 8;
  });
  return height;
}

function addQuestions(doc, passage, attempt, studyPack, imageBuffers) {
  addSectionTitle(doc, '答题结果与解析', COLORS.coral);
  const results = Array.isArray(attempt.questionResults) ? attempt.questionResults : [];
  const analyses = Array.isArray(studyPack.questionAnalyses) ? studyPack.questionAnalyses : [];
  let lastGroupKey = '';
  cleanList(passage.questions).forEach((question, index) => {
    const number = question.number === undefined || question.number === null ? index + 1 : question.number;
    const result = results.find((item) => String(item.number) === String(number)) || {};
    const analysis = analyses.find((item) => String(item.number) === String(number)) || {};
    const selected = cleanText(result.selected || (attempt.answers && attempt.answers[String(number)]));
    const answer = cleanText(result.answer || analysis.answer || question.answer);
    const groupKey = cleanText(question.groupKey);
    const groupHeight = groupKey && groupKey !== lastGroupKey
      ? 54
        + measureText(doc, question.groupRangeTitle || groupKey, { size: 10, lineGap: 1 })
        + measureText(doc, question.groupTitle, { size: 12, lineGap: 2 })
        + measureText(doc, question.groupInstruction, { size: 9.3, lineGap: 2 })
      : 0;
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 20;
    ensureSpace(doc, Math.min(
      usableHeight,
      groupHeight + estimateQuestionHeight(doc, question, selected, answer, analysis)
    ));
    if (groupKey && groupKey !== lastGroupKey) {
      writeText(doc, question.groupRangeTitle || groupKey, { size: 10, color: COLORS.blue, lineGap: 1, paragraphGap: 2 });
      writeText(doc, question.groupTitle, { size: 12, color: COLORS.ink, lineGap: 2, paragraphGap: 3 });
      writeText(doc, question.groupInstruction, { size: 9.3, color: COLORS.muted, lineGap: 2, paragraphGap: 5 });
      lastGroupKey = groupKey;
    }
    writeText(doc, `第 ${number} 题`, { size: 12.5, color: COLORS.ink, lineGap: 1, paragraphGap: 3 });
    writeText(doc, question.noteHeading, { size: 9.2, color: COLORS.blue, lineGap: 1, paragraphGap: 2 });
    writeText(doc, question.prompt, { size: 10, color: COLORS.ink, lineGap: 3, paragraphGap: 5 });
    cleanList(question.sourceImages).forEach((image, imageIndex) => {
      addSourceImage(doc, image, imageBuffers, question.sourceImages.length > 1 ? `题目图片 ${imageIndex + 1}` : '题目图片');
    });
    addOptions(doc, question, selected, answer, imageBuffers);
    const correct = result.correct === true || (selected && answer && selected === answer);
    writeText(doc, `学生答案：${selected || '未作答'}    正确答案：${answer || '暂无'}    结果：${correct ? '正确' : '需订正'}`, {
      size: 9.5,
      color: correct ? COLORS.green : COLORS.coral,
      lineGap: 2,
      paragraphGap: 4
    });
    addLabel(doc, '解析', analysis.analysis || analysis.text || result.analysis, { size: 9.6, color: COLORS.blue });
    addLabel(doc, '答案句', analysis.answerSentence, { size: 9.5, color: COLORS.coral });
    addLabel(doc, '答案句翻译', analysis.answerSentenceTranslation, { size: 9.3, color: COLORS.muted });
    doc.moveDown(0.35);
  });
}

function addStudyCards(doc, title, items, render) {
  ensureSpace(doc, 190);
  addSectionTitle(doc, title);
  cleanList(items).forEach((item, index) => {
    ensureSpace(doc, 115);
    const startY = doc.y;
    doc.rect(doc.page.margins.left, startY, 4, 18).fill(index % 2 ? COLORS.blue : COLORS.green);
    doc.x = doc.page.margins.left + 12;
    render(item, index);
    doc.x = doc.page.margins.left;
    doc.moveDown(0.35);
  });
}

function writeVocabularyHeading(doc, item) {
  const word = cleanText(item.word);
  const phonetic = cleanText(item.phonetic);
  doc
    .font(FONT_PATH)
    .fontSize(12.5)
    .fillColor(COLORS.ink)
    .text(word, {
      continued: !!phonetic,
      lineGap: 1,
      paragraphGap: phonetic ? 0 : 2
    });
  if (phonetic) {
    doc
      .font(LATIN_FONT_PATH)
      .fontSize(11.2)
      .fillColor(COLORS.muted)
      .text(`  ${phonetic}`, {
        lineGap: 1,
        paragraphGap: 2
      });
  }
}

function addLearningPack(doc, studyPack) {
  addStudyCards(doc, '生词学习卡', studyPack.vocabularyCards, (item) => {
    writeVocabularyHeading(doc, item);
    writeText(doc, item.meaning, { size: 9.8, color: COLORS.green, lineGap: 2, paragraphGap: 3 });
    writeText(doc, item.example, { size: 9.4, color: COLORS.ink, lineGap: 2, paragraphGap: 2 });
    writeText(doc, item.exampleMeaning, { size: 9, color: COLORS.muted, lineGap: 2, paragraphGap: 4 });
  });
  addStudyCards(doc, '短语学习卡', studyPack.phraseCards, (item) => {
    writeText(doc, item.text, { size: 12.2, color: COLORS.ink, lineGap: 1, paragraphGap: 2 });
    writeText(doc, item.meaning, { size: 9.8, color: COLORS.green, lineGap: 2, paragraphGap: 3 });
    writeText(doc, item.example, { size: 9.4, color: COLORS.ink, lineGap: 2, paragraphGap: 4 });
  });
  addStudyCards(doc, '句型学习卡', studyPack.sentencePatternCards, (item) => {
    writeText(doc, item.pattern, { size: 12.2, color: COLORS.ink, lineGap: 1, paragraphGap: 2 });
    writeText(doc, item.meaning, { size: 9.8, color: COLORS.green, lineGap: 2, paragraphGap: 3 });
    writeText(doc, item.example, { size: 9.4, color: COLORS.ink, lineGap: 2, paragraphGap: 2 });
    writeText(doc, item.exampleMeaning, { size: 9, color: COLORS.muted, lineGap: 2, paragraphGap: 4 });
  });
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONT_PATH)
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `佑佑英语阅读报告 · ${index + 1} / ${range.count}`,
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

function buildReadingReportPdf(input) {
  const passage = input && input.passage || {};
  const attempt = input && input.attempt || {};
  const studyPack = input && input.studyPack || {};
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 44, right: 48, bottom: 46, left: 48 },
      bufferPages: true,
      info: {
        Title: `${cleanText(passage.title || '阅读练习')} - 学习报告`,
        Author: '佑佑英语',
        Subject: '阅读原题、学生答案、逐题解析与学习卡'
      }
    });
    const paintPage = () => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    };
    doc.on('pageAdded', paintPage);
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    paintPage();
    writeText(doc, '佑佑英语 · 阅读学习报告', { size: 10, color: COLORS.coral, lineGap: 1, paragraphGap: 5 });
    writeText(doc, passage.title || '阅读练习', { size: 20, color: COLORS.ink, lineGap: 2, paragraphGap: 7 });
    const meta = [
      attempt.date,
      [passage.year, passage.district, passage.examType].filter(Boolean).join(' · '),
      Number.isFinite(Number(attempt.correctCount)) ? `${Number(attempt.correctCount)} / ${Number(attempt.totalCount || 0)} 题` : ''
    ].filter(Boolean).join('  ·  ');
    writeText(doc, meta, { size: 9.5, color: COLORS.muted, lineGap: 1, paragraphGap: 8 });

    addPassage(doc, passage, input && input.imageBuffers);
    addQuestions(doc, passage, attempt, studyPack, input && input.imageBuffers);
    addLearningPack(doc, studyPack);
    addPageNumbers(doc);
    doc.end();
  });
}

module.exports = {
  buildReadingReportPdf,
  FONT_PATH,
  LATIN_FONT_PATH,
  _test: {
    cleanText,
    imageKey
  }
};
