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
    .font(options.font || FONT_PATH)
    .fontSize(options.size || 10.8)
    .fillColor(options.color || COLORS.ink)
    .text(text, {
      width: options.width,
      lineGap: options.lineGap === undefined ? 3 : options.lineGap,
      paragraphGap: options.paragraphGap === undefined ? 5 : options.paragraphGap,
      align: options.align || 'left'
    });
}

function remainingHeight(doc) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function ensureSpace(doc, height) {
  if (remainingHeight(doc) < height) doc.addPage();
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

function addSectionTitle(doc, title, tone = COLORS.blue, options = {}) {
  ensureSpace(doc, options.minHeight || 100);
  doc.moveDown(options.compact ? 0.25 : 0.55);
  const y = doc.y;
  doc.rect(doc.page.margins.left, y + 2, 4, 22).fill(tone);
  doc.x = doc.page.margins.left + 12;
  writeText(doc, title, { size: 16.5, color: COLORS.ink, lineGap: 1, paragraphGap: 6 });
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
  const bodyHeight = measureText(doc, text, {
    font: options.font || FONT_PATH,
    size: options.size || 10.5,
    lineGap: options.lineGap === undefined ? 3 : options.lineGap
  });
  ensureSpace(doc, Math.min(180, bodyHeight + 35));
  writeText(doc, label, { size: 10, color: options.color || COLORS.green, lineGap: 1, paragraphGap: 3 });
  writeText(doc, text, {
    font: options.font || FONT_PATH,
    size: options.size || 10.5,
    color: options.textColor || COLORS.ink,
    lineGap: options.lineGap === undefined ? 3 : options.lineGap,
    paragraphGap: 7
  });
}

function imageKey(image) {
  return String(image && (image.cloudPath || image.fileId || image.fileID || image.src || image.url) || '');
}

function addSourceImage(doc, image, imageBuffers, label) {
  const buffer = imageBuffers && imageBuffers[imageKey(image)];
  if (!buffer || !buffer.length) return;
  ensureSpace(doc, 330);
  writeText(doc, label || '原题图片', { size: 10, color: COLORS.muted, lineGap: 1, paragraphGap: 5 });
  doc.image(buffer, {
    fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 285],
    align: 'center'
  });
  doc.moveDown(0.7);
}

function addPassage(doc, passage, imageBuffers) {
  addSectionTitle(doc, '阅读原题');
  addLabel(doc, '作答说明', passage.directions, { font: LATIN_FONT_PATH, size: 10.7, lineGap: 4 });
  addLabel(doc, '题组说明', passage.sectionHeading, { font: LATIN_FONT_PATH, size: 10.7, lineGap: 4 });
  if (cleanText(passage.articleTitle)) {
    ensureSpace(doc, 70);
    writeText(doc, passage.articleTitle, {
      font: LATIN_FONT_PATH,
      size: 17,
      color: COLORS.ink,
      align: 'center',
      lineGap: 2,
      paragraphGap: 5
    });
  }
  if (cleanText(passage.articleSubtitle)) {
    writeText(doc, passage.articleSubtitle, {
      font: LATIN_FONT_PATH,
      size: 10.5,
      color: COLORS.muted,
      align: 'center',
      lineGap: 2,
      paragraphGap: 9
    });
  }
  cleanList(passage.images).forEach((image, index) => {
    addSourceImage(doc, image, imageBuffers, passage.images.length > 1 ? `原文图片 ${index + 1}` : '原文图片');
  });
  const paragraphs = cleanList(passage.passageParagraphs).map(cleanText).filter(Boolean);
  if (paragraphs.length) {
    paragraphs.forEach((paragraph) => {
      const height = measureText(doc, paragraph, {
        font: LATIN_FONT_PATH,
        size: 11,
        lineGap: 4
      });
      ensureSpace(doc, Math.min(160, height + 20));
      writeText(doc, paragraph, {
        font: LATIN_FONT_PATH,
        size: 11,
        lineGap: 4,
        paragraphGap: 11
      });
    });
  } else {
    writeText(doc, passage.passage, {
      font: LATIN_FONT_PATH,
      size: 11,
      lineGap: 4,
      paragraphGap: 11
    });
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
      font: FONT_PATH,
      size: 10.3,
      color: String(key) === String(answer) ? COLORS.green : (String(key) === String(selected) ? COLORS.coral : COLORS.ink),
      lineGap: 3,
      paragraphGap: 4
    });
    if (optionImages[key]) addSourceImage(doc, optionImages[key], imageBuffers, `选项 ${key} 图片`);
  });
}

