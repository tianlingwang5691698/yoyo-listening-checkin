const crypto = require('crypto');

function getCompletionRecordKey(item) {
  return String(item && (item.recordId || item.id || item._id) || '').trim();
}

function getCompletionTimestamp(item) {
  const value = Date.parse(item && (item.updatedAt || item.createdAt) || '');
  return Number.isFinite(value) ? value : 0;
}

function isNewerCompletion(candidate, current) {
  const candidateTime = getCompletionTimestamp(candidate);
  const currentTime = getCompletionTimestamp(current);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return String(candidate && candidate._id || '') > String(current && current._id || '');
}

function dedupeCompletionItems(items) {
  const byKey = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const key = getCompletionRecordKey(item) || `completion-index-${index}`;
    const current = byKey.get(key);
    if (!current || isNewerCompletion(item, current)) byKey.set(key, item);
  });
  return Array.from(byKey.values());
}

function buildCompletionDocumentId(recordId) {
  return `completion-${crypto.createHash('sha256').update(String(recordId || '')).digest('hex').slice(0, 48)}`;
}

module.exports = {
  getCompletionRecordKey,
  dedupeCompletionItems,
  buildCompletionDocumentId
};
