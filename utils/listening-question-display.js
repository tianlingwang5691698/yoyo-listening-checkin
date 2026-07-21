function stripRepeatedFormTitle(prompt, formTitle) {
  const text = String(prompt || '').trim();
  const title = String(formTitle || '').trim();
  if (!title || !text.startsWith(title)) return text;
  return text.slice(title.length).trim();
}

function stripRepeatedQuestionTitles(prompt, formTitle, groupTitle) {
  const text = stripRepeatedFormTitle(prompt, formTitle);
  const group = String(groupTitle || '').trim();
  return group && text.toLowerCase() === group.toLowerCase() ? '' : text;
}

module.exports = {
  stripRepeatedFormTitle,
  stripRepeatedQuestionTitles
};
