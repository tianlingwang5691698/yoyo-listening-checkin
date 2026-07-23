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

function writeText(doc, value, options = {}) {
  const text = cleanText(value);
  if (!text) return;
  doc
    .font(options.font || FONT_PATH)
    .fontSize(options.size || 10)
    .fillColor(options.color || COLORS.ink)
    .text(text, {
      width: options.width,
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
    .fontSize(options.size || 10)
    .heightOfString(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: options.lineGap === undefined ? 3 : options.lineGap
    });
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

function addSectionTitle(doc, title, tone = COLORS.blue) {
  ensureSpace(doc, 70);
  doc.moveDown(0.65);
  const y = doc.y;
  doc.rect(doc.page.margins.left, y + 2, 4, 19).fill(tone);
  doc.x = doc.page.margins.left + 12;
  writeText(doc, title, { size: 15, lineGap: 1, paragraphGap: 5 });
  doc.x = doc.page.margins.left;
  doc.strokeColor(COLORS.line).lineWidth(0.7)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

function addOriginalImage(doc, imageBuffer) {
  if (!imageBuffer || !imageBuffer.length) return;
  addSectionTitle(doc, '原题原图', COLORS.green);
  ensureSpace(doc, 350);
  doc.image(imageBuffer, {
    fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 330],
    align: 'center'
  });
  doc.moveDown(0.5);
}

function addScoreSummary(doc, attempts) {
  addSectionTitle(doc, '套题综合表现', COLORS.coral);
  const scored = attempts.filter((item) => item.status === 'scored' && Number(item.ieltsOverallBand || 0) > 0);
  if (!scored.length) {
    writeText(doc, '暂无完整评分记录。', { color: COLORS.muted });
    return;
  }
  const rows = [
    ['Overall', average(scored, 'ieltsOverallBand')],
    ['Fluency & Coherence', average(scored, 'ieltsFluencyCoherenceBand')],
    ['Lexical Resource', average(scored, 'ieltsLexicalResourceBand')],
    ['Grammar', average(scored, 'ieltsGrammaticalRangeAccuracyBand')],
    ['Pronunciation', average(scored, 'ieltsPronunciationBand')]
  ];
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  rows.forEach(([label, value], index) => {
    ensureSpace(doc, 35);
    const y = doc.y;
    if (index % 2 === 0) doc.rect(doc.page.margins.left, y - 3, width, 29).fill(COLORS.pale);
    doc.x = doc.page.margins.left + 8;
    writeText(doc, label, { size: 9.5, color: COLORS.muted, width: width - 80, paragraphGap: 0 });
    doc.font(LATIN_FONT_PATH).fontSize(14).fillColor(index === 0 ? COLORS.coral : COLORS.ink)
      .text(String(value || '—'), doc.page.width - doc.page.margins.right - 54, y - 1, { width: 46, align: 'right' });
    doc.y = y + 31;
    doc.x = doc.page.margins.left;
  });
  writeText(doc, `基于 ${scored.length} 道已评分回答的平均值，仅用于练习参考。`, {
    size: 8.7,
    color: COLORS.muted,
    paragraphGap: 4
  });
}

function addBandLine(doc, attempt) {
  const complete = [
    attempt.ieltsOverallBand,
    attempt.ieltsFluencyCoherenceBand,
    attempt.ieltsLexicalResourceBand,
    attempt.ieltsGrammaticalRangeAccuracyBand,
    attempt.ieltsPronunciationBand
  ].every((value) => Number(value || 0) > 0);
  if (!complete) {
    writeText(doc, '评分未完整返回', { size: 9, color: COLORS.coral, paragraphGap: 5 });
    return;
  }
  writeText(doc, [
    `Overall ${Number(attempt.ieltsOverallBand)}`,
    `FC ${Number(attempt.ieltsFluencyCoherenceBand)}`,
    `LR ${Number(attempt.ieltsLexicalResourceBand)}`,
    `GRA ${Number(attempt.ieltsGrammaticalRangeAccuracyBand)}`,
    `P ${Number(attempt.ieltsPronunciationBand)}`
  ].join('  ·  '), { font: LATIN_FONT_PATH, size: 9.5, color: COLORS.coral, paragraphGap: 5 });
}

function addQuestion(doc, exercise, number, attempt) {
  let estimatedHeight = 92 + measureText(doc, exercise.prompt, {
    font: LATIN_FONT_PATH,
    size: 10.5,
    lineGap: 3
  });
  if (attempt) {
    estimatedHeight += measureText(doc, attempt.studentTranscript || '转写未返回', {
      font: LATIN_FONT_PATH,
      size: 10,
      lineGap: 4
    }) + 55;
    estimatedHeight += measureText(doc, attempt.feedback, { size: 9.6, lineGap: 4 }) + 28;
  }
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 20;
  ensureSpace(doc, Math.min(usableHeight, estimatedHeight));
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 24, 3)
    .fill(COLORS.pale);
  doc.x = doc.page.margins.left + 9;
  doc.y = y + 5;
  writeText(doc, `Question ${number}`, { font: LATIN_FONT_PATH, size: 9, color: COLORS.blue, paragraphGap: 0 });
  doc.x = doc.page.margins.left;
  doc.y = y + 32;
  writeText(doc, exercise.prompt, { font: LATIN_FONT_PATH, size: 10.5, lineGap: 3, paragraphGap: 7 });
  if (!attempt) {
    writeText(doc, '学生回答：未作答', { size: 9.5, color: COLORS.muted, paragraphGap: 10 });
    return;
  }
  writeText(doc, `学生回答${attempt.answerDurationText ? ` · ${attempt.answerDurationText}` : ''}`, {
    size: 8.8,
    color: COLORS.green,
    paragraphGap: 2
  });
  writeText(doc, attempt.studentTranscript || '转写未返回', {
    font: LATIN_FONT_PATH,
    size: 10,
    color: attempt.studentTranscript ? COLORS.ink : COLORS.muted,
    lineGap: 4,
    paragraphGap: 7
  });
  addBandLine(doc, attempt);
  if (cleanText(attempt.feedback)) {
    writeText(doc, '批改反馈', { size: 8.8, color: COLORS.green, paragraphGap: 2 });
    writeText(doc, attempt.feedback, { size: 9.6, lineGap: 4, paragraphGap: 10 });
  }
}

function addParts(doc, item, attempts) {
  const attemptMap = latestByQuestion(attempts);
  [1, 2, 3].forEach((part) => {
    const exercises = (item.exercises || []).filter((exercise) => Number(exercise.part || 0) === part);
    if (!exercises.length) return;
    addSectionTitle(doc, `Part ${part}`, part === 2 ? COLORS.coral : COLORS.blue);
    writeText(doc, part === 1
      ? 'Introduction and interview'
      : (part === 2 ? 'Individual long turn' : 'Two-way discussion'), {
      font: LATIN_FONT_PATH,
      size: 9.5,
      color: COLORS.muted,
      paragraphGap: 7
    });
    exercises.forEach((exercise, index) => {
      addQuestion(doc, exercise, index + 1, findAttempt(exercise, attemptMap, attempts));
    });
  });
}

function addImprovement(doc, attempts) {
  const feedback = attempts.map((item) => cleanText(item.feedback)).filter(Boolean);
  if (!feedback.length) return;
  addSectionTitle(doc, '下一步练习', COLORS.green);
  feedback.slice(-3).forEach((text, index) => {
    ensureSpace(doc, 80);
    writeText(doc, `${index + 1}. ${text}`, { size: 9.8, lineGap: 4, paragraphGap: 8 });
  });
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(FONT_PATH).fontSize(7.8).fillColor(COLORS.muted)
      .text(`AI 练习预估，不是正式 IELTS 成绩  ·  ${index + 1} / ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 28,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center',
          lineBreak: false
        });
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
      margins: { top: 44, right: 48, bottom: 46, left: 48 },
      bufferPages: true,
      info: {
        Title: `${cleanText(item.title || 'IELTS Speaking')} - 口语套题学习报告`,
        Author: '佑佑英语',
        Subject: 'IELTS Speaking 原题、学生回答、四项评分与逐题反馈'
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
    writeText(doc, '佑佑英语 · IELTS Speaking 套题学习报告', {
      size: 10,
      color: COLORS.coral,
      paragraphGap: 5
    });
    writeText(doc, item.title || 'IELTS Speaking', { font: LATIN_FONT_PATH, size: 20, lineGap: 2, paragraphGap: 6 });
    writeText(doc, [
      item.book,
      item.testNumber ? `Test ${item.testNumber}` : '',
      `${attempts.length} 次真实练习记录`
    ].filter(Boolean).join('  ·  '), { size: 9.5, color: COLORS.muted, paragraphGap: 8 });
    writeText(doc, '报告保留完整套题；未练题明确标注“未作答”。综合分仅基于现有真实评分记录计算。', {
      size: 9,
      color: COLORS.muted,
      lineGap: 3,
      paragraphGap: 8
    });
    addOriginalImage(doc, input && input.imageBuffer);
    addScoreSummary(doc, reportAttempts);
    addParts(doc, item, reportAttempts);
    addImprovement(doc, reportAttempts);
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
    average,
    latestByQuestion,
    findAttempt
  }
};
