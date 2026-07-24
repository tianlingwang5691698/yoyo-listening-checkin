function isAlpha(value) {
  return /[A-Za-z]/.test(value || '');
}

function isSentencePeriod(text, index) {
  const previous = text[index - 1] || '';
  const next = text[index + 1] || '';
  if (/\d/.test(previous) && /\d/.test(next)) return false;
  if (isAlpha(previous) && isAlpha(next)) {
    if (/[a-z]/.test(next)) return false;
    if (text[index + 2] === '.') return false;
  }
  const before = text.slice(Math.max(0, index - 8), index + 1);
  if (/\b(Mr|Mrs|Ms|Dr|No|St|Jr|Sr)\.$/.test(before)) return false;
  return true;
}

function splitReadingSentenceRanges(source) {
  const text = String(source || '');
  if (!text) return [];
  const ranges = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!'.．!?。！？\n'.includes(char)) continue;
    if (char === '.' && !isSentencePeriod(text, index)) continue;
    let end = index + 1;
    while (end < text.length && /\s/.test(text[end])) end += 1;
    if (text.slice(start, end).trim()) ranges.push({ start, end });
    start = end;
  }
  if (start < text.length && text.slice(start).trim()) ranges.push({ start, end: text.length });
  return ranges.length ? ranges : [{ start: 0, end: text.length }];
}

module.exports = {
  splitReadingSentenceRanges
};
