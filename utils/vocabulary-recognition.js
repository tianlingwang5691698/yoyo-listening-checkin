function normalizeMeaning(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function meaningKey(value) {
  return normalizeMeaning(value)
    .replace(/\b(?:modal\s+v|n|v|vt|vi|adj|adv|prep|conj|pron|det|num|art|phr)\s*[.．]/gi, '')
    .replace(/[\s，。；：,.;:()（）/]/g, '')
    .toLowerCase();
}

function extractPartOfSpeech(value) {
  const match = normalizeMeaning(value).match(/^(modal\s+v|n|v|vt|vi|adj|adv|prep|conj|pron|det|num|art|phr)\s*[.．]/i);
  if (!match) return '';
  const part = match[1].toLowerCase().replace(/\s+/g, ' ');
  if (part === 'modal v') return 'modal';
  return part === 'vt' || part === 'vi' ? 'v' : part;
}

function characterOverlap(left, right) {
  const a = new Set(meaningKey(left).split(''));
  const b = new Set(meaningKey(right).split(''));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((item) => { if (b.has(item)) shared += 1; });
  return shared / Math.min(a.size, b.size);
}

const SEMANTIC_EQUIVALENT_GROUPS = [
  ['地方', '地点', '场所']
];
const UNSUITABLE_DISTRACTOR_PAIRS = new Set([
  'bit|spot'
]);

let distractorAuditData = {};
try {
  distractorAuditData = require('./vocabulary-distractor-audit-data');
} catch (error) {}

function hasSemanticOverlap(left, right) {
  const leftText = normalizeMeaning(left);
  const rightText = normalizeMeaning(right);
  return SEMANTIC_EQUIVALENT_GROUPS.some((group) => group.some((item) => leftText.includes(item)) && group.some((item) => rightText.includes(item)));
}

function wordKey(value) {
  return String((value && (value.word || value.key)) || '').trim().toLowerCase();
}

const sourceAuditCache = {};

function sourceAudit(sourceId) {
  const key = String(sourceId || '');
  if (sourceAuditCache[key]) return sourceAuditCache[key];
  const raw = distractorAuditData[key] || {};
  sourceAuditCache[key] = {
    excludedWords: raw.excludedWords || [],
    excludedWordSet: new Set(raw.excludedWords || []),
    blockedPairs: raw.blockedPairs || [],
    blockedPairSet: new Set(raw.blockedPairs || []),
    posOverrides: raw.posOverrides || {}
  };
  return sourceAuditCache[key];
}

function isRecognitionTargetAllowed(item, sourceId) {
  return !sourceAudit(sourceId || (item && item.sourceId)).excludedWordSet.has(wordKey(item));
}

function isBlockedDistractorPair(left, right, sourceId) {
  const keys = [left, right].map((item) => String((item && (item.word || item.key)) || '').toLowerCase()).filter(Boolean).sort();
  if (keys.length !== 2) return false;
  const signature = keys.join('|');
  return UNSUITABLE_DISTRACTOR_PAIRS.has(signature) || sourceAudit(sourceId).blockedPairSet.has(signature);
}

function shuffled(items, random = Math.random) {
  const rows = (items || []).slice();
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = rows[index];
    rows[index] = rows[swapIndex];
    rows[swapIndex] = current;
  }
  return rows;
}

function distractorSignature(items) {
  return (items || []).map((item) => String(item.key)).sort().join('|');
}

function chooseDistractors(candidates, usage, previousKeys, usedSignatures) {
  const previous = new Set(previousKeys || []);
  const ranked = (candidates || []).slice().sort((left, right) => Number(usage[left.key] || 0) - Number(usage[right.key] || 0)
    || Number(previous.has(left.key)) - Number(previous.has(right.key))
    || right.score - left.score
    || String(left.key).localeCompare(String(right.key)));
  let best = null;
  const search = ranked.slice(0, Math.min(18, ranked.length));
  for (let first = 0; first < search.length - 2; first += 1) {
    for (let second = first + 1; second < search.length - 1; second += 1) {
      for (let third = second + 1; third < search.length; third += 1) {
        const items = [search[first], search[second], search[third]];
        const signature = distractorSignature(items);
        if (usedSignatures && usedSignatures.has(signature)) continue;
        const previousOverlap = items.reduce((sum, item) => sum + (previous.has(item.key) ? 1 : 0), 0);
        const usedItems = items.reduce((sum, item) => sum + (Number(usage[item.key] || 0) ? 1 : 0), 0);
        const usageTotal = items.reduce((sum, item) => sum + Number(usage[item.key] || 0), 0);
        const quality = items.reduce((sum, item) => sum + item.score, 0);
        const rank = [usedItems, usageTotal, previousOverlap, -quality, signature];
        if (!best || rank.some((value, index) => value < best.rank[index] && rank.slice(0, index).every((item, rankIndex) => item === best.rank[rankIndex]))) {
          best = { items, rank };
        }
      }
    }
  }
  return best ? best.items : [];
}

