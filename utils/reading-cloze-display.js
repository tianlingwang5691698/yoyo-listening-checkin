function questionNumbers(questions) {
  return new Set((questions || [])
    .filter((question) => question && question.questionType === 'blank')
    .map((question) => Number(question.number))
    .filter((number) => Number.isInteger(number) && number > 0));
}

function standardBlankRegex() {
  return /([A-Za-z])?[_＿]{1,}(\d{1,3})[_＿]{1,}/g;
}

function hintedBareBlankRegex(number) {
  return new RegExp(`(^|[^\\d_＿])(${number})(?![\\d_＿])(?=\\s*[（(]\\s*[A-Za-z][A-Za-z'-]*\\s*[）)])`);
}

function normalizeClozeBlankMarkers(text, questions) {
  let source = String(text || '');
  const numbers = questionNumbers(questions);
  numbers.forEach((number) => {
    const bareRegex = hintedBareBlankRegex(number);
    if (!bareRegex.test(source)) return;
    const markerRegex = new RegExp(`([A-Za-z])?[_＿]{1,}${number}[_＿]{1,}(?:\\s*[.．](?=\\s*\\d+%))?`, 'g');
    if (markerRegex.test(source)) {
      source = source.replace(markerRegex, (match, initial) => initial || '');
      source = source.replace(/([A-Za-z])\s{2,}(?=\d+%)/g, '$1 ');
    }
    source = source.replace(hintedBareBlankRegex(number), (match, prefix) => `${prefix}_____${number}_____`);
  });
  return source;
}

function findClozeBlanks(text, questions) {
  const source = String(text || '');
  const allowedNumbers = questionNumbers(questions);
  const found = {};
  const regex = standardBlankRegex();
  let match;
  while ((match = regex.exec(source))) {
    const number = Number(match[2]);
    if (!number || found[number] || (allowedNumbers.size && !allowedNumbers.has(number))) continue;
    found[number] = {
      number,
      initial: match[1] || '',
      start: match.index,
      end: match.index + match[0].length
    };
  }
  return Object.keys(found).map((key) => found[key]).sort((left, right) => left.start - right.start);
}

module.exports = {
  findClozeBlanks,
  normalizeClozeBlankMarkers
};
