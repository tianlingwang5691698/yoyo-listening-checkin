function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
}

function sanitizeManualMarks(value) {
  const source = value || {};
  return {
    tokenMarks: Object.keys(source.tokenMarks || {}).slice(0, 600).reduce((map, key) => {
      const tone = source.tokenMarks[key];
      if (/^[A-Za-z0-9_.:-]{1,160}:\d+$/.test(key) && (tone === 'word' || tone === 'phrase')) map[key] = tone;
      return map;
    }, {}),
    sentenceMarks: Object.keys(source.sentenceMarks || {}).slice(0, 120).reduce((map, key) => {
      if (/^[A-Za-z0-9_.:-]{1,160}$/.test(key) && source.sentenceMarks[key]) map[key] = true;
      return map;
    }, {}),
    items: (Array.isArray(source.items) ? source.items : []).slice(0, 120).map((item) => ({
      type: ['word', 'phrase', 'sentence'].includes(item && item.type) ? item.type : 'word',
      text: normalizeText(item && item.text).slice(0, 500)
    })).filter((item) => item.text)
  };
}

module.exports = { sanitizeManualMarks };
