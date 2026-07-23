const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_PATH = path.resolve(__dirname, '../assets/fonts/NotoSansCJKsc-Regular.otf');
const COLORS = {
  ink: '#203A5F',
  muted: '#607089',
  line: '#D8DEE7',
  coral: '#E56B4A',
  green: '#2F7D62',
  paper: '#FFFDF7',
  evidence: '#FFF8E4'
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
    .font(FONT_PATH)
    .fontSize(options.size || 10.5)
    .fillColor(options.color || COLORS.ink)
    .text(text, {
      lineGap: options.lineGap === undefined ? 3 : options.lineGap,
      paragraphGap: options.paragraphGap === undefined ? 5 : options.paragraphGap,
      continued: false
    });
}

function writeList(doc, values, options = {}) {
  cleanList(values).forEach((item) => {
    writeText(doc, `• ${item}`, {
      size: options.size || 9.5,
      color: options.color || COLORS.ink,
      lineGap: 2,
      paragraphGap: 3
    });
  });
}

function addSectionTitle(doc, title) {
  if (doc.y > doc.page.height - 90) doc.addPage();
  doc.moveDown(0.55);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.45);
  writeText(doc, title, { size: 15, color: COLORS.ink, lineGap: 1, paragraphGap: 4 });
}

function addSubsection(doc, title, values, options = {}) {
  const items = Array.isArray(values) ? cleanList(values) : [cleanText(values)].filter(Boolean);
  if (!items.length) return;
  if (doc.y > doc.page.height - 110) doc.addPage();
  writeText(doc, title, { size: 10, color: options.color || COLORS.green, lineGap: 1, paragraphGap: 2 });
  if (Array.isArray(values)) {
    writeList(doc, items, { size: 9.4 });
  } else {
    writeText(doc, items[0], { size: 9.6, lineGap: 2, paragraphGap: 4 });
  }
}

