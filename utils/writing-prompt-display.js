const SUMMARY_WRITING_STRUCTURE = require('../data/summary-writing-legacy-structure.json');

function cleanPromptText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\.{4,}|_{5,}|(?:\s+_){4,}/g, ' ')
    .replace(/．{2,}/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function summaryWords(value) {
  const words = [];
  const pattern = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g;
  let match = pattern.exec(String(value || ''));
  while (match) {
    words.push({
      value: match[0].toLowerCase().replace(/’/g, "'"),
      index: match.index
    });
    match = pattern.exec(String(value || ''));
  }
  return words;
}

function findSummaryAnchor(words, anchor, fromIndex) {
  const target = summaryWords(anchor).map((item) => item.value);
  for (let index = fromIndex; index <= words.length - target.length; index += 1) {
    if (target.every((value, offset) => words[index + offset].value === value)) return index;
  }
  return -1;
}

function cleanLegacySummaryScenario(value, articleTitle) {
  let scenario = String(value || '')
    .replace(/[（(]?\s*https?:\/\/\S+/gi, ' ')
    .replace(/第\s*\d+\s*页\s*[（(]?\s*共\s*\d+\s*页\s*[）)]?/g, ' ')
    .replace(/\s+\d{1,3}\s*[.．]\s*(?:[_＿-]+\s*)*$/g, ' ')
    .replace(/\s*(?:\d{1,3}\s*[.．]\s*)?(?:[_＿-]{2,}\s*)+$/g, ' ');
  scenario = cleanPromptText(scenario);
  if (articleTitle && scenario.startsWith(articleTitle)) {
    scenario = cleanPromptText(scenario.slice(articleTitle.length));
  }
  return scenario;
}

function restoreSummaryStructure(prompt, scenario) {
  const directParagraphs = Array.isArray(prompt && prompt.articleParagraphs)
    ? prompt.articleParagraphs.map(cleanPromptText).filter(Boolean)
    : [];
  if (directParagraphs.length) {
    return {
      articleTitle: cleanPromptText(prompt.articleTitle),
      articleParagraphs: directParagraphs,
      scenario: directParagraphs.join('\n\n')
    };
  }
  const structure = SUMMARY_WRITING_STRUCTURE[String(prompt && prompt._id || '')];
  if (!structure) return { articleTitle: '', articleParagraphs: [], scenario };
  const articleTitle = cleanPromptText(structure.articleTitle);
  const cleaned = cleanLegacySummaryScenario(scenario, articleTitle);
  const words = summaryWords(cleaned);
  const starts = [];
  let wordIndex = 0;
  for (const anchor of structure.paragraphAnchors || []) {
    const nextIndex = findSummaryAnchor(words, anchor, wordIndex);
    if (nextIndex < 0) return { articleTitle, articleParagraphs: [cleaned], scenario: cleaned };
    starts.push(words[nextIndex].index);
    wordIndex = nextIndex + summaryWords(anchor).length;
  }
  const articleParagraphs = starts.map((start, index) => cleanPromptText(
    cleaned.slice(start, index + 1 < starts.length ? starts[index + 1] : cleaned.length)
  )).filter(Boolean);
  return {
    articleTitle,
    articleParagraphs,
    scenario: articleParagraphs.join('\n\n')
  };
}

function splitExplicitRequirements(value) {
  const normalized = String(value || '')
    .replace(/\r/g, '\n')
    .replace(/(?:^|\s)[*＊●•▪◦√☺☐]​?\s*/g, '\n')
    .replace(/(?:^|\s)(?:\d+[.、）)]|[（(][一-十\d]+[）)])\s*/g, '\n');
  return normalized.split(/\n+/).map(cleanPromptText).filter(Boolean);
}

function stripJuniorSource(value) {
  return cleanPromptText(value)
    .replace(/\s*【分析】[^]*$/i, '')
    .replace(/\s*\d+\s*[-–]\s*\d+\s+[A-F]{4,}(?:\s|$)[^]*$/i, '')
    .replace(/\s*eq\s+\\o\\ac\([^]*$/i, '')
    .replace(/\s+A[.)、]\s*[^]{0,90}?\s+B[.)、]\s*[^]{0,90}?\s+C[.)、]\s*[^]{0,90}?\s+D[.)、]\s*[^]{0,90}?\s+E[.)、]\s*[^]*$/i, '')
    .replace(/\s+A[.)、]\s*[^]{0,70}?\s+B[.)、]\s*[^]{0,70}?\s+C[.)、]\s*[^]{0,70}?\s+D[.)、]\s*[^]{0,70}?\s+A[.)、]\s*[^]*$/i, '')
    .replace(/\s+A\s+B\s+B\s+C\s+C\s+D\s+E\s+E\s+F\s+F\s+G\s+G[^]*$/i, '')
    .replace(/\s*\[来源\s*:[^\]]+\]\s*/gi, ' ')
    .replace(/\s*(?:[上海市]?[\u3400-\u9fff、·]+区|[\u3400-\u9fff]+县)\s*\d{4}\s*[~～—-]\s*\d{4}年[^]*$/i, '')
    .replace(/\s*[上海市]?[\u3400-\u9fff、·]+区\d{4}年[^]*$/i, '')
    .replace(/\s*(?:[\u3400-\u9fff、]+区\s*)?\d{4}\s*(?:[~～—-]\s*\d{4})?\s*(?:学年|年度|年)[^]{0,80}?(?:学业质量|质量调研|调研试卷|试卷解析|初三英语|九年级英语|英语学科试卷)[^]*$/i, '')
    .replace(/\s*第\s*\d+\s*页\s*\/\s*共\s*\d+\s*页[^]*$/i, '')
    .trim();
}

