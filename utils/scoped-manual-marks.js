const { toggleWordMark, toggleSentenceMark, countReadingMarks } = require('./reading-manual-marks');

function tokenizeScopedText(text, scopeKey) {
  const source = String(text || '');
  const scope = String(scopeKey || 'text');
  let wordIndex = 0;
  return source.split(/([A-Za-z][A-Za-z'-]*)/g).filter(Boolean).map((part, index) => {
    const isWord = /^[A-Za-z][A-Za-z'-]*$/.test(part);
    const token = {
      id: `${scope}:${index}`,
      text: part,
      word: isWord ? part : '',
      sentenceKey: scope,
      wordIndex: isWord ? wordIndex : -1,
      markKey: isWord ? `${scope}:${wordIndex}` : ''
    };
    if (isWord) wordIndex += 1;
    return token;
  });
}

function splitScopedSentences(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const ranges = [];
  const abbreviations = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'fig', 'no']);
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    if (!'.．!?。！？'.includes(ch)) continue;
    if (ch === '.' || ch === '．') {
      if (/\d/.test(source[index - 1] || '') && /\d/.test(source[index + 1] || '')) continue;
      const before = source.slice(start, index);
      const tokenMatch = before.match(/([A-Za-z]+(?:\.[A-Za-z]+)?)$/);
      const token = String(tokenMatch && tokenMatch[1] || '').toLowerCase();
      if (abbreviations.has(token) || /^[a-z]$/.test(token)) continue;
      if (source[index + 1] === '.' || source[index + 1] === '．') continue;
    }
    let end = index + 1;
    while (end < source.length && /["'”’)]/.test(source[end])) end += 1;
    if (end < source.length && !/\s/.test(source[end]) && !/[A-Z“"‘']/.test(source[end])) continue;
    while (end < source.length && /\s/.test(source[end])) end += 1;
    const sentence = source.slice(start, end).trim();
    if (sentence) ranges.push(sentence);
    start = end;
    index = end - 1;
  }
  const tail = source.slice(start).trim();
  if (tail) ranges.push(tail);
  return ranges.length ? ranges : [source];
}

function buildScopedMarkItems(sources, tokenMarks, sentenceMarks) {
  const sourceMap = sources || {};
  const wordMap = tokenMarks || {};
  const sentenceMap = sentenceMarks || {};
  const items = [];
  Object.keys(sourceMap).forEach((scope) => {
    const text = String(sourceMap[scope] || '').trim();
    if (!text) return;
    if (sentenceMap[scope]) items.push({ type: 'sentence', text });
    const words = (text.match(/[A-Za-z][A-Za-z'-]*/g) || []);
    let index = 0;
    while (index < words.length) {
      const tone = wordMap[`${scope}:${index}`];
      if (!tone) {
        index += 1;
        continue;
      }
      if (tone === 'phrase') {
        const phrase = [];
        while (index < words.length && wordMap[`${scope}:${index}`] === 'phrase') {
          phrase.push(words[index]);
          index += 1;
        }
        if (phrase.length) items.push({ type: 'phrase', text: phrase.join(' ') });
      } else {
        items.push({ type: 'word', text: words[index] });
        index += 1;
      }
    }
  });
  return items.slice(0, 120);
}

function buildManualMarks(sources, tokenMarks, sentenceMarks) {
  return {
    tokenMarks: Object.assign({}, tokenMarks || {}),
    sentenceMarks: Object.assign({}, sentenceMarks || {}),
    items: buildScopedMarkItems(sources, tokenMarks, sentenceMarks)
  };
}

module.exports = {
  tokenizeScopedText,
  splitScopedSentences,
  toggleScopedTokenMark: toggleWordMark,
  toggleScopedSentenceMark: toggleSentenceMark,
  countScopedMarks: countReadingMarks,
  buildScopedMarkItems,
  buildManualMarks
};