function addPromptImages(doc, imageBuffers) {
  (Array.isArray(imageBuffers) ? imageBuffers : []).forEach((buffer, index) => {
    if (!buffer || !buffer.length) return;
    if (doc.y > doc.page.height - 340) doc.addPage();
    writeText(doc, imageBuffers.length > 1 ? `题目图片 ${index + 1}` : '题目图片', {
      size: 10,
      color: COLORS.muted,
      lineGap: 1,
      paragraphGap: 4
    });
    try {
      doc.image(buffer, {
        fit: [
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          300
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
  if (doc.y > doc.page.height - 160) doc.addPage();
  writeText(doc, '题目表格', { size: 10, color: COLORS.muted, lineGap: 1, paragraphGap: 3 });
  if (headers.length) writeText(doc, headers.join('  |  '), { size: 9.4, color: COLORS.ink });
  rows.forEach((row) => {
    const values = cleanList(row && row.values);
    writeText(doc, [cleanText(row && row.label), ...values].filter(Boolean).join('  |  '), {
      size: 9.2,
      color: COLORS.ink,
      paragraphGap: 3
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
    writeText(doc, meta.articleTitle, { size: 13, color: COLORS.ink, lineGap: 1, paragraphGap: 5 });
  }
  if (articleParagraphs.length) {
    articleParagraphs.forEach((paragraph) => writeText(doc, paragraph, {
      size: 10.1,
      lineGap: 3,
      paragraphGap: 7
    }));
  } else if (scenario) {
    addSubsection(doc, '写作任务', scenario);
  } else if (!hasStructuredPrompt) {
    writeText(doc, attempt.prompt, { size: 10.5 });
  }
  addPromptTable(doc, meta.promptTable);
  addSubsection(doc, meta.requirementsTitle || '写作要点', meta.requirements);
  addSubsection(doc, '注意事项', meta.notices, { color: COLORS.coral });
  addSubsection(doc, '开头提示', meta.promptStarter);
  const wordRule = [
    Number(meta.minWords || 0) ? `不少于 ${Number(meta.minWords)} 词` : '',
    Number(meta.maxWords || 0) ? `不超过 ${Number(meta.maxWords)} 词` : ''
  ].filter(Boolean).join('；');
  if (wordRule) writeText(doc, wordRule, { size: 9.3, color: COLORS.muted });
  addPromptImages(doc, imageBuffers);
}

function addCriterion(doc, criterion) {
  const item = criterion || {};
  if (!cleanText(item.label)) return;
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.moveDown(0.4);
  writeText(doc, item.label, { size: 13, color: COLORS.ink, lineGap: 1, paragraphGap: 4 });
  writeText(doc, item.comment, { size: 10.2 });
  addSubsection(doc, '原文证据', item.evidence, { color: COLORS.coral });
  addSubsection(doc, '本档依据', item.descriptorMatch);
  addSubsection(doc, '卡分原因', item.limiters, { color: COLORS.coral });
  addSubsection(doc, '升到下一档', item.nextBandActions);
}

function addReview(doc, review) {
  const data = review || {};
  addSectionTitle(doc, '批改报告');
  const scoreLine = data.score !== undefined
    ? `${data.level || '评分结果'}  ·  ${data.score} / ${data.totalScore || 20}`
    : data.level;
  writeText(doc, scoreLine, { size: 16, color: COLORS.coral, lineGap: 1, paragraphGap: 5 });
  writeText(doc, data.estimateLabel, { size: 9.2, color: COLORS.muted });
  writeText(doc, data.weightingNote, { size: 9.2, color: COLORS.muted });
  if (data.writingTestEstimate) {
    const estimate = data.writingTestEstimate;
    writeText(doc, [
      cleanText(estimate.label),
      `Task 1 ${estimate.task1Score} · Task 2 ${estimate.task2Score}`,
      `Band ${estimate.score}`,
      cleanText(estimate.formula)
    ].filter(Boolean).join('  ·  '), { size: 9.4, color: COLORS.green });
  }
  if (cleanText(data.rubricVersion)) {
    writeText(doc, `评分依据：${cleanText(data.rubricVersion)}`, { size: 8.8, color: COLORS.muted });
  }
  writeText(doc, data.summary, { size: 11 });
  writeText(doc, data.feedbackNotice, { size: 9.5, color: COLORS.muted });
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
      writeText(doc, `${index + 1}. 原句：${cleanText(item && item.original)}`, { size: 9.6 });
      writeText(doc, `修改：${cleanText(item && item.corrected)}`, { size: 9.6, color: COLORS.green });
      writeText(doc, `原因：${cleanText(item && item.reason)}`, { size: 9.2, color: COLORS.muted });
    });
  }
  if (cleanText(data.polishedVersion)) {
    addSectionTitle(doc, data.polishedTitle || '参考范文');
    writeText(doc, data.polishedVersion, { size: 10.2, lineGap: 3, paragraphGap: 7 });
  }
  const bandSamples = Array.isArray(data.bandSamples) ? data.bandSamples : [];
  bandSamples.forEach((sample) => {
    if (!cleanText(sample && sample.essay)) return;
    addSectionTitle(doc, sample.title || `升档范文 · Band ${sample.targetBand || ''}`);
    writeText(doc, sample.essay, { size: 10.2, lineGap: 3, paragraphGap: 7 });
    addSubsection(doc, '相对原文的提升', sample.upgradeNotes);
    (Array.isArray(sample.criterionTargets) ? sample.criterionTargets : []).forEach((target) => {
      addSubsection(doc, target && target.label, target && target.changes);
    });
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
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
    writeText(doc, '佑佑英语 · 写作批改报告', { size: 10, color: COLORS.coral, lineGap: 1, paragraphGap: 5 });
    writeText(doc, attempt.title || '写作练习', { size: 20, color: COLORS.ink, lineGap: 2, paragraphGap: 8 });
    const meta = [
      attempt.date,
      attempt.wordCount ? `${attempt.wordCount} words` : '',
      review.level || '',
      review.score !== undefined ? `${review.score} / ${review.totalScore || attempt.totalScore || 20}` : ''
    ].filter(Boolean).join('  ·  ');
    writeText(doc, meta, { size: 9.5, color: COLORS.muted, lineGap: 1, paragraphGap: 8 });

    addPrompt(doc, attempt, input && input.imageBuffers);

    addSectionTitle(doc, '学生作文');
    writeText(doc, attempt.essay, { size: 10.5, lineGap: 3, paragraphGap: 8 });
    addReview(doc, review);
    addPageNumbers(doc);
    doc.end();
  });
}

module.exports = {
  buildWritingReportPdf,
  FONT_PATH,
  _test: {
    cleanText,
    cleanList
  }
};
