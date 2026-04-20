const shared = require('../services/shared.service');

async function refreshRuntimeCatalogs(force, categories) {
  return undefined;
}

function getResourceDebugSnapshot() {
  return shared.getResourceDebugSnapshot();
}

module.exports = {
  refreshRuntimeCatalogs,
  getResourceDebugSnapshot
};