function estimateQuestionHeight(doc, question, selected, answer, analysis) {
  let height = 62;
  height += measureText(doc, question.noteHeading, { font: LATIN_FONT_PATH, size: 9.8, lineGap: 1 });
  height += measureText(doc, question.prompt, { font: LATIN_FONT_PATH, size: 10.8, lineGap: 4 });
  height += cleanList(question.sourceImages).length * 320;
  const options = question.options && typeof question.options === 'object' ? question.options : {};
  const optionImages = question.optionImages && typeof question.optionImages === 'object' ? question.optionImages : {};
  Array.from(new Set(Object.keys(options).concat(Object.keys(optionImages)))).forEach((key) => {
    const tags = [];
    if (String(key) === String(answer)) tags.push('正确答案');
    if (String(key) === String(selected)) tags.push('学生选择');
    height += measureText(doc, `${key}. ${cleanText(options[key])}${tags.length ? `  [${tags.join(' / ')}]` : ''}`, {
      font: FONT_PATH,
      size: 10.3,
      lineGap: 3
    }) + 4;
    if (optionImages[key]) height += 320;
  });
  const answerLine = Object.keys(options).length
    ? '答题结果：需订正'
    : `学生答案：${selected || '未作答'}    正确答案：${answer || '暂无'}    结果：需订正`;
  height += measureText(doc, answerLine, {
    size: 10.2,
    lineGap: 2
  }) + 8;
  [
    ['解析', analysis.analysis || analysis.text],
    ['答案句', analysis.answerSentence],
    ['答案句翻译', analysis.answerSentenceTranslation]
  ].forEach(([label, value]) => {
    if (!cleanText(value)) return;
    height += measureText(doc, label, { size: 10, lineGap: 1 });
    height += measureText(doc, value, {
      font: label === '解析' ? FONT_PATH : LATIN_FONT_PATH,
      size: label === '解析' ? 10.5 : 10.3,
      lineGap: 3
    }) + 9;
  });
  return height;
}

function addQuestions(doc, passage, attempt, studyPack, imageBuffers) {
  doc.addPage();
  addSectionTitle(doc, '答题结果与解析', COLORS.coral, { compact: true });
  const results = Array.isArray(attempt.questionResults) ? attempt.questionResults : [];
  const analyses = Array.isArray(studyPack.questionAnalyses) ? studyPack.questionAnalyses : [];
  const correctCount = Number(attempt.correctCount || 0);
  const totalCount = Number(attempt.totalCount || results.length || 0);
  if (totalCount > 0) {
    const y = doc.y;
    doc.roundedRect(doc.page.margins.left, y, 190, 48, 4).fill(COLORS.soft);
    doc.x = doc.page.margins.left + 12;
    doc.y = y + 9;
    writeText(doc, `${correctCount} / ${totalCount}`, {
      font: LATIN_FONT_PATH,
      size: 20,
      color: COLORS.coral,
      lineGap: 1,
      paragraphGap: 0
    });
    doc.x = doc.page.margins.left;
    doc.y = y + 62;
  }
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
      writeText(doc, question.groupRangeTitle || groupKey, { font: LATIN_FONT_PATH, size: 10.3, color: COLORS.blue, lineGap: 1, paragraphGap: 3 });
      writeText(doc, question.groupTitle, { font: LATIN_FONT_PATH, size: 12.5, color: COLORS.ink, lineGap: 2, paragraphGap: 4 });
      writeText(doc, question.groupInstruction, { font: LATIN_FONT_PATH, size: 10.1, color: COLORS.muted, lineGap: 3, paragraphGap: 6 });
      lastGroupKey = groupKey;
    }
    writeText(doc, `第 ${number} 题`, { size: 13.5, color: COLORS.ink, lineGap: 1, paragraphGap: 4 });
    writeText(doc, question.noteHeading, { font: LATIN_FONT_PATH, size: 9.8, color: COLORS.blue, lineGap: 1, paragraphGap: 3 });
    writeText(doc, question.prompt, { font: LATIN_FONT_PATH, size: 10.8, color: COLORS.ink, lineGap: 4, paragraphGap: 6 });
    cleanList(question.sourceImages).forEach((image, imageIndex) => {
      addSourceImage(doc, image, imageBuffers, question.sourceImages.length > 1 ? `题目图片 ${imageIndex + 1}` : '题目图片');
    });
    addOptions(doc, question, selected, answer, imageBuffers);
    const correct = result.correct === true || (selected && answer && selected === answer);
    const hasOptions = question.options && Object.keys(question.options).length;
    const resultLine = hasOptions
      ? `答题结果：${correct ? '正确' : '需订正'}`
      : `学生答案：${selected || '未作答'}    正确答案：${answer || '暂无'}    结果：${correct ? '正确' : '需订正'}`;
    writeText(doc, resultLine, {
      size: 10.2,
      color: correct ? COLORS.green : COLORS.coral,
      lineGap: 2,
      paragraphGap: 6
    });
    addLabel(doc, '解析', analysis.analysis || analysis.text || result.analysis, { size: 10.5, color: COLORS.blue, lineGap: 4 });
    addLabel(doc, '答案句', analysis.answerSentence, { font: LATIN_FONT_PATH, size: 10.5, color: COLORS.coral, lineGap: 4 });
    addLabel(doc, '答案句翻译', analysis.answerSentenceTranslation, { size: 10.2, color: COLORS.muted, lineGap: 3 });
    doc.moveDown(0.35);
  });
}

