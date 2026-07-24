const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_PATH = path.resolve(__dirname, '../assets/fonts/NotoSansCJKsc-Regular.otf');
const LATIN_FONT_PATH = path.resolve(__dirname, '../assets/fonts/NotoSans-Regular.ttf');
const COLORS = {
  ink: '#203A5F',
  muted: '#607089',
  line: '#D8DEE7',
  coral: '#E56B4A',
  green: '#2F7D62',
  paper: '#FFFDF7',
  pale: '#F3F6F7'
};

function cleanText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function cleanList(value) {
  return (Array.isArray(value) ? value : []).map(cleanText).filter(Boolean);
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
      continued: false
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
      lineGap: options.lineGap === undefined ? 3 : options.lineGap
    });
}

function remainingHeight(doc) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function ensureSpace(doc, height) {
  if (remainingHeight(doc) < height) doc.addPage();
}

function writeList(doc, values, options = {}) {
  cleanList(values).forEach((item) => {
    writeText(doc, `• ${item}`, {
      size: options.size || 10.1,
      color: options.color || COLORS.ink,
      lineGap: 3,
      paragraphGap: 4
    });
  });
}

function addSectionTitle(doc, title, options = {}) {
  ensureSpace(doc, options.minHeight || 92);
  doc.moveDown(options.compact ? 0.25 : 0.55);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.45);
  writeText(doc, title, { size: 16.5, color: COLORS.ink, lineGap: 1, paragraphGap: 6 });
}

function addSubsection(doc, title, values, options = {}) {
  const items = Array.isArray(values) ? cleanList(values) : [cleanText(values)].filter(Boolean);
  if (!items.length) return;
  const bodyHeight = Array.isArray(values)
    ? items.reduce((height, item) => height + measureText(doc, `• ${item}`, { size: 10.1, lineGap: 3 }) + 5, 0)
    : measureText(doc, items[0], { size: 10.4, lineGap: 3 });
  ensureSpace(doc, Math.min(190, 30 + bodyHeight));
  writeText(doc, title, { size: 10.2, color: options.color || COLORS.green, lineGap: 1, paragraphGap: 3 });
  if (Array.isArray(values)) {
    writeList(doc, items, { size: 10.1 });
  } else {
    writeText(doc, items[0], { size: 10.4, lineGap: 3, paragraphGap: 6 });
  }
}

function addPromptImages(doc, imageBuffers) {
  (Array.isArray(imageBuffers) ? imageBuffers : []).forEach((buffer, index) => {
    if (!buffer || !buffer.length) return;
    ensureSpace(doc, 325);
    writeText(doc, imageBuffers.length > 1 ? `题目图片 ${index + 1}` : '题目图片', {
      size: 10.2,
      color: COLORS.muted,
      lineGap: 1,
      paragraphGap: 6
    });
    try {
      doc.image(buffer, {
        fit: [
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          285
        ],
        align: 'center'
      });
      doc.moveDown(0.6);
    } catch (error) {
      writeText(doc, '题目图片暂无法写入 PDF。', { size: 9, color: COLORS.muted });
    }
  });
}

function addPromptTable(doc, promptTable) {
  const table = promptTable && typeof promptTable === 'object' ? promptTable : null;
  if (!table) return;
  const headers = cleanList(table.headers);
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (!headers.length && !rows.length) return;
  ensureSpace(doc, 180);
  writeText(doc, '题目表格', { size: 10.2, color: COLORS.muted, lineGap: 1, paragraphGap: 4 });
  if (headers.length) writeText(doc, headers.join('  |  '), { size: 10, color: COLORS.ink });
  rows.forEach((row) => {
    const values = cleanList(row && row.values);
    writeText(doc, [cleanText(row && row.label), ...values].filter(Boolean).join('  |  '), {
      size: 9.8,
      color: COLORS.ink,
      paragraphGap: 4
    });
  });
}

