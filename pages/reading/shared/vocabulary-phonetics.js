const ieltsData = require('./ielts-phonetics-v2');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isIeltsSource(sourceId) {
  return /^(?:dictionary-book-)?ielts(?:-list-\d+)?$/.test(String(sourceId || '').toLowerCase());
}

function resolveVocabularyEntry(sourceId, word, phonetic) {
  const originalWord = clean(word);
  if (!isIeltsSource(sourceId)) return { word: originalWord, phonetic: clean(phonetic) };
  const correctedWord = ieltsData.headwordCorrections[originalWord.toLowerCase()] || originalWord;
  return {
    word: correctedWord,
    phonetic: ieltsData.phonetics[correctedWord.toLowerCase()] || ''
  };
}

module.exports = { isIeltsSource, resolveVocabularyEntry };
