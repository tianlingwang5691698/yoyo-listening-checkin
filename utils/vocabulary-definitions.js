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

const OCR_MEANING_CORRECTIONS = {
  'adj. 自由幽，空闲的；免费的': 'adj. 自由的，空闲的；免费的',
  'adj. 很， 非常 adj.： 惜好的， 正好的': 'adv. 很，非常；adj. 正是的，恰好的',
  'n. 陆地 v. 登陆；（但巨）降落': 'n. 陆地；v. 登陆；降落',
  'adj. 政治的 ｛／ 呵嚣＼必': 'adj. 政治的',
  'n. 周期； 循环 v. 骑自行车， 循环 v. 便循环': 'n. 周期；循环；v. 骑自行车；使循环',
  'n. 思想 v. 介意 annoy': 'n. 思想；v. 介意',
  'v. 宣布， 声明；断言；申报（应纳税局）': 'v. 宣布，声明；断言；申报（应纳税额）',
  'n. 等级；（申小学的）学军；成绩， 分数': 'n. 等级；（中小学的）学年；成绩，分数',
  'adj. 任何地晴都不；无处': 'adv. 任何地方都不；无处',
  'adj. 很少， 不常': 'adv. 很少，不常',
  'v. 需要 modal v. 必须 n. 需要， 需求': 'v. 需要；modal v. 必须；n. 需要，需求',
  'n. 斑点， 污点；场所， 地点 v. ( spotted,': 'n. 斑点，污点；场所，地点；v. 弄脏；认出，发现',
  'adj. 不管怎样': 'adv. 不管怎样',
  'n. 挑战；挑战性 v. 挑战': 'n. 挑战；挑战性；v. 挑战',
  'v. 便确信，使信服': 'v. 使确信，使信服',
  'v. 使震惊 n. 震动， 冲击': 'v. 使震惊；n. 震动，冲击',
  'a呻． 不公平的， 不公正的': 'adj. 不公平的，不公正的',
  'prep. 在· ·上； 在… 时候； 在·· 地万；关于 adj. 继续': 'prep. 在…上；在…时候；在…地方；关于；adv. 继续'
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function correctOcrMeaning(value) {
  const meaning = clean(value);
  if (OCR_MEANING_CORRECTIONS[meaning]) return OCR_MEANING_CORRECTIONS[meaning];
  const compact = meaning.replace(/\s*([，；：,.;:])\s*/g, '$1');
  const matched = Object.keys(OCR_MEANING_CORRECTIONS).find((key) => key.replace(/\s*([，；：,.;:])\s*/g, '$1') === compact);
  return matched ? OCR_MEANING_CORRECTIONS[matched] : meaning;
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
  let lastGroup = null;
  const corrected = correctOcrMeaning((Array.isArray(definitions) ? definitions : []).map(clean).filter(Boolean).join('；'));
  corrected.split('；').forEach((value) => {
    const definition = clean(value);
    if (!definition) return;
    const parsed = parseDefinition(definition);
    if (!parsed) {
      if (lastGroup) {
        if (!lastGroup.meanings.includes(definition)) lastGroup.meanings.push(definition);
      } else if (!loose.includes(definition)) {
        loose.push(definition);
      }
      return;
    }
    let group = groupMap[parsed.label];
    if (!group) {
      group = { label: parsed.label, meanings: [] };
      groupMap[parsed.label] = group;
      groups.push(group);
    }
    if (!group.meanings.includes(parsed.meaning)) group.meanings.push(parsed.meaning);
    lastGroup = group;
  });
  return groups.map((group) => `${group.label} ${group.meanings.join('；')}`).concat(loose).join('；');
}

function formatVocabularyMeaning(value) {
  const meaning = correctOcrMeaning(value);
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
  normalizePos,
  correctOcrMeaning
};