function addPrompt(doc, attempt, imageBuffers) {
  const meta = attempt.promptMeta || {};
  const articleParagraphs = cleanList(meta.articleParagraphs);
  const scenario = cleanText(meta.scenario);
  const hasStructuredPrompt = cleanText(meta.directions)
    || scenario
    || articleParagraphs.length
    || cleanList(meta.requirements).length
    || cleanList(meta.notices).length
    || cleanText(meta.promptStarter);
  addSectionTitle(doc, '写作题目');
  addSubsection(doc, '作答说明', meta.directions);
  if (cleanText(meta.articleTitle)) {
    writeText(doc, meta.articleTitle, { size: 13.5, color: COLORS.ink, lineGap: 1, paragraphGap: 6 });
  }
  if (articleParagraphs.length) {
    articleParagraphs.forEach((paragraph) => writeText(doc, paragraph, {
      size: 10.7,
      lineGap: 4,
      paragraphGap: 9
    }));
  } else if (scenario) {
    addSubsection(doc, '写作任务', scenario);
  } else if (!hasStructuredPrompt) {
    writeText(doc, attempt.prompt, { font: LATIN_FONT_PATH, size: 10.8, lineGap: 4 });
  }
  addPromptTable(doc, meta.promptTable);
  addSubsection(doc, meta.requirementsTitle || '写作要点', meta.requirements);
  addSubsection(doc, '注意事项', meta.notices, { color: COLORS.coral });
  addSubsection(doc, '开头提示', meta.promptStarter);
  const wordRule = [
    Number(meta.minWords || 0) ? `不少于 ${Number(meta.minWords)} 词` : '',
    Number(meta.maxWords || 0) ? `不超过 ${Number(meta.maxWords)} 词` : ''
  ].filter(Boolean).join('；');
  if (wordRule) writeText(doc, wordRule, { size: 9.8, color: COLORS.muted });
  addPromptImages(doc, imageBuffers);
}

function estimateCriterionHeight(doc, criterion) {
  const item = criterion || {};
  let height = 65;
  height += measureText(doc, item.comment, { size: 10.7, lineGap: 4 });
  [
    item.evidence,
    item.descriptorMatch,
    item.limiters,
    item.nextBandActions
  ].forEach((value) => {
    const values = Array.isArray(value) ? cleanList(value) : [cleanText(value)].filter(Boolean);
    if (!values.length) return;
    height += 24;
    values.forEach((text) => {
      height += measureText(doc, `${Array.isArray(value) ? '• ' : ''}${text}`, {
        size: 10.1,
        lineGap: 3
      }) + 5;
    });
  });
  return height;
}

function addCriterion(doc, criterion) {
  const item = criterion || {};
  if (!cleanText(item.label)) return;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 24;
  ensureSpace(doc, Math.min(usableHeight, estimateCriterionHeight(doc, item)));
  doc.moveDown(0.55);
  writeText(doc, item.label, { size: 14, color: COLORS.ink, lineGap: 1, paragraphGap: 6 });
  writeText(doc, item.comment, { size: 10.7, lineGap: 4, paragraphGap: 7 });
  addSubsection(doc, '原文证据', item.evidence, { color: COLORS.coral });
  addSubsection(doc, '本档依据', item.descriptorMatch);
  addSubsection(doc, '卡分原因', item.limiters, { color: COLORS.coral });
  addSubsection(doc, '升到下一档', item.nextBandActions);
}

function containsScoringProcess(value) {
  return /AI|模型|校准|预估|估计总分|评分依据|Band Descriptors|逐档证据|权重为/i.test(cleanText(value));
}

function formatScoreLine(data) {
  const level = cleanText(data.level);
  const score = data.score;
  if (/IELTS\s*Band/i.test(level) && score !== undefined) return `Band ${score}`;
  if (score !== undefined) return `${score} / ${data.totalScore || 20}${level ? `  ·  ${level}` : ''}`;
  return level;
}

