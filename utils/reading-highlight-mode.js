function isAnswerSentenceHighlightExcluded(passage) {
  if (!passage) {
    return false;
  }
  if (passage.isClozePassage || passage.suppressAnswerSentenceHighlight) {
    return true;
  }
  const questions = Array.isArray(passage.questions) ? passage.questions : [];
  const blankPromptCount = questions.filter((question) => (
    /^Blank\s+\d+$/i.test(String((question && question.prompt) || '').trim())
  )).length;
  const metadata = [
    passage.title,
    passage.section,
    passage.sectionLabel,
    passage.directions
  ].filter(Boolean).join(' ');
  const source = String(passage.passage || '');
  const hasFillInCue = /完形|首字母|选词填空|语法填空|填空|cloze|fill in|complete the passage|grammar[\s-]+(?:and[\s-]+)?vocabulary[\s-]+(?:section[\s-]+)?[ab]\b/i.test(metadata);
  const hasInlineNumberedBlank = /(?:\(\s*\d{1,3}\s*\)\s*[_＿]{2,}|[_＿]{2,}\s*\d{1,3}\s*[_＿]{2,})/.test(source);
  const isSeniorReadingCloze = blankPromptCount >= 2 && /\bReading Section A\b/i.test(metadata);
  return hasFillInCue
    || isSeniorReadingCloze
    || (blankPromptCount > 0 && hasInlineNumberedBlank);
}

function canHighlightReadingAnswers(passage) {
  if (passage && typeof passage.canHighlightAnswers === 'boolean') {
    return passage.canHighlightAnswers;
  }
  return !isAnswerSentenceHighlightExcluded(passage);
}

function resolveReadingHighlightMode(passage, mode) {
  const requestedMode = String(mode || 'none');
  if (!canHighlightReadingAnswers(passage) && requestedMode === 'answer') {
    return 'none';
  }
  return requestedMode;
}

module.exports = {
  isAnswerSentenceHighlightExcluded,
  canHighlightReadingAnswers,
  resolveReadingHighlightMode
};
