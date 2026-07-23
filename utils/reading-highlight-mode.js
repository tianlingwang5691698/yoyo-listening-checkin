function canHighlightReadingAnswers(passage) {
  return !(passage && passage.isClozePassage);
}

function resolveReadingHighlightMode(passage, mode) {
  const requestedMode = String(mode || 'none');
  if (!canHighlightReadingAnswers(passage) && requestedMode === 'answer') {
    return 'none';
  }
  return requestedMode;
}

module.exports = {
  canHighlightReadingAnswers,
  resolveReadingHighlightMode
};