function addStudyCards(doc, title, items, render, estimate) {
  const cards = cleanList(items);
  if (!cards.length) return;
  doc.addPage();
  addSectionTitle(doc, title, COLORS.green, { compact: true });
  cards.forEach((item, index) => {
    const cardHeight = typeof estimate === 'function' ? estimate(item) : 130;
    ensureSpace(doc, Math.min(210, cardHeight + 24));
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
    .font(LATIN_FONT_PATH)
    .fontSize(13)
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
    writeText(doc, item.meaning, { size: 10.2, color: COLORS.green, lineGap: 2, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, color: COLORS.ink, lineGap: 3, paragraphGap: 3 });
    writeText(doc, item.exampleMeaning, { size: 9.8, color: COLORS.muted, lineGap: 3, paragraphGap: 5 });
  }, (item) => {
    return 54
      + measureText(doc, item.meaning, { size: 10.2, lineGap: 2 })
      + measureText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, lineGap: 3 })
      + measureText(doc, item.exampleMeaning, { size: 9.8, lineGap: 3 });
  });
  addStudyCards(doc, '短语学习卡', studyPack.phraseCards, (item) => {
    writeText(doc, item.text, { font: LATIN_FONT_PATH, size: 12.8, color: COLORS.ink, lineGap: 1, paragraphGap: 3 });
    writeText(doc, item.meaning, { size: 10.2, color: COLORS.green, lineGap: 2, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, color: COLORS.ink, lineGap: 3, paragraphGap: 5 });
  }, (item) => {
    return 36
      + measureText(doc, item.text, { font: LATIN_FONT_PATH, size: 12.8, lineGap: 1 })
      + measureText(doc, item.meaning, { size: 10.2, lineGap: 2 })
      + measureText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, lineGap: 3 });
  });
  addStudyCards(doc, '句型学习卡', studyPack.sentencePatternCards, (item) => {
    writeText(doc, item.pattern, { font: LATIN_FONT_PATH, size: 12.8, color: COLORS.ink, lineGap: 1, paragraphGap: 3 });
    writeText(doc, item.meaning, { size: 10.2, color: COLORS.green, lineGap: 2, paragraphGap: 4 });
    writeText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, color: COLORS.ink, lineGap: 3, paragraphGap: 3 });
    writeText(doc, item.exampleMeaning, { size: 9.8, color: COLORS.muted, lineGap: 3, paragraphGap: 5 });
  }, (item) => {
    return 42
      + measureText(doc, item.pattern, { font: LATIN_FONT_PATH, size: 12.8, lineGap: 1 })
      + measureText(doc, item.meaning, { size: 10.2, lineGap: 2 })
      + measureText(doc, item.example, { font: LATIN_FONT_PATH, size: 10.3, lineGap: 3 })
      + measureText(doc, item.exampleMeaning, { size: 9.8, lineGap: 3 });
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
        `阅读报告 · ${index + 1} / ${range.count}`,
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
    writeText(doc, '阅读学习报告', { size: 10, color: COLORS.coral, lineGap: 1, paragraphGap: 5 });
    writeText(doc, passage.title || '阅读练习', { size: 20, color: COLORS.ink, lineGap: 2, paragraphGap: 7 });
    const meta = [
      attempt.date,
      [passage.year, passage.district, passage.examType].filter(Boolean).join(' · ')
    ].filter(Boolean).join('  ·  ');
    writeText(doc, meta, { size: 10, color: COLORS.muted, lineGap: 1, paragraphGap: 8 });

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