const STRONG_REFERENCE_MARKER = /(?:Suggested\s+(?:questions?|points?)\s*[:：]?|Use\s+(?:the\s+)?following(?:\s+(?:questions?|points?))?(?:\s+(?:as|for)\s+(?:a\s+)?(?:guide|reference)|\s+to\s+help\s+you)?\s*[:：.]?(?:\s*[（(][^）)]*[）)])?|Questions?\s+for\s+reference\s*[:：]?(?:\s*[（(][^）)]*[）)])?|Points?\s+for\s+reference\s*[:：]?|Words?\s+and\s+patterns?\s+for\s+reference\s*[:：]?(?:\s*[（(][^）)]*[）)])?|The\s+following(?:\s+questions?)?\s+(?:is|are)\s+(?:for\s+reference(?:\s+only)?|reference\s+only)\s*[:：.]?(?:\s*[（(][^）)]*[）)])?|Some\s+words\s+for\s+reference(?:\s*[（(][^）)]*[）)])?)/i;

const REFERENCE_MARKER = /(?:以下(?:问题|内容|提示|表达)[^：:]*供参考\s*[:：.。）)]*|参考(?:问题|短语|词汇|表达)\s*[:：]|(?:友情)?提示(?:供参考)?\s*[:：])/i;

const REQUIREMENT_MARKER = /(?:(?:邮件|短信|报告|演讲稿|意见|作文|短文|信|文中)?[须需](?:包含|包括)|(?:文章|报告|邮件|短信|演讲稿|意见|作文|短文|信|文中)(?:内容)?(?:必须)?(?:可以)?包含(?:以下内容|以下几个问题)?|内容包括|写作要点|下列三大点)\s*[:：]?/i;

const LEGACY_REQUIREMENTS = {
  'sh-autumn-2009-writing': [
    '你感兴趣的课程',
    '你期望从这门课程中学到什么',
    '为什么想学这些内容'
  ]
};

function nextSectionIndex(value, offset) {
  const tail = value.slice(offset);
  const indexes = [STRONG_REFERENCE_MARKER, REFERENCE_MARKER, REQUIREMENT_MARKER, /(?:你可以这样开始|You\s+can\s+begin\s+like\s+this)\s*[:：]/i, /(?:^|\s)(?:Dear|Hello)\s+[A-Z][A-Za-z]*/].map((pattern) => {
    const match = tail.match(pattern);
    return match ? offset + match.index : -1;
  }).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : value.length;
}

