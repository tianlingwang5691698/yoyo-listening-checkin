function stringifyMeta(meta) {
  return Object.entries(meta || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

function classifyError(error) {
  const message = String((error && (error.message || error.errMsg)) || error || '').toLowerCase();
  if (!message) {
    return 'unknown';
  }
  if (message.includes('timeout')) {
    return 'timeout';
  }
  if (message.includes('ssl')) {
    return 'ssl';
  }
  if (message.includes('permission') || message.includes('access denied') || message.includes('not support')) {
    return 'permission';
  }
  if (message.includes('cloud') || message.includes('callfunction') || message.includes('functions execute fail')) {
    return 'cloud';
  }
  return 'unknown';
}

function logPerf(scope, name, durationMs, meta) {
  const suffix = stringifyMeta(meta);
  console.log(`[perf][${scope}] ${name} ${durationMs}ms${suffix ? ` ${suffix}` : ''}`);
}

function logError(scope, name, error, meta) {
  const suffix = stringifyMeta(Object.assign({
    type: classifyError(error)
  }, meta || {}));
  const message = String((error && (error.message || error.errMsg)) || error || '');
  console.error(`[monitor][${scope}] ${name}${suffix ? ` ${suffix}` : ''}${message ? ` error=${message}` : ''}`);
}

module.exports = {
  classifyError,
  logPerf,
  logError
};
