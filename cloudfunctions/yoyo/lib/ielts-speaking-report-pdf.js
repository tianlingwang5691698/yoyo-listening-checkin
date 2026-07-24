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

function isInternalProcessText(value) {
  const text = cleanText(value);
  const lower = text.toLowerCase();
  return /(?:作为\s*AI|人工智能模型|语言模型|模型评分|模型返回|系统提示|内部流程|接口返回|provider)/i.test(text)
    || lower.includes(['open', 'ai'].join(''))
    || lower.includes(['ter', 'ra'].join(''));
}

function studentVisibleText(value) {
  const source = cleanText(value);
  if (!source) return '';
  return (source.match(/[^。！？.!?\n]+[。！？.!?]?/g) || [])
    .map((part) => part.trim())
    .filter((part) => part && !isInternalProcessText(part))
    .join(' ')
    .trim();
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

function average(attempts, field) {
  const values = attempts.map((item) => Number(item && item[field] || 0)).filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 2) / 2;
}

function latestByQuestion(attempts) {
  return (attempts || []).reduce((result, attempt) => {
    const key = cleanText(attempt.questionViewKey) || cleanText(attempt.promptText);
    if (!key) return result;
    const previous = result[key];
    const previousTime = cleanText(previous && (previous.updatedAt || previous.createdAt));
    const nextTime = cleanText(attempt.updatedAt || attempt.createdAt);
    if (!previous || nextTime >= previousTime) result[key] = attempt;
    return result;
  }, {});
}

function findAttempt(exercise, attemptMap, attempts) {
  const exact = Object.values(attemptMap).find((attempt) => (
    cleanText(attempt.questionViewKey) === cleanText(exercise.viewKey)
    || cleanText(attempt.questionViewKey) === cleanText(exercise.id)
  ));
  if (exact) return exact;
  const prompt = cleanText(exercise.prompt);
  return (attempts || []).filter((attempt) => cleanText(attempt.promptText || attempt.questionText) === prompt)
    .sort((left, right) => cleanText(right.updatedAt || right.createdAt).localeCompare(cleanText(left.updatedAt || left.createdAt)))[0] || null;
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

function addScoreSummary(doc, attempts) {
  doc.addPage();
  addSectionTitle(doc, '套题综合表现', COLORS.coral, 'PRACTICE BAND');
  const scored = attempts.filter((item) => (
    item.status === 'scored'
    && [
      item.ieltsOverallBand,
      item.ieltsFluencyCoherenceBand,
      item.ieltsLexicalResourceBand,
      item.ieltsGrammaticalRangeAccuracyBand,
      item.ieltsPronunciationBand
    ].every((value) => Number(value || 0) > 0)
  ));
  if (!scored.length) {
    writeText(doc, '暂无完整练习结果。', { color: COLORS.muted });
    return;
  }
  const overall = average(scored, 'ieltsOverallBand');
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, 180, 92, 4).fill(COLORS.pale);
  doc.font(FONT_PATH).fontSize(9.5).fillColor(COLORS.muted)
    .text('练习 Band', doc.page.margins.left + 16, y + 14, { width: 145, lineBreak: false });
  doc.font(LATIN_FONT_PATH).fontSize(34).fillColor(COLORS.coral)
    .text(String(overall), doc.page.margins.left + 15, y + 37, { width: 145, lineBreak: false });
  doc.y = y + 112;
  doc.x = doc.page.margins.left;

  const rows = [
    ['Fluency & Coherence', average(scored, 'ieltsFluencyCoherenceBand')],
    ['Lexical Resource', average(scored, 'ieltsLexicalResourceBand')],
    ['Grammatical Range & Accuracy', average(scored, 'ieltsGrammaticalRangeAccuracyBand')],
    ['Pronunciation', average(scored, 'ieltsPronunciationBand')]
  ];
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  rows.forEach(([label, value], index) => {
    const rowY = doc.y;
    if (index % 2 === 0) doc.rect(doc.page.margins.left, rowY - 3, width, 34).fill(COLORS.pale);
    doc.x = doc.page.margins.left + 10;
    writeText(doc, label, {
      font: LATIN_FONT_PATH,
      size: 10.3,
      color: COLORS.muted,
      width: width - 78,
      paragraphGap: 0
    });
    doc.font(LATIN_FONT_PATH).fontSize(15).fillColor(COLORS.ink)
      .text(String(value), doc.page.width - doc.page.margins.right - 58, rowY - 1, { width: 48, align: 'right' });
    doc.y = rowY + 36;
    doc.x = doc.page.margins.left;
  });
  writeText(doc, `基于 ${scored.length} 道已完成回答的平均值。`, {
    size: 9.3,
    color: COLORS.muted,
    paragraphGap: 3
  });
  writeText(doc, '本报告用于练习参考，不是正式 IELTS 成绩。', {
    size: 9.3,
    color: COLORS.muted,
    paragraphGap: 7
  });
}

