function questionNumbers(questions) {
  return new Set((questions || [])
    .filter((question) => question && question.questionType === 'blank')
    .map((question) => Number(question.number))
    .filter((number) => Number.isInteger(number) && number > 0));
}

function orderedBlankQuestions(questions) {
  const seen = new Set();
  return (questions || []).filter((question) => {
    const number = Number(question && question.number);
    if (!question || question.questionType !== 'blank' || !Number.isInteger(number) || number <= 0 || seen.has(number)) {
      return false;
    }
    seen.add(number);
    return true;
  });
}

function standardBlankRegex() {
  return /([A-Za-z])?[_＿]{1,}(\d{1,3})[_＿]{1,}/g;
}

function hintedBareBlankRegex(number) {
  return new RegExp(`(^|[^\\d_＿])(${number})(?![\\d_＿])(?=\\s*[（(]\\s*[A-Za-z][A-Za-z'-]*\\s*[）)])`);
}

function promptInitial(question) {
  const match = String(question && question.prompt || '').match(/([A-Za-z])[_＿]{1,}\d{1,3}[_＿]{1,}/);
  return match ? match[1].toLowerCase() : '';
}

function normalizeInitialClozeMarkerSequence(text, questions) {
  const expectedQuestions = orderedBlankQuestions(questions);
  const expectedNumbers = expectedQuestions.map((question) => Number(question.number));
  if (expectedNumbers.length < 2 || expectedNumbers.some((number, index) => index > 0 && number <= expectedNumbers[index - 1])) {
    return String(text || '');
  }
  const matches = Array.from(String(text || '').matchAll(standardBlankRegex()));
  if (matches.length !== expectedNumbers.length || matches.some((match) => !match[1])) {
    return String(text || '');
  }
  const promptsAlign = matches.every((match, index) => {
    const initial = promptInitial(expectedQuestions[index]);
    return !initial || initial === String(match[1]).toLowerCase();
  });
  if (!promptsAlign || matches.every((match, index) => Number(match[2]) === expectedNumbers[index])) {
    return String(text || '');
  }
  let cursor = 0;
  return matches.reduce((result, match, index) => {
    const start = Number(match.index || 0);
    const end = start + match[0].length;
    const next = `${match[1]}_____${expectedNumbers[index]}_____`;
    const value = `${result}${String(text || '').slice(cursor, start)}${next}`;
    cursor = end;
    return value;
  }, '') + String(text || '').slice(cursor);
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
  return normalizeInitialClozeMarkerSequence(source, questions);
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
  normalizeClozeBlankMarkers,
  normalizeInitialClozeMarkerSequence
};
