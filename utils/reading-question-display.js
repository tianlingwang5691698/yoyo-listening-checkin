function splitReadingNotePrompt(prompt, groupInstruction) {
  const text = String(prompt || '').trim();
  if (!/complete the notes below/i.test(String(groupInstruction || ''))) {
    return { heading: '', prompt: text };
  }
  const match = text.match(/^([^:]{2,90}):\s*(.+)$/);
  if (!match) return { heading: '', prompt: text };
  return { heading: match[1].trim(), prompt: match[2].trim() };
}

function formatReadingQuestionRange(groupKey) {
  const match = String(groupKey || '').match(/questions?-(\d+)-(\d+)/i);
  return match ? `Questions ${match[1]}-${match[2]}` : '';
}

module.exports = {
  splitReadingNotePrompt,
  formatReadingQuestionRange
};
