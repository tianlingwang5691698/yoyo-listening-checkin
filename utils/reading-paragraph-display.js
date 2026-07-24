const { splitReadingSentenceRanges } = require('./reading-sentence-ranges');

function normalizeReadingPassageText(passageId, passageText) {
  const source = String(passageText || '');
  if (!/^sh-em\d.*-reading-a$/.test(String(passageId || ''))) return source;
  return source
    .replace(/^answer\b[.：:]?\s*(?:[（(]\s*根据(?:短文|文章|对话)内容，?\s*选择最恰当的答案\s*[）)]\s*[：:]?)?\s*(?:[（(]\s*12分\s*[）)])?\s*/i, '')
    .replace(/^根据(?:短文|文章|对话)内容，?\s*选择最恰当的答案[.。：:]?\s*/i, '');
}

function rangesFromSeparator(source, separator) {
  const starts = [0];
  let match;
  while ((match = separator.exec(source))) {
    starts.push(match.index + match[0].length);
  }
  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] === undefined ? source.length : starts[index + 1]
  })).filter((range) => source.slice(range.start, range.end).trim());
}

function originalLabelCandidate(source, range) {
  const text = source.slice(range.start, range.end).trimStart();
  const match = text.match(/^([A-Z])(?:(?:[.、：:]\s*|\s+)(?=\S)|\s*$)/);
  if (!match) return null;
  return Object.assign({}, range, { sourceLabel: match[1] });
}

function findOriginalIeltsLabelAnchors(source, blocks) {
  const candidates = blocks.map((range) => originalLabelCandidate(source, range)).filter(Boolean);
  let best = [];
  candidates.forEach((candidate, candidateIndex) => {
    if (candidate.sourceLabel !== 'A') return;
    const chain = [candidate];
    let expectedCode = 'B'.charCodeAt(0);
    for (let index = candidateIndex + 1; index < candidates.length; index += 1) {
      const code = candidates[index].sourceLabel.charCodeAt(0);
      if (code === expectedCode) {
        chain.push(candidates[index]);
        expectedCode += 1;
      }
    }
    if (chain.length > best.length) best = chain;
  });
  return best.length >= 2 ? best : [];
}

function expectedIeltsLabels(questions) {
  const texts = [];
  (questions || []).forEach((question) => {
    texts.push(question && question.groupInstruction, question && question.prompt, question && question.groupTitle);
  });
  for (let index = 0; index < texts.length; index += 1) {
    const match = String(texts[index] || '').match(/paragraphs?\s*,?\s*A\s*[-–—]\s*([B-Z])/i);
    if (!match) continue;
    const endCode = match[1].toUpperCase().charCodeAt(0);
    return Array.from({ length: endCode - 64 }, (_, labelIndex) => String.fromCharCode(65 + labelIndex));
  }
  const optionLabels = [];
  (questions || []).forEach((question) => {
    Object.values((question && question.options) || {}).forEach((option) => {
      const match = String(option || '').match(/^Paragraph\s+([A-Z])$/i);
      if (match) optionLabels.push(match[1].toUpperCase());
    });
  });
  const unique = Array.from(new Set(optionLabels)).sort();
  return unique.length >= 2 && unique[0] === 'A' ? unique : [];
}

function findInlineIeltsLabelStart(source, label, fromIndex, allowUnpunctuatedPrefix) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = allowUnpunctuatedPrefix ? '(^|\\s+)' : '(^|[.．!?\u3002\uff01\uff1f]["\'”’)]*\\s+)';
  const regex = new RegExp(`${prefix}(${escaped})\\s+(?=[A-Z0-9"“‘'])`, 'g');
  regex.lastIndex = Math.max(0, fromIndex || 0);
  const match = regex.exec(source);
  return match ? match.index + match[1].length : -1;
}