function buildMeaningOptions(cards, target, random = Math.random, context = {}) {
  if (!target || !normalizeMeaning(target.meaning)) return [];
  const audit = sourceAudit(context.sourceId || target.sourceId);
  const excludedWords = audit.excludedWordSet;
  if (excludedWords.has(wordKey(target))) return [];
  const correctKey = meaningKey(target.meaning);
  const posOverrides = audit.posOverrides || {};
  const targetPart = posOverrides[wordKey(target)] || extractPartOfSpeech(target.meaning);
  const targetLength = correctKey.length || 1;
  const seen = new Set([correctKey]);
  const seenWords = new Set([wordKey(target)]);
  const candidates = [];
  (cards || []).forEach((item) => {
    if (!item || item.key === target.key) return;
    const candidateWord = wordKey(item);
    if (!candidateWord || seenWords.has(candidateWord) || excludedWords.has(candidateWord)) return;
    const key = meaningKey(item.meaning);
    if (!key || seen.has(key)) return;
    seen.add(key);
    seenWords.add(candidateWord);
    const overlap = characterOverlap(target.meaning, item.meaning);
    if (overlap >= 0.5 || hasSemanticOverlap(target.meaning, item.meaning) || isBlockedDistractorPair(target, item, context.sourceId || target.sourceId)) return;
    const length = key.length || 1;
    const ratio = Math.min(length, targetLength) / Math.max(length, targetLength);
    const part = posOverrides[wordKey(item)] || extractPartOfSpeech(item.meaning);
    candidates.push({
      key: item.key,
      text: normalizeMeaning(item.meaning),
      partMatch: !!(targetPart && part && targetPart === part),
      score: (targetPart && part && targetPart === part ? 2 : 0) + ratio - overlap
    });
  });
  const usage = context.usage || {};
  const previousKeys = new Set(context.previousKeys || []);
  const sortCandidates = (left, right) => Number(usage[left.key] || 0) - Number(usage[right.key] || 0)
    || right.score - left.score
    || String(left.key).localeCompare(String(right.key));
  const samePartCandidates = candidates.filter((item) => item.partMatch);
  const unusedCandidates = candidates.filter((item) => !Number(usage[item.key] || 0));
  const unusedSamePartCandidates = unusedCandidates.filter((item) => item.partMatch);
  let optionCandidates = candidates;
  if (unusedSamePartCandidates.length >= 3) optionCandidates = unusedSamePartCandidates;
  else if (unusedCandidates.length >= 3) optionCandidates = unusedCandidates;
  else if (samePartCandidates.length >= 3) optionCandidates = samePartCandidates;
  optionCandidates.sort(sortCandidates);
  let distractors = chooseDistractors(optionCandidates, usage, Array.from(previousKeys), context.usedSignatures);
  if (distractors.length < 3 && optionCandidates !== candidates) {
    candidates.sort(sortCandidates);
    distractors = chooseDistractors(candidates, usage, Array.from(previousKeys), context.usedSignatures);
  }
  if (distractors.length < 3) distractors = optionCandidates.slice(0, 3);
  if (distractors.length < 3) return [];
  return shuffled([
    { key: target.key, text: normalizeMeaning(target.meaning), correct: true },
    ...distractors.map((item) => ({ key: item.key, text: item.text, correct: false }))
  ], random);
}

function buildRecognitionQuestions(cards, count, random = Math.random, context = {}) {
  const targets = shuffled(cards, random);
  const optionCards = Array.isArray(context.optionCards) && context.optionCards.length ? context.optionCards : cards;
  const questions = [];
  const usage = {};
  let previousKeys = [];
  const usedSignatures = new Set();
  for (const target of targets) {
    const options = buildMeaningOptions(optionCards, target, random, {
      usage,
      previousKeys,
      usedSignatures,
      sourceId: context.sourceId || target.sourceId
    });
    if (options.length === 4) {
      const distractorKeys = options.filter((item) => !item.correct).map((item) => item.key);
      distractorKeys.forEach((key) => { usage[key] = Number(usage[key] || 0) + 1; });
      previousKeys = distractorKeys;
      usedSignatures.add(distractorSignature(options.filter((item) => !item.correct)));
      questions.push(Object.assign({}, target, { options }));
    }
    if (questions.length >= Number(count || 0)) break;
  }
  return questions;
}

module.exports = {
  normalizeMeaning,
  extractPartOfSpeech,
  characterOverlap,
  hasSemanticOverlap,
  isBlockedDistractorPair,
  shuffled,
  distractorSignature,
  isRecognitionTargetAllowed,
  buildMeaningOptions,
  buildRecognitionQuestions
};
