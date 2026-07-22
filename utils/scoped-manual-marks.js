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
  toggleScopedTokenMark: toggleWordMark,
  toggleScopedSentenceMark: toggleSentenceMark,
  countScopedMarks: countReadingMarks,
  buildScopedMarkItems,
  buildManualMarks
};