function findInlineIeltsLabelAnchors(source, questions) {
  const expected = expectedIeltsLabels(questions);
  const labels = expected.length ? expected : Array.from({ length: 14 }, (_, index) => String.fromCharCode(65 + index));
  const anchors = [];
  let fromIndex = 0;
  for (let index = 0; index < labels.length; index += 1) {
    const start = findInlineIeltsLabelStart(source, labels[index], fromIndex, expected.length && index === 0);
    if (start < 0) {
      if (expected.length) return [];
      break;
    }
    anchors.push({ start, sourceLabel: labels[index] });
    fromIndex = start + 2;
  }
  return anchors.length >= 2 ? anchors : [];
}

function rangesFromIeltsAnchors(source, anchors) {
  const ranges = [];
  if (source.slice(0, anchors[0].start).trim()) {
    ranges.push({ start: 0, end: anchors[0].start, label: 'Introduction', sourceLabel: '' });
  }
  anchors.forEach((anchor, index) => {
    ranges.push({
      start: anchor.start,
      end: anchors[index + 1] ? anchors[index + 1].start : source.length,
      label: `Paragraph ${anchor.sourceLabel}`,
      sourceLabel: anchor.sourceLabel
    });
  });
  return ranges.map((range, index) => Object.assign({}, range, { index: index + 1 }));
}

function rangesFromMetadata(source, metadata) {
  const paragraphs = Array.isArray(metadata) ? metadata : metadata && metadata.paragraphs;
  if (!Array.isArray(paragraphs) || !paragraphs.length) return [];
  const starts = [];
  let fromIndex = 0;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const label = Array.isArray(paragraph) ? paragraph[0] : paragraph.label;
    const sourceLabel = Array.isArray(paragraph) ? paragraph[1] : paragraph.sourceLabel;
    const prefix = Array.isArray(paragraph) ? paragraph[2] : paragraph.prefix;
    const words = String(prefix || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const regex = new RegExp(pattern, 'g');
    regex.lastIndex = fromIndex;
    const match = regex.exec(source);
    if (!match) return [];
    starts.push({ start: match.index, label, sourceLabel: sourceLabel || '' });
    fromIndex = match.index + match[0].length;
  }
  if (starts[0].start > 0 && !source.slice(0, starts[0].start).trim()) starts[0].start = 0;
  return starts.map((item, index) => ({
    start: item.start,
    end: starts[index + 1] ? starts[index + 1].start : source.length,
    index: index + 1,
    label: item.label,
    sourceLabel: item.sourceLabel
  }));
}

function markOriginalSourceLabels(source, ranges) {
  return (ranges || []).map((range) => {
    const sourceLabel = String(range.sourceLabel || '').trim();
    if (!/^[A-Z]$/.test(sourceLabel)) return range;
    const escaped = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const text = source.slice(range.start, range.end);
    const match = text.match(new RegExp(`^\\s*(${escaped})(?:[.、：:]?)(?=\\s)\\s*`));
    if (!match) return range;
    return Object.assign({}, range, {
      hasOriginalSourceLabel: true,
      sourceLabelText: match[1],
      contentStart: range.start + match[0].length
    });
  });
}

function finalizeReadingRanges(source, ranges) {
  return markOriginalSourceLabels(source, ranges);
}

function normalizeIeltsLeadSubtitle(source, ranges) {
  if (!Array.isArray(ranges) || ranges.length < 2) return ranges || [];
  const first = ranges[0];
  const firstText = source.slice(first.start, first.end).trim();
  const isNumericFirst = /^Paragraph\s+1$/i.test(String(first.label || ''));
  const looksLikeSubtitle = isNumericFirst
    && !String(first.sourceLabel || '').trim()
    && firstText.length > 1
    && firstText.length <= 180
    && !/[.!?。！？]["'”’)]*$/.test(firstText);
  if (!looksLikeSubtitle) return ranges;
  return ranges.map((range, index) => {
    if (index === 0) {
      return Object.assign({}, range, { index: 0, label: '', isSubtitle: true });
    }
    const numericMatch = String(range.label || '').match(/^Paragraph\s+(\d+)$/i);
    return Object.assign({}, range, {
      index,
      label: numericMatch ? `Paragraph ${index}` : range.label
    });
  });
}

function finalizeIeltsRanges(source, ranges) {
  return finalizeReadingRanges(source, normalizeIeltsLeadSubtitle(source, ranges));
}

function buildHeuristicRanges(source) {
  const sentences = splitReadingSentenceRanges(source);
  const ranges = [];
  let start = sentences[0].start;
  let count = 0;
  sentences.forEach((sentence, index) => {
    count += 1;
    const length = sentence.end - start;
    const next = sentences[index + 1];
    const nextLength = next ? next.end - start : 0;
    if (!next || (length >= 300 && (count >= 3 || nextLength > 520)) || length >= 520) {
      ranges.push({ start, end: sentence.end });
      if (next) start = next.start;
      count = 0;
    }
  });
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    if (last.end - last.start < 140) {
      ranges[ranges.length - 2].end = last.end;
      ranges.pop();
    }
  }
  return ranges;
}