function hasCompleteBands(attempt) {
  return [
    attempt && attempt.ieltsOverallBand,
    attempt && attempt.ieltsFluencyCoherenceBand,
    attempt && attempt.ieltsLexicalResourceBand,
    attempt && attempt.ieltsGrammaticalRangeAccuracyBand,
    attempt && attempt.ieltsPronunciationBand
  ].every((value) => Number(value || 0) > 0);
}

function addBandGrid(doc, attempt) {
  if (!hasCompleteBands(attempt)) {
    writeText(doc, '本题暂无完整练习结果。', { size: 10, color: COLORS.coral, paragraphGap: 8 });
    return;
  }
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rows = [
    ['Overall', Number(attempt.ieltsOverallBand)],
    ['Fluency & Coherence', Number(attempt.ieltsFluencyCoherenceBand)],
    ['Lexical Resource', Number(attempt.ieltsLexicalResourceBand)],
    ['Grammar', Number(attempt.ieltsGrammaticalRangeAccuracyBand)],
    ['Pronunciation', Number(attempt.ieltsPronunciationBand)]
  ];
  rows.forEach(([label, value], index) => {
    const y = doc.y;
    if (index === 0) doc.rect(doc.page.margins.left, y - 2, width, 30).fill(COLORS.pale);
    doc.font(LATIN_FONT_PATH).fontSize(index === 0 ? 10.8 : 9.8)
      .fillColor(index === 0 ? COLORS.coral : COLORS.muted)
      .text(label, doc.page.margins.left + 8, y + 3, { width: width - 66, lineBreak: false });
    doc.font(LATIN_FONT_PATH).fontSize(index === 0 ? 15 : 11.5)
      .fillColor(index === 0 ? COLORS.coral : COLORS.ink)
      .text(String(value), doc.page.width - doc.page.margins.right - 50, y, { width: 42, align: 'right', lineBreak: false });
    doc.y = y + (index === 0 ? 34 : 25);
    doc.x = doc.page.margins.left;
  });
  doc.moveDown(0.25);
}

function estimateQuestionHeight(doc, exercise, attempt) {
  let height = 105 + measureText(doc, exercise.prompt, {
    font: LATIN_FONT_PATH,
    size: 11.3,
    lineGap: 5
  });
  if (!attempt) return height;
  height += measureText(doc, attempt.studentTranscript || '未取得清晰转写', {
    font: LATIN_FONT_PATH,
    size: 10.9,
    lineGap: 5
  }) + 178;
  const feedback = studentVisibleText(attempt.feedback);
  if (feedback) height += measureText(doc, feedback, { size: 10.5, lineGap: 4 }) + 36;
  return height;
}