function extractNotices(value) {
  const notices = [];
  let body = String(value || '');
  let match = body.match(/[（(]?\s*注意\s*[:：，,]\s*/);
  while (match) {
    const start = match.index;
    const contentStart = start + match[0].length;
    let end = nextSectionIndex(body, contentStart);
    const closing = body.indexOf('）', contentStart);
    if (closing >= 0 && closing < end && closing - contentStart < 420) end = closing + 1;
    const notice = cleanPromptText(body.slice(start, end).replace(/^[（(]\s*|\s*[）)]$/g, ''));
    if (notice && !notices.includes(notice)) notices.push(notice);
    body = `${body.slice(0, start)} ${body.slice(end)}`;
    match = body.match(/[（(]?\s*注意\s*[:：，,]\s*/);
  }
  body = body.replace(/(?:短文中|文中|信中|演讲稿中)?不得出现[^]*?否则不予评分[.。）)]?/g, (item) => {
    const notice = cleanPromptText(item);
    if (notice && !notices.includes(notice)) notices.push(notice);
    return ' ';
  });
  body = body.replace(/说明\s*[:：]\s*((?:短文中|文中|信中)[^]*?不得出现[^]*?(?:。|$))/g, (item) => {
    const notice = cleanPromptText(item);
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

function stripPromptHeading(value) {
  return cleanPromptText(value)
    .replace(/^\s*[:：]?\s*(?:[（(]本大题共\s*\d+题[^）)]*[）)])?\s*(?:(?:VII|Ⅶ)\.?\s*Writing\s*[.:：*]?(?:\s*[（(](?:写作|作文)?\s*[）)])?)?\s*(?:[（(](?:写作|作文)?\s*(?:共?\s*)?\d+\s*(?:分|%)[）)])?\s*(?:\d{1,3}\s*[.．]​?\s*)?/i, '')
    .replace(/^\s*Writing\s*[（(](?:写作|作文)[）)]\s*[（(]共?\s*\d+\s*分[）)]\s*(?:\d{1,3}\s*[.．])?\s*/i, '')
    .replace(/^\s*[（(]共?\s*\d+\s*分[）)]\s*/i, '')
    .trim();
}

function buildPromptDisplay(prompt, labels) {
  const copy = labels || {};
  const raw = stripJuniorSource(prompt && prompt.prompt);
  if (!raw) return { directions: '', scenario: '', articleTitle: '', articleParagraphs: [], scenarioTitle: '', requirementsTitle: '', requirements: [], notices: [], noticeTitle: '', promptTable: null, promptStarter: '' };
  const headingCleaned = stripPromptHeading(raw);
  const directionsMatch = headingCleaned.match(/^Directions\s*:\s*[^\u3400-\u9fff]*(?=[\u3400-\u9fff])/i);
  const directions = cleanPromptText((prompt && prompt.directions) || (directionsMatch && directionsMatch[0]));
  const extracted = extractNotices(directionsMatch ? headingCleaned.slice(directionsMatch[0].length) : headingCleaned);
  const body = extracted.body;
  let scenario = stripPromptHeading(prompt && prompt.scenario);
  if (directionsMatch && scenario.startsWith(directionsMatch[0])) scenario = cleanPromptText(scenario.slice(directionsMatch[0].length));
  let requirementsTitle = cleanPromptText(prompt && prompt.requirementsTitle);
  let requirements = Array.isArray(prompt && prompt.requirements) ? prompt.requirements.map(cleanPromptText).filter(Boolean) : [];
  if (!scenario) {
    const contentMarker = body.match(REQUIREMENT_MARKER);
    const strongReferenceMarker = body.match(STRONG_REFERENCE_MARKER);
    const referenceMarker = strongReferenceMarker || body.match(REFERENCE_MARKER);
    const marker = strongReferenceMarker || contentMarker || referenceMarker;
    if (marker) {
      scenario = cleanPromptText(body.slice(0, marker.index));
      requirementsTitle = requirementsTitle || (marker === contentMarker ? cleanPromptText(marker[0]) : copy.referenceTitle || '参考问题');
      if (!requirements.length) requirements = splitReferenceQuestions(body.slice(marker.index + marker[0].length));
    } else {
      scenario = cleanPromptText(body);
    }
  }
  const legacy = LEGACY_REQUIREMENTS[String(prompt && prompt._id || '')] || [];
  if (legacy.length && requirements.length < 2) requirements = legacy.slice();
  if (legacy.length) {
    const firstPointIndex = scenario.indexOf(legacy[0]);
    if (firstPointIndex >= 0) scenario = cleanPromptText(scenario.slice(0, firstPointIndex));
  }
  scenario = scenario
    .replace(/(?:信息)?提示\s*[:：]\s*/g, '')
    .replace(/[，,]?\s*(?:内容包括|内容必须包括)\s*[:：]\s*$/i, '')
    .trim();
  const summary = String(prompt && prompt.contentType || '') === 'summary-writing'
    ? restoreSummaryStructure(prompt, scenario)
    : { articleTitle: '', articleParagraphs: [], scenario };
  scenario = summary.scenario;
  return {
    directions,
    scenario,
    articleTitle: summary.articleTitle,
    articleParagraphs: summary.articleParagraphs,
    scenarioTitle: scenario ? (copy.taskTitle || '写作任务') : '',
    requirementsTitle: requirements.length ? (requirementsTitle || copy.requirementsTitle || '写作要点') : '',
    requirements: requirements.map((item) => cleanPromptText(item)
      .replace(STRONG_REFERENCE_MARKER, '')
      .replace(REFERENCE_MARKER, '')
      .replace(/^[（(]?以下(?:问题|内容|表达)?仅?供参考[）)]?[.:：]?\s*/i, '')
      .replace(/^[☐☺√]+\s*/, '')
      .trim()).filter(Boolean),
    notices: extracted.notices,
    noticeTitle: extracted.notices.length ? (copy.noticeTitle || '注意事项') : '',
    promptTable: prompt && prompt.promptTable && Array.isArray(prompt.promptTable.headers) && Array.isArray(prompt.promptTable.rows) ? prompt.promptTable : null,
    promptStarter: cleanPromptText(prompt && prompt.promptStarter)
  };
}

module.exports = { buildPromptDisplay, cleanPromptText };