function withNumericLabels(ranges, ielts) {
  return ranges.map((range, index) => Object.assign({}, range, {
    index: index + 1,
    label: ielts ? `Paragraph ${index + 1}` : `第 ${index + 1} 段`,
    sourceLabel: ''
  }));
}

function buildReadingParagraphRanges(passageId, passageText, questions, metadata) {
  const source = String(passageText || '');
  if (!source.trim()) return [];
  const isIelts = String(passageId || '').indexOf('ielts-') === 0;
  const blankLineBlocks = rangesFromSeparator(source, /\n\s*\n+/g);

  if (isIelts && metadata) {
    const metadataRanges = rangesFromMetadata(source, metadata);
    if (metadataRanges.length) return finalizeIeltsRanges(source, metadataRanges);
  }

  if (isIelts && blankLineBlocks.length > 1) {
    const anchors = findOriginalIeltsLabelAnchors(source, blankLineBlocks);
    if (anchors.length) {
      return finalizeIeltsRanges(source, rangesFromIeltsAnchors(source, anchors));
    }
    const expected = expectedIeltsLabels(questions);
    if (expected.length && (blankLineBlocks.length === expected.length || blankLineBlocks.length === expected.length + 1)) {
      const hasIntroduction = blankLineBlocks.length === expected.length + 1;
      return finalizeIeltsRanges(source, blankLineBlocks.map((range, index) => {
        if (hasIntroduction && index === 0) {
          return Object.assign({}, range, { index: 1, label: 'Introduction', sourceLabel: '' });
        }
        const label = expected[index - (hasIntroduction ? 1 : 0)];
        return Object.assign({}, range, {
          index: index + 1,
          label: `Paragraph ${label}`,
          sourceLabel: label
        });
      }));
    }
    return finalizeIeltsRanges(source, withNumericLabels(blankLineBlocks, true));
  }

  if (isIelts) {
    const inlineAnchors = findInlineIeltsLabelAnchors(source, questions);
    if (inlineAnchors.length) return finalizeIeltsRanges(source, rangesFromIeltsAnchors(source, inlineAnchors));
  }

  if (!isIelts) {
    const lineBlocks = rangesFromSeparator(source, /\n+/g);
    const averageLength = lineBlocks.reduce((sum, range) => sum + range.end - range.start, 0) / lineBlocks.length;
    if (lineBlocks.length > 1 && lineBlocks.length <= 30 && averageLength >= 90) {
      return finalizeReadingRanges(source, withNumericLabels(lineBlocks, false));
    }
  }

  const heuristicRanges = withNumericLabels(buildHeuristicRanges(source), isIelts);
  return isIelts ? finalizeIeltsRanges(source, heuristicRanges) : finalizeReadingRanges(source, heuristicRanges);
}

function analyzeOriginalIeltsParagraphLabels(passageText) {
  const source = String(passageText || '');
  const blocks = rangesFromSeparator(source, /\n\s*\n+/g);
  const anchors = findOriginalIeltsLabelAnchors(source, blocks);
  return {
    hasOriginalLabels: anchors.length >= 2,
    labels: anchors.map((item) => item.sourceLabel),
    naturalParagraphCount: blocks.length
  };
}

module.exports = {
  analyzeOriginalIeltsParagraphLabels,
  buildReadingParagraphRanges,
  normalizeReadingPassageText
};
