const POS_LABELS = {
  n: 'n.',
  noun: 'n.',
  v: 'v.',
  verb: 'v.',
  adj: 'adj.',
  adjective: 'adj.',
  adv: 'adv.',
  adverb: 'adv.',
  prep: 'prep.',
  preposition: 'prep.',
  conj: 'conj.',
  conjunction: 'conj.',
  pron: 'pron.',
  pronoun: 'pron.',
  det: 'det.',
  determiner: 'det.',
  num: 'num.',
  numeral: 'num.',
  phr: 'phr.',
  phrase: 'phr.',
  nphr: 'n. phr.',
  nounphrase: 'n. phr.',
  vphr: 'v. phr.',
  verbphrase: 'v. phr.',
  phrasalverb: 'v. phr.',
  phrverb: 'v. phr.',
  adjphr: 'adj. phr.',
  adjectivephrase: 'adj. phr.',
  advphr: 'adv. phr.',
  adverbphrase: 'adv. phr.',
  prepphr: 'prep. phr.',
  prepositionalphrase: 'prep. phr.',
  conjphr: 'conj. phr.',
  conjunctionphrase: 'conj. phr.'
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSinglePos(value) {
  const key = clean(value).toLowerCase().replace(/[.\s-]+/g, '');
  return POS_LABELS[key] || '';
}

function normalizePos(value) {
  const parts = clean(value).split('/').map(normalizeSinglePos).filter(Boolean);
  if (!parts.length || parts.length !== clean(value).split('/').length) return '';
  return parts.join('/');
}

function parseDefinition(value) {
  const definition = clean(value);
  const meaningStart = definition.search(/[\u3400-\u9fff]/);
  if (meaningStart <= 0) return null;
  const label = normalizePos(definition.slice(0, meaningStart));
  const meaning = clean(definition.slice(meaningStart));
  return label && meaning ? { label, meaning } : null;
}

function formatVocabularyDefinitions(definitions) {
  const groups = [];
  const groupMap = {};
  const loose = [];
  (Array.isArray(definitions) ? definitions : []).forEach((value) => {
    const definition = clean(value);
    if (!definition) return;
    const parsed = parseDefinition(definition);
    if (!parsed) {
      if (!loose.includes(definition)) loose.push(definition);
      return;
    }
    let group = groupMap[parsed.label];
    if (!group) {
      group = { label: parsed.label, meanings: [] };
      groupMap[parsed.label] = group;
      groups.push(group);
    }
    if (!group.meanings.includes(parsed.meaning)) group.meanings.push(parsed.meaning);
  });
  return groups.map((group) => `${group.label} ${group.meanings.join('；')}`).concat(loose).join('；');
}

function formatVocabularyMeaning(value) {
  const meaning = clean(value);
  if (!meaning) return '';
  const definitions = [];
  meaning.split('；').forEach((part) => {
    const item = clean(part);
    if (!item) return;
    if (parseDefinition(item) || !definitions.length) definitions.push(item);
    else definitions[definitions.length - 1] = `${definitions[definitions.length - 1]}；${item}`;
  });
  return formatVocabularyDefinitions(definitions);
}

module.exports = {
  formatVocabularyDefinitions,
  formatVocabularyMeaning,
  normalizePos
};
