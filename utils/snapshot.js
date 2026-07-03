const monitor = require('./monitor');

const DEFAULT_MAX_AGE_MS = 2 * 60 * 1000;

function read(key, options = {}) {
  const startedAt = Date.now();
  const maxAgeMs = Number(options.maxAgeMs || DEFAULT_MAX_AGE_MS);
  const id = String(options.id || '').trim();
  try {
    const snapshot = wx.getStorageSync(key) || null;
    const ageMs = snapshot ? Date.now() - Number(snapshot.savedAt || 0) : 0;
    const expired = !snapshot || ageMs > maxAgeMs;
    const mismatch = !!(id && snapshot && String(snapshot.id || '') !== id);
    monitor.logPerf('snapshot', 'read', Date.now() - startedAt, {
      key,
      hit: snapshot && !expired && !mismatch ? 'yes' : 'no',
      age: snapshot ? ageMs : ''
    });
    if (!snapshot || expired || mismatch) {
      return null;
    }
    return snapshot.data || null;
  } catch (error) {
    monitor.logError('snapshot', 'read', error, { key });
    return null;
  }
}

function write(key, id, data, options = {}) {
  if (!key || !data) return false;
  const startedAt = Date.now();
  try {
    wx.setStorageSync(key, {
      savedAt: Date.now(),
      id: String(id || '').trim(),
      data
    });
    monitor.logPerf('snapshot', 'write', Date.now() - startedAt, {
      key,
      source: options.source || ''
    });
    return true;
  } catch (error) {
    monitor.logError('snapshot', 'write', error, { key });
    return false;
  }
}

module.exports = {
  read,
  write,
  DEFAULT_MAX_AGE_MS
};
