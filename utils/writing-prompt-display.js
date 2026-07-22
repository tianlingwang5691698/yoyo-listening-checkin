function cleanPromptText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function splitExplicitRequirements(value) {
  const normalized = String(value || '')
    .replace(/\r/g, '\n')
    .replace(/(?:^|\s)[*●•▪◦]​?\s*/g, '\n')
    .replace(/(?:^|\s)(?:\d+[.、）)]|[（(][一-十\d]+[）)])\s*/g, '\n');
  return normalized.split(/\n+/).map(cleanPromptText).filter(Boolean);
}

function stripJuniorSource(value) {
  return cleanPromptText(value)
    .replace(/\s*\[来源\s*:[^\]]+\]\s*/gi, ' ')
    .replace(/\s*(?:[上海市]?[\u3400-\u9fff、·]+区|[\u3400-\u9fff]+县)\s*\d{4}\s*[~～—-]\s*\d{4}年[^]*$/i, '')
    .replace(/\s*[上海市]?[\u3400-\u9fff、·]+区\d{4}年[^]*$/i, '')
    .replace(/(?:\s+_){5,}[^]*$/g, '')
    .trim();
}

function extractNotices(value) {
  const notices = [];
  const body = String(value || '').replace(/[（(]\s*注意\s*[:：][^）)]*[）)]/g, (match) => {
    const notice = cleanPromptText(match.replace(/^[（(]\s*|\s*[）)]$/g, ''));
    if (notice && !notices.includes(notice)) notices.push(notice);
    return ' ';
  });
  return { body: cleanPromptText(body), notices };
}

function splitReferenceQuestions(value) {
  const numbered = splitExplicitRequirements(value);
  if (numbered.length > 1) return numbered;
  const questions = String(value || '').match(/[^?？]+[?？](?:\s*\([^)]*\))?/g);
  if (questions && questions.length > 1) return questions.map((item) => cleanPromptText(item).replace(/^[*＊]​?\s*/, '')).filter(Boolean);
  return numbered;
}

function buildPromptDisplay(prompt, labels) {
  const copy = labels || {};
  const raw = stripJuniorSource(prompt && prompt.prompt);
  if (!raw) return { directions: '', scenario: '', scenarioTitle: '', requirementsTitle: '', requirements: [], notices: [], noticeTitle: '', promptTable: null, promptStarter: '' };
  const directionsMatch = raw.match(/^Directions\s*:\s*[^\u3400-\u9fff]*(?=[\u3400-\u9fff])/i);
  const directions = cleanPromptText((prompt && prompt.directions) || (directionsMatch && directionsMatch[0]));
  const extracted = extractNotices(directionsMatch ? raw.slice(directionsMatch[0].length) : raw);
  const body = extracted.body.replace(/^\s*[:：]?\s*(?:VII\.?\s*Writing\s*[:：]?)?\s*(?:[（(]共?\s*\d+\s*分[）)])?\s*\d{1,3}\s*[.．]​?\s*/i, '');
  let scenario = cleanPromptText(prompt && prompt.scenario);
  let requirementsTitle = cleanPromptText(prompt && prompt.requirementsTitle);
  let requirements = Array.isArray(prompt && prompt.requirements) ? prompt.requirements.map(cleanPromptText).filter(Boolean) : [];
  if (!scenario) {
    const contentMarker = body.match(/(?:信的)?内容(?:必须)?包括(?:如下)?\s*[:：]/);
    const referenceMarker = body.match(/(?:Use\s+the\s+following\s+points?(?:\s+as|\s+for)?\s+(?:a\s+)?reference\.?(?:\s*[（(][^）)]*[）)])?|The\s+following\s+is\s+only\s+for\s+reference\.?(?:\s*[（(][^）)]*[）)])?|Some\s+words\s+for\s+reference(?:\s*[（(][^）)]*[）)])?)/i)
      || body.match(/(?:以下(?:问题|内容|提示)[^：:]*仅供参考[.。）)]*|提示(?:供参考)?\s*[:：])/i);
    const marker = contentMarker || referenceMarker;
    if (marker) {
      scenario = cleanPromptText(body.slice(0, marker.index));
      requirementsTitle = requirementsTitle || (contentMarker ? cleanPromptText(marker[0]) : copy.referenceTitle || '参考问题');
      if (!requirements.length) requirements = splitReferenceQuestions(body.slice(marker.index + marker[0].length));
    } else {
      scenario = cleanPromptText(body);
    }
  }
  return {
    directions,
    scenario,
    scenarioTitle: scenario ? (copy.taskTitle || '写作任务') : '',
    requirementsTitle: requirements.length ? (requirementsTitle || copy.requirementsTitle || '写作要点') : '',
    requirements,
    notices: extracted.notices,
    noticeTitle: extracted.notices.length ? (copy.noticeTitle || '注意事项') : '',
    promptTable: prompt && prompt.promptTable && Array.isArray(prompt.promptTable.headers) && Array.isArray(prompt.promptTable.rows) ? prompt.promptTable : null,
    promptStarter: cleanPromptText(prompt && prompt.promptStarter)
  };
}

module.exports = { buildPromptDisplay, cleanPromptText };