function addReview(doc, review) {
  const data = review || {};
  doc.addPage();
  addSectionTitle(doc, '批改报告', { compact: true });
  const scoreLine = formatScoreLine(data);
  if (scoreLine) {
    const y = doc.y;
    doc.roundedRect(doc.page.margins.left, y, 190, 48, 4).fill(COLORS.pale);
    doc.x = doc.page.margins.left + 12;
    doc.y = y + 10;
    writeText(doc, scoreLine, { size: 20, color: COLORS.coral, lineGap: 1, paragraphGap: 0 });
    doc.x = doc.page.margins.left;
    doc.y = y + 62;
  }
  if (cleanText(data.summary) && !containsScoringProcess(data.summary)) {
    addSubsection(doc, '总体评价', data.summary);
  }
  if (Array.isArray(data.criterionDetails) && data.criterionDetails.length) {
    data.criterionDetails.forEach((criterion) => addCriterion(doc, criterion));
  } else {
    [
      [data.contentLabel || '内容与任务完成', data.content],
      [data.structureLabel || '组织与衔接', data.structure],
      [data.languageLabel || '词汇资源', data.language],
      [data.spellingLabel || '语法与书写', data.spelling]
    ].forEach(([label, value]) => {
      if (!cleanText(value)) return;
      addCriterion(doc, { label, comment: value });
    });
  }
  addSubsection(doc, '做得好的地方', data.strengths);
  addSubsection(doc, '需要改进', data.problems, { color: COLORS.coral });
  addSubsection(doc, '下一步建议', data.suggestions);
  const corrections = Array.isArray(data.grammarCorrections) ? data.grammarCorrections : [];
  if (corrections.length) {
    addSectionTitle(doc, '句子订正');
    corrections.forEach((item, index) => {
      const blockHeight = [
        `${index + 1}. 原句：${cleanText(item && item.original)}`,
        `修改：${cleanText(item && item.corrected)}`,
        `原因：${cleanText(item && item.reason)}`
      ].reduce((height, text) => height + measureText(doc, text, { size: 10.2, lineGap: 3 }) + 6, 0);
      ensureSpace(doc, Math.min(180, blockHeight));
      writeText(doc, `${index + 1}. 原句：${cleanText(item && item.original)}`, { size: 10.2, lineGap: 3 });
      writeText(doc, `修改：${cleanText(item && item.corrected)}`, { size: 10.2, color: COLORS.green, lineGap: 3 });
      writeText(doc, `原因：${cleanText(item && item.reason)}`, { size: 9.9, color: COLORS.muted, lineGap: 3, paragraphGap: 9 });
    });
  }
  if (cleanText(data.polishedVersion)) {
    addSectionTitle(doc, data.polishedTitle || '参考范文');
    addLongEnglishText(doc, data.polishedVersion);
  }
  const bandSamples = Array.isArray(data.bandSamples) ? data.bandSamples : [];
  bandSamples.forEach((sample) => {
    if (!cleanText(sample && sample.essay)) return;
    addSectionTitle(doc, sample.title || `升档范文 · Band ${sample.targetBand || ''}`);
    addLongEnglishText(doc, sample.essay);
    addSubsection(doc, '相对原文的提升', sample.upgradeNotes);
    (Array.isArray(sample.criterionTargets) ? sample.criterionTargets : []).forEach((target) => {
      addSubsection(doc, target && target.label, target && target.changes);
    });
  });
}

function addLongEnglishText(doc, value) {
  const paragraphs = cleanText(value).split(/\n\s*\n/).map(cleanText).filter(Boolean);
  paragraphs.forEach((paragraph) => {
    const height = measureText(doc, paragraph, {
      font: LATIN_FONT_PATH,
      size: 11,
      lineGap: 4
    });
    ensureSpace(doc, Math.min(130, height + 18));
    writeText(doc, paragraph, {
      font: LATIN_FONT_PATH,
      size: 11,
      lineGap: 4,
      paragraphGap: 11
    });
  });
}

function addStudentEssay(doc, essay) {
  doc.addPage();
  addSectionTitle(doc, '学生作文', { compact: true });
  addLongEnglishText(doc, essay);
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
        `佑佑英语写作报告 · ${index + 1} / ${range.count}`,
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

function buildWritingReportPdf(input) {
  const attempt = input && input.attempt || {};
  const review = attempt.review || input && input.review || {};
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 44, right: 48, bottom: 46, left: 48 },
      bufferPages: true,
      info: {
        Title: `${cleanText(attempt.title || '写作练习')} - 批改报告`,
        Author: '佑佑英语',
        Subject: '写作题目、学生作文与批改报告'
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
    writeText(doc, '佑佑英语 · 写作批改报告', { size: 10, color: COLORS.coral, lineGap: 1, paragraphGap: 5 });
    writeText(doc, attempt.title || '写作练习', { size: 20, color: COLORS.ink, lineGap: 2, paragraphGap: 8 });
    const meta = [
      attempt.date,
      attempt.wordCount ? `${attempt.wordCount} words` : ''
    ].filter(Boolean).join('  ·  ');
    writeText(doc, meta, { size: 10, color: COLORS.muted, lineGap: 1, paragraphGap: 8 });

    addPrompt(doc, attempt, input && input.imageBuffers);
    addStudentEssay(doc, attempt.essay);
    addReview(doc, review);
    addPageNumbers(doc);
    doc.end();
  });
}

module.exports = {
  buildWritingReportPdf,
  FONT_PATH,
  LATIN_FONT_PATH,
  _test: {
    cleanText,
    cleanList,
    containsScoringProcess,
    formatScoreLine
  }
};