function addQuestion(doc, exercise, number, attempt) {
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 20;
  ensureSpace(doc, Math.min(usableHeight, estimateQuestionHeight(doc, exercise, attempt)));
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, 100, 28, 3).fill(COLORS.pale);
  doc.font(LATIN_FONT_PATH).fontSize(9.5).fillColor(COLORS.blue)
    .text(`QUESTION ${number}`, doc.page.margins.left + 10, y + 7, { width: 80, lineBreak: false });
  doc.x = doc.page.margins.left;
  doc.y = y + 38;
  writeText(doc, exercise.prompt, {
    font: LATIN_FONT_PATH,
    size: 11.3,
    lineGap: 5,
    paragraphGap: 10
  });
  if (!attempt) {
    writeText(doc, '学生回答：未作答', { size: 10.2, color: COLORS.muted, paragraphGap: 14 });
    return;
  }
  writeText(doc, `学生回答${attempt.answerDurationText ? ` · ${attempt.answerDurationText}` : ''}`, {
    size: 9.4,
    color: COLORS.green,
    paragraphGap: 3
  });
  writeText(doc, attempt.studentTranscript || '未取得清晰转写', {
    font: LATIN_FONT_PATH,
    size: 10.9,
    color: attempt.studentTranscript ? COLORS.ink : COLORS.muted,
    lineGap: 5,
    paragraphGap: 10
  });
  addBandGrid(doc, attempt);
  const feedback = studentVisibleText(attempt.feedback);
  if (feedback) {
    writeText(doc, '练习建议', { size: 9.4, color: COLORS.green, paragraphGap: 3 });
    writeText(doc, feedback, { size: 10.5, lineGap: 4, paragraphGap: 14 });
  }
}

function addParts(doc, item, attempts) {
  const attemptMap = latestByQuestion(attempts);
  [1, 2, 3].forEach((part) => {
    const exercises = (item.exercises || []).filter((exercise) => Number(exercise.part || 0) === part);
    if (!exercises.length) return;
    doc.addPage();
    addSectionTitle(doc, `Part ${part}`, part === 2 ? COLORS.coral : COLORS.blue, part === 1
      ? 'INTRODUCTION AND INTERVIEW'
      : (part === 2 ? 'INDIVIDUAL LONG TURN' : 'TWO-WAY DISCUSSION'));
    exercises.forEach((exercise, index) => {
      addQuestion(doc, exercise, index + 1, findAttempt(exercise, attemptMap, attempts));
    });
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
        `IELTS Speaking 练习报告 · ${index + 1} / ${range.count}`,
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

function buildIeltsSpeakingReportPdf(input) {
  const item = input && input.item || {};
  const attempts = Array.isArray(input && input.attempts) ? input.attempts : [];
  const reportAttempts = Object.values(latestByQuestion(attempts));
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, right: 50, bottom: 48, left: 50 },
      bufferPages: true,
      info: {
        Title: `${cleanText(item.title || 'IELTS Speaking')} - 口语套题练习报告`,
        Subject: 'IELTS Speaking 原题、学生回答、四项结果与逐题建议'
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
    writeText(doc, 'IELTS Speaking 套题练习报告', {
      size: 10.5,
      color: COLORS.coral,
      paragraphGap: 6
    });
    writeText(doc, item.title || 'IELTS Speaking', {
      font: LATIN_FONT_PATH,
      size: 22,
      lineGap: 3,
      paragraphGap: 8
    });
    writeText(doc, [
      item.book,
      item.testNumber ? `Test ${item.testNumber}` : '',
      `${attempts.length} 次练习记录`
    ].filter(Boolean).join('  ·  '), { size: 10, color: COLORS.muted, paragraphGap: 9 });
    writeText(doc, '报告保留完整套题，未练题明确标注“未作答”。综合表现仅按已有完整练习结果计算。', {
      size: 9.5,
      color: COLORS.muted,
      lineGap: 4,
      paragraphGap: 12
    });
    addScoreSummary(doc, reportAttempts);
    addParts(doc, item, reportAttempts);
    addPageNumbers(doc);
    doc.end();
  });
}

module.exports = {
  buildIeltsSpeakingReportPdf,
  FONT_PATH,
  LATIN_FONT_PATH,
  _test: {
    cleanText,
    isInternalProcessText,
    studentVisibleText,
    average,
    latestByQuestion,
    findAttempt,
    hasCompleteBands,
    estimateQuestionHeight
  }
};
