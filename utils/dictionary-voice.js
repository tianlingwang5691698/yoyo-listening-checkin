function expandPronunciationPlaceholders(value) {
  return String(value || '')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\bs\.?\s*b\.?('s)?(?![A-Za-z])/gi, (match, possessive) => (possessive ? "somebody's" : 'somebody'))
    .replace(/\bs\.?\s*th\.?(?![A-Za-z])/gi, 'something')
    .replace(/\bs\.?\s*o\.?(?![A-Za-z])/gi, 'someone')
    .replace(/\bone's\b/gi, "someone's")
    .replace(/\boneself\b/gi, 'yourself')
    .replace(/\badj\.?(?![A-Za-z])/gi, 'adjective')
    .replace(/\badv\.?(?![A-Za-z])/gi, 'adverb')
    .replace(/\bprep\.?(?![A-Za-z])/gi, 'preposition')
    .replace(/\bpron\.?(?![A-Za-z])/gi, 'pronoun')
    .replace(/\bv\.?(?![A-Za-z])/gi, 'verb')
    .replace(/\bn\.?(?![A-Za-z])/gi, 'noun')
    .replace(/\s*\/\s*/g, ' or ');
}

function normalizeDictionaryVoiceText(value) {
  return expandPronunciationPlaceholders(value)
    .replace(/\bon the outskir\b/gi, 'on the outskirts')
    .replace(/\.{2,}|…+/g, ' something ')
    .replace(/_+/g, ' something ')
    .replace(/~/g, ' something ')
    .replace(/&|\+/g, ' and ')
    .replace(/[→⇒]/g, ' to ')
    .replace(/\s+-\s+/g, ' and ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[,.!?;:，。！？；："“”]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeSimpleWord(value) {
  const word = String(value || '').toLowerCase();
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word) && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

function buildNaturalPhraseVariant(value) {
  const match = String(value || '').match(/^([A-Za-z][A-Za-z'-]+) to ([A-Za-z][A-Za-z'-]+)$/);
  if (!match || !/s$/i.test(match[1]) || !/s$/i.test(match[2])) return '';
  const left = singularizeSimpleWord(match[1]);
  const right = singularizeSimpleWord(match[2]);
  const article = /^[aeiou]/i.test(right) ? 'an' : 'a';
  return `${left} to ${article} ${right}`;
}

function canUseDictionaryVoice(value) {
  const text = normalizeDictionaryVoiceText(value);
  if (!text || text.length > 240) return false;
  const words = text.split(' ').filter(Boolean);
  return words.length >= 1
    && words.length <= 24
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

function buildDictionaryVoiceUrls(value) {
  const normalized = normalizeDictionaryVoiceText(value);
  const texts = [normalized, buildNaturalPhraseVariant(normalized)].filter((item, index, rows) => item && rows.indexOf(item) === index);
  return texts.flatMap((item) => {
    const encoded = encodeURIComponent(item);
    return [2, 1, 0].map((type) => `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${type}`);
  });
}

function buildDictionaryVoiceSegments(value) {
  const normalized = normalizeDictionaryVoiceText(value);
  if (!canUseDictionaryVoice(normalized)) return [];
  const words = normalized.split(' ').filter(Boolean);
  return words.length > 1 ? words : [];
}

function buildDictionaryVoiceSegmentUrls(segment) {
  const encoded = encodeURIComponent(String(segment || '').trim());
  return encoded
    ? [2, 1, 0].map((type) => `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${type}`)
    : [];
}

module.exports = {
  normalizeDictionaryVoiceText,
  canUseDictionaryVoice,
  buildDictionaryVoiceUrls,
  buildNaturalPhraseVariant,
  buildDictionaryVoiceSegments,
  buildDictionaryVoiceSegmentUrls
};
