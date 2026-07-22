function normalizeSentenceKey(value) {
  return String(value === undefined || value === null ? '' : value);
}

function toggleWordMark(markMap, sentenceKey, wordIndex) {
  const key = normalizeSentenceKey(sentenceKey);
  const index = Number(wordIndex);
  if (!key || !Number.isInteger(index) || index < 0) {
    return Object.assign({}, markMap || {});
  }
  const next = Object.assign({}, markMap || {});
  const prefix = `${key}:`;
  const selected = Object.keys(next).reduce((indexes, markKey) => {
    if (markKey.indexOf(prefix) !== 0) return indexes;
    const selectedIndex = Number(markKey.slice(prefix.length));
    if (Number.isInteger(selectedIndex) && selectedIndex >= 0) indexes.add(selectedIndex);
    delete next[markKey];
    return indexes;
  }, new Set());
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);

  const sorted = Array.from(selected).sort((a, b) => a - b);
  let runStart = 0;
  while (runStart < sorted.length) {
    let runEnd = runStart;
    while (runEnd + 1 < sorted.length && sorted[runEnd + 1] === sorted[runEnd] + 1) runEnd += 1;
    const tone = runEnd > runStart ? 'phrase' : 'word';
    for (let cursor = runStart; cursor <= runEnd; cursor += 1) {
      next[`${key}:${sorted[cursor]}`] = tone;
    }
    runStart = runEnd + 1;
  }
  return next;
}

function toggleSentenceMark(markMap, sentenceKey) {
  const key = normalizeSentenceKey(sentenceKey);
  const next = Object.assign({}, markMap || {});
  if (!key) return next;
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

function countReadingMarks(wordMarks, sentenceMarks) {
  return Object.keys(wordMarks || {}).length + Object.keys(sentenceMarks || {}).length;
}

function splitSentenceRanges(source) {
  const text = String(source || '');
  if (!text) return [];
  const ranges = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (!'.．!?。！？\n'.includes(ch)) continue;
    if (ch === '.' && /[A-Za-z]/.test(text[index - 1] || '') && /[A-Za-z]/.test(text[index + 1] || '')) continue;
    if (ch === '.' && /\b(Mr|Mrs|Ms|Dr|No|St|Jr|Sr)\.$/.test(text.slice(Math.max(0, index - 8), index + 1))) continue;
    let end = index + 1;
    while (end < text.length && /\s/.test(text[end])) end += 1;
    if (text.slice(start, end).trim()) ranges.push({ start, end });
    start = end;
  }
  if (start < text.length && text.slice(start).trim()) ranges.push({ start, end: text.length });
  return ranges.length ? ranges : [{ start: 0, end: text.length }];
}

function buildReadingMarkItems(passageText, tokenMarks, sentenceMarks) {
  const source = String(passageText || '');
  const wordMarks = tokenMarks || {};
  const sentenceMap = sentenceMarks || {};
  const items = [];
  splitSentenceRanges(source).forEach((range) => {
    const sentenceKey = String(range.start);
    const sentenceText = source.slice(range.start, range.end).trim();
    if (sentenceMap[sentenceKey] && sentenceText) {
      items.push({ type: 'sentence', text: sentenceText });
    }
    const words = [];
    const regex = /[A-Za-z][A-Za-z'-]*/g;
    let match;
    while ((match = regex.exec(source.slice(range.start, range.end)))) words.push(match[0]);
    let index = 0;
    while (index < words.length) {
      const tone = wordMarks[`${sentenceKey}:${index}`];
      if (!tone) {
        index += 1;
        continue;
      }
      if (tone === 'phrase') {
        const phrase = [];
        while (index < words.length && wordMarks[`${sentenceKey}:${index}`] === 'phrase') {
          phrase.push(words[index]);
          index += 1;
        }
        if (phrase.length) items.push({ type: 'phrase', text: phrase.join(' ') });
        continue;
      }
      items.push({ type: 'word', text: words[index] });
      index += 1;
    }
  });
  return items.slice(0, 120);
}

module.exports = {
  toggleWordMark,
  toggleSentenceMark,
  countReadingMarks,
  buildReadingMarkItems
};
