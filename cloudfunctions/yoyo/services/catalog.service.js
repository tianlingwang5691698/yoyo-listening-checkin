const shared = require('./shared.service');

function getResourceDebugSnapshot() {
  return shared.getResourceDebugSnapshot();
}

module.exports = {
  getResourceDebugSnapshot
};
